//! AI gateway: every LLM call goes through Rust so API keys never reach the web view, CORS is
//! not an issue, and requests have a timeout, can be cancelled, are retried with backoff on
//! 429/5xx and are counted against a daily cap.
//!
//! Providers implement [`provider::AIProvider`]: [`claude::ClaudeProvider`] and
//! [`groq::GroqProvider`] (both editions) and `gemini::GeminiProvider` (main edition only — not
//! compiled into the pilot edition). When the chosen provider runs out of quota or credit, a
//! configured fallback provider answers instead (see [`is_quota_error`]).
//!
//! The LLM is only used to (a) extract a problem into a structured SceneSpec and
//! (b) explain results already computed by the engine. It never computes numbers.

pub mod claude;
#[cfg(feature = "edition-main")]
pub mod gemini;
pub mod groq;
pub mod provider;
pub mod usage;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::Manager;
use tokio::sync::oneshot;

use provider::AIProvider;

#[cfg(all(feature = "edition-main", feature = "edition-pilot"))]
compile_error!("enable exactly one of the features `edition-main` and `edition-pilot`");
#[cfg(not(any(feature = "edition-main", feature = "edition-pilot")))]
compile_error!("enable one of the features `edition-main` or `edition-pilot`");

/// "main" or "pilot" (PROMPT_PHAN_2 A2).
pub const EDITION: &str = if cfg!(feature = "edition-pilot") {
    "pilot"
} else {
    "main"
};

/// Keychain service. The pilot edition has its own, so the two editions never share keys.
const KEYRING_SERVICE: &str = if cfg!(feature = "edition-pilot") {
    "STEM Sim Lab Pilot"
} else {
    "STEM Sim Lab"
};

/// Default timeout of one AI call, retries included (PROMPT_PHAN_2 A2: 30 s, adjustable).
pub const DEFAULT_TIMEOUT_SECS: u64 = 30;
/// Retries after a 429 or 5xx answer (PROMPT_PHAN_2 A2: at most 3).
pub const MAX_RETRIES: u32 = 3;
/// Longest wait between two attempts, even if the server asks for more.
const MAX_BACKOFF: Duration = Duration::from_secs(8);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    #[cfg(feature = "edition-main")]
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
            #[cfg(feature = "edition-main")]
            Provider::Gemini => "gemini",
            Provider::Claude => "claude",
            Provider::Groq => "groq",
        }
    }
}

/// The implementation of a provider.
pub fn provider(p: Provider) -> &'static dyn AIProvider {
    match p {
        #[cfg(feature = "edition-main")]
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
    /// The user's local date ("YYYY-MM-DD") for the daily cap.
    #[serde(default)]
    pub day: Option<String>,
    /// Maximum calls per day (0 = no limit).
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
    /// Blocked by the safety gates (age confirmation / consent / supervisor PIN), see `safety`.
    #[error("not allowed: {0}")]
    NotAllowed(String),
}

/// AI calls need the safety gates open (main: 18+ confirmed; pilot: consent for a minor).
fn require_ai_allowed(app: &tauri::AppHandle) -> Result<(), AiError> {
    if crate::safety::ai_allowed(app) {
        Ok(())
    } else {
        Err(AiError::NotAllowed("ageGate".into()))
    }
}

/// Who may store or delete a key. Main edition: only after the 18+ confirmation (Gemini API
/// terms). Pilot edition: only with the supervisor PIN (the key belongs to the paying adult).
fn require_key_permission(
    app: &tauri::AppHandle,
    safety: &crate::safety::SafetyState,
    pin: Option<&str>,
) -> Result<(), AiError> {
    key_gate(
        cfg!(feature = "edition-pilot"),
        || crate::safety::ai_allowed(app),
        || crate::safety::verify_pin(app, safety, pin),
    )
}

