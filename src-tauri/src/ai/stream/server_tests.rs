//! Streamed cloud answers end to end, against mock HTTP servers on 127.0.0.1 that answer in the
//! providers' documented formats. No provider is ever contacted.

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde_json::{json, Value};

use super::*;
use crate::ai::mock_server::{json_answer, json_answer_with, serve, stream_head, Mock, Step};
use crate::ai::tests::req;
use crate::ai::{cancel_inflight, run_counted, usage, Fallback, InflightGuard};

const CLAUDE: &str = include_str!("../../../tests/fixtures/cloud-ai/claude-stream.sse");
const GROQ: &str = include_str!("../../../tests/fixtures/cloud-ai/groq-stream.sse");

const GEMINI_PATH: &str = "/models/m:streamGenerateContent?alt=sse";

fn http() -> reqwest::Client {
    // Tests talk to 127.0.0.1 only: never through a proxy from the environment.
    reqwest::Client::builder().no_proxy().build().unwrap()
}

fn quick() -> Timing {
    Timing {
        first_delta: Duration::from_secs(5),
        gap: Duration::from_secs(5),
        overall: Duration::from_secs(10),
    }
}

fn keys(p: Provider) -> Result<String, AiError> {
    Ok(format!("key-{}", p.key_name()))
}

/// One streamed call against mock servers: the result and the events the page got.
fn run(
    state: &AiState,
    r: &ChatRequest,
    base: impl Fn(Provider) -> String,
    timing: Timing,
) -> (Result<ChatResponse, AiError>, Vec<StreamEvent>) {
    let got = Mutex::new(Vec::new());
    let sink = |e: StreamEvent| got.lock().unwrap().push(e);
    let http = http();
    let result = tauri::async_runtime::block_on(stream_with_fallback(
        state, &http, r, keys, base, timing, &sink,
    ));
    (result, got.into_inner().unwrap())
}

fn run_one(mock: &Mock, r: &ChatRequest) -> (Result<ChatResponse, AiError>, Vec<StreamEvent>) {
    run(&AiState::default(), r, |_| mock.url(), quick())
}

fn sse_head() -> Step {
    stream_head("text/event-stream")
}

fn data(v: &Value) -> Step {
    Step::Send(format!("data: {v}\n\n").into_bytes())
}

fn named(name: &str, v: &Value) -> Step {
    Step::Send(format!("event: {name}\ndata: {v}\n\n").into_bytes())
}

fn gemini_piece(text: &str) -> Value {
    json!({"candidates": [{"content": {"parts": [{"text": text}], "role": "model"}, "index": 0}],
        "modelVersion": "gemini-3.8-flash"})
}

fn gemini_end(reason: &str) -> Value {
    json!({"candidates": [{"content": {"parts": [{"text": ""}], "role": "model"},
        "finishReason": reason, "index": 0}], "modelVersion": "gemini-3.8-flash"})
}

fn groq_piece(text: &str) -> Value {
    json!({"object": "chat.completion.chunk", "model": "qwen/qwen3.8-27b",
        "choices": [{"index": 0, "delta": {"content": text}, "finish_reason": null}]})
}

fn groq_end(reason: &str) -> Value {
    json!({"object": "chat.completion.chunk", "model": "qwen/qwen3.8-27b",
        "choices": [{"index": 0, "delta": {}, "finish_reason": reason}]})
}

fn done() -> Step {
    Step::Send(b"data: [DONE]\n\n".to_vec())
}

fn claude_start() -> Step {
    named(
        "message_start",
        &json!({"type": "message_start", "message": {"model": "claude-sonnet-5-5",
            "content": [], "stop_reason": null}}),
    )
}

fn claude_text(text: &str) -> Step {
    named(
        "content_block_delta",
        &json!({"type": "content_block_delta", "index": 0,
            "delta": {"type": "text_delta", "text": text}}),
    )
}

fn claude_error(kind: &str, message: &str) -> Step {
    named(
        "error",
        &json!({"type": "error", "error": {"type": kind, "message": message}}),
    )
}

fn ping() -> Step {
    named("ping", &json!({"type": "ping"}))
}

fn delta(s: &str) -> StreamEvent {
    StreamEvent::Delta(s.into())
}

fn with_groq_fallback(p: Provider) -> ChatRequest {
    let mut r = req(p, false);
    r.fallback = Some(Fallback {
        provider: Provider::Groq,
        model: "qwen/qwen3.8-27b".into(),
    });
    r
}

/// A mock that answers the n-th request (0, 1, …) with `answer(n)`.
fn counting(answer: impl Fn(usize) -> Vec<Step> + Send + Sync + 'static) -> Mock {
    let n = Arc::new(AtomicUsize::new(0));
    serve(move |_| answer(n.fetch_add(1, Ordering::SeqCst)))
}

