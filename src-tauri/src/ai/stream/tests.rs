//! Server-sent event framing and the three providers' stream parsers, on hand-written fixtures in
//! the documented formats (no live call was recorded).

use serde_json::json;

use super::*;
use crate::ai::claude::ClaudeProvider;
use crate::ai::gemini::{gemini_body, GeminiProvider};
use crate::ai::groq::GroqProvider;
use crate::ai::tests::req;

const GEMINI: &str = include_str!("../../../tests/fixtures/cloud-ai/gemini-stream.sse");
const CLAUDE: &str = include_str!("../../../tests/fixtures/cloud-ai/claude-stream.sse");
const GROQ: &str = include_str!("../../../tests/fixtures/cloud-ai/groq-stream.sse");

fn events(chunks: &[&[u8]]) -> Vec<SseEvent> {
    let mut r = SseReader::new(MAX_EVENT_BYTES);
    let mut out = Vec::new();
    for c in chunks {
        out.extend(r.push(c).unwrap());
    }
    out.extend(r.finish());
    out
}

fn crlf(s: &str) -> String {
    s.replace("\r\n", "\n").replace('\n', "\r\n")
}

fn ev(event: &str, data: &str) -> SseEvent {
    SseEvent {
        event: event.into(),
        data: data.into(),
    }
}

#[test]
fn events_survive_any_chunking_crlf_and_characters_split_between_chunks() {
    for fixture in [GEMINI, CLAUDE, GROQ] {
        let whole = events(&[fixture.as_bytes()]);
        assert!(whole.len() >= 4);
        // CRLF line ends give the same events.
        let windows = crlf(fixture);
        assert_eq!(events(&[windows.as_bytes()]), whole);
        for text in [fixture.to_string(), windows] {
            let bytes = text.as_bytes();
            // Every split point, also inside a multi-byte character ("ố", "Δ") and between
            // "\r" and "\n".
            for i in 1..bytes.len() {
                assert_eq!(events(&[&bytes[..i], &bytes[i..]]), whole, "split at {i}");
            }
            let singles: Vec<&[u8]> = bytes.chunks(1).collect();
            assert_eq!(events(&singles), whole);
        }
    }
    // The fixtures hold multi-byte text that must come out whole.
    let g = events(&[GEMINI.as_bytes()]);
    assert!(g.iter().any(|e| e.data.contains("độ biến thiên")));
    assert!(g.iter().any(|e| e.data.contains("Δv/Δt")));
}

#[test]
fn fields_follow_the_event_stream_format() {
    let got = events(&[
        b"event: delta\ndata: a\ndata: b\n\n",
        b"data:no-space\n\n",
        b": keep-alive\n\n",
        b"id: 7\nretry: 100\ndata: x\n\n",
        b"data\n\n",
        b"event: ping\n\n",
        b"event: one\ndata: 1\n\ndata: 2\n\n",
    ]);
    assert_eq!(
        got,
        vec![
            ev("delta", "a\nb"),
            ev("message", "no-space"),
            ev("message", "x"),
            ev("message", ""),
            ev("one", "1"),
            // The event name does not carry over to the next event.
            ev("message", "2"),
        ]
    );
}

#[test]
fn the_end_of_the_stream_keeps_complete_lines_and_drops_a_cut_one() {
    // No blank line after the last event: its complete lines are still read.
    assert_eq!(events(&[b"data: [DONE]\n"]), vec![ev("message", "[DONE]")]);
    // A line cut by the end of the stream is dropped.
    assert_eq!(
        events(&[b"data: a\ndata: {\"cut"]),
        vec![ev("message", "a")]
    );
    assert!(events(&[b"data: {\"cut"]).is_empty());
}

#[test]
fn an_event_over_the_cap_is_an_error() {
    let mut r = SseReader::new(16);
    assert!(r.push(b"data: 0123").unwrap().is_empty());
    assert!(matches!(
        r.push(b"456789abcdef"),
        Err(AiError::BadResponse(_))
    ));
    // Many data lines that add up.
    let mut r = SseReader::new(16);
    assert!(r.push(b"data: 01234567\ndata: 89abcdef\n").is_err());
}

