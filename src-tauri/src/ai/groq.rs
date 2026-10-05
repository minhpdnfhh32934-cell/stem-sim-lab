//! `GroqProvider` (GroqCloud, OpenAI-compatible `chat/completions`). Free fallback for both
//! editions when the paid provider runs out of tokens (user decision 2026-10-05; terms in
//! docs/LEGAL_COMPLIANCE.md §2b: account holder 18+, no training on inputs/outputs).

use serde_json::{json, Value};

use super::provider::AIProvider;
use super::{AiError, ChatRequest, Provider};

pub const GROQ_URL: &str = "https://api.groq.com/openai/v1";
/// GroqCloud page where an API key is created (opened from Settings).
pub const GROQ_KEY_PAGE: &str = "https://console.groq.com/keys";

pub struct GroqProvider;

/// Models that support strict JSON-schema output on Groq (checked 2026-10-05 on
/// console.groq.com/docs/structured-outputs). Other models get best-effort JSON.
fn supports_strict(model: &str) -> bool {
    model.starts_with("openai/gpt-oss") || model.starts_with("qwen/qwen3.8")
}

/// JSON body for `chat/completions`.
///
/// - Structured output: `response_format: json_schema` (strict where supported; our schemas
///   list every property as required and forbid extra ones, as strict mode needs).
/// - Reasoning models: reasoning is kept out of the answer (gpt-oss: `include_reasoning:
///   false`; Qwen: `reasoning_format: hidden` for plain text — not allowed together with JSON
///   output, where Groq hides it by itself) and kept short (`reasoning_effort: low`) so the
///   free per-minute token budget lasts.
pub fn groq_body(req: &ChatRequest) -> Value {
    let model = req.model.trim();
    let mut messages = vec![json!({ "role": "system", "content": req.system })];
    messages.extend(
        req.messages
            .iter()
            .map(|m| json!({ "role": m.role, "content": m.content })),
    );
    let mut body = json!({
        "model": model,
        "messages": messages,
        "max_completion_tokens": req.max_tokens.unwrap_or(2048),
        "temperature": req.temperature.unwrap_or(0.0),
    });
    if model.starts_with("openai/gpt-oss") {
        body["include_reasoning"] = json!(false);
        body["reasoning_effort"] = json!("low");
    } else if model.starts_with("qwen/") {
        body["reasoning_effort"] = json!("low");
        if req.json_schema.is_none() {
            body["reasoning_format"] = json!("hidden");
        }
    }
    if let Some(schema) = &req.json_schema {
        body["response_format"] = json!({
            "type": "json_schema",
            "json_schema": {
                "name": req.schema_name.clone().unwrap_or_else(|| "result".to_string()),
                "strict": supports_strict(model),
                "schema": schema,
            },
        });
    }
    body
}

/// Removes a `<think>…</think>` block some models put before the answer.
fn strip_thinking(text: &str) -> &str {
    match (text.find("<think>"), text.find("</think>")) {
        (Some(start), Some(end)) if start < end => text[end + "</think>".len()..].trim_start(),
        _ => text,
    }
}

impl AIProvider for GroqProvider {
    fn id(&self) -> Provider {
        Provider::Groq
    }

