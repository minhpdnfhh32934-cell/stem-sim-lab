//! Any local server with the OpenAI-compatible API (`GET /v1/models`,
//! `POST /v1/chat/completions` streamed as server-sent events). LM Studio and llama.cpp use the
//! same chat code ([`openai_body`], [`parse_openai_event`]).
//!
//! An unknown server is only used when the user picks it explicitly; its capabilities stay
//! "unverified" until checked on this computer. Reasoning fields (`reasoning_content`) are never
//! read.

use serde_json::{json, Value};

use super::endpoint::Loopback;
use super::runtime::{
    clean_id, error_message, openai_model_list, Cap, Capabilities, ChatOptions, Fingerprint,
    LocalModel, LocalRuntime, RuntimeKind, StreamFormat, StreamPiece,
};
use super::{chat_role, stream_error, LocalChatRequest};
use crate::ai::AiError;

pub struct OpenAiCompat;

/// JSON body for a streamed `/v1/chat/completions`.
pub fn openai_body(req: &LocalChatRequest, opts: &ChatOptions) -> Value {
    let mut messages = vec![json!({ "role": "system", "content": req.system })];
    messages.extend(
        req.messages
            .iter()
            .map(|m| json!({ "role": chat_role(&m.role), "content": m.content })),
    );
    let mut body = json!({
        "model": req.model.trim(),
        "messages": messages,
        "stream": true,
        "max_tokens": opts.max_tokens,
    });
    if let Some(t) = req.temperature {
        body["temperature"] = json!(t);
    }
    // Support differs per server (unverified until tested on this computer); the page only
    // asks for it when the check said yes.
    if let Some(schema) = &req.json_schema {
        body["response_format"] = json!({
            "type": "json_schema",
            "json_schema": { "name": "result", "schema": schema },
        });
    }
    body
}

/// One `data:` payload of the stream.
pub fn parse_openai_event(data: &str) -> Result<StreamPiece, AiError> {
    let v: Value = serde_json::from_str(data)
        .map_err(|_| AiError::BadResponse(format!("{}: unreadable stream line", super::FAILED)))?;
    if let Some(msg) = error_message(&v) {
        return Err(stream_error(&msg));
    }
    let choice = &v["choices"][0];
    Ok(StreamPiece {
        text: choice["delta"]["content"].as_str().map(str::to_string),
        done: choice["finish_reason"]
            .as_str()
            .map(|reason| reason == "length"),
        model: v["model"].as_str().map(str::to_string),
    })
}

/// Model ids of an OpenAI-style list.
pub fn openai_models(v: &Value) -> Vec<LocalModel> {
    openai_model_list(v)
        .unwrap_or_default()
        .into_iter()
        .filter_map(|m| m["id"].as_str().and_then(clean_id))
        .map(LocalModel::named)
        .collect()
}

impl LocalRuntime for OpenAiCompat {
    fn kind(&self) -> RuntimeKind {
        RuntimeKind::OpenAiCompatible
    }

    fn declared(&self) -> Capabilities {
        Capabilities {
            list_models: Cap::Yes,
            ..Capabilities::UNVERIFIED
        }
    }

    fn fingerprint_request(
        &self,
        http: &reqwest::Client,
        base: &Loopback,
    ) -> reqwest::RequestBuilder {
        self.models_request(http, base)
    }

    /// A 200 answer with `{"data":[{"id":…}, …]}`.
    fn parse_fingerprint(&self, status: u16, body: &str) -> Fingerprint {
        match status {
            401 | 403 => Fingerprint::NeedsAuth,
            200 => match serde_json::from_str::<Value>(body) {
                Ok(v) if openai_model_list(&v).is_some() => Fingerprint::Match {
                    version: None,
                    loading: false,
                },
                _ => Fingerprint::NotThis,
            },
            _ => Fingerprint::NotThis,
        }
    }

    fn models_request(&self, http: &reqwest::Client, base: &Loopback) -> reqwest::RequestBuilder {
        http.get(base.url("/v1/models"))
    }

    fn parse_models(&self, v: &Value) -> Vec<LocalModel> {
        openai_models(v)
    }

    fn chat_request(
        &self,
        http: &reqwest::Client,
        base: &Loopback,
        req: &LocalChatRequest,
        opts: &ChatOptions,
    ) -> reqwest::RequestBuilder {
        http.post(base.url("/v1/chat/completions"))
            .json(&openai_body(req, opts))
    }

