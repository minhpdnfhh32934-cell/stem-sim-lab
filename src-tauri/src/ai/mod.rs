//! AI gateway: every LLM call goes through Rust so API keys never reach the web view, CORS is
//! not an issue, and requests have a timeout, can be cancelled, are retried with backoff on
//! 429/5xx and are counted against a daily cap.
//!
//! Providers implement [`provider::AIProvider`]: [`gemini::GeminiProvider`] (default),
//! [`claude::ClaudeProvider`] and [`groq::GroqProvider`]. When the chosen provider runs out of
//! quota or credit, a configured fallback provider answers instead (see [`is_quota_error`]); a
//! provider without a key is never replaced by the fallback.
//!
//! Every answer has the model's reasoning removed ([`reasoning`]) before it reaches the page.
//!
//! A call is registered for `ai_cancel` before anything else ([`InflightGuard`]), so a stop
//! pressed while the gate, the key or the daily cap is being checked is never counted or sent.
//!
//! Language models run by another program on this computer (Ollama, LM Studio, llama.cpp) go
//! through [`local`]: no key, no daily cap, never a cloud fallback.
//!
//! The LLM is only used to (a) extract a problem into a structured SceneSpec and
//! (b) explain results already computed by the engine. It never computes numbers.

pub mod claude;
pub mod gemini;
pub mod groq;
pub mod local;
pub mod provider;
pub mod reasoning;
pub mod tts;
pub mod usage;

use std::collections::HashMap;
use std::future::Future;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::Manager;
use tokio::sync::oneshot;

use provider::AIProvider;

/// The only edition since 0.5.0 (the supervised high-school "pilot" edition was removed at the
/// user's request, 2026-10-12). Still reported by `ai_edition` / `app_info`.
pub const EDITION: &str = "main";

/// Keychain service. Keeps the name from before the rename to SimLab, so saved keys survive.
const KEYRING_SERVICE: &str = "STEM Sim Lab";

/// Default timeout of one AI call, retries included (PROMPT_PHAN_2 A2: 30 s, adjustable).
pub const DEFAULT_TIMEOUT_SECS: u64 = 30;
/// Retries after a 429 or 5xx answer (PROMPT_PHAN_2 A2: at most 3).
pub const MAX_RETRIES: u32 = 3;
/// Longest wait between two attempts, even if the server asks for more.
const MAX_BACKOFF: Duration = Duration::from_secs(8);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    Gemini,
    /// "anthropic" was the id before PROMPT_PHAN_2.
    #[serde(alias = "anthropic")]
    Claude,
    /// Free fallback (GroqCloud, OpenAI-compatible).
    Groq,
}

impl Provider {
    fn key_name(self) -> &'static str {
        match self {
            Provider::Gemini => "gemini",
            Provider::Claude => "claude",
            Provider::Groq => "groq",
        }
    }
}