/// The rule behind [`require_key_permission`], without the app (tested for both editions).
/// Pilot: only the PIN decides. Main: only the 18+ confirmation decides.
pub fn key_gate(
    pilot: bool,
    adult_confirmed: impl FnOnce() -> bool,
    check_pin: impl FnOnce() -> Result<(), crate::safety::SafetyError>,
) -> Result<(), AiError> {
    use crate::safety::SafetyError;
    if pilot {
        check_pin().map_err(|e| match e {
            SafetyError::Locked(s) => AiError::NotAllowed(format!("locked:{s}")),
            SafetyError::WrongPin(s) => AiError::NotAllowed(format!("wrongPin:{s}")),
            other => AiError::NotAllowed(format!("pin:{other}")),
        })
    } else if adult_confirmed() {
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
        return Ok(ChatResponse {
            content: p.extract_content(&v)?,
            model: p.response_model(&v).unwrap_or_else(|| req.model.clone()),
            duration_ms: started.elapsed().as_millis() as u64,
            retries: attempt,
            provider: req.provider,
            fallback: false,
        });
    }
}

fn usage_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|d| d.join("ai-usage.json"))
}

/// Counts the call against the daily cap (skipped without a valid day or a cap).
fn count_call(app: &tauri::AppHandle, state: &AiState, req: &ChatRequest) -> Result<(), AiError> {
    let (Some(day), Some(cap)) = (req.day.as_deref(), req.daily_cap) else {
        return Ok(());
    };
    if !usage::valid_day(day) {
        return Ok(());
    }
    let Some(path) = usage_path(app) else {
        return Ok(());
    };
    let _guard = state
        .usage
        .lock()
        .map_err(|e| AiError::Network(e.to_string()))?;
    usage::consume(&path, day, cap).map(|_| ())
}

#[tauri::command]
pub async fn ai_chat(
    app: tauri::AppHandle,
    state: tauri::State<'_, AiState>,
    request: ChatRequest,
) -> Result<ChatResponse, AiError> {
    require_ai_allowed(&app)?;
    // A missing key is reported before the call is counted (unless the fallback can answer).
    if api_key(request.provider).is_err() && fallback_key(&request).is_none() {
        return Err(AiError::MissingKey(request.provider.key_name().into()));
    }
    count_call(&app, &state, &request)?;
    let (tx, rx) = oneshot::channel::<()>();
    state
        .inflight
        .lock()
        .map_err(|e| AiError::Network(e.to_string()))?
        .insert(request.request_id.clone(), tx);
    let timeout = Duration::from_secs(
        request
            .timeout_secs
            .unwrap_or(DEFAULT_TIMEOUT_SECS)
            .clamp(5, 600),
    );
    let result = tokio::select! {
        r = send_with_fallback(&state, &request) => r,
        _ = tokio::time::sleep(timeout) => Err(AiError::Timeout(format!("{}s", timeout.as_secs()))),
        _ = rx => Err(AiError::Cancelled(request.request_id.clone())),
    };
    if let Ok(mut map) = state.inflight.lock() {
        map.remove(&request.request_id);
    }
    result
}

/// The fallback and its key, when one is configured, differs from the chosen provider and has
/// a key.
fn fallback_key(req: &ChatRequest) -> Option<(&Fallback, String)> {
    let f = req
        .fallback
        .as_ref()
        .filter(|f| f.provider != req.provider)?;
    api_key(f.provider).ok().map(|k| (f, k))
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
    let fallback = fallback_key(req);
    let primary_key = api_key(req.provider);
    if let Some((f, key)) = &fallback {
        if state.is_exhausted(req.provider) || primary_key.is_err() {
            return send(&as_fallback(req, f), key).await.map(|r| ChatResponse {
                fallback: true,
                ..r
            });
        }
    }
    let result = send(req, &primary_key?).await;
    match (result, fallback) {
        (Err(e), Some((f, key))) if is_quota_error(&e) => {
            state.mark_exhausted(req.provider);
            send(&as_fallback(req, f), &key)
                .await
                .map(|r| ChatResponse {
                    fallback: true,
                    ..r
                })
        }
        (other, _) => other,
    }
}

#[tauri::command]
pub fn ai_cancel(state: tauri::State<'_, AiState>, request_id: String) -> bool {
    state
        .inflight
        .lock()
        .ok()
        .and_then(|mut m| m.remove(&request_id))
        .map(|tx| tx.send(()).is_ok())
        .unwrap_or(false)
}

/// AI calls made today (for Settings).
#[tauri::command]
pub fn ai_usage(app: tauri::AppHandle, day: String) -> usage::Usage {
    match usage_path(&app) {
        Some(p) if usage::valid_day(&day) => usage::current(&p, &day),
        _ => usage::Usage { day, count: 0 },
    }
}

/// The edition this program was built as ("main" / "pilot").
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

