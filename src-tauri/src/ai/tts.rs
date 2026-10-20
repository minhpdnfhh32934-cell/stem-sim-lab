//! AI Teacher's cloud voice: Gemini text-to-speech (`generateContent` with an AUDIO response).
//!
//! The page sends text that was already turned into words (`src/teacher/voice/vietnameseText.ts`);
//! the key stays in the keychain and the call goes through the same gates as `ai_chat`: the
//! 18+ confirmation, the daily cap, retries on 429/5xx, a timeout and cancellation. Only the
//! text is sent, never the conversation. The answer is base64 audio (WAV or raw 16-bit PCM,
//! 24 kHz mono) that the page plays.

use std::time::{Duration, Instant};

use base64::Engine as _;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::gemini::{gemini_model, GEMINI_URL};
use super::{
    api_key, client, count_usage, require_ai_allowed, retry_delay, run_counted, AiError, AiState,
    InflightGuard, Provider,
};

/// Longest text in one request (a few sentences; the page sends phrase groups).
pub const MAX_TTS_CHARS: usize = 1200;
/// Default and longest wait for one piece of audio.
const DEFAULT_TTS_TIMEOUT_SECS: u64 = 45;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsRequest {
    pub request_id: String,
    /// A Gemini TTS model ("gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts").
    pub model: String,
    /// A prebuilt voice name ("Achird", "Sulafat", …).
    pub voice: String,
    /// Delivery instructions ("vui vẻ, rõ ràng…"), sent as `speech_metadata.style`.
    #[serde(default)]
    pub style: String,
    pub text: String,
    #[serde(default)]
    pub timeout_secs: Option<u64>,
    #[serde(default)]
    pub day: Option<String>,
    #[serde(default)]
    pub daily_cap: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsResponse {
    /// Base64 audio bytes.
    pub audio: String,
    /// "audio/wav" or "audio/L16;codec=pcm;rate=24000" (as reported by Gemini).
    pub mime_type: String,
    pub duration_ms: u64,
}

/// Checks what the page may ask for: a TTS model id, a plain voice name and bounded text.
pub fn validate(req: &TtsRequest) -> Result<(), AiError> {
    let model = gemini_model(&req.model);
    if !(model.starts_with("gemini-")
        && model.contains("tts")
        && model
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.'))
    {
        return Err(AiError::BadResponse(format!("not a speech model: {model}")));
    }
    if req.voice.is_empty()
        || req.voice.len() > 40
        || !req.voice.chars().all(|c| c.is_ascii_alphabetic())
    {
        return Err(AiError::BadResponse("invalid voice name".into()));
    }
    let chars = req.text.chars().count();
    if req.text.trim().is_empty() || chars > MAX_TTS_CHARS {
        return Err(AiError::BadResponse(format!("text length {chars}")));
    }
    Ok(())
}

/// JSON body for a single-speaker Gemini TTS request.
pub fn tts_body(req: &TtsRequest) -> Value {
    let mut part = json!({ "text": req.text });
    if !req.style.trim().is_empty() {
        part["speech_metadata"] = json!({ "style": req.style.trim() });
    }
    json!({
        "contents": [{ "role": "user", "parts": [part] }],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": { "voiceConfig": { "voice": req.voice } },
        },
    })
}

/// The first audio part of a Gemini answer: (base64 data, MIME type).
pub fn extract_audio(v: &Value) -> Result<(String, String), AiError> {
    let parts = v["candidates"][0]["content"]["parts"]
        .as_array()
        .ok_or_else(|| AiError::BadResponse("no audio in the answer".into()))?;
    for p in parts {
        let inline = if p["inlineData"].is_object() {
            &p["inlineData"]
        } else {
            &p["inline_data"]
        };
        if let Some(data) = inline["data"].as_str() {
            let mime = inline["mimeType"]
                .as_str()
                .or_else(|| inline["mime_type"].as_str())
                .unwrap_or("audio/wav");
            // Refuse anything that is not base64 audio before it reaches the page.
            base64::engine::general_purpose::STANDARD
                .decode(data)
                .map_err(|e| AiError::BadResponse(format!("audio: {e}")))?;
            return Ok((data.to_string(), mime.to_string()));
        }
    }
    Err(AiError::BadResponse("no audio in the answer".into()))
}

async fn synthesize(req: &TtsRequest, key: &str) -> Result<TtsResponse, AiError> {
    let http = client()?;
    synthesize_at(&http, GEMINI_URL, req, key, tokio::time::sleep).await
}

/// One spoken answer from `base` (Gemini in the app, a mock server in tests): 429 and 5xx are
/// retried as [`retry_delay`] says, waiting through `pause` (tests record the waits).
async fn synthesize_at<P, W>(
    http: &reqwest::Client,
    base: &str,
    req: &TtsRequest,
    key: &str,
    pause: P,
) -> Result<TtsResponse, AiError>
where
    P: Fn(std::time::Duration) -> W,
    W: std::future::Future<Output = ()>,
{
    let started = Instant::now();
    let url = format!("{base}/models/{}:generateContent", gemini_model(&req.model));
    let body = tts_body(req);
    let mut attempt = 0;
    loop {
        let resp = http
            .post(&url)
            .header("x-goog-api-key", key)
            .json(&body)
            .send()
            .await
            .map_err(|e| AiError::Network(e.to_string()))?;
        let status = resp.status();
        let retry_after = resp
            .headers()
            .get("retry-after")
            .and_then(|v| v.to_str().ok())
            .map(str::to_string);
        let text = resp
            .text()
            .await
            .map_err(|e| AiError::Network(e.to_string()))?;
        if !status.is_success() {
            if let Some(wait) = retry_delay(status.as_u16(), retry_after.as_deref(), &text, attempt)
            {
                attempt += 1;
                pause(wait).await;
                continue;
            }
            let snippet: String = text.chars().take(400).collect();
            return Err(AiError::Http(format!("{status}: {snippet}")));
        }
        let v: Value =
            serde_json::from_str(&text).map_err(|e| AiError::BadResponse(e.to_string()))?;
        let (audio, mime_type) = extract_audio(&v)?;
        return Ok(TtsResponse {
            audio,
            mime_type,
            duration_ms: started.elapsed().as_millis() as u64,
        });
    }
}

/// Reads one piece of text aloud with Gemini (main edition, the user's own Gemini key).
#[tauri::command]
pub async fn ai_tts(
    app: tauri::AppHandle,
    state: tauri::State<'_, AiState>,
    request: TtsRequest,
) -> Result<TtsResponse, AiError> {
    // First of all, so a stop that comes early is never counted or sent (see `run_counted`).
    let (_inflight, stop) = InflightGuard::register(state.inner(), &request.request_id)?;
    require_ai_allowed(&app)?;
    validate(&request)?;
    let key = api_key(Provider::Gemini)?;
    let timeout = Duration::from_secs(
        request
            .timeout_secs
            .unwrap_or(DEFAULT_TTS_TIMEOUT_SECS)
            .clamp(5, 120),
    );
    run_counted(
        &request.request_id,
        stop,
        || count_usage(&app, &state, request.day.as_deref(), request.daily_cap),
        synthesize(&request, &key),
        timeout,
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn req(text: &str) -> TtsRequest {
        TtsRequest {
            request_id: "r1".into(),
            model: "gemini-3.8-flash-tts".into(),
            voice: "Achird".into(),
            style: "vui vẻ, rõ ràng".into(),
            text: text.into(),
            timeout_secs: None,
            day: None,
            daily_cap: None,
        }
    }

    #[test]
    fn body_asks_for_audio_with_the_voice_and_style() {
        let b = tts_body(&req("Xin chào"));
        assert_eq!(b["generationConfig"]["responseModalities"][0], "AUDIO");
        assert_eq!(
            b["generationConfig"]["speechConfig"]["voiceConfig"]["voice"],
            "Achird"
        );
        assert_eq!(b["contents"][0]["parts"][0]["text"], "Xin chào");
        assert_eq!(
            b["contents"][0]["parts"][0]["speech_metadata"]["style"],
            "vui vẻ, rõ ràng"
        );
        let mut plain = req("Xin chào");
        plain.style = " ".into();
        assert!(tts_body(&plain)["contents"][0]["parts"][0]
            .get("speech_metadata")
            .is_none());
    }

    #[test]
    fn only_speech_models_plain_voices_and_bounded_text_pass() {
        assert!(validate(&req("Xin chào")).is_ok());
        let mut r = req("Xin chào");
        r.model = "gemini-3.8-flash".into();
        assert!(validate(&r).is_err());
        r.model = "../../other:generateContent?x=tts".into();
        assert!(validate(&r).is_err());
        let mut r = req("Xin chào");
        r.voice = "Kore\"}".into();
        assert!(validate(&r).is_err());
        assert!(validate(&req("")).is_err());
        assert!(validate(&req(&"a".repeat(MAX_TTS_CHARS + 1))).is_err());
    }

    #[test]
    fn audio_is_read_from_either_spelling_and_must_be_base64() {
        let camel = json!({"candidates":[{"content":{"parts":[{"inlineData":{"mimeType":"audio/wav","data":"UklGRg=="}}]}}]});
        assert_eq!(
            extract_audio(&camel).unwrap(),
            ("UklGRg==".to_string(), "audio/wav".to_string())
        );
        let snake = json!({"candidates":[{"content":{"parts":[{"inline_data":{"mime_type":"audio/L16;codec=pcm;rate=24000","data":"AAAA"}}]}}]});
        assert_eq!(
            extract_audio(&snake).unwrap().1,
            "audio/L16;codec=pcm;rate=24000"
        );
        let bad =
            json!({"candidates":[{"content":{"parts":[{"inlineData":{"data":"<script>"}}]}}]});
        assert!(extract_audio(&bad).is_err());
        assert!(extract_audio(&json!({})).is_err());
    }
}

/// The spoken-answer HTTP loop against mock servers on 127.0.0.1 (no provider is contacted, no
/// test sleeps: the waits between retries are recorded).
#[cfg(test)]
mod server_tests {
    use std::sync::{Arc, Mutex};

    use super::*;
    use crate::ai::mock_server::{json_answer, json_answer_with, serve, Mock, Step};

    const AUDIO: &str = r#"{"candidates":[{"content":{"parts":[{"inlineData":{"mimeType":"audio/L16;rate=24000","data":"AAAA"}}]}}]}"#;

    fn request() -> TtsRequest {
        TtsRequest {
            request_id: "r1".into(),
            model: "gemini-3.8-flash-tts".into(),
            voice: "Achird".into(),
            style: String::new(),
            text: "Xin chào".into(),
            timeout_secs: None,
            day: None,
            daily_cap: None,
        }
    }

    fn scripted(answers: Vec<Vec<Step>>) -> Mock {
        let next = Mutex::new(0usize);
        serve(move |_| {
            let mut i = next.lock().unwrap();
            let steps = answers[(*i).min(answers.len() - 1)].clone();
            *i += 1;
            steps
        })
    }

    fn speak(mock: &Mock) -> (Result<TtsResponse, AiError>, Vec<Duration>) {
        let waits = Arc::new(Mutex::new(Vec::new()));
        let seen = waits.clone();
        let pause = move |d: Duration| {
            seen.lock().unwrap().push(d);
            std::future::ready(())
        };
        let http = reqwest::Client::builder().no_proxy().build().unwrap();
        let result = tauri::async_runtime::block_on(synthesize_at(
            &http,
            &mock.url(),
            &request(),
            "key",
            pause,
        ));
        let waits = waits.lock().unwrap().clone();
        (result, waits)
    }

    #[test]
    fn a_429_is_retried_then_the_audio_is_returned() {
        let mock = scripted(vec![
            json_answer_with("429 Too Many Requests", "Retry-After: 2\r\n", "{}"),
            json_answer("200 OK", AUDIO),
        ]);
        let (result, waits) = speak(&mock);
        let audio = result.unwrap();
        assert_eq!(audio.audio, "AAAA");
        assert_eq!(audio.mime_type, "audio/L16;rate=24000");
        assert_eq!(waits, vec![Duration::from_secs(2)]);
        assert_eq!(mock.seen().len(), 2);
        assert!(
            mock.seen()[0].ends_with(":generateContent"),
            "{:?}",
            mock.seen()
        );
        assert_eq!(
            mock.body_of(":generateContent")["contents"][0]["parts"][0]["text"]
                .as_str()
                .map(|t| t.contains("Xin chào")),
            Some(true)
        );
    }

    #[test]
    fn a_refusal_and_an_answer_without_audio_are_reported() {
        let refused = scripted(vec![json_answer("403 Forbidden", "no")]);
        let (result, waits) = speak(&refused);
        assert!(matches!(result, Err(AiError::Http(ref m)) if m.starts_with("403")));
        assert!(waits.is_empty());

        let silent = scripted(vec![json_answer("200 OK", r#"{"candidates":[]}"#)]);
        let (result, _) = speak(&silent);
        assert!(matches!(result, Err(AiError::BadResponse(_))), "{result:?}");
    }
}
