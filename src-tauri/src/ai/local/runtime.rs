//! What every local runtime adapter provides: request builders and pure parsers. `mod.rs` sends
//! the requests (loopback client, timeouts, size caps, cancel); the adapters never touch the
//! network themselves, so they are tested on JSON fixtures.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::endpoint::Loopback;
use super::LocalChatRequest;
use crate::ai::AiError;

/// A program on this computer that serves a language model over HTTP.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum RuntimeKind {
    Ollama,
    LmStudio,
    LlamaCpp,
    /// Any other server with the OpenAI-compatible `/v1` API, chosen explicitly by the user.
    OpenAiCompatible,
}

impl RuntimeKind {
    /// The order in which an unknown address is identified (most specific first).
    pub const PROBE_ORDER: [RuntimeKind; 4] = [
        RuntimeKind::Ollama,
        RuntimeKind::LmStudio,
        RuntimeKind::LlamaCpp,
        RuntimeKind::OpenAiCompatible,
    ];
}

/// One capability: seen on this computer (`Yes` / `No`) or not checked (`Unverified`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Cap {
    Yes,
    No,
    Unverified,
}

impl Cap {
    pub fn from_bool(b: bool) -> Cap {
        if b {
            Cap::Yes
        } else {
            Cap::No
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Capabilities {
    pub list_models: Cap,
    pub context_length: Cap,
    pub vision: Cap,
    pub streaming: Cap,
    pub cancel: Cap,
    pub json_schema: Cap,
    pub load_state: Cap,
}

impl Capabilities {
    pub const UNVERIFIED: Capabilities = Capabilities {
        list_models: Cap::Unverified,
        context_length: Cap::Unverified,
        vision: Cap::Unverified,
        streaming: Cap::Unverified,
        cancel: Cap::Unverified,
        json_schema: Cap::Unverified,
        load_state: Cap::Unverified,
    };
}

/// How a streamed chat answer is framed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StreamFormat {
    /// One JSON object per line (Ollama `/api/chat`).
    Ndjson,
    /// Server-sent events, `data: {json}` lines and `data: [DONE]` (OpenAI-compatible).
    Sse,
}

/// What a fingerprint answer says about the address.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Fingerprint {
    /// It is this runtime.
    Match {
        version: Option<String>,
        /// It is still loading its model (llama.cpp answers 503 "Loading model").
        loading: bool,
    },
    /// Something answered but wants a key (401/403).
    NeedsAuth,
    /// Not this runtime.
    NotThis,
}

/// A model a runtime offers.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalModel {
    pub id: String,
    pub size_bytes: Option<u64>,
    pub family: Option<String>,
    pub parameter_size: Option<String>,
    pub quantization: Option<String>,
    pub context_length: Option<u64>,
    pub vision: Cap,
    /// Loaded in memory now (LM Studio), when the runtime says.
    pub loaded: Option<bool>,
    /// Runs on another computer (an Ollama "cloud" model): listed, never used.
    pub remote: bool,
}

impl LocalModel {
    pub fn named(id: String) -> LocalModel {
        LocalModel {
            id,
            size_bytes: None,
            family: None,
            parameter_size: None,
            quantization: None,
            context_length: None,
            vision: Cap::Unverified,
            loaded: None,
            remote: false,
        }
    }
}

/// What the runtime on this computer says about one model.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelDetails {
    pub model: String,
    pub context_length: Option<u64>,
    pub vision: Cap,
    /// The model reasons before answering (Ollama "thinking" capability).
    pub thinking: Cap,
    pub loaded: Option<bool>,
    pub remote: bool,
    /// Seen on this computer (`yes`/`no`) or not known (`unverified`).
    pub capabilities: Capabilities,
    /// What the runtime's documentation says: a hint only, never shown as checked.
    pub declared: Capabilities,
}

impl ModelDetails {
    /// Details known from a model listing only.
    pub fn from_listing(m: &LocalModel, declared: Capabilities) -> ModelDetails {
        ModelDetails {
            model: m.id.clone(),
            context_length: m.context_length,
            vision: m.vision,
            thinking: Cap::Unverified,
            loaded: m.loaded,
            remote: m.remote,
            capabilities: Capabilities {
                list_models: Cap::Yes,
                context_length: if m.context_length.is_some() {
                    Cap::Yes
                } else {
                    Cap::Unverified
                },
                vision: m.vision,
                load_state: if m.loaded.is_some() {
                    Cap::Yes
                } else {
                    Cap::Unverified
                },
                ..Capabilities::UNVERIFIED
            },
            declared,
        }
    }
}

/// Generation settings decided in `mod.rs` (clamped there), shared by every adapter.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ChatOptions {
    pub max_tokens: u32,
    /// Context window to ask for (Ollama `num_ctx`; the others use what was loaded).
    pub context_length: u32,
    /// Ollama `think`, only sent when the model has the "thinking" capability.
    pub think: Option<bool>,
}

/// One line of a streamed answer.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct StreamPiece {
    pub text: Option<String>,
    /// The answer ended; `Some(true)` when it stopped at the output limit.
    pub done: Option<bool>,
    pub model: Option<String>,
}

pub trait LocalRuntime: Send + Sync {
    fn kind(&self) -> RuntimeKind;

    /// What the runtime's documentation says it supports (a hint, never shown as checked).
    fn declared(&self) -> Capabilities;

    /// A cheap request that only this runtime answers in its own way.
    fn fingerprint_request(
        &self,
        http: &reqwest::Client,
        base: &Loopback,
    ) -> reqwest::RequestBuilder;

    fn parse_fingerprint(&self, status: u16, body: &str) -> Fingerprint;

    fn models_request(&self, http: &reqwest::Client, base: &Loopback) -> reqwest::RequestBuilder;