#[test]
fn a_long_line_in_tiny_chunks_is_scanned_once() {
    let mut r = SseReader::new(MAX_EVENT_BYTES);
    let started = std::time::Instant::now();
    assert!(r.push(b"data: ").unwrap().is_empty());
    for _ in 0..200_000 {
        assert!(r.push(b"a").unwrap().is_empty());
    }
    let got = r.push(b"\n\n").unwrap();
    assert_eq!(got.len(), 1);
    assert_eq!(got[0].data.len(), 200_000);
    assert!(started.elapsed() < std::time::Duration::from_secs(2));
}

/// Reads a whole fixture with a provider's parser: the state and all the text.
fn read(p: &dyn AIProvider, sse: &str) -> (StreamState, String) {
    let mut st = StreamState::default();
    let mut text = String::new();
    for e in events(&[sse.as_bytes()]) {
        p.on_sse(&e, &mut st).unwrap();
        text.push_str(&std::mem::take(&mut st.delta));
        if st.closed {
            break;
        }
    }
    (st, text)
}

#[test]
fn gemini_reads_text_parts_without_thoughts() {
    let (st, text) = read(&GeminiProvider, GEMINI);
    assert_eq!(
        text,
        "Gia tốc là độ biến thiên vận tốc theo thời gian: a = Δv/Δt."
    );
    assert_eq!(st.model.as_deref(), Some("gemini-3.8-flash"));
    assert_eq!(st.finish.as_deref(), Some("STOP"));
    assert!(st.ended && !st.truncated);
    let g = |v: serde_json::Value| ev("message", &v.to_string());
    let mut st = StreamState::default();
    GeminiProvider
        .on_sse(
            &g(
                json!({"candidates": [{"content": {"parts": [{"text": "Bước"}]},
                "finishReason": "MAX_TOKENS"}]}),
            ),
            &mut st,
        )
        .unwrap();
    assert!(st.truncated && st.ended);
    // A blocked question: no candidate, only the reason. No answer, as without streaming.
    let blocked = GeminiProvider
        .on_sse(
            &g(json!({"promptFeedback": {"blockReason": "SAFETY"}})),
            &mut StreamState::default(),
        )
        .unwrap_err();
    assert!(matches!(blocked, AiError::BadResponse(ref m) if m == "empty answer (SAFETY)"));
    // An error inside the stream is the HTTP error it stands for.
    let e = GeminiProvider
        .on_sse(
            &g(
                json!({"error": {"code": 429, "status": "RESOURCE_EXHAUSTED",
                "message": "Quota exceeded: GenerateRequestsPerDayPerProjectPerModel"}}),
            ),
            &mut StreamState::default(),
        )
        .unwrap_err();
    assert!(matches!(e, AiError::Http(ref m) if m.starts_with("429: RESOURCE_EXHAUSTED: Quota")));
    assert!(is_quota_error(&e));
    let bad = GeminiProvider.on_sse(&ev("message", "{not json"), &mut StreamState::default());
    assert!(matches!(bad, Err(AiError::BadResponse(ref m)) if m.starts_with("stream event")));
}

