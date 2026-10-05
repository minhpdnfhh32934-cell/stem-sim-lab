//! AI gateway: every LLM call goes through Rust so API keys never reach the web view, CORS is
//! not an issue, and requests have a timeout, can be cancelled, are retried with backoff on
//! 429/5xx and are counted against a daily cap.
//!
//! Providers implement [`provider::AIProvider`]: [`claude::ClaudeProvider`] (both editions)
//! and `gemini::GeminiProvider` (main edition only — not compiled into the pilot edition).
//!
//! The LLM is only used to (a) extract a problem into a structured SceneSpec and
//! (b) explain results already computed by the engine. It never computes numbers.

pub mod claude;
#[cfg(feature = "edition-main")]
pub mod gemini;
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    #[cfg(feature = "edition-main")]
    Gemini,
    /// "anthropic" was the id before PROMPT_PHAN_2.
    #[serde(alias = "anthropic")]
    Claude,
}

impl Provider {
    fn key_name(self) -> &'static str {
        match self {
            #[cfg(feature = "edition-main")]
            Provider::Gemini => "gemini",
            Provider::Claude => "claude",
        }
    }
}

/// The implementation of a provider.
pub fn provider(p: Provider) -> &'static dyn AIProvider {
    match p {
        #[cfg(feature = "edition-main")]
        Provider::Gemini => &gemini::GeminiProvider,
        Provider::Claude => &claude::ClaudeProvider,
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
    /// Used by Gemini; Claude ignores it (see `claude_body`).
    #[cfg_attr(not(feature = "edition-main"), allow(dead_code))]
    pub temperature: Option<f64>,
    pub max_tokens: Option<u32>,
    pub timeout_secs: Option<u64>,
    /// The user's local date ("YYYY-MM-DD") for the daily cap.
    #[serde(default)]
    pub day: Option<String>,
    /// Maximum calls per day (0 = no limit).
    #[serde(default)]
    pub daily_cap: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatResponse {
    pub content: String,
    pub model: String,
    pub duration_ms: u64,
    /// Attempts that were retried (429/5xx).
    pub retries: u32,
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
}

#[derive(Default)]
pub struct AiState {
    inflight: Mutex<HashMap<String, oneshot::Sender<()>>>,
    /// Serializes reads/writes of the usage file.
    usage: Mutex<()>,
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
    let key = api_key(request.provider)?;
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
        r = send(&request, &key) => r,
        _ = tokio::time::sleep(timeout) => Err(AiError::Timeout(format!("{}s", timeout.as_secs()))),
        _ = rx => Err(AiError::Cancelled(request.request_id.clone())),
    };
    if let Ok(mut map) = state.inflight.lock() {
        map.remove(&request.request_id);
    }
    result
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
pub async fn ai_models(provider: Provider) -> Result<ModelsResponse, AiError> {
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

#[tauri::command]
pub fn ai_set_key(provider: Provider, key: String) -> Result<(), AiError> {
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
        }
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
    /// so that this test does not put it into the program itself. (The embedded web assets
    /// are compressed, so the web bundle is checked separately by
    /// `scripts/edition-bundle.mjs`.)
    #[cfg(feature = "edition-pilot")]
    #[test]
    fn pilot_edition_has_no_gemini() {
        assert_eq!(EDITION, "pilot");
        assert_eq!(KEYRING_SERVICE, "STEM Sim Lab Pilot");
        assert!(serde_json::from_value::<Provider>(json!("gemini")).is_err());
        let host = ["generative", "language", ".googleapis", ".com"].concat();
        let exe = std::fs::read(std::env::current_exe().unwrap()).unwrap();
        let found = exe.windows(host.len()).any(|w| w == host.as_bytes());
        assert!(!found, "the pilot program contains the Gemini API host");
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
}
