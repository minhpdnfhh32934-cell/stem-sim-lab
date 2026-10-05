//! AI gateway (Gemini, OpenAI, Anthropic): every LLM call goes through Rust so API keys never reach the web view,
//! CORS is not an issue, and requests have a timeout and can be cancelled.
//!
//! The LLM is only used to (a) extract a problem into a structured SceneSpec and
//! (b) explain results already computed by the engine. It never computes numbers.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::sync::oneshot;

const KEYRING_SERVICE: &str = "STEM Sim Lab";
const ANTHROPIC_URL: &str = "https://api.anthropic.com/v1";
const OPENAI_URL: &str = "https://api.openai.com/v1";
const GEMINI_URL: &str = "https://generativelanguage.googleapis.com/v1beta";
/// Google AI Studio page where a Gemini API key is created (opened from Settings).
pub const GEMINI_KEY_PAGE: &str = "https://aistudio.google.com/apikey";
/// Gemini models think before answering and the thoughts count towards the output limit, so
/// the limit is raised to leave room for the actual JSON answer.
const GEMINI_MIN_OUTPUT_TOKENS: u32 = 8192;
const ANTHROPIC_VERSION: &str = "2023-06-01";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    Gemini,
    Openai,
    Anthropic,
}

impl Provider {
    fn key_name(self) -> &'static str {
        match self {
            Provider::Gemini => "gemini",
            Provider::Openai => "openai",
            Provider::Anthropic => "anthropic",
        }
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
    pub temperature: Option<f64>,
    pub max_tokens: Option<u32>,
    pub timeout_secs: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatResponse {
    pub content: String,
    pub model: String,
    pub duration_ms: u64,
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
}

#[derive(Default)]
pub struct AiState {
    inflight: Mutex<HashMap<String, oneshot::Sender<()>>>,
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

/// API base URL of each provider.
pub fn base_url(provider: Provider) -> &'static str {
    match provider {
        Provider::Gemini => GEMINI_URL,
        Provider::Openai => OPENAI_URL,
        Provider::Anthropic => ANTHROPIC_URL,
    }
}

/// Model id as Gemini expects it in the URL (`models/` prefix removed if the user typed it).
fn gemini_model(model: &str) -> &str {
    model.trim().trim_start_matches("models/")
}

/// Builds the JSON body for an OpenAI-compatible `/chat/completions` call.
pub fn openai_body(req: &ChatRequest) -> Value {
    let mut messages = vec![json!({ "role": "system", "content": req.system })];
    for m in &req.messages {
        messages.push(json!({ "role": m.role, "content": m.content }));
    }
    let mut body = json!({
        "model": req.model,
        "messages": messages,
        "temperature": req.temperature.unwrap_or(0.0),
        "max_tokens": req.max_tokens.unwrap_or(2048),
        "stream": false,
    });
    if let Some(schema) = &req.json_schema {
        body["response_format"] = json!({
            "type": "json_schema",
            "json_schema": {
                "name": req.schema_name.clone().unwrap_or_else(|| "result".to_string()),
                "strict": true,
                "schema": schema,
            }
        });
    }
    body
}

/// Builds the JSON body for Gemini's `generateContent`. Structured output uses
/// `responseJsonSchema` (standard JSON Schema) with a JSON response type.
pub fn gemini_body(req: &ChatRequest) -> Value {
    let contents: Vec<Value> = req
        .messages
        .iter()
        .map(|m| {
            let role = if m.role == "assistant" {
                "model"
            } else {
                "user"
            };
            json!({ "role": role, "parts": [{ "text": m.content }] })
        })
        .collect();
    let mut config = json!({
        "temperature": req.temperature.unwrap_or(0.0),
        "maxOutputTokens": req.max_tokens.unwrap_or(2048).max(GEMINI_MIN_OUTPUT_TOKENS),
    });
    if let Some(schema) = &req.json_schema {
        config["responseMimeType"] = json!("application/json");
        config["responseJsonSchema"] = schema.clone();
    }
    json!({
        "systemInstruction": { "parts": [{ "text": req.system }] },
        "contents": contents,
        "generationConfig": config,
    })
}

/// Builds the JSON body for Anthropic's Messages API. Structured output is obtained by
/// forcing a single tool call whose input schema is the requested JSON schema.
pub fn anthropic_body(req: &ChatRequest) -> Value {
    let messages: Vec<Value> = req
        .messages
        .iter()
        .map(|m| json!({ "role": m.role, "content": m.content }))
        .collect();
    let mut body = json!({
        "model": req.model,
        "system": req.system,
        "messages": messages,
        "max_tokens": req.max_tokens.unwrap_or(2048),
        "temperature": req.temperature.unwrap_or(0.0),
    });
    if let Some(schema) = &req.json_schema {
        let name = req
            .schema_name
            .clone()
            .unwrap_or_else(|| "result".to_string());
        body["tools"] = json!([{
            "name": name,
            "description": "Return the structured result.",
            "input_schema": schema,
        }]);
        body["tool_choice"] = json!({ "type": "tool", "name": name });
    }
    body
}

/// Extracts the text (or tool input serialized as JSON) from a provider response.
pub fn extract_content(provider: Provider, v: &Value) -> Result<String, AiError> {
    match provider {
        Provider::Gemini => {
            let candidate = &v["candidates"][0];
            let parts = candidate["content"]["parts"].as_array();
            let text: String = parts
                .map(|ps| {
                    ps.iter()
                        // Thought summaries are not part of the answer.
                        .filter(|p| p["thought"].as_bool() != Some(true))
                        .filter_map(|p| p["text"].as_str())
                        .collect::<Vec<_>>()
                        .join("")
                })
                .unwrap_or_default();
            if text.trim().is_empty() {
                let reason = candidate["finishReason"]
                    .as_str()
                    .or_else(|| v["promptFeedback"]["blockReason"].as_str())
                    .unwrap_or("no text");
                return Err(AiError::BadResponse(format!("empty answer ({reason})")));
            }
            Ok(text)
        }
        Provider::Anthropic => {
            let blocks = v["content"]
                .as_array()
                .ok_or_else(|| AiError::BadResponse("missing content".into()))?;
            if let Some(tool) = blocks.iter().find(|b| b["type"] == "tool_use") {
                return Ok(tool["input"].to_string());
            }
            let text: String = blocks
                .iter()
                .filter_map(|b| b["text"].as_str())
                .collect::<Vec<_>>()
                .join("");
            Ok(text)
        }
        _ => v["choices"][0]["message"]["content"]
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| AiError::BadResponse("missing choices[0].message.content".into())),
    }
}

