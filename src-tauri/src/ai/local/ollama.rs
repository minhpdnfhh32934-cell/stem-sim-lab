//! Ollama (default 127.0.0.1:11434): `GET /api/version`, `GET /api/tags`, `POST /api/show`,
//! `POST /api/chat` streamed as one JSON object per line.
//!
//! - `num_ctx` is always sent: Ollama's own default context is small and a longer prompt would
//!   be cut from the front, losing the system and safety instructions.
//! - `message.thinking` (reasoning of thinking models) is never read; `think` is sent only when
//!   the page asks and the model has the "thinking" capability (Ollama rejects it otherwise).
//! - "Cloud" models are listed by Ollama but run on ollama.com: they are flagged `remote` and
//!   never used (`remote_host` / `remote_model` fields, or a `…cloud` tag).

use serde_json::{json, Value};

use super::endpoint::Loopback;
use super::runtime::{
    clean_id, clean_label, error_message, positive, Cap, Capabilities, ChatOptions, Fingerprint,
    LocalModel, LocalRuntime, ModelDetails, RuntimeKind, StreamFormat, StreamPiece,
};
use super::{chat_role, stream_error, LocalChatRequest, LocalMessage};
use crate::ai::AiError;

pub struct Ollama;

/// A model whose tag says it runs on ollama.com ("gpt-oss:120b-cloud", "x:cloud").
pub fn is_cloud_name(name: &str) -> bool {
    let tag = name
        .rsplit_once(':')
        .map(|(_, t)| t.to_ascii_lowercase())
        .unwrap_or_default();
    tag == "cloud" || tag.ends_with("-cloud")
}

/// The answer describes a model that runs on another computer.
fn has_remote_fields(v: &Value) -> bool {
    ["remote_host", "remote_model"].iter().any(|k| {
        v.get(k)
            .and_then(Value::as_str)
            .is_some_and(|s| !s.trim().is_empty())
    })
}

/// The context length in `/api/show`'s `model_info`: `<architecture>.context_length`.
pub fn context_length(model_info: &Value) -> Option<u64> {
    if let Some(arch) = model_info
        .get("general.architecture")
        .and_then(Value::as_str)
    {
        if let Some(n) = model_info
            .get(format!("{arch}.context_length"))
            .and_then(positive)
        {
            return Some(n);
        }
    }
    model_info
        .as_object()?
        .iter()
        .find(|(k, _)| k.ends_with(".context_length"))
        .and_then(|(_, v)| positive(v))
}

/// One turn of `/api/chat`; a checked picture goes in `images` as base64 ([`super::vision`]).
fn ollama_message(m: &LocalMessage) -> Value {
    let mut v = json!({ "role": chat_role(&m.role), "content": m.content });
    if !m.images.is_empty() {
        v["images"] = json!(m.images);
    }
    v
}

/// JSON body for a streamed `/api/chat`.
pub fn ollama_body(req: &LocalChatRequest, opts: &ChatOptions) -> Value {
    let mut messages = vec![json!({ "role": "system", "content": req.system })];
    messages.extend(req.messages.iter().map(ollama_message));
    let mut options = json!({
        "num_ctx": opts.context_length,
        "num_predict": opts.max_tokens,
    });
    if let Some(t) = req.temperature {
        options["temperature"] = json!(t);
    }
    let mut body = json!({
        "model": req.model.trim(),
        "messages": messages,
        "stream": true,
        "options": options,
    });
    if let Some(schema) = &req.json_schema {
        body["format"] = schema.clone();
    }
    if let Some(think) = opts.think {
        body["think"] = json!(think);
    }
    body
}

impl LocalRuntime for Ollama {
    fn kind(&self) -> RuntimeKind {
        RuntimeKind::Ollama
    }

    fn declared(&self) -> Capabilities {
        Capabilities {
            list_models: Cap::Yes,
            context_length: Cap::Yes,
            vision: Cap::Unverified,
            streaming: Cap::Yes,
            cancel: Cap::Yes,
            json_schema: Cap::Yes,
            load_state: Cap::Unverified,
        }
    }