#[test]
fn gemini_streams_pieces_in_order_and_keeps_split_characters_whole() {
    // The " tốc" event is cut inside the "ố" between two network writes.
    let toc = format!("data: {}\n\n", gemini_piece(" tốc"));
    let cut = toc.find('ố').unwrap() + 1;
    let (a, b) = (
        toc.as_bytes()[..cut].to_vec(),
        toc.as_bytes()[cut..].to_vec(),
    );
    let mock = serve(move |_| {
        vec![
            sse_head(),
            data(&gemini_piece("Gia")),
            Step::Wait(20),
            Step::Send(a.clone()),
            Step::Wait(20),
            Step::Send(b.clone()),
            data(&gemini_piece(" a = 2 m/s².")),
            data(&gemini_end("STOP")),
        ]
    });
    let (r, events) = run_one(&mock, &req(Provider::Gemini, false));
    let r = r.unwrap();
    assert_eq!(r.content, "Gia tốc a = 2 m/s².");
    assert_eq!(
        events,
        vec![delta("Gia"), delta(" tốc"), delta(" a = 2 m/s².")]
    );
    assert_eq!(r.model, "gemini-3.8-flash");
    assert_eq!(r.provider, Provider::Gemini);
    assert!(!r.truncated && !r.fallback);
    assert_eq!(r.retries, 0);
    assert_eq!(mock.seen(), vec![format!("POST {GEMINI_PATH}")]);
    assert_eq!(
        mock.body_of(GEMINI_PATH)["contents"][0]["parts"][0]["text"],
        "hi"
    );
}

#[test]
fn claude_and_groq_streams_end_at_their_end_mark() {
    for (p, path, fixture, text) in [
        (
            Provider::Claude,
            "/messages",
            CLAUDE,
            "Lực là đại lượng vectơ.",
        ),
        (
            Provider::Groq,
            "/chat/completions",
            GROQ,
            "Vận tốc là đại lượng vectơ.",
        ),
    ] {
        // After the end mark the server keeps the connection open: reading must stop there and
        // drop it, not wait for more.
        let mock = serve(move |_| {
            vec![
                sse_head(),
                Step::Send(fixture.as_bytes().to_vec()),
                Step::WaitForClose,
            ]
        });
        let (r, events) = run_one(&mock, &req(p, false));
        let r = r.unwrap();
        assert_eq!(r.content, text, "{p:?}");
        assert!(!r.truncated, "{p:?}");
        let shown: String = events
            .iter()
            .map(|e| match e {
                StreamEvent::Delta(t) => t.as_str(),
                StreamEvent::Reset(_) => panic!("{p:?}: reset"),
            })
            .collect();
        assert_eq!(shown, text);
        assert!(events.len() >= 2, "{p:?}: streamed in pieces");
        assert_eq!(mock.seen(), vec![format!("POST {path}")]);
        assert_eq!(mock.body_of(path)["stream"], true);
        assert_eq!(mock.closed.recv_timeout(Duration::from_secs(10)), Ok(true));
    }
}

#[test]
fn reasoning_never_reaches_the_page_even_when_tags_are_cut_between_chunks() {
    let mock = serve(|_| {
        vec![
            sse_head(),
            data(&groq_piece("Ta có <th")),
            Step::Wait(10),
            data(&groq_piece("ink>BÍ MẬT: thử 3 kg</thi")),
            Step::Wait(10),
            data(&groq_piece("nk> a = F/m.")),
            data(&groq_piece(" <reasoning>BÍ MẬT bị cắt")),
            data(&groq_end("length")),
            done(),
        ]
    });
    let (r, events) = run_one(&mock, &req(Provider::Groq, false));
    let r = r.unwrap();
    assert_eq!(r.content, "Ta có a = F/m.");
    assert!(r.truncated);
    for e in &events {
        let s = format!("{e:?}");
        assert!(
            !s.contains("BÍ MẬT") && !s.contains("<th") && !s.contains("<re"),
            "{s}"
        );
    }
}

#[test]
fn reasoning_only_empty_and_refused_answers_are_errors() {
    let mock = serve(|_| {
        vec![
            sse_head(),
            data(&groq_piece("<think>chỉ nháp</think>")),
            data(&groq_end("stop")),
            done(),
        ]
    });
    let (r, events) = run_one(&mock, &req(Provider::Groq, false));
    assert!(matches!(r, Err(AiError::BadResponse(ref m)) if m == "reasoningOnly"));
    assert!(events.is_empty());

    let mock = serve(|_| vec![sse_head(), data(&gemini_end("STOP"))]);
    let (r, _) = run_one(&mock, &req(Provider::Gemini, false));
    assert!(matches!(r, Err(AiError::BadResponse(ref m)) if m == "empty answer (STOP)"));

    let mock = serve(|_| {
        vec![
            sse_head(),
            claude_start(),
            claude_text("Phần"),
            named(
                "message_delta",
                &json!({"type": "message_delta", "delta": {"stop_reason": "refusal"}}),
            ),
        ]
    });
    let (r, _) = run_one(&mock, &req(Provider::Claude, false));
    assert!(matches!(r, Err(AiError::BadResponse(ref m)) if m == "empty answer (refusal)"));
}

