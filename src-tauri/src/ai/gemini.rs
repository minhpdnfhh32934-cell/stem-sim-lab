//! `GeminiProvider` — the default provider (Gemini API terms require users 18+: keys can only
//! be stored after the 18+ confirmation, see `safety`).

use serde_json::{json, Value};

use super::provider::AIProvider;
use super::stream::{event_json, provider_error, SseEvent, StreamState};
use super::{AiError, ChatRequest, Provider};

pub const GEMINI_URL: &str = "https://generativelanguage.googleapis.com/v1beta";
/// Google AI Studio page where a Gemini API key is created (opened from Settings).
pub const GEMINI_KEY_PAGE: &str = "https://aistudio.google.com/apikey";
/// Gemini models think before answering and the thoughts count towards the output limit, so
/// the limit is raised to leave room for the actual JSON answer.
const GEMINI_MIN_OUTPUT_TOKENS: u32 = 8192;

pub struct GeminiProvider;

/// Model id as Gemini expects it in the URL (`models/` prefix removed if the user typed it).
pub fn gemini_model(model: &str) -> &str {
    model.trim().trim_start_matches("models/")
}

/// JSON body for `generateContent`. Structured output uses `responseJsonSchema` (standard
/// JSON Schema) with a JSON response type.
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

/// Finish reasons that mean Gemini's own filters stopped the answer: neither a natural end
/// (`STOP`) nor the output limit (`MAX_TOKENS`). What was written before such a stop is not an
/// answer.
const BLOCKED: [&str; 8] = [
    "SAFETY",
    "RECITATION",
    "PROHIBITED_CONTENT",
    "BLOCKLIST",
    "SPII",
    "IMAGE_SAFETY",
    "IMAGE_PROHIBITED_CONTENT",
    "IMAGE_RECITATION",
];

/// The answer text of a candidate. Thought summaries are not part of the answer.
fn answer_text(candidate: &Value) -> String {
    candidate["content"]["parts"]
        .as_array()
        .map(|ps| {
            ps.iter()
                .filter(|p| p["thought"].as_bool() != Some(true))
                .filter_map(|p| p["text"].as_str())
                .collect::<Vec<_>>()
                .join("")
        })
        .unwrap_or_default()
}

impl AIProvider for GeminiProvider {
    fn id(&self) -> Provider {
        Provider::Gemini
    }

