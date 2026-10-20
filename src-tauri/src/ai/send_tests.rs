//! The whole-answer HTTP loop (`send_to`, used by Think, summaries, "Phân tích đề", "AI diễn
//! giải") end to end, against mock HTTP servers on 127.0.0.1 that answer in the providers'
//! documented formats. No provider is ever contacted, and no test sleeps: the waits between
//! retries are recorded instead.

use std::net::TcpListener;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use super::mock_server::{json_answer, json_answer_with, serve, Mock};
use super::tests::req;
use super::*;

const GROQ_OK: &str =
    r#"{"model":"m","choices":[{"message":{"content":"Xin chào"},"finish_reason":"stop"}]}"#;
const CLAUDE_OK: &str =
    r#"{"model":"c","content":[{"type":"text","text":"Chào em"}],"stop_reason":"end_turn"}"#;

fn http() -> reqwest::Client {
    // Tests talk to 127.0.0.1 only: never through a proxy from the environment.
    reqwest::Client::builder().no_proxy().build().unwrap()
}

/// A server that gives the scripted answers in turn (the last one again after the script ends).
fn scripted(answers: Vec<Vec<super::mock_server::Step>>) -> Mock {
    let next = Mutex::new(0usize);
    serve(move |_| {
        let mut i = next.lock().unwrap();
        let steps = answers[(*i).min(answers.len() - 1)].clone();
        *i += 1;
        steps
    })
}

/// One `send_to` call: the result and the waits it asked for between attempts.
fn send_once(base: &str, r: &ChatRequest) -> (Result<ChatResponse, AiError>, Vec<Duration>) {
    let waits = Arc::new(Mutex::new(Vec::new()));
    let seen = waits.clone();
    let pause = move |d: Duration| {
        seen.lock().unwrap().push(d);
        std::future::ready(())
    };
    let result = tauri::async_runtime::block_on(send_to(&http(), base, r, "key", pause));
    let waits = waits.lock().unwrap().clone();
    (result, waits)
}

#[test]
fn a_429_is_retried_once_after_the_server_s_retry_after() {
    let mock = scripted(vec![
        json_answer_with("429 Too Many Requests", "Retry-After: 0.5\r\n", "{}"),
        json_answer("200 OK", GROQ_OK),
    ]);
    let (result, waits) = send_once(&mock.url(), &req(Provider::Groq, false));
    let answer = result.unwrap();
    assert_eq!(answer.content, "Xin chào");
    assert_eq!(answer.retries, 1);
    assert_eq!(waits, vec![Duration::from_millis(500)]);
    assert_eq!(mock.seen(), vec!["POST /chat/completions"; 2]);
    // The body sent again is the same chat request.
    assert_eq!(mock.body_of("POST /chat/completions")["model"], "m");
}

#[test]
fn a_long_retry_after_is_capped() {
    let mock = scripted(vec![
        json_answer_with("503 Service Unavailable", "Retry-After: 120\r\n", "{}"),
        json_answer("200 OK", GROQ_OK),
    ]);
    let (result, waits) = send_once(&mock.url(), &req(Provider::Groq, false));
    assert!(result.is_ok());
    assert_eq!(waits, vec![MAX_BACKOFF]);
}

#[test]
fn a_5xx_is_retried_three_times_with_backoff_then_reported() {
    let mock = scripted(vec![json_answer("500 Internal Server Error", "down")]);
    let (result, waits) = send_once(&mock.url(), &req(Provider::Groq, false));
    let Err(AiError::Http(msg)) = result else {
        panic!("expected an HTTP error, got {result:?}");
    };
    assert!(msg.starts_with("500"), "{msg}");
    assert_eq!(mock.seen().len(), 1 + MAX_RETRIES as usize);
    assert_eq!(
        waits,
        vec![
            Duration::from_secs(1),
            Duration::from_secs(2),
            Duration::from_secs(4)
        ]
    );
}

#[test]
fn a_daily_quota_and_a_refused_key_are_not_retried() {
    let per_day = scripted(vec![json_answer(
        "429 Too Many Requests",
        r#"{"error":{"details":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel"}]}}"#,
    )]);
    let (result, waits) = send_once(&per_day.url(), &req(Provider::Groq, false));
    assert!(matches!(result, Err(AiError::Http(ref m)) if m.starts_with("429")));
    assert!(waits.is_empty());
    assert_eq!(per_day.seen().len(), 1);

    // A refused key: one request, the provider's words cut to 400 characters.
    let long = format!(r#"{{"error":"{}"}}"#, "x".repeat(1000));
    let refused = scripted(vec![json_answer("401 Unauthorized", &long)]);
    let (result, waits) = send_once(&refused.url(), &req(Provider::Claude, false));
    let Err(AiError::Http(msg)) = result else {
        panic!("expected an HTTP error, got {result:?}");
    };
    let snippet = msg.split_once(": ").map(|(_, s)| s).unwrap_or_default();
    assert!(msg.starts_with("401"), "{msg}");
    assert_eq!(snippet.chars().count(), 400);
    assert!(waits.is_empty());
    assert_eq!(refused.seen(), vec!["POST /messages"]);
}

#[test]
fn an_answer_that_is_not_json_is_a_bad_response() {
    let mock = scripted(vec![json_answer("200 OK", "<html>proxy</html>")]);
    let (result, _) = send_once(&mock.url(), &req(Provider::Groq, false));
    assert!(matches!(result, Err(AiError::BadResponse(_))), "{result:?}");
}

#[test]
fn a_refused_connection_is_a_network_error() {
    // A port that was free a moment ago: nothing listens there now.
    let port = TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port();
    let (result, waits) = send_once(
        &format!("http://127.0.0.1:{port}"),
        &req(Provider::Groq, false),
    );
    assert!(matches!(result, Err(AiError::Network(_))), "{result:?}");
    assert!(waits.is_empty());
}

#[test]
fn out_of_credit_switches_to_the_fallback_on_its_own_server() {
    let primary = scripted(vec![json_answer(
        "402 Payment Required",
        r#"{"error":"credit"}"#,
    )]);
    let backup = scripted(vec![json_answer("200 OK", CLAUDE_OK)]);
    let mut r = req(Provider::Groq, false);
    r.fallback = Some(Fallback {
        provider: Provider::Claude,
        model: "c".into(),
    });
    let base = |p: Provider| match p {
        Provider::Claude => backup.url(),
        _ => primary.url(),
    };
    let state = AiState::default();
    let answer = tauri::async_runtime::block_on(with_fallback(
        &state,
        &r,
        |p| Ok(format!("key-{}", p.key_name())),
        |r, key| {
            let url = base(r.provider);
            async move { send_to(&http(), &url, &r, &key, |_| std::future::ready(())).await }
        },
        is_quota_error,
    ))
    .unwrap();
    assert_eq!(answer.content, "Chào em");
    assert!(answer.fallback);
    assert_eq!(answer.provider, Provider::Claude);
    assert_eq!(primary.seen(), vec!["POST /chat/completions"]);
    assert_eq!(backup.seen(), vec!["POST /messages"]);
    assert_eq!(backup.body_of("POST /messages")["model"], "c");
}