/// The implementation of a provider.
pub fn provider(p: Provider) -> &'static dyn AIProvider {
    match p {
        Provider::Gemini => &gemini::GeminiProvider,
        Provider::Claude => &claude::ClaudeProvider,
        Provider::Groq => &groq::GroqProvider,
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Message {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest {
    pub request_id: String,
    pub provider: Provider,
    pub model: String,
    pub system: String,
    pub messages: Vec<Message>,
    pub json_schema: Option<Value>,
    pub schema_name: Option<String>,
    /// Used by Gemini and Groq; Claude ignores it (see `claude_body`).
    pub temperature: Option<f64>,
    pub max_tokens: Option<u32>,
    pub timeout_secs: Option<u64>,
    /// The user's local date ("YYYY-MM-DD") for the daily cap; only trusted within one day of
    /// the system clock (`usage::counting_day`).
    #[serde(default)]
    pub day: Option<String>,
    /// Maximum calls per day (0 = no limit; missing = `usage::DEFAULT_DAILY_CAP`).
    #[serde(default)]
    pub daily_cap: Option<u32>,
    /// Provider that answers when `provider` is out of quota or credit.
    #[serde(default)]
    pub fallback: Option<Fallback>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct Fallback {
    pub provider: Provider,
    pub model: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatResponse {
    pub content: String,
    pub model: String,
    pub duration_ms: u64,
    /// Attempts that were retried (429/5xx).
    pub retries: u32,
    /// Provider that answered.
    pub provider: Provider,
    /// True when the fallback provider answered (the chosen one was out of quota/credit).
    pub fallback: bool,
    /// The answer stopped at the output limit (the AI Teacher offers "Viết tiếp").
    pub truncated: bool,
}

#[derive(Debug, Clone, Serialize, thiserror::Error)]
#[serde(tag = "code", content = "message", rename_all = "camelCase")]
pub enum AiError {
    #[error("request timed out")]
    Timeout(String),
    #[error("request cancelled")]
    Cancelled(String),
    #[error("HTTP error: {0}")]
    Http(String),
    #[error("network error: {0}")]
    Network(String),
    #[error("missing API key")]
    MissingKey(String),
    #[error("unexpected response: {0}")]
    BadResponse(String),
    #[error("keychain error: {0}")]
    Keychain(String),
    #[error("daily limit reached: {0}")]
    DailyLimit(String),
    /// Blocked by the safety gate (18+ confirmation), see `safety`.
    #[error("not allowed: {0}")]
    NotAllowed(String),
}

/// AI calls need the safety gate open (18+ and the terms confirmed).
fn require_ai_allowed(app: &tauri::AppHandle) -> Result<(), AiError> {
    if crate::safety::ai_allowed(app) {
        Ok(())
    } else {
        Err(AiError::NotAllowed("ageGate".into()))
    }
}

/// Keys may be stored only after the 18+ confirmation (Gemini API terms: users must be 18+).
fn require_key_permission(app: &tauri::AppHandle) -> Result<(), AiError> {
    key_gate(|| crate::safety::ai_allowed(app))
}

/// The rule behind [`require_key_permission`], without the app (tested).
pub fn key_gate(adult_confirmed: impl FnOnce() -> bool) -> Result<(), AiError> {
    if adult_confirmed() {
        Ok(())
    } else {
        Err(AiError::NotAllowed("ageGate".into()))
    }
}

#[derive(Default)]
pub struct AiState {
    inflight: Mutex<HashMap<String, oneshot::Sender<()>>>,
    /// Serializes reads/writes of the usage file.
    usage: Mutex<()>,
    /// Providers found out of quota/credit, until when calls go straight to the fallback (so a
    /// failing provider is not tried again for every call of the same lesson).
    exhausted: Mutex<HashMap<Provider, Instant>>,
}

/// How long calls skip a provider that was out of quota or credit.
const EXHAUSTED_FOR: Duration = Duration::from_secs(10 * 60);

impl AiState {
    fn is_exhausted(&self, p: Provider) -> bool {
        self.exhausted
            .lock()
            .ok()
            .and_then(|m| m.get(&p).copied())
            .is_some_and(|until| Instant::now() < until)
    }

    fn mark_exhausted(&self, p: Provider) {
        if let Ok(mut m) = self.exhausted.lock() {
            m.insert(p, Instant::now() + EXHAUSTED_FOR);
        }
    }
}

/// A call's entry in `AiState.inflight` (what `ai_cancel` looks up). Registered as the very
/// first step of a call and removed again however the call ends.
pub(crate) struct InflightGuard<'a> {
    state: &'a AiState,
    id: String,
}

impl<'a> InflightGuard<'a> {
    pub(crate) fn register(
        state: &'a AiState,
        id: &str,
    ) -> Result<(Self, oneshot::Receiver<()>), AiError> {
        let (tx, rx) = oneshot::channel::<()>();
        state
            .inflight
            .lock()
            .map_err(|e| AiError::Network(e.to_string()))?
            .insert(id.to_string(), tx);
        Ok((
            InflightGuard {
                state,
                id: id.to_string(),
            },
            rx,
        ))
    }
}

impl Drop for InflightGuard<'_> {
    fn drop(&mut self) {
        if let Ok(mut map) = self.state.inflight.lock() {
            map.remove(&self.id);
        }
    }
}

/// A stop arrived for this call.
pub(crate) fn stop_requested(stop: &mut oneshot::Receiver<()>) -> bool {
    stop.try_recv().is_ok()
}

/// Stops a registered call (what `ai_cancel` does). False when no such call is running.
pub(crate) fn cancel_inflight(state: &AiState, request_id: &str) -> bool {
    state
        .inflight
        .lock()
        .ok()
        .and_then(|mut m| m.remove(request_id))
        .map(|tx| tx.send(()).is_ok())
        .unwrap_or(false)
}

/// The counted part of a call that is already registered: a stop that arrived before the count
/// means nothing is counted or sent; a stop during the count means nothing is sent. Then the
/// work runs with a timeout and can still be stopped (dropping it aborts the HTTP request).
pub(crate) async fn run_counted<T>(
    id: &str,
    mut stop: oneshot::Receiver<()>,
    count: impl FnOnce() -> Result<(), AiError>,
    work: impl Future<Output = Result<T, AiError>>,
    timeout: Duration,
) -> Result<T, AiError> {
    if stop_requested(&mut stop) {
        return Err(AiError::Cancelled(id.to_string()));
    }
    count()?;
    if stop_requested(&mut stop) {
        return Err(AiError::Cancelled(id.to_string()));
    }
    tokio::select! {
        r = work => r,
        _ = tokio::time::sleep(timeout) => Err(AiError::Timeout(format!("{}s", timeout.as_secs()))),
        _ = stop => Err(AiError::Cancelled(id.to_string())),
    }
}

/// Errors after which the fallback provider may answer: the provider is out of quota or credit
/// (HTTP 429 after the retries, 402, Claude's "credit balance is too low", Gemini's
/// RESOURCE_EXHAUSTED). Not for a wrong key, an unknown model or a network problem: those need
/// the user's attention, not a different provider.
pub fn is_quota_error(e: &AiError) -> bool {
    let AiError::Http(msg) = e else {
        return false;
    };
    let status: u16 = msg
        .split(|c: char| !c.is_ascii_digit())
        .find(|s| !s.is_empty())
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    let lower = msg.to_ascii_lowercase();
    matches!(status, 402 | 429)
        || (status == 400 && lower.contains("credit balance"))
        || lower.contains("resource_exhausted")
}

fn client() -> Result<reqwest::Client, AiError> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| AiError::Network(e.to_string()))
}

fn keyring_entry(provider: Provider) -> Result<keyring::Entry, AiError> {
    keyring::Entry::new(KEYRING_SERVICE, provider.key_name())
        .map_err(|e| AiError::Keychain(e.to_string()))
}

fn api_key(provider: Provider) -> Result<String, AiError> {
    keyring_entry(provider)?
        .get_password()
        .map_err(|_| AiError::MissingKey(provider.key_name().to_string()))
}