/// Opens the Google AI Studio page where students create a Gemini API key (main edition).
#[tauri::command]
pub fn open_gemini_key_page(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(feature = "edition-main")]
    {
        use tauri_plugin_opener::OpenerExt;
        app.opener()
            .open_url(gemini::GEMINI_KEY_PAGE, None::<&str>)
            .map_err(|e| e.to_string())
    }
    #[cfg(not(feature = "edition-main"))]
    {
        let _ = app;
        Err("not available in this edition".into())
    }
}

/// Opens the GroqCloud page where an API key is created (both editions; fixed address).
#[tauri::command]
pub fn open_groq_key_page(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(groq::GROQ_KEY_PAGE, None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn ai_set_key(
    app: tauri::AppHandle,
    safety: tauri::State<'_, crate::safety::SafetyState>,
    provider: Provider,
    key: String,
    pin: Option<String>,
) -> Result<(), AiError> {
    require_key_permission(&app, &safety, pin.as_deref())?;
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
    /// The safety gates are closed (age confirmation / consent missing).
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

#[tauri::command]
pub fn ai_delete_key(
    app: tauri::AppHandle,
    safety: tauri::State<'_, crate::safety::SafetyState>,
    provider: Provider,
    pin: Option<String>,
) -> Result<(), AiError> {
    // Main edition: deleting is always allowed (also after "I am under 18").
    if cfg!(feature = "edition-pilot") {
        require_key_permission(&app, &safety, pin.as_deref())?;
    } else {
        let _ = (&app, &safety, &pin);
    }
    match keyring_entry(provider)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(AiError::Keychain(e.to_string())),
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use serde_json::json;

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
    fn groq_is_in_both_editions() {
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

    #[cfg(feature = "edition-main")]
    #[test]
    fn main_edition_has_gemini_and_claude() {
        assert_eq!(EDITION, "main");
        assert_eq!(
            serde_json::from_value::<Provider>(json!("gemini")).unwrap(),
            Provider::Gemini
        );
        assert_eq!(provider(Provider::Gemini).id(), Provider::Gemini);
        assert_eq!(KEYRING_SERVICE, "STEM Sim Lab");
    }

    /// PROMPT_PHAN_2 A2: the pilot edition must not contain any Gemini code. Checked twice:
    /// the provider id is refused, and the compiled test program (which links the same
    /// library code) does not contain the Gemini API host. The host is assembled at run time
    /// so that this test does not put it into the program itself: it is stored reversed,
    /// because the compiler may place separate string pieces next to each other (it did on
    /// Windows), which would recreate the host in the program. (The embedded web assets are
    /// compressed, so the web bundle is checked separately by `scripts/edition-bundle.mjs`.)
    #[cfg(feature = "edition-pilot")]
    #[test]
    fn pilot_edition_has_no_gemini() {
        assert_eq!(EDITION, "pilot");
        assert_eq!(KEYRING_SERVICE, "STEM Sim Lab Pilot");
        assert!(serde_json::from_value::<Provider>(json!("gemini")).is_err());
        let host: String = "moc.sipaelgoog.egaugnalevitareneg".chars().rev().collect();
        let exe = std::fs::read(std::env::current_exe().unwrap()).unwrap();
        let found = exe.windows(host.len()).any(|w| w == host.as_bytes());
        assert!(!found, "the pilot program contains the Gemini API host");
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
    fn keys_need_the_age_confirmation_or_the_supervisor_pin() {
        use crate::safety::SafetyError;
        // Main edition: no key (Gemini or Claude) before "I am 18+"; the PIN is not consulted.
        let r = key_gate(false, || false, || panic!("no PIN in the main edition"));
        assert!(matches!(r, Err(AiError::NotAllowed(ref s)) if s == "ageGate"));
        assert!(key_gate(false, || true, || panic!()).is_ok());
        // Pilot edition: only the supervisor PIN counts.
        let r = key_gate(true, || true, || Err(SafetyError::WrongPin("4".into())));
        assert!(matches!(r, Err(AiError::NotAllowed(ref s)) if s == "wrongPin:4"));
        let r = key_gate(true, || true, || Err(SafetyError::Locked("60".into())));
        assert!(matches!(r, Err(AiError::NotAllowed(ref s)) if s == "locked:60"));
        assert!(key_gate(true, || false, || Ok(())).is_ok());
    }
}