    fn base_url(&self) -> &'static str {
        GROQ_URL
    }

    fn chat_request(
        &self,
        http: &reqwest::Client,
        key: &str,
        req: &ChatRequest,
    ) -> reqwest::RequestBuilder {
        http.post(format!("{}/chat/completions", self.base_url()))
            .bearer_auth(key)
            .json(&groq_body(req))
    }

    fn extract_content(&self, v: &Value) -> Result<String, AiError> {
        let choice = &v["choices"][0];
        let text = choice["message"]["content"].as_str().unwrap_or_default();
        let text = strip_thinking(text);
        if text.trim().is_empty() {
            let reason = choice["finish_reason"].as_str().unwrap_or("no text");
            return Err(AiError::BadResponse(format!("empty answer ({reason})")));
        }
        Ok(text.to_string())
    }

    fn models_request(&self, http: &reqwest::Client, key: &str) -> reqwest::RequestBuilder {
        http.get(format!("{}/models", self.base_url()))
            .bearer_auth(key)
    }

    fn model_ids(&self, v: &Value) -> Vec<String> {
        v["data"]
            .as_array()
            .map(|a| {
                a.iter()
                    .filter_map(|m| m["id"].as_str())
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::tests::req;

    fn with_model(model: &str, schema: bool) -> ChatRequest {
        let mut r = req(Provider::Groq, schema);
        r.model = model.into();
        r
    }

    #[test]
    fn body_puts_the_system_prompt_first_and_asks_for_strict_json() {
        let b = groq_body(&with_model("qwen/qwen3.8-27b", true));
        assert_eq!(b["messages"][0]["role"], "system");
        assert_eq!(b["messages"][0]["content"], "sys");
        assert_eq!(b["messages"][1]["role"], "user");
        assert_eq!(b["response_format"]["type"], "json_schema");
        assert_eq!(b["response_format"]["json_schema"]["name"], "scene_spec");
        assert_eq!(b["response_format"]["json_schema"]["strict"], true);
        assert_eq!(
            b["response_format"]["json_schema"]["schema"]["type"],
            "object"
        );
        // JSON output and reasoning_format may not be combined.
        assert!(b.get("reasoning_format").is_none());
        assert_eq!(b["reasoning_effort"], "low");
        assert_eq!(b["temperature"], 0.0);
    }

    #[test]
    fn reasoning_stays_out_of_the_answer() {
        let qwen_text = groq_body(&with_model("qwen/qwen3.8-27b", false));
        assert_eq!(qwen_text["reasoning_format"], "hidden");
        assert!(qwen_text.get("response_format").is_none());
        let oss = groq_body(&with_model("openai/gpt-oss-120b", true));
        assert_eq!(oss["include_reasoning"], false);
        assert!(oss.get("reasoning_format").is_none());
        assert_eq!(oss["response_format"]["json_schema"]["strict"], true);
        // Unknown models: best-effort JSON, no reasoning parameters.
        let other = groq_body(&with_model("llama-3.3-70b-versatile", true));
        assert_eq!(other["response_format"]["json_schema"]["strict"], false);
        assert!(other.get("reasoning_effort").is_none());
    }

    #[test]
    fn extracts_the_answer_without_thinking() {
        let v = json!({"choices": [{"message": {"content": "<think>hmm</think>\n{\"a\":1}"}}],
            "model": "qwen/qwen3.8-27b"});
        assert_eq!(GroqProvider.extract_content(&v).unwrap(), "{\"a\":1}");
        assert_eq!(
            GroqProvider.response_model(&v).as_deref(),
            Some("qwen/qwen3.8-27b")
        );
        let empty = json!({"choices": [{"message": {"content": ""}, "finish_reason": "length"}]});
        assert!(GroqProvider
            .extract_content(&empty)
            .unwrap_err()
            .to_string()
            .contains("length"));
        assert!(GroqProvider.extract_content(&json!({})).is_err());
    }

    #[test]
    fn lists_models_and_builds_requests() {
        let v = json!({"data": [{"id": "openai/gpt-oss-120b"}, {"id": "qwen/qwen3.8-27b"}]});
        assert_eq!(
            GroqProvider.model_ids(&v),
            vec!["openai/gpt-oss-120b", "qwen/qwen3.8-27b"]
        );
        let http = reqwest::Client::new();
        let built = GroqProvider
            .chat_request(&http, "k", &req(Provider::Groq, true))
            .build()
            .unwrap();
        assert_eq!(built.url().as_str(), format!("{GROQ_URL}/chat/completions"));
        assert_eq!(built.headers()["authorization"], "Bearer k");
    }
}