/// How long to wait before retrying an answer with this HTTP status, or `None` when it must
/// not be retried. 429 and 5xx are retried (at most [`MAX_RETRIES`] times) with exponential
/// backoff (1 s, 2 s, 4 s) or the server's `Retry-After`, capped at [`MAX_BACKOFF`]. A daily
/// quota (Gemini "…PerDay…") is not retried: waiting a few seconds cannot help.
pub fn retry_delay(
    status: u16,
    retry_after: Option<&str>,
    body: &str,
    attempt: u32,
) -> Option<Duration> {
    if attempt >= MAX_RETRIES {
        return None;
    }
    let retryable = status == 429 || (500..=599).contains(&status);
    if !retryable || (status == 429 && body.contains("PerDay")) {
        return None;
    }
    let server = retry_after
        .and_then(|s| s.trim().parse::<f64>().ok())
        .filter(|s| s.is_finite() && *s >= 0.0)
        .map(Duration::from_secs_f64);
    let backoff = Duration::from_secs(1u64 << attempt);
    Some(server.unwrap_or(backoff).min(MAX_BACKOFF))
}

async fn send(req: &ChatRequest, key: &str) -> Result<ChatResponse, AiError> {
    let started = Instant::now();
    let http = client()?;
    let p = provider(req.provider);
    let mut attempt = 0;
    loop {
        let resp = p
            .chat_request(&http, key, req)
            .send()
            .await
            .map_err(|e| AiError::Network(e.to_string()))?;
        let status = resp.status();
        let retry_after = resp
            .headers()
            .get("retry-after")
            .and_then(|v| v.to_str().ok())
            .map(str::to_string);
        let text = resp
            .text()
            .await
            .map_err(|e| AiError::Network(e.to_string()))?;
        if !status.is_success() {
            if let Some(wait) = retry_delay(status.as_u16(), retry_after.as_deref(), &text, attempt)
            {
                attempt += 1;
                tokio::time::sleep(wait).await;
                continue;
            }
            let snippet: String = text.chars().take(400).collect();
            return Err(AiError::Http(format!("{status}: {snippet}")));
        }
        let v: Value =
            serde_json::from_str(&text).map_err(|e| AiError::BadResponse(e.to_string()))?;
        return chat_response(p, req, &v, started, attempt);
    }
}

/// The response for an answer: the provider's text with the model's reasoning removed (an
/// answer that is only reasoning is a `reasoningOnly` error), for every provider.
fn chat_response(
    p: &dyn AIProvider,
    req: &ChatRequest,
    v: &Value,
    started: Instant,
    retries: u32,
) -> Result<ChatResponse, AiError> {
    Ok(ChatResponse {
        content: reasoning::visible_answer(&p.extract_content(v)?)?,
        model: p.response_model(v).unwrap_or_else(|| req.model.clone()),
        duration_ms: started.elapsed().as_millis() as u64,
        retries,
        provider: req.provider,
        fallback: false,
        truncated: p.truncated(v),
    })
}

fn usage_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|d| d.join("ai-usage.json"))
}

/// Counts the call against the daily cap. Never skipped: a missing or invalid day falls back to
/// the clock and a missing cap to the default (see `count_usage`).
fn count_call(app: &tauri::AppHandle, state: &AiState, req: &ChatRequest) -> Result<(), AiError> {
    count_usage(app, state, req.day.as_deref(), req.daily_cap)
}

/// Counts one AI call (chat or speech) against the user's daily cap. Every call is counted:
/// without a cap the default applies, and the day is checked against the system clock
/// (audit SEC-07), so the page cannot skip the count by leaving a field out. The counting day
/// never goes backwards (`usage::consume`), so switching dates cannot reset the count either.
fn count_usage(
    app: &tauri::AppHandle,
    state: &AiState,
    day: Option<&str>,
    cap: Option<u32>,
) -> Result<(), AiError> {
    let day = usage::counting_day(day, usage::utc_today());
    let cap = cap.unwrap_or(usage::DEFAULT_DAILY_CAP);
    let Some(path) = usage_path(app) else {
        return Ok(());
    };
    let _guard = state
        .usage
        .lock()
        .map_err(|e| AiError::Network(e.to_string()))?;
    usage::consume(&path, &day, cap).map(|_| ())
}

#[tauri::command]
pub async fn ai_chat(
    app: tauri::AppHandle,
    state: tauri::State<'_, AiState>,
    request: ChatRequest,
) -> Result<ChatResponse, AiError> {
    // First of all, so `ai_cancel` finds the call however early the stop comes.
    let (_inflight, stop) = InflightGuard::register(state.inner(), &request.request_id)?;
    require_ai_allowed(&app)?;
    // The chosen provider needs its own key: the fallback only answers for a provider that is
    // out of quota or credit (CLAUDE.md), never for one that was not set up.
    if api_key(request.provider).is_err() {
        return Err(AiError::MissingKey(request.provider.key_name().into()));
    }
    let timeout = Duration::from_secs(
        request
            .timeout_secs
            .unwrap_or(DEFAULT_TIMEOUT_SECS)
            .clamp(5, 600),
    );
    run_counted(
        &request.request_id,
        stop,
        || count_call(&app, &state, &request),
        send_with_fallback(&state, &request),
        timeout,
    )
    .await
}

/// The same request for the fallback provider.
fn as_fallback(req: &ChatRequest, f: &Fallback) -> ChatRequest {
    ChatRequest {
        provider: f.provider,
        model: f.model.clone(),
        fallback: None,
        ..req.clone()
    }
}

/// Sends to the chosen provider; when it is out of quota/credit (or was a few minutes ago) and
/// a fallback is configured, the fallback answers and the response says so.
async fn send_with_fallback(state: &AiState, req: &ChatRequest) -> Result<ChatResponse, AiError> {
    with_fallback(
        state,
        req,
        api_key,
        |r, key| async move { send(&r, &key).await },
    )
    .await
}