async fn send(req: &ChatRequest) -> Result<ChatResponse, AiError> {
    let started = Instant::now();
    let http = client()?;
    let base = base_url(req.provider);
    let resp = match req.provider {
        Provider::Anthropic => {
            let key = api_key(Provider::Anthropic)?;
            http.post(format!("{base}/messages"))
                .header("x-api-key", key)
                .header("anthropic-version", ANTHROPIC_VERSION)
                .json(&anthropic_body(req))
                .send()
                .await
        }
        Provider::Openai => {
            let key = api_key(Provider::Openai)?;
            http.post(format!("{base}/chat/completions"))
                .bearer_auth(key)
                .json(&openai_body(req))
                .send()
                .await
        }
        Provider::Gemini => {
            let key = api_key(Provider::Gemini)?;
            http.post(format!(
                "{base}/models/{}:generateContent",
                gemini_model(&req.model)
            ))
            .header("x-goog-api-key", key)
            .json(&gemini_body(req))
            .send()
            .await
        }
    }
    .map_err(|e| AiError::Network(e.to_string()))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| AiError::Network(e.to_string()))?;
    if !status.is_success() {
        let snippet: String = text.chars().take(400).collect();
        return Err(AiError::Http(format!("{status}: {snippet}")));
    }
    let v: Value = serde_json::from_str(&text).map_err(|e| AiError::BadResponse(e.to_string()))?;
    Ok(ChatResponse {
        content: extract_content(req.provider, &v)?,
        model: v["model"].as_str().unwrap_or(&req.model).to_string(),
        duration_ms: started.elapsed().as_millis() as u64,
    })
}

