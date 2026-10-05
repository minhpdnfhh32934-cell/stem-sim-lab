//! `ClaudeProvider` (Anthropic Messages API). The only provider of the pilot edition and an
//! option in the main edition.

use serde_json::{json, Value};

use super::provider::AIProvider;
use super::{AiError, ChatRequest, Provider};

pub const CLAUDE_URL: &str = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION: &str = "2023-06-01";

pub struct ClaudeProvider;

/// JSON body for the Messages API.
///
/// - Structured output: a single tool whose `input_schema` is the requested JSON schema, and
///   `tool_choice` forces Claude to call it.
/// - The system prompt is marked for prompt caching (ignored by the API when it is shorter
///   than the model's minimum cacheable length).
/// - No `temperature`: recent Claude models reject non-default sampling parameters; the
///   pipeline does not depend on it (the code checks every number anyway).
pub fn claude_body(req: &ChatRequest) -> Value {
    let messages: Vec<Value> = req
        .messages
        .iter()
        .map(|m| json!({ "role": m.role, "content": m.content }))
        .collect();
    let mut body = json!({
        "model": req.model.trim(),
        "system": [{
            "type": "text",
            "text": req.system,
            "cache_control": { "type": "ephemeral" },
        }],
        "messages": messages,
        "max_tokens": req.max_tokens.unwrap_or(2048),
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

impl AIProvider for ClaudeProvider {
    fn id(&self) -> Provider {
        Provider::Claude
    }

    fn base_url(&self) -> &'static str {
        CLAUDE_URL
    }

    fn chat_request(
        &self,
        http: &reqwest::Client,
        key: &str,
        req: &ChatRequest,
    ) -> reqwest::RequestBuilder {
        http.post(format!("{}/messages", self.base_url()))
            .header("x-api-key", key)
            .header("anthropic-version", ANTHROPIC_VERSION)
            .json(&claude_body(req))
    }

    fn extract_content(&self, v: &Value) -> Result<String, AiError> {
        let blocks = v["content"]
            .as_array()
            .ok_or_else(|| AiError::BadResponse("missing content".into()))?;
        if let Some(tool) = blocks.iter().find(|b| b["type"] == "tool_use") {
            return Ok(tool["input"].to_string());
        }
        let text: String = blocks
            .iter()
            .filter(|b| b["type"] == "text")
            .filter_map(|b| b["text"].as_str())
            .collect::<Vec<_>>()
            .join("");
        if text.trim().is_empty() {
            let reason = v["stop_reason"].as_str().unwrap_or("no text");
            return Err(AiError::BadResponse(format!("empty answer ({reason})")));
        }
        Ok(text)
    }

    fn models_request(&self, http: &reqwest::Client, key: &str) -> reqwest::RequestBuilder {
        http.get(format!("{}/models?limit=1000", self.base_url()))
            .header("x-api-key", key)
            .header("anthropic-version", ANTHROPIC_VERSION)
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

    #[test]
    fn body_forces_the_schema_tool_and_caches_the_system_prompt() {
        let b = claude_body(&req(Provider::Claude, true));
        assert_eq!(b["tool_choice"]["type"], "tool");
        assert_eq!(b["tool_choice"]["name"], "scene_spec");
        assert_eq!(b["tools"][0]["input_schema"]["type"], "object");
        assert_eq!(b["system"][0]["text"], "sys");
        assert_eq!(b["system"][0]["cache_control"]["type"], "ephemeral");
        assert_eq!(b["messages"][0]["role"], "user");
        assert!(b.get("temperature").is_none());
        let plain = claude_body(&req(Provider::Claude, false));
        assert!(plain.get("tools").is_none());
    }

    #[test]
    fn extracts_tool_input_or_text() {
        let tool = json!({"content": [
            {"type": "text", "text": "ok"},
            {"type": "tool_use", "name": "scene_spec", "input": {"a": 1}}
        ], "model": "claude-x"});
        assert_eq!(ClaudeProvider.extract_content(&tool).unwrap(), "{\"a\":1}");
        assert_eq!(
            ClaudeProvider.response_model(&tool).as_deref(),
            Some("claude-x")
        );
        let text = json!({"content": [{"type": "text", "text": "Giải thích"}]});
        assert_eq!(ClaudeProvider.extract_content(&text).unwrap(), "Giải thích");
        let cut = json!({"content": [], "stop_reason": "max_tokens"});
        assert!(ClaudeProvider
            .extract_content(&cut)
            .unwrap_err()
            .to_string()
            .contains("max_tokens"));
        assert!(ClaudeProvider.extract_content(&json!({})).is_err());
    }

    #[test]
    fn lists_models_and_builds_requests() {
        let v = json!({"data": [{"id": "claude-sonnet-5-5"}, {"id": "claude-haiku-4-5"}]});
        assert_eq!(
            ClaudeProvider.model_ids(&v),
            vec!["claude-sonnet-5-5", "claude-haiku-4-5"]
        );
        let http = reqwest::Client::new();
        let built = ClaudeProvider
            .chat_request(&http, "k", &req(Provider::Claude, true))
            .build()
            .unwrap();
        assert_eq!(built.url().as_str(), format!("{CLAUDE_URL}/messages"));
        assert_eq!(built.headers()["x-api-key"], "k");
        assert_eq!(built.headers()["anthropic-version"], ANTHROPIC_VERSION);
    }
}