    fn parse_models(&self, v: &Value) -> Vec<LocalModel>;

    /// The runtime to ask for the model list when `models_request` gets a 404 (LM Studio
    /// without its `/api/v0` REST API).
    fn models_fallback(&self) -> Option<&'static dyn LocalRuntime> {
        None
    }

    /// A request for one model's details, when the runtime has one (otherwise the details come
    /// from the model list).
    fn info_request(
        &self,
        _http: &reqwest::Client,
        _base: &Loopback,
        _model: &str,
    ) -> Option<reqwest::RequestBuilder> {
        None
    }

    fn parse_info(&self, _v: &Value, model: &str) -> ModelDetails {
        ModelDetails::from_listing(&LocalModel::named(model.to_string()), self.declared())
    }

    /// A request telling whether the model is loaded (llama.cpp `/health`).
    fn health_request(
        &self,
        _http: &reqwest::Client,
        _base: &Loopback,
    ) -> Option<reqwest::RequestBuilder> {
        None
    }

    /// `Some(true)` loaded, `Some(false)` still loading, `None` unknown.
    fn parse_health(&self, _status: u16, _body: &str) -> Option<bool> {
        None
    }

    /// The streamed chat request (not sent yet).
    fn chat_request(
        &self,
        http: &reqwest::Client,
        base: &Loopback,
        req: &LocalChatRequest,
        opts: &ChatOptions,
    ) -> reqwest::RequestBuilder;

    fn stream_format(&self) -> StreamFormat;

    /// One stream payload: an NDJSON line, or the data of an SSE `data:` line. An error object
    /// in the stream becomes an `AiError` with a local tag.
    fn parse_event(&self, data: &str) -> Result<StreamPiece, AiError>;
}

/// The adapter for a runtime.
pub fn runtime(kind: RuntimeKind) -> &'static dyn LocalRuntime {
    match kind {
        RuntimeKind::Ollama => &super::ollama::Ollama,
        RuntimeKind::LmStudio => &super::lmstudio::LmStudio,
        RuntimeKind::LlamaCpp => &super::llamacpp::LlamaCpp,
        RuntimeKind::OpenAiCompatible => &super::openai_compat::OpenAiCompat,
    }
}

/// A model id from a runtime or the page: non-empty, at most 256 bytes, no control characters,
/// not a path step. Anything else is dropped (runtime data is untrusted text).
pub fn clean_id(s: &str) -> Option<String> {
    let s = s.trim();
    let ok = !s.is_empty()
        && s.len() <= 256
        && s != "."
        && s != ".."
        && !s.chars().any(char::is_control);
    ok.then(|| s.to_string())
}

/// A short descriptive label from a runtime (family, size, quantization): at most 64 bytes.
pub fn clean_label(v: &Value) -> Option<String> {
    let s = v.as_str()?.trim();
    (!s.is_empty() && s.len() <= 64 && !s.chars().any(char::is_control)).then(|| s.to_string())
}

/// A positive integer from a runtime (sizes, context lengths).
pub fn positive(v: &Value) -> Option<u64> {
    v.as_u64().filter(|n| *n > 0)
}

/// The OpenAI-style `{"data":[{"id":…}]}` model list (also used by LM Studio and llama.cpp).
pub fn openai_model_list(v: &Value) -> Option<Vec<&Value>> {
    let data = v.get("data")?.as_array()?;
    data.iter()
        .all(|m| m.get("id").and_then(Value::as_str).is_some())
        .then(|| data.iter().collect())
}

/// The error message of an OpenAI-style or Ollama error answer, if the body is one.
pub fn error_message(v: &Value) -> Option<String> {
    let e = v.get("error")?;
    let msg = e
        .as_str()
        .or_else(|| e.get("message").and_then(Value::as_str))?;
    Some(msg.chars().take(200).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn kinds_and_capabilities_use_the_page_names() {
        assert_eq!(
            serde_json::to_value(RuntimeKind::LmStudio).unwrap(),
            "lmStudio"
        );
        assert_eq!(
            serde_json::to_value(RuntimeKind::LlamaCpp).unwrap(),
            "llamaCpp"
        );
        assert_eq!(
            serde_json::to_value(RuntimeKind::OpenAiCompatible).unwrap(),
            "openAiCompatible"
        );
        assert_eq!(
            serde_json::from_value::<RuntimeKind>(json!("ollama")).unwrap(),
            RuntimeKind::Ollama
        );
        assert!(serde_json::from_value::<RuntimeKind>(json!("gemini")).is_err());
        assert_eq!(serde_json::to_value(Cap::Unverified).unwrap(), "unverified");
        let c = serde_json::to_value(Capabilities::UNVERIFIED).unwrap();
        assert_eq!(c["jsonSchema"], "unverified");
        assert_eq!(c["loadState"], "unverified");
        for kind in RuntimeKind::PROBE_ORDER {
            assert_eq!(runtime(kind).kind(), kind);
        }
    }

    #[test]
    fn untrusted_names_are_bounded() {
        assert_eq!(clean_id(" qwen3:8b ").as_deref(), Some("qwen3:8b"));
        assert_eq!(clean_id(""), None);
        assert_eq!(clean_id(".."), None);
        assert_eq!(clean_id("a\u{0}b"), None);
        assert_eq!(clean_id(&"x".repeat(257)), None);
        assert_eq!(clean_label(&json!("Q4_K_M")).as_deref(), Some("Q4_K_M"));
        assert_eq!(clean_label(&json!("x".repeat(65))), None);
        assert_eq!(clean_label(&json!(4)), None);
        assert_eq!(positive(&json!(0)), None);
        assert_eq!(positive(&json!(4096)), Some(4096));
    }
}