    fn fingerprint_request(
        &self,
        http: &reqwest::Client,
        base: &Loopback,
    ) -> reqwest::RequestBuilder {
        http.get(base.url("/api/version"))
    }

    /// `{"version":"0.12.6"}` and nothing that looks like another server.
    fn parse_fingerprint(&self, status: u16, body: &str) -> Fingerprint {
        match status {
            401 | 403 => Fingerprint::NeedsAuth,
            200 => match serde_json::from_str::<Value>(body) {
                Ok(v) if v.get("error").is_none() => match clean_label(&v["version"]) {
                    Some(version) => Fingerprint::Match {
                        version: Some(version),
                        loading: false,
                    },
                    None => Fingerprint::NotThis,
                },
                _ => Fingerprint::NotThis,
            },
            _ => Fingerprint::NotThis,
        }
    }

    fn models_request(&self, http: &reqwest::Client, base: &Loopback) -> reqwest::RequestBuilder {
        http.get(base.url("/api/tags"))
    }

    fn parse_models(&self, v: &Value) -> Vec<LocalModel> {
        let Some(list) = v["models"].as_array() else {
            return Vec::new();
        };
        list.iter()
            .filter_map(|m| {
                let id = m["name"]
                    .as_str()
                    .filter(|s| !s.trim().is_empty())
                    .or_else(|| m["model"].as_str())
                    .and_then(clean_id)?;
                let d = &m["details"];
                Some(LocalModel {
                    remote: has_remote_fields(m) || is_cloud_name(&id),
                    size_bytes: positive(&m["size"]),
                    family: clean_label(&d["family"]),
                    parameter_size: clean_label(&d["parameter_size"]),
                    quantization: clean_label(&d["quantization_level"]),
                    ..LocalModel::named(id)
                })
            })
            .collect()
    }

    fn info_request(
        &self,
        http: &reqwest::Client,
        base: &Loopback,
        model: &str,
    ) -> Option<reqwest::RequestBuilder> {
        Some(
            http.post(base.url("/api/show"))
                .json(&json!({ "model": model })),
        )
    }

    /// Newer Ollama lists `capabilities` ("vision", "thinking", …); older versions do not, and
    /// then those stay unverified.
    fn parse_info(&self, v: &Value, model: &str) -> ModelDetails {
        let caps: Option<Vec<&str>> = v["capabilities"]
            .as_array()
            .map(|a| a.iter().filter_map(Value::as_str).collect());
        let has = |name: &str| {
            caps.as_ref()
                .map_or(Cap::Unverified, |c| Cap::from_bool(c.contains(&name)))
        };
        let context = context_length(&v["model_info"]);
        let vision = has("vision");
        ModelDetails {
            model: model.to_string(),
            context_length: context,
            vision,
            thinking: has("thinking"),
            loaded: None,
            remote: has_remote_fields(v) || is_cloud_name(model),
            capabilities: Capabilities {
                list_models: Cap::Yes,
                context_length: if context.is_some() {
                    Cap::Yes
                } else {
                    Cap::Unverified
                },
                vision,
                ..Capabilities::UNVERIFIED
            },
            declared: self.declared(),
        }
    }

    fn chat_request(
        &self,
        http: &reqwest::Client,
        base: &Loopback,
        req: &LocalChatRequest,
        opts: &ChatOptions,
    ) -> reqwest::RequestBuilder {
        http.post(base.url("/api/chat"))
            .json(&ollama_body(req, opts))
    }

    fn stream_format(&self) -> StreamFormat {
        StreamFormat::Ndjson
    }