#[tauri::command]
pub async fn ai_chat(
    state: tauri::State<'_, AiState>,
    request: ChatRequest,
) -> Result<ChatResponse, AiError> {
    let (tx, rx) = oneshot::channel::<()>();
    state
        .inflight
        .lock()
        .map_err(|e| AiError::Network(e.to_string()))?
        .insert(request.request_id.clone(), tx);
    let timeout = Duration::from_secs(request.timeout_secs.unwrap_or(60).clamp(5, 600));
    let result = tokio::select! {
        r = send(&request) => r,
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelsResponse {
    pub models: Vec<String>,
}

/// Lists the provider's models. Only called when the user presses "Kiểm tra kết nối", so it
/// also tells whether the stored key works.
#[tauri::command]
pub async fn ai_models(provider: Provider) -> Result<ModelsResponse, AiError> {
    let http = client()?;
    let base = base_url(provider);
    // Gemini lists 50 models per page by default; one page of 1000 holds them all.
    let query = if provider == Provider::Gemini {
        "?pageSize=1000"
    } else {
        ""
    };
    let mut rb = http
        .get(format!("{base}/models{query}"))
        .timeout(Duration::from_secs(10));
    match provider {
        Provider::Anthropic => {
            rb = rb
                .header("x-api-key", api_key(provider)?)
                .header("anthropic-version", ANTHROPIC_VERSION)
        }
        Provider::Openai => rb = rb.bearer_auth(api_key(provider)?),
        Provider::Gemini => rb = rb.header("x-goog-api-key", api_key(provider)?),
    }
    let resp = rb
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
        models: model_ids(provider, &v),
    })
}

/// Model ids from a `/models` answer (Gemini: only models that can generate text).
pub fn model_ids(provider: Provider, v: &Value) -> Vec<String> {
    let (list, id) = match provider {
        Provider::Gemini => (&v["models"], "name"),
        _ => (&v["data"], "id"),
    };
    list.as_array()
        .map(|a| {
            a.iter()
                .filter(|m| {
                    provider != Provider::Gemini
                        || m["supportedGenerationMethods"]
                            .as_array()
                            .is_some_and(|g| g.iter().any(|x| x == "generateContent"))
                })
                .filter_map(|m| m[id].as_str())
                .map(|s| s.trim_start_matches("models/").to_string())
                .collect()
        })
        .unwrap_or_default()
}

