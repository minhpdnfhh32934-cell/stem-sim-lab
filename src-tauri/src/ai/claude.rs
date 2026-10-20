//! `ClaudeProvider` (Anthropic Messages API), an optional provider.

use serde_json::{json, Value};

use super::provider::AIProvider;
use super::stream::{event_json, provider_error, SseEvent, StreamState};
use super::{AiError, ChatRequest, Provider};

pub const CLAUDE_URL: &str = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION: &str = "2023-06-01";

pub struct ClaudeProvider;

/// Stop reasons of an answer that ended naturally (`tool_use`: the forced tool call of a
/// structured answer). Any other reason (`max_tokens`, `model_context_window_exceeded`,
/// `pause_turn`, a reason added later) marks the answer as possibly incomplete, streamed or not;
/// a `refusal` is an error.
const NATURAL_END: [&str; 3] = ["end_turn", "stop_sequence", "tool_use"];

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
        base: &str,
        key: &str,
        req: &ChatRequest,
    ) -> reqwest::RequestBuilder {
        http.post(format!("{base}/messages"))
            .header("x-api-key", key)
            .header("anthropic-version", ANTHROPIC_VERSION)
            .json(&claude_body(req))
    }

    /// Any stop reason but a natural end ([`NATURAL_END`]).
    fn truncated(&self, v: &Value) -> bool {
        v["stop_reason"]
            .as_str()
            .is_some_and(|r| !NATURAL_END.contains(&r))
    }

    /// The text, or the forced tool's input. A `refusal` is no answer even with text, as when
    /// streamed.
    fn extract_content(&self, v: &Value) -> Result<String, AiError> {
        if v["stop_reason"] == "refusal" {
            return Err(AiError::BadResponse("empty answer (refusal)".into()));
        }
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

    /// The same body with `"stream": true`.
    fn stream_request(
        &self,
        http: &reqwest::Client,
        base: &str,
        key: &str,
        req: &ChatRequest,
    ) -> reqwest::RequestBuilder {
        let mut body = claude_body(req);
        body["stream"] = json!(true);
        http.post(format!("{base}/messages"))
            .header("x-api-key", key)
            .header("anthropic-version", ANTHROPIC_VERSION)
            .json(&body)
    }

    /// Messages API events: the model from `message_start`, text from `text_delta`s (thinking,
    /// signature and tool deltas are not answer text), the stop reason from `message_delta`, the
    /// end at `message_stop`. An `error` event (e.g. `overloaded_error`) is the HTTP error it
    /// stands for. A `refusal` stop is an empty answer, as without streaming: the API leaves a
    /// declined partial out of a whole answer, so a streamed one is not kept either.
    fn on_sse(&self, ev: &SseEvent, st: &mut StreamState) -> Result<(), AiError> {
        let v = event_json(ev)?;
        match v["type"].as_str().unwrap_or(&ev.event) {
            "message_start" => {
                if st.model.is_none() {
                    st.model = v["message"]["model"].as_str().map(str::to_string);
                }
            }
            "content_block_delta" if v["delta"]["type"] == "text_delta" => {
                st.delta
                    .push_str(v["delta"]["text"].as_str().unwrap_or_default());
            }
            "message_delta" => {
                if let Some(reason) = v["delta"]["stop_reason"].as_str() {
                    if reason == "refusal" {
                        return Err(AiError::BadResponse("empty answer (refusal)".into()));
                    }
                    st.finished(reason, &NATURAL_END);
                }
            }
            "message_stop" => {
                st.ended = true;
                st.closed = true;
            }
            "error" => return Err(provider_error(&v["error"])),
            // ping, content_block_start/stop, other deltas and future event types.
            _ => {}
        }
        Ok(())
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
    fn reports_answers_cut_at_the_output_limit() {
        assert!(ClaudeProvider.truncated(&json!({"stop_reason": "max_tokens"})));
        assert!(!ClaudeProvider.truncated(&json!({"stop_reason": "end_turn"})));
    }

    #[test]
    fn every_stop_reason_but_a_natural_end_may_be_incomplete_streamed_or_not() {
        use crate::ai::stream::{SseEvent, StreamState};
        for (reason, cut) in [
            ("end_turn", false),
            ("stop_sequence", false),
            ("tool_use", false),
            ("max_tokens", true),
            ("model_context_window_exceeded", true),
            ("pause_turn", true),
            ("something_new", true),
        ] {
            let whole =
                json!({"content": [{"type": "text", "text": "Lực là "}], "stop_reason": reason});
            assert_eq!(ClaudeProvider.truncated(&whole), cut, "{reason}");
            assert_eq!(ClaudeProvider.extract_content(&whole).unwrap(), "Lực là ");
            let mut st = StreamState::default();
            let ev = SseEvent {
                event: "message_delta".into(),
                data: json!({"type": "message_delta", "delta": {"stop_reason": reason}})
                    .to_string(),
            };
            ClaudeProvider.on_sse(&ev, &mut st).unwrap();
            assert_eq!(st.truncated, cut, "{reason} streamed");
            assert!(st.ended);
        }
        // A refusal is no answer, streamed or not, even with text.
        let refused =
            json!({"content": [{"type": "text", "text": "Phần"}], "stop_reason": "refusal"});
        assert!(matches!(
            ClaudeProvider.extract_content(&refused),
            Err(AiError::BadResponse(ref m)) if m == "empty answer (refusal)"
        ));
    }

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
            .chat_request(
                &http,
                ClaudeProvider.base_url(),
                "k",
                &req(Provider::Claude, true),
            )
            .build()
            .unwrap();
        assert_eq!(built.url().as_str(), format!("{CLAUDE_URL}/messages"));
        assert_eq!(built.headers()["x-api-key"], "k");
        assert_eq!(built.headers()["anthropic-version"], ANTHROPIC_VERSION);
    }
}