#[test]
fn claude_reads_text_deltas_only_and_stops_at_message_stop() {
    let (st, text) = read(&ClaudeProvider, CLAUDE);
    // Thinking and signature deltas are not answer text.
    assert_eq!(text, "Lực là đại lượng vectơ.");
    assert_eq!(st.model.as_deref(), Some("claude-sonnet-5-5"));
    assert_eq!(st.finish.as_deref(), Some("end_turn"));
    assert!(st.ended && st.closed && !st.truncated);
    let c = |name: &str, v: serde_json::Value| ev(name, &v.to_string());
    let mut st = StreamState::default();
    ClaudeProvider
        .on_sse(
            &c(
                "message_delta",
                json!({"type": "message_delta",
                "delta": {"stop_reason": "max_tokens"}}),
            ),
            &mut st,
        )
        .unwrap();
    assert!(st.truncated);
    // The event name is used when the data has no type.
    let mut st = StreamState::default();
    ClaudeProvider
        .on_sse(&ev("message_stop", "{}"), &mut st)
        .unwrap();
    assert!(st.closed);
    // Error events: overloaded is retried as a 529, a rate limit is a quota error.
    let err = |kind: &str, msg: &str| {
        ClaudeProvider
            .on_sse(
                &c(
                    "error",
                    json!({"type": "error", "error": {"type": kind, "message": msg}}),
                ),
                &mut StreamState::default(),
            )
            .unwrap_err()
    };
    let overloaded = err("overloaded_error", "Overloaded");
    assert!(matches!(overloaded, AiError::Http(ref m) if m == "529: overloaded_error: Overloaded"));
    assert!(!is_quota_error(&overloaded));
    assert!(retry_delay(529, None, "", 0).is_some());
    assert!(is_quota_error(&err("rate_limit_error", "slow down")));
    assert!(is_quota_error(&err("billing_error", "credit")));
    assert!(matches!(err("api_error", "x"), AiError::Http(ref m) if m.starts_with("500: ")));
    // A refusal is an empty answer, as without streaming.
    let refusal = ClaudeProvider.on_sse(
        &c(
            "message_delta",
            json!({"type": "message_delta",
            "delta": {"stop_reason": "refusal"}}),
        ),
        &mut StreamState::default(),
    );
    assert!(matches!(refusal, Err(AiError::BadResponse(ref m)) if m == "empty answer (refusal)"));
}

#[test]
fn groq_reads_content_deltas_and_stops_at_done() {
    let (st, text) = read(&GroqProvider, GROQ);
    assert_eq!(text, "Vận tốc là đại lượng vectơ.");
    assert_eq!(st.model.as_deref(), Some("qwen/qwen3.8-27b"));
    assert_eq!(st.finish.as_deref(), Some("stop"));
    assert!(st.ended && st.closed && !st.truncated);
    let o = |v: serde_json::Value| ev("message", &v.to_string());
    let mut st = StreamState::default();
    GroqProvider
        .on_sse(
            &o(
                json!({"choices": [{"delta": {"reasoning": "nháp", "content": null},
                "finish_reason": "length"}]}),
            ),
            &mut st,
        )
        .unwrap();
    // A separate reasoning field is not answer text.
    assert!(st.delta.is_empty());
    assert!(st.truncated);
    let e = GroqProvider
        .on_sse(
            &o(
                json!({"error": {"message": "Rate limit reached", "type": "tokens",
                "code": "rate_limit_exceeded"}}),
            ),
            &mut StreamState::default(),
        )
        .unwrap_err();
    assert!(
        matches!(e, AiError::Http(ref m) if m == "429: rate_limit_exceeded: Rate limit reached")
    );
    assert!(is_quota_error(&e));
}

#[test]
fn a_stop_by_the_providers_filter_is_no_answer_even_after_text() {
    let g = |v: serde_json::Value| ev("message", &v.to_string());
    let piece = |text: &str| json!({"candidates": [{"content": {"parts": [{"text": text}]}}]});
    for reason in [
        "SAFETY",
        "RECITATION",
        "PROHIBITED_CONTENT",
        "BLOCKLIST",
        "SPII",
        "IMAGE_SAFETY",
    ] {
        let mut st = StreamState::default();
        GeminiProvider
            .on_sse(&g(piece("Bước 1: lấy ")), &mut st)
            .unwrap();
        assert_eq!(st.delta, "Bước 1: lấy ");
        // The stop comes after text that was already passed on (with or without more text).
        let stop = json!({"candidates": [{"content": {"parts": [{"text": "hóa chất"}]},
            "finishReason": reason, "safetyRatings": [{"blocked": true}]}]});
        let e = GeminiProvider.on_sse(&g(stop), &mut st).unwrap_err();
        assert!(
            matches!(e, AiError::BadResponse(ref m) if *m == format!("empty answer ({reason})")),
            "{reason}: {e:?}"
        );
        // The same reason without streaming gives the same error.
        let whole = json!({"candidates": [{"finishReason": reason}]});
        assert_eq!(
            GeminiProvider
                .extract_content(&whole)
                .unwrap_err()
                .to_string(),
            e.to_string()
        );
    }
    // A natural end and the output limit are answers (the second one cut).
    for (reason, cut) in [("STOP", false), ("MAX_TOKENS", true)] {
        let mut st = StreamState::default();
        let end = json!({"candidates": [{"content": {"parts": [{"text": "Xong"}]},
            "finishReason": reason}]});
        GeminiProvider.on_sse(&g(end), &mut st).unwrap();
        assert_eq!(st.delta, "Xong");
        assert!(st.ended && st.truncated == cut, "{reason}");
    }

    // Groq (OpenAI format): a `content_filter` stop.
    let o = |v: serde_json::Value| ev("message", &v.to_string());
    let mut st = StreamState::default();
    GroqProvider
        .on_sse(
            &o(json!({"choices": [{"delta": {"content": "Bước 1: "}, "finish_reason": null}]})),
            &mut st,
        )
        .unwrap();
    let e = GroqProvider
        .on_sse(
            &o(json!({"choices": [{"delta": {}, "finish_reason": "content_filter"}]})),
            &mut st,
        )
        .unwrap_err();
    assert!(matches!(e, AiError::BadResponse(ref m) if m == "empty answer (content_filter)"));
}