/// The fallback rule, with the key lookup and the sender passed in (tested without network):
/// - the chosen provider must have a key (a missing key is never replaced by the fallback);
/// - the fallback answers only when the chosen provider is out of quota or credit, now
///   ([`is_quota_error`]) or in the last minutes ([`AiState::is_exhausted`]);
/// - a fallback equal to the chosen provider, or without a key, is ignored.
async fn with_fallback<K, S, F>(
    state: &AiState,
    req: &ChatRequest,
    key_of: K,
    send: S,
) -> Result<ChatResponse, AiError>
where
    K: Fn(Provider) -> Result<String, AiError>,
    S: Fn(ChatRequest, String) -> F,
    F: Future<Output = Result<ChatResponse, AiError>>,
{
    let primary_key = key_of(req.provider)?;
    let fallback = req
        .fallback
        .as_ref()
        .filter(|f| f.provider != req.provider)
        .and_then(|f| key_of(f.provider).ok().map(|k| (f.clone(), k)));
    let answered_by_fallback = |r: ChatResponse| ChatResponse {
        fallback: true,
        ..r
    };
    if let Some((f, key)) = &fallback {
        if state.is_exhausted(req.provider) {
            return send(as_fallback(req, f), key.clone())
                .await
                .map(answered_by_fallback);
        }
    }
    match (send(req.clone(), primary_key).await, fallback) {
        (Err(e), Some((f, key))) if is_quota_error(&e) => {
            state.mark_exhausted(req.provider);
            send(as_fallback(req, &f), key)
                .await
                .map(answered_by_fallback)
        }
        (other, _) => other,
    }
}

#[tauri::command]
pub fn ai_cancel(state: tauri::State<'_, AiState>, request_id: String) -> bool {
    cancel_inflight(state.inner(), &request_id)
}

/// AI calls made today (for Settings).
#[tauri::command]
pub fn ai_usage(app: tauri::AppHandle, day: String) -> usage::Usage {
    let day = usage::counting_day(Some(&day), usage::utc_today());
    match usage_path(&app) {
        Some(p) => usage::current(&p, &day),
        None => usage::Usage { day, count: 0 },
    }
}

/// The edition of this program (always "main" since 0.5.0).
#[tauri::command]
pub fn ai_edition() -> &'static str {
    EDITION
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelsResponse {
    pub models: Vec<String>,
}

/// Lists the provider's models. Only called when the user presses "Kiểm tra kết nối", so it
/// also tells whether the stored key works.
#[tauri::command]
pub async fn ai_models(
    app: tauri::AppHandle,
    provider: Provider,
) -> Result<ModelsResponse, AiError> {
    require_ai_allowed(&app)?;
    let p = self::provider(provider);
    let resp = p
        .models_request(&client()?, &api_key(p.id())?)
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| AiError::Network(e.to_string()))?;
    if !resp.status().is_success() {
        return Err(AiError::Http(resp.status().to_string()));
    }
    let v: Value = resp
        .json()
        .await
        .map_err(|e| AiError::BadResponse(e.to_string()))?;
    Ok(ModelsResponse {
        models: p.model_ids(&v),
    })
}

/// Opens the Google AI Studio page where students create a Gemini API key.
#[tauri::command]
pub fn open_gemini_key_page(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(gemini::GEMINI_KEY_PAGE, None::<&str>)
        .map_err(|e| e.to_string())
}

