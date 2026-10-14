//! LM Studio (default 127.0.0.1:1234, the user starts its server). Models come from its REST API
//! `GET /api/v0/models` (type llm / vlm / embeddings, loaded state, context length); when that
//! API is missing (404) the OpenAI-compatible `/v1/models` is used. Chat is OpenAI-compatible.
//! A model that is not loaded is loaded on the first question, which can take a while.

use serde_json::Value;

use super::endpoint::Loopback;
use super::openai_compat::{openai_body, parse_openai_event, OpenAiCompat};
use super::runtime::{
    clean_id, clean_label, openai_model_list, positive, Cap, Capabilities, ChatOptions,
    Fingerprint, LocalModel, LocalRuntime, RuntimeKind, StreamFormat, StreamPiece,
};
use super::LocalChatRequest;
use crate::ai::AiError;

pub struct LmStudio;

impl LocalRuntime for LmStudio {
    fn kind(&self) -> RuntimeKind {
        RuntimeKind::LmStudio
    }

    fn declared(&self) -> Capabilities {
        Capabilities {
            list_models: Cap::Yes,
            context_length: Cap::Yes,
            vision: Cap::Unverified,
            streaming: Cap::Yes,
            cancel: Cap::Unverified,
            json_schema: Cap::Yes,
            load_state: Cap::Yes,
        }
    }

    fn fingerprint_request(
        &self,
        http: &reqwest::Client,
        base: &Loopback,
    ) -> reqwest::RequestBuilder {
        self.models_request(http, base)
    }

    /// `/api/v0/models` exists only in LM Studio: a 200 answer with an OpenAI-style list.
    fn parse_fingerprint(&self, status: u16, body: &str) -> Fingerprint {
        match status {
            401 | 403 => Fingerprint::NeedsAuth,
            200 => match serde_json::from_str::<Value>(body) {
                Ok(v) if v["object"] == "list" && openai_model_list(&v).is_some() => {
                    Fingerprint::Match {
                        version: None,
                        loading: false,
                    }
                }
                _ => Fingerprint::NotThis,
            },
            _ => Fingerprint::NotThis,
        }
    }

    fn models_request(&self, http: &reqwest::Client, base: &Loopback) -> reqwest::RequestBuilder {
        http.get(base.url("/api/v0/models"))
    }

    /// Chat models only (embedding models cannot answer).
    fn parse_models(&self, v: &Value) -> Vec<LocalModel> {
        openai_model_list(v)
            .unwrap_or_default()
            .into_iter()
            .filter(|m| m["type"] != "embeddings")
            .filter_map(|m| {
                let id = m["id"].as_str().and_then(clean_id)?;
                let vision = match m["type"].as_str() {
                    Some("vlm") => Cap::Yes,
                    Some("llm") => Cap::No,
                    _ => Cap::Unverified,
                };
                let loaded = match m["state"].as_str() {
                    Some("loaded") => Some(true),
                    Some("not-loaded") => Some(false),
                    _ => None,
                };
                Some(LocalModel {
                    family: clean_label(&m["arch"]),
                    quantization: clean_label(&m["quantization"]),
                    // The context it was loaded with, else the model's maximum.
                    context_length: positive(&m["loaded_context_length"])
                        .or_else(|| positive(&m["max_context_length"])),
                    vision,
                    loaded,
                    ..LocalModel::named(id)
                })
            })
            .collect()
    }

    fn models_fallback(&self) -> Option<&'static dyn LocalRuntime> {
        Some(&OpenAiCompat)
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

    const MODELS: &str = include_str!("../../../tests/fixtures/local-ai/lmstudio-models.json");

    #[test]
    fn the_rest_api_identifies_lm_studio() {
        assert!(matches!(
            LmStudio.parse_fingerprint(200, MODELS),
            Fingerprint::Match { .. }
        ));
        let html = include_str!("../../../tests/fixtures/local-ai/html-page.html");
        assert_eq!(LmStudio.parse_fingerprint(200, html), Fingerprint::NotThis);
        assert_eq!(LmStudio.parse_fingerprint(404, "{}"), Fingerprint::NotThis);
    }

    #[test]
    fn models_show_vision_load_state_and_context_without_embeddings() {
        let models = LmStudio.parse_models(&serde_json::from_str(MODELS).unwrap());
        assert_eq!(models.len(), 2, "the embedding model is left out");
        let llm = &models[0];
        assert_eq!(llm.id, "qwen2.5-7b-instruct");
        assert_eq!(llm.vision, Cap::No);
        assert_eq!(llm.loaded, Some(true));
        assert_eq!(llm.context_length, Some(8192), "loaded context first");
        let vlm = &models[1];
        assert_eq!(vlm.vision, Cap::Yes);
        assert_eq!(vlm.loaded, Some(false));
        assert_eq!(vlm.context_length, Some(32768));
        assert_eq!(vlm.quantization.as_deref(), Some("4bit"));
        assert!(models.iter().all(|m| !m.remote));
        assert!(LmStudio.models_fallback().is_some());
        // A name in Ollama's cloud form is flagged in every list.
        let cloud = LmStudio.parse_models(&serde_json::json!({"object": "list", "data": [
            {"id": "gpt-oss:120b-cloud", "type": "llm"}
        ]}));
        assert!(cloud[0].remote);
    }
}