    fn stream_format(&self) -> StreamFormat {
        StreamFormat::Sse
    }

    fn parse_event(&self, data: &str) -> Result<StreamPiece, AiError> {
        parse_openai_event(data)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::local::stream::{sse_line, Sse};
    use crate::ai::Message;

    #[test]
    fn a_model_list_identifies_the_server_and_html_does_not() {
        let list = include_str!("../../../tests/fixtures/local-ai/openai-models.json");
        assert!(matches!(
            OpenAiCompat.parse_fingerprint(200, list),
            Fingerprint::Match { .. }
        ));
        let html = include_str!("../../../tests/fixtures/local-ai/html-page.html");
        assert_eq!(
            OpenAiCompat.parse_fingerprint(200, html),
            Fingerprint::NotThis
        );
        assert_eq!(
            OpenAiCompat.parse_fingerprint(200, r#"{"data":[{"name":"x"}]}"#),
            Fingerprint::NotThis
        );
        assert_eq!(
            OpenAiCompat.parse_fingerprint(403, ""),
            Fingerprint::NeedsAuth
        );
        let models = OpenAiCompat.parse_models(&serde_json::from_str(list).unwrap());
        assert_eq!(models.len(), 2);
        assert_eq!(models[1].id, "phi-4-mini");
        assert_eq!(models[1].vision, Cap::Unverified);
        assert!(models.iter().all(|m| !m.remote));
    }

    #[test]
    fn models_named_as_ollama_cloud_models_are_flagged_remote() {
        // Ollama's own `/v1/models` lists its cloud models next to the local ones.
        let models = openai_models(&json!({"object": "list", "data": [
            {"id": "gpt-oss:120b-cloud"}, {"id": "kimi-k2:cloud"}, {"id": "qwen3:8b"}
        ]}));
        let remote: Vec<bool> = models.iter().map(|m| m.remote).collect();
        assert_eq!(remote, vec![true, true, false]);
        // The model details built from a name say the same.
        let d = OpenAiCompat.parse_info(&json!({}), "gpt-oss:120b-cloud");
        assert!(d.remote);
    }

    #[test]
    fn the_sse_stream_gives_text_and_ignores_reasoning() {
        let text = include_str!("../../../tests/fixtures/local-ai/openai-chat.sse");
        let mut answer = String::new();
        let mut done = None;
        let mut ended = false;
        for line in text.lines() {
            match sse_line(line) {
                Sse::Data(d) => {
                    let p = parse_openai_event(d).unwrap();
                    answer.push_str(p.text.as_deref().unwrap_or(""));
                    if p.done.is_some() {
                        done = p.done;
                    }
                }
                Sse::Done => ended = true,
                _ => {}
            }
        }
        assert_eq!(answer, "Lực là đại lượng vectơ.");
        assert_eq!(done, Some(false));
        assert!(ended);
        let cut =
            parse_openai_event(r#"{"choices":[{"delta":{},"finish_reason":"length"}]}"#).unwrap();
        assert_eq!(cut.done, Some(true));
        let err = parse_openai_event(
            r#"{"error":{"message":"Loading model","type":"unavailable_error","code":503}}"#,
        )
        .unwrap_err();
        assert!(matches!(err, AiError::Http(ref m) if m.starts_with(super::super::LOADING)));
    }

    #[test]
    fn the_chat_body_is_streamed_with_the_system_prompt_first() {
        let req = LocalChatRequest {
            request_id: "r".into(),
            kind: RuntimeKind::OpenAiCompatible,
            base_url: "http://127.0.0.1:8080".into(),
            model: "m".into(),
            system: "sys".into(),
            messages: vec![Message {
                role: "user".into(),
                content: "hi".into(),
            }],
            json_schema: Some(json!({"type": "object"})),
            temperature: None,
            max_tokens: None,
            context_length: None,
            think: None,
            timeout_secs: None,
        };
        let b = openai_body(
            &req,
            &ChatOptions {
                max_tokens: 8,
                context_length: 4096,
                think: Some(false),
            },
        );
        assert_eq!(b["stream"], true);
        assert_eq!(b["max_tokens"], 8);
        assert_eq!(b["messages"][0]["content"], "sys");
        assert_eq!(b["messages"][1]["role"], "user");
        assert_eq!(b["response_format"]["type"], "json_schema");
        assert!(b.get("temperature").is_none() && b.get("think").is_none());
    }
}