    fn parse_event(&self, data: &str) -> Result<StreamPiece, AiError> {
        let v: Value = serde_json::from_str(data).map_err(|_| {
            AiError::BadResponse(format!("{}: unreadable stream line", super::FAILED))
        })?;
        if let Some(msg) = error_message(&v) {
            return Err(stream_error(&msg));
        }
        Ok(StreamPiece {
            text: v["message"]["content"].as_str().map(str::to_string),
            done: (v["done"] == true).then(|| v["done_reason"] == "length"),
            model: v["model"].as_str().map(str::to_string),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::local::stream::Lines;
    use crate::ai::local::vision::tests::png;

    fn fixture(name: &str) -> Value {
        let text = match name {
            "tags" => include_str!("../../../tests/fixtures/local-ai/ollama-tags.json"),
            "show" => include_str!("../../../tests/fixtures/local-ai/ollama-show.json"),
            "old" => include_str!("../../../tests/fixtures/local-ai/ollama-show-vision-old.json"),
            "remote" => include_str!("../../../tests/fixtures/local-ai/ollama-show-remote.json"),
            _ => unreachable!(),
        };
        serde_json::from_str(text).unwrap()
    }

    #[test]
    fn the_version_answer_identifies_ollama_and_nothing_else_does() {
        let version = include_str!("../../../tests/fixtures/local-ai/ollama-version.json");
        assert_eq!(
            Ollama.parse_fingerprint(200, version),
            Fingerprint::Match {
                version: Some("0.12.6".into()),
                loading: false
            }
        );
        let html = include_str!("../../../tests/fixtures/local-ai/html-page.html");
        assert_eq!(Ollama.parse_fingerprint(200, html), Fingerprint::NotThis);
        assert_eq!(
            Ollama.parse_fingerprint(200, r#"{"error":"Unexpected endpoint"}"#),
            Fingerprint::NotThis
        );
        assert_eq!(
            Ollama.parse_fingerprint(404, "404 page not found"),
            Fingerprint::NotThis
        );
        assert_eq!(Ollama.parse_fingerprint(401, ""), Fingerprint::NeedsAuth);
    }

    #[test]
    fn tags_list_local_models_and_flag_cloud_ones() {
        let models = Ollama.parse_models(&fixture("tags"));
        let ids: Vec<&str> = models.iter().map(|m| m.id.as_str()).collect();
        assert_eq!(
            ids,
            vec![
                "qwen3:8b",
                "gemma3:4b",
                "gpt-oss:120b-cloud",
                "deepseek-v3.1:671b-cloud"
            ]
        );
        let qwen = &models[0];
        assert!(!qwen.remote);
        assert_eq!(qwen.size_bytes, Some(5_225_376_047));
        assert_eq!(qwen.parameter_size.as_deref(), Some("8.2B"));
        assert_eq!(qwen.quantization.as_deref(), Some("Q4_K_M"));
        assert_eq!(qwen.vision, Cap::Unverified);
        // Remote fields, or only the "-cloud" tag.
        assert!(models[2].remote);
        assert!(models[3].remote);
        assert!(Ollama.parse_models(&json!({"other": 1})).is_empty());
    }

    #[test]
    fn show_gives_the_context_and_the_capabilities_when_present() {
        let d = Ollama.parse_info(&fixture("show"), "qwen3:8b");
        assert_eq!(d.context_length, Some(40960));
        assert_eq!(d.vision, Cap::No);
        assert_eq!(d.thinking, Cap::Yes);
        assert!(!d.remote);
        assert_eq!(d.capabilities.context_length, Cap::Yes);
        assert_eq!(d.capabilities.json_schema, Cap::Unverified);
        // Older Ollama: no capabilities list, so vision and thinking stay unverified.
        let old = Ollama.parse_info(&fixture("old"), "llava:7b");
        assert_eq!(old.context_length, Some(32768));
        assert_eq!(old.vision, Cap::Unverified);
        assert_eq!(old.thinking, Cap::Unverified);
        let remote = Ollama.parse_info(&fixture("remote"), "gpt-oss:120b");
        assert!(remote.remote);
        assert!(is_cloud_name("x:cloud") && is_cloud_name("a:7b-CLOUD"));
        assert!(!is_cloud_name("cloudy:7b") && !is_cloud_name("qwen3"));
    }

    fn chat_req() -> LocalChatRequest {
        LocalChatRequest {
            request_id: "r".into(),
            kind: RuntimeKind::Ollama,
            base_url: "http://127.0.0.1:11434".into(),
            model: " qwen3:8b ".into(),
            system: "sys".into(),
            messages: vec![
                LocalMessage::text("user", "hỏi"),
                LocalMessage::text("assistant", "đáp"),
                LocalMessage::text("system", "lạ"),
            ],
            vision: false,
            json_schema: None,
            temperature: Some(0.2),
            max_tokens: None,
            context_length: None,
            think: None,
            timeout_secs: None,
        }
    }

    #[test]
    fn the_chat_body_always_carries_num_ctx() {
        let opts = ChatOptions {
            max_tokens: 512,
            context_length: 8192,
            think: None,
        };
        let b = ollama_body(&chat_req(), &opts);
        assert_eq!(b["model"], "qwen3:8b");
        assert_eq!(b["stream"], true);
        assert_eq!(b["options"]["num_ctx"], 8192);
        assert_eq!(b["options"]["num_predict"], 512);
        assert_eq!(b["options"]["temperature"], 0.2);
        assert_eq!(b["messages"][0]["role"], "system");
        assert_eq!(b["messages"][2]["role"], "assistant");
        // Only user and assistant turns come from the page.
        assert_eq!(b["messages"][3]["role"], "user");
        assert!(b.get("think").is_none() && b.get("format").is_none());
        let mut r = chat_req();
        r.json_schema = Some(json!({"type": "object"}));
        let b = ollama_body(
            &r,
            &ChatOptions {
                think: Some(false),
                ..opts
            },
        );
        assert_eq!(b["format"]["type"], "object");
        assert_eq!(b["think"], false);
        // Turns without a picture have no `images` field.
        assert!(b["messages"][1].get("images").is_none());
    }

    #[test]
    fn a_picture_goes_in_the_images_of_its_turn() {
        let mut r = chat_req();
        r.vision = true;
        r.messages = vec![
            LocalMessage::text("assistant", "Bảng có hình vẽ."),
            LocalMessage {
                images: vec![png()],
                ..LocalMessage::text("user", "Chỗ em khoanh là gì?")
            },
        ];
        let b = ollama_body(
            &r,
            &ChatOptions {
                max_tokens: 512,
                context_length: 8192,
                think: None,
            },
        );
        assert_eq!(b["messages"][2]["content"], "Chỗ em khoanh là gì?");
        assert_eq!(b["messages"][2]["images"], json!([png()]));
        assert!(b["messages"][1].get("images").is_none());
        assert!(b["messages"][0].get("images").is_none());
    }

    #[test]
    fn stream_lines_give_text_then_done() {
        let text = include_str!("../../../tests/fixtures/local-ai/ollama-chat.ndjson");
        let mut lines = Lines::new(1 << 20);
        let mut answer = String::new();
        let mut done = None;
        for line in lines.push(text.as_bytes()).unwrap() {
            if line.is_empty() {
                continue;
            }
            let p = Ollama.parse_event(&line).unwrap();
            answer.push_str(p.text.as_deref().unwrap_or(""));
            if p.done.is_some() {
                done = p.done;
            }
            assert_eq!(p.model.as_deref(), Some("qwen3:8b"));
        }
        // The thinking field is never part of the answer.
        assert_eq!(answer, "Gia tốc a = 2 m/s², lớn dần.");
        assert_eq!(done, Some(false));
        let cut = Ollama
            .parse_event(r#"{"message":{"content":""},"done":true,"done_reason":"length"}"#)
            .unwrap();
        assert_eq!(cut.done, Some(true));
        let err = Ollama
            .parse_event(r#"{"error":"model 'x' not found"}"#)
            .unwrap_err();
        assert!(matches!(err, AiError::Http(ref m) if m.starts_with(super::super::MODEL_MISSING)));
        assert!(Ollama.parse_event("not json").is_err());
    }
}