#[test]
fn a_quota_named_only_in_the_error_details_is_kept() {
    // Gemini says which quota ran out only in `details[].violations[].quotaId`.
    let gemini_quota = |quota: &str| {
        json!({"code": 429, "status": "RESOURCE_EXHAUSTED",
        "message": "You exceeded your current quota, please check your plan and billing details.",
        "details": [
            {"@type": "type.googleapis.com/google.rpc.QuotaFailure",
             "violations": [{"quotaMetric": "generativelanguage.googleapis.com/generate_content_free_tier_requests",
                             "quotaId": quota, "quotaValue": "250"}]},
            {"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "43s"}
        ]})
    };
    let AiError::Http(m) = provider_error(&gemini_quota(
        "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
    )) else {
        unreachable!()
    };
    assert_eq!(
        m,
        "429: RESOURCE_EXHAUSTED: You exceeded your current quota, please check your plan and \
         billing details. (quota: GenerateRequestsPerDayPerProjectPerModel-FreeTier)"
    );
    // The retry rule reads it as it reads the same body from an HTTP 429: a day's quota is not
    // retried, a minute's quota is.
    assert_eq!(retry_delay(http_status(&m), None, &m, 0), None);
    let AiError::Http(m) = provider_error(&gemini_quota(
        "GenerateRequestsPerMinutePerProjectPerModel-FreeTier",
    )) else {
        unreachable!()
    };
    assert!(retry_delay(http_status(&m), None, &m, 0).is_some());
    // A quota id at the first level of the details (as in `ai_chat`'s retry test) counts too;
    // odd ids are cleaned and bounded, and only a few are kept.
    let odd = "Per\nDay".to_string() + &"x".repeat(500);
    let AiError::Http(m) = provider_error(&json!({"code": 429, "message": "quota",
        "details": [{"quotaId": "A"}, {"quotaId": odd}, {"quotaId": "C"}, {"quotaId": "D"},
                    {"quotaId": "E"}, {"quotaId": 7}]}))
    else {
        unreachable!()
    };
    assert!(m.starts_with("429: error: quota (quota: A, PerDay"), "{m}");
    assert!(m.ends_with(", C, D)"), "{m}");
    assert!(m.len() < 600 && !m.contains('\n'), "{m}");
    // Without details nothing is added.
    let AiError::Http(m) = provider_error(&json!({"code": 429, "message": "quota"})) else {
        unreachable!()
    };
    assert_eq!(m, "429: error: quota");
}

#[test]
fn provider_errors_name_a_status() {
    let status = |v: serde_json::Value| match provider_error(&v) {
        AiError::Http(m) => http_status(&m),
        other => panic!("{other:?}"),
    };
    assert_eq!(status(json!({"code": 503, "status": "UNAVAILABLE"})), 503);
    assert_eq!(status(json!({"type": "invalid_request_error"})), 400);
    assert_eq!(status(json!({"type": "authentication_error"})), 401);
    assert_eq!(status(json!({"type": "not_found_error"})), 404);
    assert_eq!(status(json!({"type": "request_too_large"})), 413);
    assert_eq!(status(json!({"status": "INTERNAL"})), 500);
    // Unknown: the answer had started, so the failure is on the server's side.
    assert_eq!(status(json!({"type": "something_new"})), 500);
    assert_eq!(status(json!({})), 500);
    let long = "x".repeat(1000) + "\n\u{7}";
    let AiError::Http(m) = provider_error(&json!({"type": "api_error", "message": long})) else {
        unreachable!()
    };
    assert!(m.len() < 450 && !m.contains('\n') && !m.contains('\u{7}'));
}

#[test]
fn stream_requests_ask_for_server_sent_events() {
    let http = reqwest::Client::new();
    let base = "http://127.0.0.1:9";
    let built = GeminiProvider
        .stream_request(&http, base, "k", &req(Provider::Gemini, false))
        .build()
        .unwrap();
    assert_eq!(
        built.url().as_str(),
        format!("{base}/models/m:streamGenerateContent?alt=sse")
    );
    assert_eq!(built.headers()["x-goog-api-key"], "k");
    let body: serde_json::Value =
        serde_json::from_slice(built.body().unwrap().as_bytes().unwrap()).unwrap();
    assert_eq!(body, gemini_body(&req(Provider::Gemini, false)));

    let built = ClaudeProvider
        .stream_request(&http, base, "k", &req(Provider::Claude, false))
        .build()
        .unwrap();
    assert_eq!(built.url().as_str(), format!("{base}/messages"));
    assert_eq!(built.headers()["x-api-key"], "k");
    assert!(built.headers().contains_key("anthropic-version"));
    let body: serde_json::Value =
        serde_json::from_slice(built.body().unwrap().as_bytes().unwrap()).unwrap();
    assert_eq!(body["stream"], true);
    assert!(body.get("tools").is_none());

    let built = GroqProvider
        .stream_request(&http, base, "k", &req(Provider::Groq, false))
        .build()
        .unwrap();
    assert_eq!(built.url().as_str(), format!("{base}/chat/completions"));
    assert_eq!(built.headers()["authorization"], "Bearer k");
    let body: serde_json::Value =
        serde_json::from_slice(built.body().unwrap().as_bytes().unwrap()).unwrap();
    assert_eq!(body["stream"], true);
    assert_eq!(body["messages"][0]["role"], "system");
    // In the app, every provider streams from its own fixed address.
    for p in [Provider::Gemini, Provider::Claude, Provider::Groq] {
        assert!(provider(p).base_url().starts_with("https://"));
    }
}

#[test]
fn events_use_the_page_names_shared_with_local_runtimes() {
    assert_eq!(
        serde_json::to_value(StreamEvent::Delta("Lực".into())).unwrap(),
        json!({"kind": "delta", "text": "Lực"})
    );
    assert_eq!(
        serde_json::to_value(StreamEvent::Reset(String::new())).unwrap(),
        json!({"kind": "reset", "text": ""})
    );
    let local: crate::ai::local::LocalEvent = StreamEvent::Delta("x".into());
    assert_eq!(local, StreamEvent::Delta("x".into()));
}

#[test]
fn json_schema_answers_are_not_streamed() {
    let e = streamable(&req(Provider::Claude, true)).unwrap_err();
    assert!(matches!(e, AiError::Unavailable(ref m) if m == "jsonSchema"));
    assert_eq!(serde_json::to_value(&e).unwrap()["code"], "unavailable");
    assert!(streamable(&req(Provider::Claude, false)).is_ok());
}

#[test]
fn timing_follows_the_call_timeout_and_the_fixed_caps() {
    let t = Timing::chat(None);
    assert_eq!(t.first_delta, Duration::from_secs(30));
    assert_eq!(t.gap, Duration::from_secs(45));
    assert_eq!(t.overall, Duration::from_secs(600));
    assert_eq!(Timing::chat(Some(90)).first_delta, Duration::from_secs(90));
    assert_eq!(Timing::chat(Some(1)).first_delta, Duration::from_secs(5));
    assert_eq!(
        Timing::chat(Some(9999)).first_delta,
        Duration::from_secs(600)
    );
    assert_eq!(http_status("529: overloaded_error: x"), 529);
    assert_eq!(http_status("429 Too Many Requests: {}"), 429);
    assert_eq!(http_status("no number"), 0);
}