/// Opens the Google AI Studio page where students create a Gemini API key.
#[tauri::command]
pub fn open_gemini_key_page(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(GEMINI_KEY_PAGE, None::<&str>)
        .map_err(|e| e.to_string())
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
mod tests {
    use super::*;

    fn req(provider: Provider, schema: bool) -> ChatRequest {
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
        }
    }

    #[test]
    fn openai_body_uses_strict_json_schema() {
        let b = openai_body(&req(Provider::Openai, true));
        assert_eq!(b["response_format"]["type"], "json_schema");
        assert_eq!(b["response_format"]["json_schema"]["name"], "scene_spec");
        assert_eq!(b["response_format"]["json_schema"]["strict"], true);
        assert_eq!(b["messages"][0]["role"], "system");
        assert_eq!(b["temperature"], 0.0);
    }

    #[test]
    fn anthropic_body_forces_the_schema_tool() {
        let b = anthropic_body(&req(Provider::Anthropic, true));
        assert_eq!(b["tool_choice"]["name"], "scene_spec");
        assert_eq!(b["tools"][0]["input_schema"]["type"], "object");
        assert_eq!(b["system"], "sys");
    }

    #[test]
    fn extracts_content_from_both_response_shapes() {
        let oa = json!({"choices": [{"message": {"content": "{\"a\":1}"}}]});
        assert_eq!(extract_content(Provider::Openai, &oa).unwrap(), "{\"a\":1}");
        let an = json!({"content": [{"type": "tool_use", "input": {"a": 1}}]});
        assert_eq!(
            extract_content(Provider::Anthropic, &an).unwrap(),
            "{\"a\":1}"
        );
        assert!(extract_content(Provider::Openai, &json!({})).is_err());
    }

    #[test]
    fn gemini_body_requests_json_with_the_schema() {
        let mut r = req(Provider::Gemini, true);
        r.messages.push(Message {
            role: "assistant".into(),
            content: "{}".into(),
        });
        let b = gemini_body(&r);
        assert_eq!(b["systemInstruction"]["parts"][0]["text"], "sys");
        assert_eq!(b["contents"][0]["role"], "user");
        assert_eq!(b["contents"][0]["parts"][0]["text"], "hi");
        assert_eq!(b["contents"][1]["role"], "model");
        let c = &b["generationConfig"];
        assert_eq!(c["responseMimeType"], "application/json");
        assert_eq!(c["responseJsonSchema"]["type"], "object");
        assert_eq!(c["temperature"], 0.0);
        assert!(c["maxOutputTokens"].as_u64().unwrap() >= 8192);
        // Explanations (no schema) are plain text.
        let plain = gemini_body(&req(Provider::Gemini, false));
        assert!(plain["generationConfig"].get("responseMimeType").is_none());
    }

    #[test]
    fn extracts_gemini_text_without_thoughts() {
        let v = json!({"candidates": [{"content": {"parts": [
            {"text": "thinking…", "thought": true},
            {"text": "{\"a\":"},
            {"text": "1}"}
        ]}, "finishReason": "STOP"}]});
        assert_eq!(extract_content(Provider::Gemini, &v).unwrap(), "{\"a\":1}");
        let cut = json!({"candidates": [{"content": {"parts": []}, "finishReason": "MAX_TOKENS"}]});
        let err = extract_content(Provider::Gemini, &cut).unwrap_err();
        assert!(err.to_string().contains("MAX_TOKENS"));
    }

    #[test]
    fn lists_gemini_text_models_only() {
        let v = json!({"models": [
            {"name": "models/gemini-3.8-flash", "supportedGenerationMethods": ["generateContent"]},
            {"name": "models/text-embedding-004", "supportedGenerationMethods": ["embedContent"]}
        ]});
        assert_eq!(model_ids(Provider::Gemini, &v), vec!["gemini-3.8-flash"]);
        let oa = json!({"data": [{"id": "gpt-x"}]});
        assert_eq!(model_ids(Provider::Openai, &oa), vec!["gpt-x"]);
    }

    #[test]
    fn base_urls_and_model_names() {
        assert_eq!(base_url(Provider::Openai), OPENAI_URL);
        assert_eq!(base_url(Provider::Gemini), GEMINI_URL);
        assert_eq!(
            gemini_model(" models/gemini-3.8-flash "),
            "gemini-3.8-flash"
        );
    }

    #[test]
    fn old_lmstudio_setting_is_rejected() {
        assert!(serde_json::from_value::<Provider>(json!("lmstudio")).is_err());
        assert_eq!(
            serde_json::from_value::<Provider>(json!("gemini")).unwrap(),
            Provider::Gemini
        );
    }

    #[test]
    fn errors_serialize_with_a_code() {
        let v = serde_json::to_value(AiError::Timeout("60s".into())).unwrap();
        assert_eq!(v["code"], "timeout");
    }
}