#[test]
fn a_stop_by_the_providers_filter_after_text_was_shown_is_an_error() {
    // Gemini's safety filter stops the answer partway: what was shown is no answer (the page takes
    // it back), it never reaches the board or speech as a complete one.
    for reason in ["SAFETY", "RECITATION", "PROHIBITED_CONTENT"] {
        let mock = serve(move |_| {
            vec![
                sse_head(),
                data(&gemini_piece("Bước 1: lấy ")),
                data(&gemini_piece("hóa chất")),
                data(&json!({"candidates": [{"finishReason": reason, "index": 0,
                    "safetyRatings": [{"category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                        "probability": "HIGH", "blocked": true}]}]})),
            ]
        });
        let (r, events) = run_one(&mock, &req(Provider::Gemini, false));
        assert!(
            matches!(r, Err(AiError::BadResponse(ref m)) if *m == format!("empty answer ({reason})")),
            "{reason}: {r:?}"
        );
        assert_eq!(events, vec![delta("Bước 1: lấy "), delta("hóa chất")]);
        // Not retried: the same question would be stopped again.
        assert_eq!(mock.seen().len(), 1);
    }
    // Groq's `content_filter` stop.
    let mock = serve(|_| {
        vec![
            sse_head(),
            data(&groq_piece("Bước 1: ")),
            data(&groq_end("content_filter")),
            done(),
        ]
    });
    let (r, events) = run_one(&mock, &req(Provider::Groq, false));
    assert!(matches!(r, Err(AiError::BadResponse(ref m)) if m == "empty answer (content_filter)"));
    assert_eq!(events, vec![delta("Bước 1: ")]);
}

#[test]
fn an_answer_whose_end_mark_came_is_kept_when_the_connection_stays_open() {
    // The provider said it finished, then holds the connection: Groq without its `[DONE]`,
    // Gemini (which has no closing mark) without closing.
    for (p, steps, text) in [
        (
            Provider::Groq,
            vec![
                sse_head(),
                data(&groq_piece("Vận tốc là đại lượng vectơ.")),
                data(&groq_end("stop")),
                Step::WaitForClose,
            ],
            "Vận tốc là đại lượng vectơ.",
        ),
        (
            Provider::Gemini,
            vec![
                sse_head(),
                data(&gemini_piece("Gia tốc.")),
                data(&gemini_end("STOP")),
                Step::WaitForClose,
            ],
            "Gia tốc.",
        ),
    ] {
        let mock = serve(move |_| steps.clone());
        let started = std::time::Instant::now();
        let (r, events) = run(
            &AiState::default(),
            &req(p, false),
            |_| mock.url(),
            short(2000, 300, 10_000),
        );
        let r = r.unwrap();
        assert_eq!(r.content, text, "{p:?}");
        assert!(!r.truncated, "{p:?}");
        assert_eq!(events, vec![delta(text)], "{p:?}");
        assert!(started.elapsed() < Duration::from_millis(1500), "{p:?}");
        // The connection is dropped, not left open.
        assert_eq!(mock.closed.recv_timeout(Duration::from_secs(10)), Ok(true));
    }
    // After the end mark the wait is short ([`END_GRACE`]), not the whole gap between chunks:
    // speech and the board wait for the final text.
    let mock = serve(|_| {
        vec![
            sse_head(),
            data(&groq_piece("Vận tốc")),
            data(&groq_end("stop")),
            Step::Wait(8000),
        ]
    });
    let started = std::time::Instant::now();
    let (r, _) = run(
        &AiState::default(),
        &req(Provider::Groq, false),
        |_| mock.url(),
        short(2000, 6000, 20_000),
    );
    assert_eq!(r.unwrap().content, "Vận tốc");
    assert!(started.elapsed() < END_GRACE + Duration::from_secs(1));
}

/// A streamed answer sent with chunked transfer encoding whose closing chunk never comes: the
/// connection breaks after `payload`.
fn broken_after(payload: String) -> Mock {
    let head = Step::Send(
        b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nTransfer-Encoding: chunked\r\n\r\n"
            .to_vec(),
    );
    let chunk = Step::Send(format!("{:x}\r\n{payload}\r\n", payload.len()).into_bytes());
    serve(move |_| vec![head.clone(), chunk.clone(), Step::Wait(100)])
}

#[test]
fn a_connection_broken_after_the_end_mark_loses_nothing() {
    let ended = format!(
        "data: {}\n\ndata: {}\n\n",
        groq_piece("Vận tốc"),
        groq_end("stop")
    );
    let mock = broken_after(ended);
    let (r, _) = run_one(&mock, &req(Provider::Groq, false));
    let r = r.unwrap();
    assert_eq!(r.content, "Vận tốc");
    assert!(!r.truncated);
    // Before the end mark the same break is a network error (the answer may be incomplete).
    let mock = broken_after(format!("data: {}\n\n", groq_piece("Vận tốc")));
    let (r, events) = run_one(&mock, &req(Provider::Groq, false));
    assert!(matches!(r, Err(AiError::Network(_))), "{r:?}");
    assert_eq!(events, vec![delta("Vận tốc")]);
}

#[test]
fn a_stream_without_its_end_mark_is_marked_incomplete() {
    let mock = serve(|_| vec![sse_head(), data(&gemini_piece("Gia tốc"))]);
    let (r, _) = run_one(&mock, &req(Provider::Gemini, false));
    let r = r.unwrap();
    assert_eq!(r.content, "Gia tốc");
    assert!(r.truncated);
}

#[test]
fn a_429_is_retried_before_anything_is_shown() {
    let mock = counting(|n| match n {
        0 => json_answer_with(
            "429 Too Many Requests",
            "Retry-After: 0\r\n",
            r#"{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","message":"per minute"}}"#,
        ),
        _ => vec![
            sse_head(),
            data(&gemini_piece("Gia tốc")),
            data(&gemini_end("STOP")),
        ],
    });
    let (r, events) = run_one(&mock, &req(Provider::Gemini, false));
    let r = r.unwrap();
    assert_eq!(r.content, "Gia tốc");
    assert_eq!(r.retries, 1);
    assert_eq!(events, vec![delta("Gia tốc")]);
    assert_eq!(mock.seen().len(), 2);
}

#[test]
fn http_errors_keep_the_format_of_ai_chat_and_client_errors_are_not_retried() {
    let mock = serve(|_| {
        json_answer(
            "401 Unauthorized",
            r#"{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}"#,
        )
    });
    let (r, events) = run_one(&mock, &req(Provider::Claude, false));
    assert!(
        matches!(r, Err(AiError::Http(ref m)) if m.starts_with("401 Unauthorized: {\"type\":\"error\""))
    );
    assert!(events.is_empty());
    assert_eq!(mock.seen().len(), 1);
}

#[test]
fn an_error_inside_the_stream_is_retried_only_before_the_first_delta() {
    // Overloaded before any text: tried again (after the 1 s backoff).
    let mock = counting(|n| match n {
        0 => vec![
            sse_head(),
            claude_start(),
            ping(),
            claude_error("overloaded_error", "Overloaded"),
        ],
        _ => vec![sse_head(), Step::Send(CLAUDE.as_bytes().to_vec())],
    });
    let (r, events) = run_one(&mock, &req(Provider::Claude, false));
    let r = r.unwrap();
    assert_eq!(r.content, "Lực là đại lượng vectơ.");
    assert_eq!(r.retries, 1);
    assert_eq!(events, vec![delta("Lực là "), delta("đại lượng vectơ.")]);
    assert_eq!(mock.seen().len(), 2);

    // Overloaded after text was shown: never tried again (two attempts' text would mix).
    let mock = counting(|_| {
        vec![
            sse_head(),
            claude_start(),
            claude_text("Lực là "),
            claude_error("overloaded_error", "Overloaded"),
        ]
    });
    let (r, events) = run_one(&mock, &req(Provider::Claude, false));
    assert!(matches!(r, Err(AiError::Http(ref m)) if m == "529: overloaded_error: Overloaded"));
    assert_eq!(events, vec![delta("Lực là ")]);
    assert_eq!(mock.seen().len(), 1);
}

const PER_DAY: &str = r#"{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","message":"Quota exceeded for GenerateRequestsPerDayPerProjectPerModel"}}"#;

#[test]
fn the_fallback_answers_only_before_anything_was_shown() {
    // Out of quota before the answer starts: Groq answers, the response says so.
    let gemini = serve(|_| json_answer("429 Too Many Requests", PER_DAY));
    let groq = serve(|_| {
        vec![
            sse_head(),
            data(&groq_piece("Vận tốc")),
            data(&groq_end("stop")),
            done(),
        ]
    });
    let state = AiState::default();
    let base = |p: Provider| match p {
        Provider::Groq => groq.url(),
        _ => gemini.url(),
    };
    let (r, events) = run(&state, &with_groq_fallback(Provider::Gemini), base, quick());
    let r = r.unwrap();
    assert!(r.fallback);
    assert_eq!(r.provider, Provider::Groq);
    assert_eq!(r.model, "qwen/qwen3.8-27b");
    assert_eq!(r.content, "Vận tốc");
    assert_eq!(events, vec![delta("Vận tốc")]);
    // A per-day quota is not retried.
    assert_eq!(gemini.seen().len(), 1);
    assert_eq!(groq.seen(), vec!["POST /chat/completions"]);
    assert_eq!(
        groq.body_of("/chat/completions")["model"],
        "qwen/qwen3.8-27b"
    );
    assert!(state.is_exhausted(Provider::Gemini));

    // Out of quota after text was shown: the error stays, Groq is never asked.
    let gemini = serve(|_| {
        vec![
            sse_head(),
            data(&gemini_piece("Gia")),
            data(&serde_json::from_str::<Value>(PER_DAY).unwrap()),
        ]
    });
    let groq = serve(|_| vec![sse_head(), data(&groq_piece("x")), done()]);
    let state = AiState::default();
    let base = |p: Provider| match p {
        Provider::Groq => groq.url(),
        _ => gemini.url(),
    };
    let (r, events) = run(&state, &with_groq_fallback(Provider::Gemini), base, quick());
    let e = r.unwrap_err();
    assert!(crate::ai::is_quota_error(&e), "{e:?}");
    assert_eq!(events, vec![delta("Gia")]);
    assert!(groq.seen().is_empty());
}

/// Gemini's per-day quota error as Google words it: the message does not say which quota ran
/// out, only `details[].violations[].quotaId` does.
fn gemini_per_day_in_details() -> Value {
    json!({"error": {"code": 429, "status": "RESOURCE_EXHAUSTED",
    "message": "You exceeded your current quota, please check your plan and billing details.",
    "details": [
        {"@type": "type.googleapis.com/google.rpc.QuotaFailure",
         "violations": [{
            "quotaMetric": "generativelanguage.googleapis.com/generate_content_free_tier_requests",
            "quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
            "quotaDimensions": {"location": "global", "model": "gemini-3.8-flash"},
            "quotaValue": "250"}]},
        {"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "43s"}
    ]}})
}

#[test]
fn a_per_day_quota_named_only_in_the_details_is_not_retried_inside_the_stream() {
    // As the same body in an HTTP 429: one request, no backoff (1 s, 2 s, …).
    let gemini = counting(|_| vec![sse_head(), data(&gemini_per_day_in_details())]);
    let started = std::time::Instant::now();
    let (r, events) = run_one(&gemini, &req(Provider::Gemini, false));
    assert!(
        started.elapsed() < Duration::from_millis(900),
        "{:?}",
        started.elapsed()
    );
    let e = r.unwrap_err();
    assert!(crate::ai::is_quota_error(&e), "{e:?}");
    assert!(
        matches!(e, AiError::Http(ref m) if m.contains("GenerateRequestsPerDayPerProjectPerModel")),
        "{e:?}"
    );
    assert!(events.is_empty());
    assert_eq!(gemini.seen().len(), 1);
    // With a fallback, it answers straight away.
    let gemini = counting(|_| vec![sse_head(), data(&gemini_per_day_in_details())]);
    let groq = serve(|_| {
        vec![
            sse_head(),
            data(&groq_piece("Vận tốc")),
            data(&groq_end("stop")),
            done(),
        ]
    });
    let base = |p: Provider| match p {
        Provider::Groq => groq.url(),
        _ => gemini.url(),
    };
    let started = std::time::Instant::now();
    let (r, _) = run(
        &AiState::default(),
        &with_groq_fallback(Provider::Gemini),
        base,
        quick(),
    );
    assert!(r.unwrap().fallback);
    assert!(started.elapsed() < Duration::from_millis(900));
    assert_eq!(gemini.seen().len(), 1);
}

#[test]
fn no_fallback_once_the_first_text_was_due() {
    // Gemini reasons quietly (nothing shown) past the first-text timer, then reports a per-day
    // quota inside the stream. The fallback's own wait would already be over: the user gets the
    // quota error, not a timeout, and Gemini is not marked as out of quota by a switch that never
    // happened.
    let gemini = serve(|_| {
        vec![
            sse_head(),
            data(&gemini_piece("<think>mình nháp")),
            Step::Wait(600),
            data(&serde_json::from_str::<Value>(PER_DAY).unwrap()),
        ]
    });
    let groq = serve(|_| {
        vec![
            sse_head(),
            data(&groq_piece("Vận tốc")),
            data(&groq_end("stop")),
            done(),
        ]
    });
    let state = AiState::default();
    let base = |p: Provider| match p {
        Provider::Groq => groq.url(),
        _ => gemini.url(),
    };
    let (r, events) = run(
        &state,
        &with_groq_fallback(Provider::Gemini),
        base,
        short(300, 5000, 10_000),
    );
    let e = r.unwrap_err();
    assert!(crate::ai::is_quota_error(&e), "{e:?}");
    assert!(events.is_empty());
    assert!(groq.seen().is_empty());
    assert!(!state.is_exhausted(Provider::Gemini));
}

#[test]
fn json_schema_requests_are_refused_before_anything_is_sent() {
    let mock = serve(|_| vec![sse_head(), data(&groq_piece("x")), done()]);
    let (r, _) = run_one(&mock, &req(Provider::Groq, true));
    assert!(matches!(r, Err(AiError::Unavailable(ref m)) if m == "jsonSchema"));
    assert!(mock.seen().is_empty());
}

#[test]
fn ai_cancel_stops_a_streamed_answer_and_closes_the_connection() {
    let mock = serve(|_| vec![sse_head(), data(&groq_piece("Vận")), Step::WaitForClose]);
    let state = AiState::default();
    let r = req(Provider::Groq, false);
    let (_inflight, stop) = InflightGuard::register(&state, "r1").unwrap();
    let got = AtomicBool::new(false);
    let sink = |_: StreamEvent| got.store(true, Ordering::SeqCst);
    let http = http();
    let (result, stopped) = tauri::async_runtime::block_on(async {
        let work = stream_with_fallback(&state, &http, &r, keys, |_| mock.url(), quick(), &sink);
        let answer = run_counted("r1", stop, || Ok(()), work, Duration::from_secs(10));
        let user = async {
            for _ in 0..500 {
                if got.load(Ordering::SeqCst) {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
            // What `ai_cancel` does.
            cancel_inflight(&state, "r1")
        };
        tokio::join!(answer, user)
    });
    assert!(stopped, "the request was registered");
    assert!(matches!(result, Err(AiError::Cancelled(ref id)) if id == "r1"));
    assert_eq!(mock.closed.recv_timeout(Duration::from_secs(10)), Ok(true));
}

#[test]
fn the_daily_cap_counts_a_streamed_call_once_with_retries_and_the_fallback() {
    let usage_file =
        std::env::temp_dir().join(format!("stemsim-stream-usage-{}.json", std::process::id()));
    let _ = std::fs::remove_file(&usage_file);
    // A per-minute 429 (retried), then a per-day 429 (fallback), then Groq answers.
    let gemini = counting(|n| match n {
        0 => json_answer_with(
            "429 Too Many Requests",
            "Retry-After: 0\r\n",
            r#"{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","message":"per minute"}}"#,
        ),
        _ => json_answer("429 Too Many Requests", PER_DAY),
    });
    let groq = serve(|_| {
        vec![
            sse_head(),
            data(&groq_piece("Vận tốc")),
            data(&groq_end("stop")),
            done(),
        ]
    });
    let state = AiState::default();
    let r = with_groq_fallback(Provider::Gemini);
    let (_inflight, stop) = InflightGuard::register(&state, "r1").unwrap();
    let sink = |_: StreamEvent| {};
    let http = http();
    let base = |p: Provider| match p {
        Provider::Groq => groq.url(),
        _ => gemini.url(),
    };
    let result = tauri::async_runtime::block_on(run_counted(
        "r1",
        stop,
        || usage::consume(&usage_file, "2026-10-14", 100).map(|_| ()),
        stream_with_fallback(&state, &http, &r, keys, base, quick(), &sink),
        Duration::from_secs(10),
    ));
    let result = result.unwrap();
    assert!(result.fallback);
    assert_eq!(gemini.seen().len(), 2);
    assert_eq!(groq.seen().len(), 1);
    assert_eq!(usage::current(&usage_file, "2026-10-14").count, 1);
    let _ = std::fs::remove_file(&usage_file);
}

fn short(first_ms: u64, gap_ms: u64, overall_ms: u64) -> Timing {
    Timing {
        first_delta: Duration::from_millis(first_ms),
        gap: Duration::from_millis(gap_ms),
        overall: Duration::from_millis(overall_ms),
    }
}

fn timed_out(steps: Vec<Step>, p: Provider, timing: Timing) -> (String, Vec<StreamEvent>) {
    let mock = serve(move |_| steps.clone());
    let started = std::time::Instant::now();
    let (r, events) = run(&AiState::default(), &req(p, false), |_| mock.url(), timing);
    assert!(
        started.elapsed() < Duration::from_secs(4),
        "the timer stopped the call"
    );
    match r {
        Err(AiError::Timeout(m)) => (m, events),
        other => panic!("expected a timeout, got {other:?}"),
    }
}

#[test]
fn the_first_text_must_come_in_time() {
    // No headers in time.
    let (m, _) = timed_out(
        vec![Step::Wait(3000), sse_head()],
        Provider::Groq,
        short(300, 5000, 10_000),
    );
    assert!(m.starts_with("first-delta"), "{m}");
    // Headers, then nothing.
    let (m, _) = timed_out(
        vec![sse_head(), Step::Wait(3000)],
        Provider::Groq,
        short(300, 5000, 10_000),
    );
    assert!(m.starts_with("first-delta"), "{m}");
    // Keep-alive pings are not answer text.
    let mut steps = vec![sse_head(), claude_start()];
    for _ in 0..30 {
        steps.push(ping());
        steps.push(Step::Wait(100));
    }
    let (m, events) = timed_out(steps, Provider::Claude, short(500, 5000, 10_000));
    assert!(m.starts_with("first-delta"), "{m}");
    assert!(events.is_empty());
}

#[test]
fn a_retry_wait_past_the_first_text_timer_gives_the_error_itself() {
    // The server asks for 5 s, the first text is due in 1 s: no pointless wait, the real error.
    let busy = || {
        counting(|_| {
            json_answer_with(
                "429 Too Many Requests",
                "Retry-After: 5\r\n",
                r#"{"error":{"message":"Rate limit reached","code":"rate_limit_exceeded"}}"#,
            )
        })
    };
    let groq = busy();
    let started = std::time::Instant::now();
    let (r, _) = run(
        &AiState::default(),
        &req(Provider::Groq, false),
        |_| groq.url(),
        short(1000, 5000, 10_000),
    );
    assert!(started.elapsed() < Duration::from_millis(900));
    assert!(matches!(r, Err(AiError::Http(ref m)) if m.starts_with("429 Too Many Requests")));
    assert_eq!(groq.seen().len(), 1);
    // Being a quota error, it lets the fallback answer.
    let claude = busy();
    let groq = serve(|_| {
        vec![
            sse_head(),
            data(&groq_piece("Vận tốc")),
            data(&groq_end("stop")),
            done(),
        ]
    });
    let base = |p: Provider| match p {
        Provider::Groq => groq.url(),
        _ => claude.url(),
    };
    let (r, _) = run(
        &AiState::default(),
        &with_groq_fallback(Provider::Claude),
        base,
        short(1000, 5000, 10_000),
    );
    let r = r.unwrap();
    assert!(r.fallback);
    assert_eq!(r.content, "Vận tốc");
}

#[test]
fn a_silent_gap_or_an_endless_answer_times_out() {
    let (m, events) = timed_out(
        vec![sse_head(), data(&groq_piece("Vận")), Step::Wait(3000)],
        Provider::Groq,
        short(2000, 300, 10_000),
    );
    assert!(m.starts_with("gap"), "{m}");
    assert_eq!(events, vec![delta("Vận")]);
    // Pings keep the gap timer happy, but not the overall one.
    let mut steps = vec![sse_head(), claude_start(), claude_text("Lực")];
    for _ in 0..30 {
        steps.push(ping());
        steps.push(Step::Wait(100));
    }
    let (m, _) = timed_out(steps, Provider::Claude, short(2000, 300, 800));
    assert!(m.starts_with("overall"), "{m}");
}

#[test]
fn the_command_is_registered_and_shares_the_page_event_shape() {
    let lib = include_str!("../../lib.rs");
    assert!(lib.contains("ai::ai_chat_stream,"));
    let code = include_str!("../mod.rs");
    assert!(code.contains("on_event: tauri::ipc::Channel<stream::StreamEvent>"));
}

#[test]
fn leading_whitespace_is_not_shown_so_a_later_error_can_still_be_retried() {
    // The model starts with a newline, then the server fails before any visible text: nothing
    // reached the page, so the call is tried again.
    let mock = counting(|n| match n {
        0 => vec![
            sse_head(),
            data(&gemini_piece("\n")),
            data(&json!({"error": {"code": 503, "status": "UNAVAILABLE", "message": "busy"}})),
        ],
        _ => vec![
            sse_head(),
            data(&gemini_piece("Gia tốc")),
            data(&gemini_end("STOP")),
        ],
    });
    let (r, events) = run_one(&mock, &req(Provider::Gemini, false));
    let r = r.unwrap();
    assert_eq!(r.content, "Gia tốc");
    assert_eq!(r.retries, 1);
    assert_eq!(events, vec![delta("Gia tốc")]);
    assert_eq!(mock.seen().len(), 2);

    // The same before a quota error: the fallback answers.
    let gemini = serve(|_| {
        vec![
            sse_head(),
            data(&gemini_piece(" \n")),
            data(&serde_json::from_str::<Value>(PER_DAY).unwrap()),
        ]
    });
    let groq = serve(|_| {
        vec![
            sse_head(),
            data(&groq_piece("Vận tốc")),
            data(&groq_end("stop")),
            done(),
        ]
    });
    let base = |p: Provider| match p {
        Provider::Groq => groq.url(),
        _ => gemini.url(),
    };
    let (r, events) = run(
        &AiState::default(),
        &with_groq_fallback(Provider::Gemini),
        base,
        quick(),
    );
    let r = r.unwrap();
    assert!(r.fallback);
    assert_eq!(r.content, "Vận tốc");
    // The whitespace of the first provider never reaches the page.
    assert_eq!(events, vec![delta("Vận tốc")]);

    // Whitespace before the first visible text is kept in the text that is shown.
    let mock = serve(|_| {
        vec![
            sse_head(),
            data(&groq_piece("\n\n")),
            data(&groq_piece("Lực")),
            data(&groq_piece(" là vectơ.")),
            data(&groq_end("stop")),
            done(),
        ]
    });
    let (r, events) = run_one(&mock, &req(Provider::Groq, false));
    assert_eq!(r.unwrap().content, "\n\nLực là vectơ.");
    assert_eq!(events, vec![delta("\n\nLực"), delta(" là vectơ.")]);
}

/// Gemini reasons quietly for `wait_ms`, then reports a per-day quota inside the stream; Groq
/// would answer at once. The result, whether Groq was asked and whether Gemini was marked out of
/// quota.
fn late_quota(wait_ms: u64, timing: Timing) -> (Result<ChatResponse, AiError>, bool, bool) {
    let gemini = serve(move |_| {
        vec![
            sse_head(),
            data(&gemini_piece("<think>mình nháp")),
            Step::Wait(wait_ms),
            data(&serde_json::from_str::<Value>(PER_DAY).unwrap()),
        ]
    });
    let groq = serve(|_| {
        vec![
            sse_head(),
            data(&groq_piece("Vận tốc")),
            data(&groq_end("stop")),
            done(),
        ]
    });
    let state = AiState::default();
    let base = |p: Provider| match p {
        Provider::Groq => groq.url(),
        _ => gemini.url(),
    };
    let (r, _) = run(&state, &with_groq_fallback(Provider::Gemini), base, timing);
    let asked = !groq.seen().is_empty();
    (r, asked, state.is_exhausted(Provider::Gemini))
}

#[test]
fn the_fallback_is_asked_only_with_enough_of_the_first_text_wait_left() {
    // First text due in 2 s: the fallback needs a quarter of it (500 ms, less than 5 s) left.
    let timing = short(2000, 5000, 10_000);
    // About 300 ms left: not enough. The quota error itself, Gemini not marked out of quota.
    let (r, asked, exhausted) = late_quota(1700, timing);
    let e = r.unwrap_err();
    assert!(crate::ai::is_quota_error(&e), "{e:?}");
    assert!(!asked && !exhausted);
    // About 1.8 s left: the fallback answers.
    let (r, asked, exhausted) = late_quota(200, timing);
    assert!(r.unwrap().fallback);
    assert!(asked && exhausted);
    // A long wait for the first text needs at most 5 s left.
    let long = short(30_000, 5000, 60_000);
    assert_eq!(
        FALLBACK_ROOM.min(long.first_delta / 4),
        Duration::from_secs(5)
    );
}

#[test]
fn an_error_after_the_end_mark_keeps_the_complete_answer() {
    // Claude said why it stopped, then an error event comes instead of `message_stop`.
    let claude = serve(|_| {
        vec![
            sse_head(),
            claude_start(),
            claude_text("Lực là đại lượng vectơ."),
            named(
                "message_delta",
                &json!({"type": "message_delta", "delta": {"stop_reason": "end_turn"}}),
            ),
            claude_error("overloaded_error", "Overloaded"),
        ]
    });
    // Gemini and Groq: a finish reason, then an error object.
    let gemini = serve(|_| {
        vec![
            sse_head(),
            data(&gemini_piece("Gia tốc.")),
            data(&gemini_end("STOP")),
            data(&json!({"error": {"code": 500, "status": "INTERNAL", "message": "x"}})),
        ]
    });
    let groq = serve(|_| {
        vec![
            sse_head(),
            data(&groq_piece("Vận tốc.")),
            data(&groq_end("stop")),
            data(&json!({"error": {"message": "x", "type": "server_error"}})),
        ]
    });
    for (p, mock, text) in [
        (Provider::Claude, &claude, "Lực là đại lượng vectơ."),
        (Provider::Gemini, &gemini, "Gia tốc."),
        (Provider::Groq, &groq, "Vận tốc."),
    ] {
        let (r, events) = run_one(mock, &req(p, false));
        let r = r.unwrap_or_else(|e| panic!("{p:?}: {e:?}"));
        assert_eq!(r.content, text, "{p:?}");
        assert!(!r.truncated, "{p:?}");
        assert_eq!(events, vec![delta(text)], "{p:?}");
        assert_eq!(mock.seen().len(), 1, "{p:?}: not retried");
    }
    // A stop by the filter of the provider is still no answer.
    let mock = serve(|_| {
        vec![
            sse_head(),
            data(&gemini_piece("Gia tốc.")),
            data(&gemini_end("STOP")),
            data(&json!({"candidates": [{"finishReason": "SAFETY"}]})),
        ]
    });
    let (r, _) = run_one(&mock, &req(Provider::Gemini, false));
    assert!(matches!(r, Err(AiError::BadResponse(ref m)) if m == "empty answer (SAFETY)"));
    // Before the end mark an error is still an error.
    let mock = serve(|_| {
        vec![
            sse_head(),
            data(&gemini_piece("Gia")),
            data(&json!({"error": {"code": 500, "status": "INTERNAL", "message": "x"}})),
        ]
    });
    let (r, _) = run_one(&mock, &req(Provider::Gemini, false));
    assert!(matches!(r, Err(AiError::Http(ref m)) if m.starts_with("500")));
}

#[test]
fn a_streamed_answer_stopped_for_another_reason_is_marked_incomplete() {
    for reason in ["OTHER", "LANGUAGE", "FINISH_REASON_UNSPECIFIED"] {
        let mock = serve(move |_| {
            vec![
                sse_head(),
                data(&gemini_piece("Gia tốc")),
                data(&gemini_end(reason)),
            ]
        });
        let (r, _) = run_one(&mock, &req(Provider::Gemini, false));
        let r = r.unwrap();
        assert_eq!(r.content, "Gia tốc");
        assert!(r.truncated, "{reason}");
    }
    let mock = serve(|_| {
        vec![
            sse_head(),
            claude_start(),
            claude_text("Lực"),
            named(
                "message_delta",
                &json!({"type": "message_delta",
                    "delta": {"stop_reason": "model_context_window_exceeded"}}),
            ),
            named("message_stop", &json!({"type": "message_stop"})),
        ]
    });
    let (r, _) = run_one(&mock, &req(Provider::Claude, false));
    assert!(r.unwrap().truncated);
}