/// Opens the GroqCloud page where an API key is created (fixed address).
#[tauri::command]
pub fn open_groq_key_page(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(groq::GROQ_KEY_PAGE, None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn ai_set_key(app: tauri::AppHandle, provider: Provider, key: String) -> Result<(), AiError> {
    require_key_permission(&app)?;
    let key = key.trim();
    if key.is_empty() {
        return Err(AiError::MissingKey(provider.key_name().into()));
    }
    keyring_entry(provider)?
        .set_password(key)
        .map_err(|e| AiError::Keychain(e.to_string()))
}

#[tauri::command]
pub fn ai_has_key(provider: Provider) -> bool {
    api_key(provider).is_ok()
}

/// "••••••••abcd": only the last 4 characters of a stored key are ever shown (PROMPT_PHAN_2 A2).
pub fn mask_key(key: &str) -> String {
    let chars: Vec<char> = key.trim().chars().collect();
    if chars.len() <= 8 {
        return "••••••••".into();
    }
    let tail: String = chars[chars.len() - 4..].iter().collect();
    format!("••••••••{tail}")
}

/// The masked form of the stored key, or `None` when there is none. The key itself never
/// leaves Rust.
#[tauri::command]
pub fn ai_key_hint(provider: Provider) -> Option<String> {
    api_key(provider).ok().map(|k| mask_key(&k))
}

/// Result of "Kiểm tra key" (PROMPT_PHAN_2 A2: thành công / key không hợp lệ / hết hạn mức /
/// không có mạng), plus "no key" and "model not found".
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum KeyStatus {
    Ok,
    NoKey,
    BadKey,
    Quota,
    BadModel,
    Offline,
    Error,
    /// The safety gate is closed (18+ confirmation missing).
    NotAllowed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyTest {
    pub status: KeyStatus,
    /// Short server message for the "error" case (never contains the key).
    pub detail: String,
}

/// Turns the answer to the test call into a status. Gemini: a wrong key is HTTP 400
/// `API_KEY_INVALID`; Claude: 401. Both: unknown model 404, rate/quota 429. Claude reports an
/// empty prepaid balance as 400 "credit balance is too low", which is a quota problem too.
pub fn classify_key_test(status: u16, body: &str) -> KeyStatus {
    let b = body.to_ascii_lowercase();
    match status {
        200..=299 => KeyStatus::Ok,
        401 | 403 => KeyStatus::BadKey,
        404 => KeyStatus::BadModel,
        402 | 429 => KeyStatus::Quota,
        400 if b.contains("api_key_invalid") || b.contains("api key not valid") => {
            KeyStatus::BadKey
        }
        400 if b.contains("credit balance") => KeyStatus::Quota,
        400 if b.contains("model") && (b.contains("not found") || b.contains("not_found")) => {
            KeyStatus::BadModel
        }
        _ => KeyStatus::Error,
    }
}

/// "Kiểm tra key": one very small request with the chosen model (a few tokens). It checks the
/// key, the model name and the quota at once. Not counted against the daily cap, not retried.
#[tauri::command]
pub async fn ai_test_key(app: tauri::AppHandle, provider: Provider, model: String) -> KeyTest {
    let done = |status, detail: String| KeyTest { status, detail };
    if require_ai_allowed(&app).is_err() {
        return done(KeyStatus::NotAllowed, String::new());
    }
    let Ok(key) = api_key(provider) else {
        return done(KeyStatus::NoKey, String::new());
    };
    let req = ChatRequest {
        request_id: "key-test".into(),
        provider,
        model,
        system: "Reply with the single word OK.".into(),
        messages: vec![Message {
            role: "user".into(),
            content: "OK?".into(),
        }],
        json_schema: None,
        schema_name: None,
        temperature: None,
        max_tokens: Some(16),
        timeout_secs: None,
        day: None,
        daily_cap: None,
        fallback: None,
    };
    let http = match client() {
        Ok(h) => h,
        Err(e) => return done(KeyStatus::Error, e.to_string()),
    };
    let sent = self::provider(provider)
        .chat_request(&http, &key, &req)
        .timeout(Duration::from_secs(20))
        .send()
        .await;
    let resp = match sent {
        Ok(r) => r,
        Err(e) if e.is_timeout() || e.is_connect() || e.is_request() => {
            return done(KeyStatus::Offline, String::new())
        }
        Err(e) => return done(KeyStatus::Error, e.to_string()),
    };
    let code = resp.status().as_u16();
    let body = resp.text().await.unwrap_or_default();
    let status = classify_key_test(code, &body);
    let detail = if status == KeyStatus::Error {
        format!("{code}: {}", body.chars().take(200).collect::<String>())
    } else {
        String::new()
    };
    done(status, detail)
}

/// Deleting a key is always allowed (also after "I am under 18").
#[tauri::command]
pub fn ai_delete_key(provider: Provider) -> Result<(), AiError> {
    match keyring_entry(provider)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(AiError::Keychain(e.to_string())),
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::atomic::{AtomicBool, Ordering};

    pub(crate) fn req(provider: Provider, schema: bool) -> ChatRequest {
        ChatRequest {
            request_id: "r1".into(),
            provider,
            model: "m".into(),
            system: "sys".into(),
            messages: vec![Message {
                role: "user".into(),
                content: "hi".into(),
            }],
            json_schema: schema.then(|| json!({"type": "object"})),
            schema_name: Some("scene_spec".into()),
            temperature: None,
            max_tokens: None,
            timeout_secs: None,
            day: None,
            daily_cap: None,
            fallback: None,
        }
    }

    #[test]
    fn only_quota_and_credit_errors_switch_to_the_fallback() {
        let http = |m: &str| AiError::Http(m.into());
        assert!(is_quota_error(&http(
            "429 Too Many Requests: {\"error\": \"PerDay\"}"
        )));
        assert!(is_quota_error(&http("402 Payment Required: …")));
        assert!(is_quota_error(&http(
            "400 Bad Request: Your credit balance is too low to access the Anthropic API."
        )));
        assert!(is_quota_error(&http("400 Bad Request: RESOURCE_EXHAUSTED")));
        // A wrong key, an unknown model, a server error or no network: no switch.
        assert!(!is_quota_error(&http(
            "401 Unauthorized: invalid x-api-key"
        )));
        assert!(!is_quota_error(&http("404 Not Found: model")));
        assert!(!is_quota_error(&http("500 Internal Server Error")));
        assert!(!is_quota_error(&AiError::Network("down".into())));
        assert!(!is_quota_error(&AiError::DailyLimit("100".into())));
    }

    #[test]
    fn fallback_request_keeps_the_conversation_and_changes_the_model() {
        let mut r = req(Provider::Claude, true);
        r.fallback = Some(Fallback {
            provider: Provider::Groq,
            model: "qwen/qwen3.8-27b".into(),
        });
        let f = r.fallback.clone().unwrap();
        let fb = as_fallback(&r, &f);
        assert_eq!(fb.provider, Provider::Groq);
        assert_eq!(fb.model, "qwen/qwen3.8-27b");
        assert_eq!(fb.messages[0].content, "hi");
        assert_eq!(fb.json_schema, r.json_schema);
        assert!(fb.fallback.is_none());
    }

    #[test]
    fn an_exhausted_provider_is_skipped_for_a_while() {
        let st = AiState::default();
        assert!(!st.is_exhausted(Provider::Claude));
        st.mark_exhausted(Provider::Claude);
        assert!(st.is_exhausted(Provider::Claude));
        assert!(!st.is_exhausted(Provider::Groq));
    }

    #[test]
    fn groq_is_available() {
        let p: Provider = serde_json::from_str("\"groq\"").unwrap();
        assert_eq!(p, Provider::Groq);
        assert_eq!(provider(p).id(), Provider::Groq);
        assert_eq!(p.key_name(), "groq");
    }

    #[test]
    fn retries_429_and_5xx_with_backoff() {
        assert_eq!(retry_delay(429, None, "", 0), Some(Duration::from_secs(1)));
        assert_eq!(retry_delay(503, None, "", 1), Some(Duration::from_secs(2)));
        assert_eq!(retry_delay(529, None, "", 2), Some(Duration::from_secs(4)));
        // At most three retries.
        assert_eq!(retry_delay(500, None, "", 3), None);
        // The server's Retry-After wins, but never more than 8 s.
        assert_eq!(
            retry_delay(429, Some("3"), "", 0),
            Some(Duration::from_secs(3))
        );
        assert_eq!(retry_delay(429, Some("120"), "", 0), Some(MAX_BACKOFF));
        assert_eq!(
            retry_delay(429, Some("soon"), "", 0),
            Some(Duration::from_secs(1))
        );
    }

    #[test]
    fn does_not_retry_client_errors_or_daily_quota() {
        for status in [400, 401, 403, 404] {
            assert_eq!(retry_delay(status, None, "", 0), None);
        }
        let daily = r#"{"error":{"details":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}}"#;
        assert_eq!(retry_delay(429, None, daily, 0), None);
    }

    #[test]
    fn provider_ids_and_old_names() {
        assert_eq!(
            serde_json::from_value::<Provider>(json!("claude")).unwrap(),
            Provider::Claude
        );
        assert_eq!(
            serde_json::from_value::<Provider>(json!("anthropic")).unwrap(),
            Provider::Claude
        );
        assert_eq!(serde_json::to_value(Provider::Claude).unwrap(), "claude");
        for removed in ["lmstudio", "openai"] {
            assert!(serde_json::from_value::<Provider>(json!(removed)).is_err());
        }
        assert_eq!(provider(Provider::Claude).id(), Provider::Claude);
    }

    #[test]
    fn gemini_and_claude_are_available() {
        assert_eq!(EDITION, "main");
        assert_eq!(
            serde_json::from_value::<Provider>(json!("gemini")).unwrap(),
            Provider::Gemini
        );
        assert_eq!(provider(Provider::Gemini).id(), Provider::Gemini);
        assert_eq!(KEYRING_SERVICE, "STEM Sim Lab");
    }

    #[test]
    fn masks_keys_to_the_last_four_characters() {
        assert_eq!(mask_key("AIzaSyA-1234567890abcd"), "••••••••abcd");
        assert_eq!(mask_key("  sk-ant-api03-xyzWXYZ \n"), "••••••••WXYZ");
        // Short strings show nothing at all.
        assert_eq!(mask_key("abcd"), "••••••••");
    }

    #[test]
    fn classifies_key_test_answers() {
        use KeyStatus::*;
        assert_eq!(classify_key_test(200, "{}"), Ok);
        let gemini_bad = r#"{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}"#;
        assert_eq!(classify_key_test(400, gemini_bad), BadKey);
        let claude_bad = r#"{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}"#;
        assert_eq!(classify_key_test(401, claude_bad), BadKey);
        assert_eq!(classify_key_test(403, ""), BadKey);
        assert_eq!(classify_key_test(404, "models/x is not found"), BadModel);
        assert_eq!(classify_key_test(429, "RESOURCE_EXHAUSTED"), Quota);
        let credit = r#"{"error":{"type":"invalid_request_error","message":"Your credit balance is too low"}}"#;
        assert_eq!(classify_key_test(400, credit), Quota);
        assert_eq!(classify_key_test(500, "oops"), Error);
        assert_eq!(
            serde_json::to_value(KeyTest {
                status: BadModel,
                detail: String::new()
            })
            .unwrap()["status"],
            "badModel"
        );
    }

    #[test]
    fn errors_serialize_with_a_code() {
        let v = serde_json::to_value(AiError::Timeout("30s".into())).unwrap();
        assert_eq!(v["code"], "timeout");
        let v = serde_json::to_value(AiError::DailyLimit("50/50".into())).unwrap();
        assert_eq!(v["code"], "dailyLimit");
        assert_eq!(v["message"], "50/50");
    }

    #[test]
    fn chat_request_accepts_the_page_payload() {
        let r: ChatRequest = serde_json::from_value(json!({
            "requestId": "x", "provider": "claude", "model": "m", "system": "s",
            "messages": [], "day": "2026-10-05", "dailyCap": 50
        }))
        .unwrap();
        assert_eq!(r.daily_cap, Some(50));
        assert_eq!(r.day.as_deref(), Some("2026-10-05"));
    }

    #[test]
    fn keys_need_the_age_confirmation() {
        // No key (Gemini, Claude or Groq) before "I am 18+".
        let r = key_gate(|| false);
        assert!(matches!(r, Err(AiError::NotAllowed(ref s)) if s == "ageGate"));
        assert!(key_gate(|| true).is_ok());
    }

    fn block<T>(f: impl Future<Output = T>) -> T {
        tauri::async_runtime::block_on(f)
    }

    #[test]
    fn the_inflight_entry_is_removed_on_every_path() {
        let st = AiState::default();
        {
            let (_guard, _stop) = InflightGuard::register(&st, "a").unwrap();
            assert!(st.inflight.lock().unwrap().contains_key("a"));
        }
        assert!(st.inflight.lock().unwrap().is_empty());
        // An early return (the gate, a missing key) drops the guard too.
        let early = || -> Result<(), AiError> {
            let (_guard, _stop) = InflightGuard::register(&st, "b")?;
            Err(AiError::NotAllowed("ageGate".into()))
        };
        assert!(early().is_err());
        assert!(st.inflight.lock().unwrap().is_empty());
        assert!(!cancel_inflight(&st, "b"), "nothing left to stop");
    }

    #[test]
    fn a_stop_before_the_count_is_never_counted_or_sent() {
        let usage_file = std::env::temp_dir().join("stemsim-cancel-window-usage.json");
        let _ = std::fs::remove_file(&usage_file);
        let st = AiState::default();
        let (_guard, stop) = InflightGuard::register(&st, "r1").unwrap();
        // The stop arrives while the gate, the keychain or the cap is still being checked.
        assert!(
            cancel_inflight(&st, "r1"),
            "registered before anything else"
        );
        let sent = AtomicBool::new(false);
        let r: Result<(), AiError> = block(run_counted(
            "r1",
            stop,
            || usage::consume(&usage_file, "2026-10-14", 100).map(|_| ()),
            async {
                sent.store(true, Ordering::SeqCst);
                Ok(())
            },
            Duration::from_secs(5),
        ));
        assert!(matches!(r, Err(AiError::Cancelled(ref id)) if id == "r1"));
        assert!(!usage_file.exists(), "not counted");
        assert!(!sent.load(Ordering::SeqCst), "not sent");
    }

    #[test]
    fn a_stop_during_the_count_is_never_sent() {
        let st = AiState::default();
        let (_guard, stop) = InflightGuard::register(&st, "r2").unwrap();
        let sent = AtomicBool::new(false);
        let r: Result<(), AiError> = block(run_counted(
            "r2",
            stop,
            || {
                assert!(cancel_inflight(&st, "r2"));
                Ok(())
            },
            async {
                sent.store(true, Ordering::SeqCst);
                Ok(())
            },
            Duration::from_secs(5),
        ));
        assert!(matches!(r, Err(AiError::Cancelled(_))));
        assert!(!sent.load(Ordering::SeqCst));
    }

    #[test]
    fn a_counted_call_answers_times_out_or_stops_while_sending() {
        let st = AiState::default();
        let (_g1, stop) = InflightGuard::register(&st, "ok").unwrap();
        let r = block(run_counted(
            "ok",
            stop,
            || Ok(()),
            async { Ok(7u8) },
            Duration::from_secs(5),
        ));
        assert_eq!(r.unwrap(), 7);
        let (_g2, stop) = InflightGuard::register(&st, "slow").unwrap();
        let r: Result<u8, AiError> = block(run_counted(
            "slow",
            stop,
            || Ok(()),
            async {
                tokio::time::sleep(Duration::from_secs(5)).await;
                Ok(1)
            },
            Duration::from_millis(50),
        ));
        assert!(matches!(r, Err(AiError::Timeout(_))));
        let (_g3, stop) = InflightGuard::register(&st, "capped").unwrap();
        let r: Result<u8, AiError> = block(run_counted(
            "capped",
            stop,
            || Err(AiError::DailyLimit("100/100".into())),
            async { Ok(1) },
            Duration::from_secs(5),
        ));
        assert!(matches!(r, Err(AiError::DailyLimit(_))));
        let (_g4, stop) = InflightGuard::register(&st, "sending").unwrap();
        let (r, stopped) = block(async {
            let work = async {
                tokio::time::sleep(Duration::from_secs(30)).await;
                Ok(1u8)
            };
            let user = async {
                tokio::time::sleep(Duration::from_millis(50)).await;
                cancel_inflight(&st, "sending")
            };
            tokio::join!(
                run_counted("sending", stop, || Ok(()), work, Duration::from_secs(60)),
                user
            )
        });
        assert!(stopped);
        assert!(matches!(r, Err(AiError::Cancelled(_))));
    }

    #[test]
    fn chat_and_speech_register_before_the_gate_key_and_count() {
        // The commands need a running app, so check their order in the source.
        let order = |code: &'static str, func: &str, count: &str| {
            let code = code.split("#[cfg(test)]").next().unwrap_or_default();
            let body = code.split(func).nth(1).expect(func);
            let at = |s: &str| body.find(s).unwrap_or_else(|| panic!("{func}: no {s}"));
            let reg = at("InflightGuard::register(");
            assert!(reg < at("require_ai_allowed("), "{func}");
            assert!(reg < at("api_key("), "{func}");
            assert!(
                at("run_counted(") < at(count),
                "{func}: counted outside run_counted"
            );
        };
        order(
            include_str!("mod.rs"),
            "pub async fn ai_chat(",
            "count_call(",
        );
        order(
            include_str!("tts.rs"),
            "pub async fn ai_tts(",
            "count_usage(",
        );
    }

    fn answer(p: Provider) -> ChatResponse {
        ChatResponse {
            content: "ok".into(),
            model: "m".into(),
            duration_ms: 0,
            retries: 0,
            provider: p,
            fallback: false,
            truncated: false,
        }
    }

    /// `with_fallback` with fake keys and answers: the result and the providers called.
    fn fallback_run(
        st: &AiState,
        r: &ChatRequest,
        keys: &[Provider],
        answers: impl Fn(Provider) -> Result<ChatResponse, AiError>,
    ) -> (Result<ChatResponse, AiError>, Vec<Provider>) {
        let calls = Mutex::new(Vec::new());
        let key_of = |p: Provider| {
            if keys.contains(&p) {
                Ok(format!("key-{}", p.key_name()))
            } else {
                Err(AiError::MissingKey(p.key_name().into()))
            }
        };
        let result = block(with_fallback(st, r, key_of, |sent: ChatRequest, _key| {
            calls.lock().unwrap().push(sent.provider);
            let a = answers(sent.provider);
            async move { a }
        }));
        (result, calls.into_inner().unwrap())
    }

    fn with_groq_fallback(p: Provider) -> ChatRequest {
        let mut r = req(p, false);
        r.fallback = Some(Fallback {
            provider: Provider::Groq,
            model: "qwen/qwen3.8-27b".into(),
        });
        r
    }

    #[test]
    fn the_fallback_never_replaces_a_missing_key() {
        let st = AiState::default();
        let r = with_groq_fallback(Provider::Gemini);
        let (res, calls) = fallback_run(&st, &r, &[Provider::Groq], |p| Ok(answer(p)));
        assert!(matches!(res, Err(AiError::MissingKey(ref k)) if k == "gemini"));
        assert!(calls.is_empty());
        // Not even when the chosen provider was out of quota a minute ago.
        st.mark_exhausted(Provider::Gemini);
        let (res, calls) = fallback_run(&st, &r, &[Provider::Groq], |p| Ok(answer(p)));
        assert!(res.is_err());
        assert!(calls.is_empty());
    }

    #[test]
    fn only_quota_or_credit_exhaustion_switches_to_the_fallback() {
        let both = [Provider::Claude, Provider::Groq];
        let r = with_groq_fallback(Provider::Claude);
        let st = AiState::default();
        // Credit gone: Groq answers, the response says so, and Claude is skipped for a while.
        let (res, calls) = fallback_run(&st, &r, &both, |p| match p {
            Provider::Claude => Err(AiError::Http(
                "400 Bad Request: Your credit balance is too low".into(),
            )),
            _ => Ok(answer(p)),
        });
        let res = res.unwrap();
        assert!(res.fallback);
        assert_eq!(res.provider, Provider::Groq);
        assert_eq!(calls, vec![Provider::Claude, Provider::Groq]);
        assert!(st.is_exhausted(Provider::Claude));
        let (res, calls) = fallback_run(&st, &r, &both, |p| Ok(answer(p)));
        assert!(res.unwrap().fallback);
        assert_eq!(calls, vec![Provider::Groq]);
        // A wrong key, an unknown model, an overloaded server: no switch.
        let st = AiState::default();
        for e in [
            "401 Unauthorized: invalid x-api-key",
            "404 Not Found: model",
            "503 Service Unavailable",
        ] {
            let (res, calls) = fallback_run(&st, &r, &both, |p| match p {
                Provider::Claude => Err(AiError::Http(e.into())),
                _ => Ok(answer(p)),
            });
            assert!(res.is_err(), "{e}");
            assert_eq!(calls, vec![Provider::Claude], "{e}");
        }
        assert!(!st.is_exhausted(Provider::Claude));
        // No fallback asked for (a Think draft or review): the quota error reaches the page.
        let mut alone = r.clone();
        alone.fallback = None;
        let quota = |_: Provider| Err(AiError::Http("429 Too Many Requests".into()));
        let (res, calls) = fallback_run(&st, &alone, &both, quota);
        assert!(res.is_err());
        assert_eq!(calls, vec![Provider::Claude]);
        // A fallback equal to the chosen provider, or one without a key, is ignored.
        let mut same = r.clone();
        same.fallback = Some(Fallback {
            provider: Provider::Claude,
            model: "x".into(),
        });
        assert_eq!(
            fallback_run(&st, &same, &both, quota).1,
            vec![Provider::Claude]
        );
        assert_eq!(
            fallback_run(&st, &r, &[Provider::Claude], quota).1,
            vec![Provider::Claude]
        );
    }

    #[test]
    fn every_provider_answer_loses_its_reasoning() {
        let started = Instant::now();
        let gemini = json!({"candidates": [{"content": {"parts": [
            {"text": "<think>nháp 3*4=12</think>Lực là đại lượng vectơ."}]},
            "finishReason": "STOP"}]});
        let r = chat_response(
            provider(Provider::Gemini),
            &req(Provider::Gemini, false),
            &gemini,
            started,
            0,
        )
        .unwrap();
        assert_eq!(r.content, "Lực là đại lượng vectơ.");
        let claude = json!({"content": [{"type": "text", "text": "<thinking>chỉ nháp</thinking>"}],
            "stop_reason": "end_turn"});
        let e = chat_response(
            provider(Provider::Claude),
            &req(Provider::Claude, false),
            &claude,
            started,
            0,
        )
        .unwrap_err();
        assert!(matches!(e, AiError::BadResponse(ref m) if m == "reasoningOnly"));
        // Answers without reasoning are unchanged.
        let plain = json!({"content": [{"type": "text", "text": "  a = 2 m/s²  "}]});
        let r = chat_response(
            provider(Provider::Claude),
            &req(Provider::Claude, false),
            &plain,
            started,
            0,
        )
        .unwrap();
        assert_eq!(r.content, "  a = 2 m/s²  ");
        // `send` builds every response through `chat_response`.
        let code = include_str!("mod.rs")
            .split("#[cfg(test)]")
            .next()
            .unwrap_or_default();
        let send_fn = code.split("async fn send(").nth(1).expect("send");
        let send_fn = send_fn.split("\nfn ").next().unwrap_or_default();
        assert!(send_fn.contains("chat_response(p, req, &v, started, attempt)"));
        assert!(!send_fn.contains("ChatResponse {"));
    }
}
