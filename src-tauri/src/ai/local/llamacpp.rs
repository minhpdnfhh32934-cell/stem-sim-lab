//! llama.cpp's `llama-server` (default 127.0.0.1:8080). It serves one model: `GET /props`
//! (context size it was started with, vision support in newer builds, build), `GET /health`
//! (200 ready, 503 "Loading model"), `GET /v1/models`, OpenAI-compatible chat. With
//! `--api-key` it answers 401. Closing the connection stops the generation.
//!
//! Port 8080 is used by many other programs, so only an answer with llama-server's own fields
//! counts as llama.cpp.

use serde_json::Value;

use super::endpoint::Loopback;
use super::openai_compat::{openai_body, openai_models, parse_openai_event};
use super::runtime::{
    clean_label, positive, Cap, Capabilities, ChatOptions, Fingerprint, LocalModel, LocalRuntime,
    ModelDetails, RuntimeKind, StreamFormat, StreamPiece,
};
use super::LocalChatRequest;
use crate::ai::AiError;

pub struct LlamaCpp;

/// llama-server's answer while it loads its model.
fn is_loading(status: u16, body: &str) -> bool {
    status == 503 && body.to_ascii_lowercase().contains("loading model")
}

/// The context size the server was started with.
fn n_ctx(v: &Value) -> Option<u64> {
    positive(&v["default_generation_settings"]["n_ctx"]).or_else(|| positive(&v["n_ctx"]))
}

impl LocalRuntime for LlamaCpp {
    fn kind(&self) -> RuntimeKind {
        RuntimeKind::LlamaCpp
    }

    fn declared(&self) -> Capabilities {
        Capabilities {
            list_models: Cap::Yes,
            context_length: Cap::Yes,
            vision: Cap::Unverified,
            streaming: Cap::Yes,
            cancel: Cap::Yes,
            json_schema: Cap::Yes,
            load_state: Cap::Yes,
        }
    }

    fn fingerprint_request(
        &self,
        http: &reqwest::Client,
        base: &Loopback,
    ) -> reqwest::RequestBuilder {
        http.get(base.url("/props"))
    }

    fn parse_fingerprint(&self, status: u16, body: &str) -> Fingerprint {
        if is_loading(status, body) {
            return Fingerprint::Match {
                version: None,
                loading: true,
            };
        }
        match status {
            401 | 403 => Fingerprint::NeedsAuth,
            200 => match serde_json::from_str::<Value>(body) {
                Ok(v)
                    if v["default_generation_settings"].is_object()
                        || v["total_slots"].is_u64() =>
                {
                    Fingerprint::Match {
                        version: clean_label(&v["build_info"]),
                        loading: false,
                    }
                }
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

    fn info_request(
        &self,
        http: &reqwest::Client,
        base: &Loopback,
        _model: &str,
    ) -> Option<reqwest::RequestBuilder> {
        Some(self.fingerprint_request(http, base))
    }

    /// `modalities` exists in newer builds only; without it vision stays unverified.
    fn parse_info(&self, v: &Value, model: &str) -> ModelDetails {
        let context = n_ctx(v);
        let vision = v["modalities"]["vision"]
            .as_bool()
            .map_or(Cap::Unverified, Cap::from_bool);
        ModelDetails {
            model: model.to_string(),
            context_length: context,
            vision,
            thinking: Cap::Unverified,
            loaded: Some(true),
            // As in every model list: a name in Ollama's cloud form is never shown as local.
            remote: super::ollama::is_cloud_name(model),
            capabilities: Capabilities {
                list_models: Cap::Yes,
                context_length: if context.is_some() {
                    Cap::Yes
                } else {
                    Cap::Unverified
                },
                vision,
                load_state: Cap::Yes,
                ..Capabilities::UNVERIFIED
            },
            declared: self.declared(),
        }
    }

    fn health_request(
        &self,
        http: &reqwest::Client,
        base: &Loopback,
    ) -> Option<reqwest::RequestBuilder> {
        Some(http.get(base.url("/health")))
    }

    fn parse_health(&self, status: u16, body: &str) -> Option<bool> {
        if is_loading(status, body) {
            return Some(false);
        }
        let v: Value = serde_json::from_str(body).ok()?;
        (status == 200 && v["status"] == "ok").then_some(true)
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

    const PROPS: &str = include_str!("../../../tests/fixtures/local-ai/llamacpp-props.json");
    const LOADING: &str = include_str!("../../../tests/fixtures/local-ai/llamacpp-loading.json");

    #[test]
    fn props_identify_llama_server_and_a_plain_web_page_does_not() {
        assert_eq!(
            LlamaCpp.parse_fingerprint(200, PROPS),
            Fingerprint::Match {
                version: Some("b6700-1a2b3c4d".into()),
                loading: false
            }
        );
        assert_eq!(
            LlamaCpp.parse_fingerprint(503, LOADING),
            Fingerprint::Match {
                version: None,
                loading: true
            }
        );
        let html = include_str!("../../../tests/fixtures/local-ai/html-page.html");
        assert_eq!(LlamaCpp.parse_fingerprint(200, html), Fingerprint::NotThis);
        // Another server's health-style answer is not enough.
        assert_eq!(
            LlamaCpp.parse_fingerprint(200, r#"{"status":"ok"}"#),
            Fingerprint::NotThis
        );
        assert_eq!(
            LlamaCpp.parse_fingerprint(503, "busy"),
            Fingerprint::NotThis
        );
        assert_eq!(LlamaCpp.parse_fingerprint(401, ""), Fingerprint::NeedsAuth);
    }

    #[test]
    fn props_give_the_context_and_vision() {
        let d = LlamaCpp.parse_info(&serde_json::from_str(PROPS).unwrap(), "gemma.gguf");
        assert_eq!(d.context_length, Some(4096));
        assert_eq!(d.vision, Cap::No);
        assert_eq!(d.loaded, Some(true));
        assert!(!d.remote);
        // The details agree with the model list (src/ai/local/runtimes.ts does the same).
        assert!(
            LlamaCpp
                .parse_info(&serde_json::json!({}), "gpt-oss:120b-cloud")
                .remote
        );
        let old = LlamaCpp.parse_info(&serde_json::json!({"n_ctx": 2048}), "m");
        assert_eq!(old.context_length, Some(2048));
        assert_eq!(old.vision, Cap::Unverified);
        assert_eq!(LlamaCpp.parse_health(200, r#"{"status":"ok"}"#), Some(true));
        assert_eq!(LlamaCpp.parse_health(503, LOADING), Some(false));
        assert_eq!(LlamaCpp.parse_health(404, "nope"), None);
        let models = LlamaCpp.parse_models(
            &serde_json::from_str(include_str!(
                "../../../tests/fixtures/local-ai/llamacpp-models.json"
            ))
            .unwrap(),
        );
        assert_eq!(models[0].id, "gemma-3-4b-it-Q4_K_M.gguf");
    }
}
