//! The `AIProvider` interface (PROMPT_PHAN_2 A2). The rest of the app only talks to
//! `ai_chat` / `ai_models`; each provider knows how to build its HTTP requests and read
//! its answers. Requests are built here and sent (with retry, timeout and cancel) by `mod.rs`,
//! or streamed by `stream.rs`.

use serde_json::Value;

use super::stream::{SseEvent, StreamState};
use super::{AiError, ChatRequest, Provider};

pub trait AIProvider: Send + Sync {
    /// Which provider this is (also its keychain entry).
    fn id(&self) -> Provider;

    /// API base URL.
    fn base_url(&self) -> &'static str;

    /// HTTP request for one chat call (not sent yet).
    fn chat_request(
        &self,
        http: &reqwest::Client,
        key: &str,
        req: &ChatRequest,
    ) -> reqwest::RequestBuilder;

    /// The answer text (or the forced tool input, serialized as JSON).
    fn extract_content(&self, v: &Value) -> Result<String, AiError>;

    /// The answer stopped because it reached the output-token limit.
    fn truncated(&self, _v: &Value) -> bool {
        false
    }

    /// Model that actually answered, if the response says so.
    fn response_model(&self, v: &Value) -> Option<String> {
        v["model"].as_str().map(str::to_string)
    }

    /// HTTP request for one streamed chat call (server-sent events), sent to `base`: the
    /// provider's [`base_url`](Self::base_url) in the app, a mock server in tests.
    fn stream_request(
        &self,
        http: &reqwest::Client,
        base: &str,
        key: &str,
        req: &ChatRequest,
    ) -> reqwest::RequestBuilder;

    /// Reads one event of a streamed answer into `st`: new answer text goes to `st.delta`, the
    /// end of the answer and its reason to `st`. An error the provider reports inside the stream
    /// is returned as the HTTP error it stands for (`stream::provider_error`).
    fn on_sse(&self, ev: &SseEvent, st: &mut StreamState) -> Result<(), AiError>;

    /// HTTP request listing the provider's models (also proves that the key works).
    fn models_request(&self, http: &reqwest::Client, key: &str) -> reqwest::RequestBuilder;

    /// Model ids from a models listing.
    fn model_ids(&self, v: &Value) -> Vec<String>;
}