    fn base_url(&self) -> &'static str {
        GEMINI_URL
    }

    fn chat_request(
        &self,
        http: &reqwest::Client,
        key: &str,
        req: &ChatRequest,
    ) -> reqwest::RequestBuilder {
        http.post(format!(
            "{}/models/{}:generateContent",
            self.base_url(),
            gemini_model(&req.model)
        ))
        .header("x-goog-api-key", key)
        .json(&gemini_body(req))
    }

    fn extract_content(&self, v: &Value) -> Result<String, AiError> {
        let candidate = &v["candidates"][0];
        let text = answer_text(candidate);
        if text.trim().is_empty() {
            let reason = candidate["finishReason"]
                .as_str()
                .or_else(|| v["promptFeedback"]["blockReason"].as_str())
                .unwrap_or("no text");
            return Err(AiError::BadResponse(format!("empty answer ({reason})")));
        }
        Ok(text)
    }

    fn truncated(&self, v: &Value) -> bool {
        v["candidates"][0]["finishReason"] == "MAX_TOKENS"
    }

    fn response_model(&self, v: &Value) -> Option<String> {
        v["modelVersion"].as_str().map(str::to_string)
    }

    /// `streamGenerateContent` with `alt=sse`: the same body, answered as server-sent events, each
    /// one a `GenerateContentResponse` with the next piece of the answer.
    fn stream_request(
        &self,
        http: &reqwest::Client,
        base: &str,
        key: &str,
        req: &ChatRequest,
    ) -> reqwest::RequestBuilder {
        http.post(format!(
            "{base}/models/{}:streamGenerateContent?alt=sse",
            gemini_model(&req.model)
        ))
        .header("x-goog-api-key", key)
        .json(&gemini_body(req))
    }

    /// Text parts without thoughts; `finishReason` ends the answer, `MAX_TOKENS` means it was
    /// cut. A blocked question (`promptFeedback.blockReason`) or an answer stopped by Gemini's
    /// filters ([`BLOCKED`], also after text was shown) is no answer, as without streaming:
    /// "empty answer (SAFETY)", and the page takes back what it showed. An `error` object is the
    /// HTTP error it stands for.
    fn on_sse(&self, ev: &SseEvent, st: &mut StreamState) -> Result<(), AiError> {
        let v = event_json(ev)?;
        if let Some(err) = v.get("error") {
            return Err(provider_error(err));
        }
        if st.model.is_none() {
            st.model = self.response_model(&v);
        }
        let candidate = &v["candidates"][0];
        let finish = candidate["finishReason"].as_str();
        if let Some(reason) = v["promptFeedback"]["blockReason"]
            .as_str()
            .or_else(|| finish.filter(|r| BLOCKED.contains(r)))
        {
            return Err(AiError::BadResponse(format!("empty answer ({reason})")));
        }
        st.delta.push_str(&answer_text(candidate));
        if let Some(reason) = finish {
            st.finished(reason, "MAX_TOKENS");
        }
        Ok(())
    }

    fn models_request(&self, http: &reqwest::Client, key: &str) -> reqwest::RequestBuilder {
        // 50 models per page by default; one page of 1000 holds them all.
        http.get(format!("{}/models?pageSize=1000", self.base_url()))
            .header("x-goog-api-key", key)
    }

    /// Only models that can generate text.
    fn model_ids(&self, v: &Value) -> Vec<String> {
        v["models"]
            .as_array()
            .map(|a| {
                a.iter()
                    .filter(|m| {
                        m["supportedGenerationMethods"]
                            .as_array()
                            .is_some_and(|g| g.iter().any(|x| x == "generateContent"))
                    })
                    .filter_map(|m| m["name"].as_str())
                    .map(|s| s.trim_start_matches("models/").to_string())
                    .collect()
            })
            .unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::tests::req;
    use crate::ai::Message;

    #[test]
    fn body_requests_json_with_the_schema() {
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
    fn extracts_text_without_thoughts() {
        let v = json!({"candidates": [{"content": {"parts": [
            {"text": "thinking…", "thought": true},
            {"text": "{\"a\":"},
            {"text": "1}"}
        ]}, "finishReason": "STOP"}], "modelVersion": "gemini-x"});
        assert_eq!(GeminiProvider.extract_content(&v).unwrap(), "{\"a\":1}");
        assert_eq!(
            GeminiProvider.response_model(&v).as_deref(),
            Some("gemini-x")
        );
        let cut = json!({"candidates": [{"content": {"parts": []}, "finishReason": "MAX_TOKENS"}]});
        let err = GeminiProvider.extract_content(&cut).unwrap_err();
        assert!(err.to_string().contains("MAX_TOKENS"));
    }

    #[test]
    fn reports_answers_cut_at_the_output_limit() {
        let cut = json!({"candidates": [{"content": {"parts": [{"text": "Bước 1"}]}, "finishReason": "MAX_TOKENS"}]});
        assert!(GeminiProvider.truncated(&cut));
        let done = json!({"candidates": [{"content": {"parts": [{"text": "Xong"}]}, "finishReason": "STOP"}]});
        assert!(!GeminiProvider.truncated(&done));
        assert!(!GeminiProvider.truncated(&json!({})));
    }

    #[test]
    fn lists_text_models_only() {
        let v = json!({"models": [
            {"name": "models/gemini-3.8-flash", "supportedGenerationMethods": ["generateContent"]},
            {"name": "models/text-embedding-004", "supportedGenerationMethods": ["embedContent"]}
        ]});
        assert_eq!(GeminiProvider.model_ids(&v), vec!["gemini-3.8-flash"]);
    }

    #[test]
    fn urls_and_model_names() {
        assert_eq!(GeminiProvider.base_url(), GEMINI_URL);
        assert_eq!(
            gemini_model(" models/gemini-3.8-flash "),
            "gemini-3.8-flash"
        );
        let http = reqwest::Client::new();
        let built = GeminiProvider
            .chat_request(&http, "k", &req(Provider::Gemini, false))
            .build()
            .unwrap();
        assert_eq!(
            built.url().as_str(),
            format!("{GEMINI_URL}/models/m:generateContent")
        );
        assert_eq!(built.headers()["x-goog-api-key"], "k");
    }
}
