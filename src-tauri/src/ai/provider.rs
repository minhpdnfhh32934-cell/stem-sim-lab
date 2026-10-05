//! The `AIProvider` interface (PROMPT_PHAN_2 A2). The rest of the app only talks to
//! `ai_chat` / `ai_models`; each provider knows how to build its HTTP requests and read
//! its answers. Requests are built here and sent (with retry, timeout and cancel) by `mod.rs`.

use serde_json::Value;

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

    /// Model that actually answered, if the response says so.
    fn response_model(&self, v: &Value) -> Option<String> {
        v["model"].as_str().map(str::to_string)
    }

    /// HTTP request listing the provider's models (also proves that the key works).
    fn models_request(&self, http: &reqwest::Client, key: &str) -> reqwest::RequestBuilder;

    /// Model ids from a models listing.
    fn model_ids(&self, v: &Value) -> Vec<String>;
}
