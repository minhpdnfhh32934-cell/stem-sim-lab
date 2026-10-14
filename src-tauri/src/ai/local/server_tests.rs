//! Local runtimes against mock HTTP servers. Every server here is a std thread bound to a free
//! port on 127.0.0.1 and answers from a script: no real runtime is ever started or contacted,
//! and `detect` (which asks the real default ports) is never called.

use std::io::ErrorKind;
use std::net::TcpListener;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

use serde_json::json;

use super::endpoint::{loopback_client, LoopHost, Loopback};
use super::runtime::{runtime, Cap, RuntimeKind};
use super::vision::tests::png;
use super::*;
use crate::ai::mock_server::{json_answer, serve, stream_head, Mock, Req, Step};
use crate::ai::{cancel_inflight, AiError, AiState};

impl Mock {
    fn base(&self) -> Loopback {
        Loopback::v4(self.port)
    }
}

fn ndjson_head() -> Step {
    stream_head("application/x-ndjson")
}

fn line(s: &str) -> Step {
    Step::Send(format!("{s}\n").into_bytes())
}

/// One Ollama stream line with this text.
fn piece(text: &str) -> String {
    json!({"model": "qwen3:8b", "message": {"role": "assistant", "content": text}, "done": false})
        .to_string()
}

fn finished(reason: &str) -> String {
    json!({"model": "qwen3:8b", "message": {"role": "assistant", "content": ""}, "done": true, "done_reason": reason})
        .to_string()
}

const VERSION: &str = r#"{"version":"0.12.6"}"#;
const SHOW: &str = include_str!("../../../tests/fixtures/local-ai/ollama-show.json");
const SHOW_REMOTE: &str = include_str!("../../../tests/fixtures/local-ai/ollama-show-remote.json");
const TAGS: &str = include_str!("../../../tests/fixtures/local-ai/ollama-tags.json");
const OPENAI_MODELS: &str = include_str!("../../../tests/fixtures/local-ai/openai-models.json");
const LMSTUDIO_MODELS: &str = include_str!("../../../tests/fixtures/local-ai/lmstudio-models.json");
const PROPS: &str = include_str!("../../../tests/fixtures/local-ai/llamacpp-props.json");
const LLAMA_LOADING: &str = include_str!("../../../tests/fixtures/local-ai/llamacpp-loading.json");
const HTML: &str = include_str!("../../../tests/fixtures/local-ai/html-page.html");
const SSE: &str = include_str!("../../../tests/fixtures/local-ai/openai-chat.sse");

fn not_found() -> Vec<Step> {
    json_answer("404 Not Found", r#"{"error":"not found"}"#)
}

fn ollama_with(
    show: &'static str,
    chat: impl Fn(&Req) -> Vec<Step> + Send + Sync + 'static,
) -> Mock {
    serve(move |r| match (r.method.as_str(), r.path.as_str()) {
        ("GET", "/api/version") => json_answer("200 OK", VERSION),
        ("GET", "/api/tags") => json_answer("200 OK", TAGS),
        ("POST", "/api/show") => json_answer("200 OK", show),
        ("POST", "/api/chat") => chat(r),
        _ => not_found(),
    })
}

fn ollama(chat: impl Fn(&Req) -> Vec<Step> + Send + Sync + 'static) -> Mock {
    ollama_with(SHOW, chat)
}

/// A plain OpenAI-compatible server.
fn compat(chat: impl Fn(&Req) -> Vec<Step> + Send + Sync + 'static) -> Mock {
    serve(move |r| match (r.method.as_str(), r.path.as_str()) {
        ("GET", "/v1/models") => json_answer("200 OK", OPENAI_MODELS),
        ("POST", "/v1/chat/completions") => chat(r),
        _ => not_found(),
    })
}

fn request(kind: RuntimeKind, mock: &Mock) -> LocalChatRequest {
    LocalChatRequest {
        request_id: "local-1".into(),
        kind,
        base_url: mock.base().base(),
        model: "qwen3:8b".into(),
        system: "Em là trợ giảng vật lý.".into(),
        messages: vec![LocalMessage::text("user", "Gia tốc là gì?")],
        vision: false,
        json_schema: None,
        temperature: None,
        max_tokens: None,
        context_length: None,
        think: None,
        timeout_secs: None,
    }
}

fn quick() -> Limits {
    Limits {
        first_piece: Duration::from_secs(5),
        gap: Duration::from_secs(5),
        overall: Duration::from_secs(10),
        precheck: Duration::from_secs(5),
        max_answer: stream::MAX_ANSWER_BYTES,
        max_line: stream::MAX_LINE_BYTES,
    }
}

fn chat(
    mock: &Mock,
    req: &LocalChatRequest,
    limits: Limits,
) -> (Result<LocalChatResponse, AiError>, Vec<LocalEvent>) {
    let http = loopback_client().unwrap();
    let mut events = Vec::new();
    let result = tauri::async_runtime::block_on(async {
        let mut emit = |e: LocalEvent| events.push(e);
        run_chat(
            &http,
            runtime(req.kind),
            &mock.base(),
            req,
            limits,
            &mut emit,
        )
        .await
    });
    (result, events)
}

fn delta(s: &str) -> LocalEvent {
    LocalEvent::Delta(s.into())
}

#[test]
fn ollama_streams_pieces_in_order_without_reasoning_and_with_num_ctx() {
    // " tốc" is cut inside the "ố" between two network writes.
    let toc = format!("{}\n", piece(" tốc"));
    let cut = toc.find('ố').unwrap() + 1;
    let (a, b) = (
        toc.as_bytes()[..cut].to_vec(),
        toc.as_bytes()[cut..].to_vec(),
    );
    let mock = ollama(move |_| {
        vec![
            ndjson_head(),
            line(&piece("<think>BÍ MẬT: thử 3 kg")),
            Step::Wait(20),
            line(&piece("</think>Gia")),
            Step::Wait(20),
            Step::Send(a.clone()),
            Step::Wait(20),
            Step::Send(b.clone()),
            line(&piece(" a = 2 m/s².")),
            line(&finished("stop")),
        ]
    });
    let (r, events) = chat(&mock, &request(RuntimeKind::Ollama, &mock), quick());
    let r = r.unwrap();
    assert_eq!(r.content, "Gia tốc a = 2 m/s².");
    assert_eq!(
        events,
        vec![delta("Gia"), delta(" tốc"), delta(" a = 2 m/s².")]
    );
    assert!(events.iter().all(|e| !format!("{e:?}").contains("BÍ MẬT")));
    assert!(r.streamed && !r.truncated);
    assert_eq!(r.runtime, RuntimeKind::Ollama);
    assert_eq!(r.model, "qwen3:8b");
    assert!(r.first_piece_ms.is_some());
    // Identified first, model checked, then the question.
    assert_eq!(
        mock.seen(),
        vec!["GET /api/version", "POST /api/show", "POST /api/chat"]
    );
    let body = mock.body_of("/api/chat");
    // The model allows 40960; without a request the default window is asked for.
    assert_eq!(body["options"]["num_ctx"], 8192);
    assert_eq!(body["stream"], true);
    assert_eq!(body["messages"][0]["role"], "system");
    assert_eq!(body["messages"][1]["content"], "Gia tốc là gì?");
    assert!(body.get("think").is_none());
}

#[test]
fn ollama_context_never_exceeds_the_model_and_think_needs_the_capability() {
    let mock = ollama(|_| {
        vec![
            ndjson_head(),
            line(&piece("Đúng.")),
            line(&finished("stop")),
        ]
    });
    let mut req = request(RuntimeKind::Ollama, &mock);
    req.context_length = Some(200_000);
    req.think = Some(false);
    req.max_tokens = Some(100_000);
    let (r, _) = chat(&mock, &req, quick());
    assert_eq!(r.unwrap().content, "Đúng.");
    let body = mock.body_of("/api/chat");
    assert_eq!(body["options"]["num_ctx"], 40960);
    assert_eq!(body["options"]["num_predict"], 16384);
    // ollama-show.json lists "thinking".
    assert_eq!(body["think"], false);
    // An older Ollama without capabilities: `think` is not sent (it would be refused).
    let old = include_str!("../../../tests/fixtures/local-ai/ollama-show-vision-old.json");
    let mock = ollama_with(old, |_| {
        vec![
            ndjson_head(),
            line(&piece("Đúng.")),
            line(&finished("length")),
        ]
    });
    let mut req = request(RuntimeKind::Ollama, &mock);
    req.think = Some(false);
    let (r, _) = chat(&mock, &req, quick());
    assert!(r.unwrap().truncated);
    assert!(mock.body_of("/api/chat").get("think").is_none());
}

#[test]
fn openai_compatible_and_lm_studio_stream_server_sent_events() {
    let mock = compat(|_| {
        vec![
            stream_head("text/event-stream"),
            Step::Send(SSE.as_bytes().to_vec()),
        ]
    });
    let mut req = request(RuntimeKind::OpenAiCompatible, &mock);
    req.model = "qwen2.5-7b-instruct".into();
    let (r, events) = chat(&mock, &req, quick());
    let r = r.unwrap();
    assert_eq!(r.content, "Lực là đại lượng vectơ.");
    assert_eq!(events, vec![delta("Lực"), delta(" là đại lượng vectơ.")]);
    assert_eq!(r.runtime, RuntimeKind::OpenAiCompatible);
    // Checked not to be Ollama, identified, then the question.
    assert_eq!(
        mock.seen(),
        vec![
            "GET /api/version",
            "GET /v1/models",
            "POST /v1/chat/completions"
        ]
    );
    assert_eq!(mock.body_of("/v1/chat/completions")["stream"], true);

    let lm = serve(|r| match r.path.as_str() {
        "/api/v0/models" => json_answer("200 OK", LMSTUDIO_MODELS),
        "/v1/chat/completions" => {
            vec![
                stream_head("text/event-stream"),
                Step::Send(SSE.as_bytes().to_vec()),
            ]
        }
        _ => not_found(),
    });
    let mut req = request(RuntimeKind::LmStudio, &lm);
    req.model = "qwen2.5-7b-instruct".into();
    let (r, _) = chat(&lm, &req, quick());
    assert_eq!(r.unwrap().runtime, RuntimeKind::LmStudio);
    assert_eq!(
        lm.seen(),
        vec![
            "GET /api/version",
            "GET /api/v0/models",
            "POST /v1/chat/completions"
        ]
    );
}

#[test]
fn a_stream_without_its_end_mark_is_marked_incomplete() {
    let mock = ollama(|_| vec![ndjson_head(), line(&piece("Gia tốc"))]);
    let (r, _) = chat(&mock, &request(RuntimeKind::Ollama, &mock), quick());
    let r = r.unwrap();
    assert_eq!(r.content, "Gia tốc");
    assert!(r.truncated);
}

#[test]
fn reasoning_only_and_empty_answers_are_errors() {
    let mock = ollama(|_| {
        vec![
            ndjson_head(),
            line(&piece("<think>chỉ nháp</think>")),
            line(&finished("stop")),
        ]
    });
    let (r, events) = chat(&mock, &request(RuntimeKind::Ollama, &mock), quick());
    assert!(matches!(r, Err(AiError::BadResponse(ref m)) if m == "reasoningOnly"));
    assert!(events.is_empty());
    let mock = ollama(|_| vec![ndjson_head(), line(&finished("length"))]);
    let (r, _) = chat(&mock, &request(RuntimeKind::Ollama, &mock), quick());
    assert!(matches!(r, Err(AiError::BadResponse(ref m)) if m == "empty answer (length)"));
}

/// Runs until the first event, then drops the answer as a stop does.
fn first_event_then_drop(mock: &Mock) {
    let http = loopback_client().unwrap();
    let req = request(RuntimeKind::Ollama, mock);
    let got = AtomicBool::new(false);
    let base = mock.base();
    tauri::async_runtime::block_on(async {
        let mut emit = |_: LocalEvent| got.store(true, Ordering::SeqCst);
        let answer = run_chat(&http, runtime(req.kind), &base, &req, quick(), &mut emit);
        let first = async {
            while !got.load(Ordering::SeqCst) {
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        };
        tokio::select! {
            r = answer => panic!("the answer should still be streaming: {r:?}"),
            _ = tokio::time::timeout(Duration::from_secs(5), first) => {}
        }
    });
}

#[test]
fn dropping_the_answer_closes_the_connection() {
    let mock = ollama(|_| vec![ndjson_head(), line(&piece("Gia")), Step::WaitForClose]);
    first_event_then_drop(&mock);
    assert_eq!(mock.closed.recv_timeout(Duration::from_secs(10)), Ok(true));
}

#[test]
fn ai_cancel_stops_a_local_answer_and_closes_the_connection() {
    let mock = ollama(|_| vec![ndjson_head(), line(&piece("Gia")), Step::WaitForClose]);
    let state = AiState::default();
    let http = loopback_client().unwrap();
    let req = request(RuntimeKind::Ollama, &mock);
    let got = AtomicBool::new(false);
    let (result, stopped) = tauri::async_runtime::block_on(async {
        let mut emit = |_: LocalEvent| got.store(true, Ordering::SeqCst);
        let answer = chat_cancellable(&state, &http, &req, quick(), &mut emit);
        let stop = async {
            for _ in 0..500 {
                if got.load(Ordering::SeqCst) {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
            // What `ai_cancel` does.
            cancel_inflight(&state, "local-1")
        };
        tokio::join!(answer, stop)
    });
    assert!(stopped, "the request was registered");
    assert!(matches!(result, Err(AiError::Cancelled(ref id)) if id == "local-1"));
    assert_eq!(mock.closed.recv_timeout(Duration::from_secs(10)), Ok(true));
    assert!(state.inflight.lock().unwrap().is_empty(), "entry removed");
}

#[test]
fn a_non_loopback_address_is_refused_before_any_request() {
    let state = AiState::default();
    let http = loopback_client().unwrap();
    let mock = ollama(|_| not_found());
    let mut req = request(RuntimeKind::Ollama, &mock);
    req.base_url = "http://192.168.1.5:11434".into();
    let r = tauri::async_runtime::block_on(async {
        let mut emit = |_: LocalEvent| {};
        chat_cancellable(&state, &http, &req, quick(), &mut emit).await
    });
    assert!(matches!(r, Err(AiError::NotAllowed(ref t)) if t == NOT_LOOPBACK));
    assert!(mock.seen().is_empty());
    assert!(state.inflight.lock().unwrap().is_empty());
}

#[test]
fn stalls_are_timed_out_first_piece_gap_and_overall() {
    let limits = Limits {
        first_piece: Duration::from_millis(300),
        gap: Duration::from_millis(300),
        ..quick()
    };
    // No headers at all.
    let mock = ollama(|_| vec![Step::Wait(1500), ndjson_head()]);
    let (r, _) = chat(&mock, &request(RuntimeKind::Ollama, &mock), limits);
    let e = r.unwrap_err();
    assert_eq!(tag_of(&e), STALLED);
    assert!(e_message(&e).contains("first-piece"), "{e:?}");
    // Headers but no piece.
    let mock = ollama(|_| vec![ndjson_head(), Step::Wait(1500), line(&piece("x"))]);
    let (r, _) = chat(&mock, &request(RuntimeKind::Ollama, &mock), limits);
    assert!(e_message(&r.unwrap_err()).contains("first-piece"));
    // A piece, then silence.
    let mock = ollama(|_| vec![ndjson_head(), line(&piece("Gia")), Step::Wait(1500)]);
    let (r, events) = chat(&mock, &request(RuntimeKind::Ollama, &mock), limits);
    assert!(e_message(&r.unwrap_err()).contains("gap"));
    assert_eq!(events, vec![delta("Gia")]);
    // Pieces keep coming, but the whole answer takes too long.
    let mock = ollama(|_| {
        let mut steps = vec![ndjson_head()];
        for _ in 0..20 {
            steps.push(line(&piece("a")));
            steps.push(Step::Wait(100));
        }
        steps
    });
    let overall = Limits {
        overall: Duration::from_millis(700),
        gap: Duration::from_secs(2),
        ..quick()
    };
    let (r, _) = chat(&mock, &request(RuntimeKind::Ollama, &mock), overall);
    assert!(e_message(&r.unwrap_err()).contains("overall"));
}

fn e_message(e: &AiError) -> String {
    serde_json::to_value(e).unwrap()["message"]
        .as_str()
        .unwrap()
        .to_string()
}

#[test]
fn http_errors_get_tags_and_never_fall_back() {
    for (status, body, tag) in [
        (
            "404 Not Found",
            r#"{"error":{"message":"model \"x\" not found"}}"#,
            MODEL_MISSING,
        ),
        ("503 Service Unavailable", LLAMA_LOADING, LOADING),
        (
            "401 Unauthorized",
            r#"{"error":{"message":"Invalid API Key"}}"#,
            NEEDS_AUTH,
        ),
        ("500 Internal Server Error", "boom", FAILED),
    ] {
        let mock = compat(move |_| json_answer(status, body));
        let (r, _) = chat(
            &mock,
            &request(RuntimeKind::OpenAiCompatible, &mock),
            quick(),
        );
        let e = r.unwrap_err();
        assert_eq!(tag_of(&e), tag, "{status}");
        // One attempt only: no retry.
        assert_eq!(
            mock.seen(),
            vec![
                "GET /api/version",
                "GET /v1/models",
                "POST /v1/chat/completions"
            ],
            "{status}"
        );
    }
    // Ollama: an unknown model is found before the question is sent.
    let mock = serve(|r| match r.path.as_str() {
        "/api/version" => json_answer("200 OK", VERSION),
        "/api/show" => json_answer("404 Not Found", r#"{"error":"model 'x' not found"}"#),
        _ => not_found(),
    });
    let (r, _) = chat(&mock, &request(RuntimeKind::Ollama, &mock), quick());
    assert_eq!(tag_of(&r.unwrap_err()), MODEL_MISSING);
    assert_eq!(mock.seen(), vec!["GET /api/version", "POST /api/show"]);
    // An error line in the middle of the stream.
    let mock = ollama(|_| {
        vec![
            ndjson_head(),
            line(&piece("Gia")),
            line(r#"{"error":"model requires more system memory"}"#),
        ]
    });
    let (r, events) = chat(&mock, &request(RuntimeKind::Ollama, &mock), quick());
    assert_eq!(tag_of(&r.unwrap_err()), FAILED);
    assert_eq!(events, vec![delta("Gia")]);
}

#[test]
fn answers_and_lines_over_their_caps_are_refused() {
    let mock = ollama(|_| {
        let mut steps = vec![ndjson_head()];
        for _ in 0..10 {
            steps.push(line(&piece("0123456789")));
        }
        steps.push(line(&finished("stop")));
        steps
    });
    let small = Limits {
        max_answer: 64,
        ..quick()
    };
    let (r, _) = chat(&mock, &request(RuntimeKind::Ollama, &mock), small);
    let e = r.unwrap_err();
    assert!(
        matches!(e, AiError::BadResponse(_)) && tag_of(&e) == TOO_LARGE,
        "{e:?}"
    );
    let long = piece(&"x".repeat(2000));
    let mock = ollama(move |_| vec![ndjson_head(), line(&long)]);
    let short_lines = Limits {
        max_line: 256,
        ..quick()
    };
    let (r, _) = chat(&mock, &request(RuntimeKind::Ollama, &mock), short_lines);
    assert_eq!(tag_of(&r.unwrap_err()), TOO_LARGE);
}

#[test]
fn a_redirect_is_never_followed() {
    let elsewhere = TcpListener::bind("127.0.0.1:0").unwrap();
    elsewhere.set_nonblocking(true).unwrap();
    let to = elsewhere.local_addr().unwrap().port();
    let mock = compat(move |_| {
        vec![Step::Send(
            format!(
                "HTTP/1.1 307 Temporary Redirect\r\nLocation: http://127.0.0.1:{to}/v1/chat/completions\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            )
            .into_bytes(),
        )]
    });
    let (r, _) = chat(
        &mock,
        &request(RuntimeKind::OpenAiCompatible, &mock),
        quick(),
    );
    let e = r.unwrap_err();
    assert_eq!(tag_of(&e), FAILED);
    assert!(e_message(&e).contains("307"));
    thread::sleep(Duration::from_millis(200));
    assert!(
        matches!(elsewhere.accept(), Err(ref err) if err.kind() == ErrorKind::WouldBlock),
        "the prompt was resent elsewhere"
    );
}

#[test]
fn ollama_cloud_models_never_get_the_question() {
    let mock = ollama_with(SHOW_REMOTE, |_| {
        vec![ndjson_head(), line(&piece("x")), line(&finished("stop"))]
    });
    let (r, _) = chat(&mock, &request(RuntimeKind::Ollama, &mock), quick());
    assert!(matches!(r, Err(AiError::NotAllowed(ref t)) if t == REMOTE_MODEL));
    assert_eq!(mock.seen(), vec!["GET /api/version", "POST /api/show"]);
    // A "-cloud" tag is refused before any request.
    let mock = ollama(|_| vec![ndjson_head(), line(&piece("x"))]);
    let mut req = request(RuntimeKind::Ollama, &mock);
    req.model = "gpt-oss:120b-cloud".into();
    let (r, _) = chat(&mock, &req, quick());
    assert!(matches!(r, Err(AiError::NotAllowed(ref t)) if t == REMOTE_MODEL));
    assert!(mock.seen().is_empty());
}

/// Ollama also serves the OpenAI-compatible `/v1` API, where its "cloud" models look local.
fn ollama_with_v1() -> Mock {
    let list = json!({"object": "list", "data": [
        {"id": "gpt-oss:120b-cloud", "object": "model", "owned_by": "library"},
        {"id": "qwen3:8b", "object": "model", "owned_by": "library"},
        // A copy of a cloud model keeps no "-cloud" tag.
        {"id": "my-copy:latest", "object": "model", "owned_by": "library"}
    ]})
    .to_string();
    serve(move |r| match (r.method.as_str(), r.path.as_str()) {
        ("GET", "/api/version") => json_answer("200 OK", VERSION),
        ("GET", "/api/tags") => json_answer("200 OK", TAGS),
        ("POST", "/api/show") => json_answer("200 OK", SHOW_REMOTE),
        ("GET", "/v1/models") => json_answer("200 OK", &list),
        ("POST", "/v1/chat/completions") => vec![
            stream_head("text/event-stream"),
            Step::Send(SSE.as_bytes().to_vec()),
        ],
        _ => not_found(),
    })
}

#[test]
fn an_ollama_address_is_only_used_as_ollama() {
    let posted = |m: &Mock| m.seen().iter().any(|r| r.starts_with("POST /v1/"));
    // A cloud model under another kind: refused before any request.
    for kind in [
        RuntimeKind::OpenAiCompatible,
        RuntimeKind::LmStudio,
        RuntimeKind::LlamaCpp,
    ] {
        let mock = ollama_with_v1();
        let mut req = request(kind, &mock);
        req.model = "gpt-oss:120b-cloud".into();
        let (r, events) = chat(&mock, &req, quick());
        assert!(
            matches!(r, Err(AiError::NotAllowed(ref t)) if t == REMOTE_MODEL),
            "{kind:?}: {r:?}"
        );
        assert!(events.is_empty());
        assert!(mock.seen().is_empty(), "{kind:?}: {:?}", mock.seen());
    }
    // Any other model: the address answers as Ollama, so it is only used as Ollama (through
    // `/v1` a copied cloud model cannot be recognised and `num_ctx` cannot be sent). Ollama is
    // asked first, so every kind names it, also one whose own fingerprint Ollama does not answer
    // (llama.cpp's `/props`).
    for kind in [
        RuntimeKind::OpenAiCompatible,
        RuntimeKind::LmStudio,
        RuntimeKind::LlamaCpp,
    ] {
        for model in ["qwen3:8b", "my-copy:latest"] {
            let mock = ollama_with_v1();
            let mut req = request(kind, &mock);
            req.model = model.into();
            let (r, events) = chat(&mock, &req, quick());
            let e = r.unwrap_err();
            assert_eq!(tag_of(&e), NOT_RUNTIME, "{kind:?} {model}");
            assert_eq!(
                e_message(&e),
                format!("{NOT_RUNTIME}: {IS_OLLAMA}"),
                "{kind:?} {model}"
            );
            assert!(events.is_empty());
            assert!(!posted(&mock), "{kind:?} {model}: the prompt was sent");
            assert_eq!(mock.seen(), vec!["GET /api/version"], "{kind:?} {model}");
        }
    }
    // The answer test reports it too.
    let http = loopback_client().unwrap();
    for kind in [RuntimeKind::OpenAiCompatible, RuntimeKind::LlamaCpp] {
        let mock = ollama_with_v1();
        let t = tauri::async_runtime::block_on(test_model(
            &http,
            kind,
            &mock.base(),
            "qwen3:8b",
            quick(),
        ));
        assert_eq!(t.status, LocalTestStatus::NotRuntime, "{kind:?}");
        assert_eq!(t.detail, IS_OLLAMA, "{kind:?}");
        assert!(!posted(&mock));
    }
    // Lists and details under another kind are refused the same way, so the page can say
    // "this is Ollama" before a model is chosen.
    for kind in [RuntimeKind::OpenAiCompatible, RuntimeKind::LmStudio] {
        let mock = ollama_with_v1();
        let list = tauri::async_runtime::block_on(list_models(
            &http,
            runtime(kind),
            &mock.base(),
            quick().precheck,
        ));
        assert_eq!(tag_of(&list.unwrap_err()), NOT_RUNTIME, "{kind:?}");
        assert_eq!(mock.seen(), vec!["GET /api/version"], "{kind:?}");
        let info = tauri::async_runtime::block_on(model_info(
            &http,
            runtime(kind),
            &mock.base(),
            "qwen3:8b",
            quick().precheck,
        ));
        assert_eq!(tag_of(&info.unwrap_err()), NOT_RUNTIME, "{kind:?}");
    }
    // As Ollama, the same address works and its cloud models are flagged.
    let mock = ollama_with_v1();
    let list = tauri::async_runtime::block_on(list_models(
        &http,
        runtime(RuntimeKind::Ollama),
        &mock.base(),
        quick().precheck,
    ))
    .unwrap();
    assert!(list
        .models
        .iter()
        .any(|m| m.id == "gpt-oss:120b-cloud" && m.remote));
}

#[test]
fn lm_studio_without_its_rest_api_still_answers() {
    // `/api/v0` missing: a 404, or an error object instead of a list.
    for missing in [
        not_found(),
        json_answer("200 OK", r#"{"error":"Unexpected endpoint or method."}"#),
    ] {
        let mock = serve(move |r| match (r.method.as_str(), r.path.as_str()) {
            ("GET", "/api/v0/models") => missing.clone(),
            ("GET", "/v1/models") => json_answer("200 OK", OPENAI_MODELS),
            ("POST", "/v1/chat/completions") => vec![
                stream_head("text/event-stream"),
                Step::Send(SSE.as_bytes().to_vec()),
            ],
            _ => not_found(),
        });
        let mut req = request(RuntimeKind::LmStudio, &mock);
        req.model = "qwen2.5-7b-instruct".into();
        let (r, _) = chat(&mock, &req, quick());
        let r = r.unwrap();
        assert_eq!(r.content, "Lực là đại lượng vectơ.");
        assert_eq!(r.runtime, RuntimeKind::LmStudio);
        assert_eq!(
            mock.seen(),
            vec![
                "GET /api/version",
                "GET /api/v0/models",
                "GET /v1/models",
                "POST /v1/chat/completions"
            ]
        );
        let http = loopback_client().unwrap();
        let list = tauri::async_runtime::block_on(list_models(
            &http,
            runtime(RuntimeKind::LmStudio),
            &mock.base(),
            quick().precheck,
        ))
        .unwrap();
        assert_eq!(list.models.len(), 2);
    }
    // Detection does not guess: a server with only `/v1` is reported as OpenAI-compatible
    // (llama.cpp and many others answer `/v1/models` too).
    let p = probe_of(&compat(|_| not_found()));
    assert_eq!(p.kind, Some(RuntimeKind::OpenAiCompatible));
}

#[test]
fn an_unidentified_server_never_gets_the_question() {
    let html = || {
        serve(|_| {
            vec![Step::Send(
                format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{HTML}",
                    HTML.len()
                )
                .into_bytes(),
            )]
        })
    };
    // Every other kind first checks that the address is not Ollama.
    for (kind, asked) in [
        (RuntimeKind::Ollama, vec!["GET /api/version"]),
        (
            RuntimeKind::LmStudio,
            vec!["GET /api/version", "GET /api/v0/models"],
        ),
        (
            RuntimeKind::LlamaCpp,
            vec!["GET /api/version", "GET /props"],
        ),
        (
            RuntimeKind::OpenAiCompatible,
            vec!["GET /api/version", "GET /v1/models"],
        ),
    ] {
        let mock = html();
        let (r, _) = chat(&mock, &request(kind, &mock), quick());
        assert!(
            matches!(r, Err(AiError::BadResponse(ref m)) if m == NOT_RUNTIME),
            "{kind:?}"
        );
        assert_eq!(mock.seen(), asked, "{kind:?}");
    }
}

fn probe_of(mock: &Mock) -> RuntimeProbe {
    let http = loopback_client().unwrap();
    tauri::async_runtime::block_on(probe(&http, &mock.base(), Duration::from_secs(3)))
}

#[test]
fn probing_names_the_runtime_that_answers() {
    let o = probe_of(&ollama(|_| not_found()));
    assert_eq!(
        (o.kind, o.status, o.version.as_deref()),
        (
            Some(RuntimeKind::Ollama),
            ProbeStatus::Found,
            Some("0.12.6")
        )
    );
    let lm = probe_of(&serve(|r| match r.path.as_str() {
        "/api/v0/models" => json_answer("200 OK", LMSTUDIO_MODELS),
        "/v1/models" => json_answer("200 OK", OPENAI_MODELS),
        _ => not_found(),
    }));
    assert_eq!(lm.kind, Some(RuntimeKind::LmStudio));
    let llama_mock = serve(|r| match r.path.as_str() {
        "/props" => json_answer("200 OK", PROPS),
        "/v1/models" => json_answer("200 OK", OPENAI_MODELS),
        _ => not_found(),
    });
    let llama = probe_of(&llama_mock);
    assert_eq!(
        (llama.kind, llama.version.as_deref()),
        (Some(RuntimeKind::LlamaCpp), Some("b6700-1a2b3c4d"))
    );
    assert_eq!(
        llama_mock.seen(),
        vec!["GET /api/version", "GET /api/v0/models", "GET /props"]
    );
    let loading = probe_of(&serve(|r| match r.path.as_str() {
        "/props" => json_answer("503 Service Unavailable", LLAMA_LOADING),
        _ => not_found(),
    }));
    assert_eq!(loading.status, ProbeStatus::Loading);
    let generic = probe_of(&compat(|_| not_found()));
    assert_eq!(generic.kind, Some(RuntimeKind::OpenAiCompatible));
    let web_page = serve(|_| {
        vec![Step::Send(
            format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{HTML}",
                HTML.len()
            )
            .into_bytes(),
        )]
    });
    let p = probe_of(&web_page);
    assert_eq!((p.kind, p.status), (None, ProbeStatus::NotRuntime));
    // Only GET requests, nothing about the learner.
    assert!(web_page.seen().iter().all(|r| r.starts_with("GET ")));
    let locked = probe_of(&serve(|_| json_answer("401 Unauthorized", "{}")));
    assert_eq!((locked.kind, locked.status), (None, ProbeStatus::NeedsAuth));
    // A closed port.
    let port = {
        let l = TcpListener::bind("127.0.0.1:0").unwrap();
        l.local_addr().unwrap().port()
    };
    let http = loopback_client().unwrap();
    let gone =
        tauri::async_runtime::block_on(probe(&http, &Loopback::v4(port), Duration::from_secs(3)));
    assert_eq!(gone.status, ProbeStatus::Unreachable);
}

#[test]
fn localhost_resolves_to_loopback_without_dns() {
    let mock = ollama(|_| not_found());
    let http = loopback_client().unwrap();
    let base = Loopback {
        host: LoopHost::Localhost,
        port: mock.port,
    };
    let p = tauri::async_runtime::block_on(probe(&http, &base, Duration::from_secs(3)));
    assert_eq!(p.status, ProbeStatus::Found);
    assert_eq!(p.base_url, format!("http://localhost:{}", mock.port));
}

#[test]
fn model_lists_and_details() {
    let http = loopback_client().unwrap();
    let run = |f| tauri::async_runtime::block_on(f);
    let mock = ollama(|_| not_found());
    let list = run(list_models(
        &http,
        runtime(RuntimeKind::Ollama),
        &mock.base(),
        quick().precheck,
    ))
    .unwrap();
    assert_eq!(list.models.len(), 4);
    assert!(list.models.iter().any(|m| m.remote));
    assert!(!list.more);
    let d = tauri::async_runtime::block_on(model_info(
        &http,
        runtime(RuntimeKind::Ollama),
        &mock.base(),
        "qwen3:8b",
        quick().precheck,
    ))
    .unwrap();
    assert_eq!((d.context_length, d.thinking), (Some(40960), Cap::Yes));

    // LM Studio without its REST API: the OpenAI-compatible list is used.
    let old_lm = serve(|r| match r.path.as_str() {
        "/v1/models" => json_answer("200 OK", OPENAI_MODELS),
        _ => not_found(),
    });
    let list = tauri::async_runtime::block_on(list_models(
        &http,
        runtime(RuntimeKind::LmStudio),
        &old_lm.base(),
        quick().precheck,
    ))
    .unwrap();
    assert_eq!(list.models.len(), 2);
    assert_eq!(
        old_lm.seen(),
        vec!["GET /api/version", "GET /api/v0/models", "GET /v1/models"]
    );

    // LM Studio details come from its list.
    let lm = serve(|r| match r.path.as_str() {
        "/api/v0/models" => json_answer("200 OK", LMSTUDIO_MODELS),
        _ => not_found(),
    });
    let info = |model: &str| {
        tauri::async_runtime::block_on(model_info(
            &http,
            runtime(RuntimeKind::LmStudio),
            &lm.base(),
            model,
            quick().precheck,
        ))
    };
    let vlm = info("qwen2-vl-7b-instruct").unwrap();
    assert_eq!((vlm.vision, vlm.loaded), (Cap::Yes, Some(false)));
    assert_eq!(tag_of(&info("missing").unwrap_err()), MODEL_MISSING);

    // llama.cpp: /props for the context, /health for the load state.
    let llama = serve(|r| match r.path.as_str() {
        "/props" => json_answer("200 OK", PROPS),
        "/health" => json_answer("200 OK", r#"{"status":"ok"}"#),
        _ => not_found(),
    });
    let d = tauri::async_runtime::block_on(model_info(
        &http,
        runtime(RuntimeKind::LlamaCpp),
        &llama.base(),
        "gemma.gguf",
        quick().precheck,
    ))
    .unwrap();
    assert_eq!((d.context_length, d.loaded), (Some(4096), Some(true)));
    assert_eq!(d.capabilities.load_state, Cap::Yes);
}

#[test]
fn the_answer_test_is_tiny_and_reports_a_status() {
    let http = loopback_client().unwrap();
    let mock = ollama(|_| {
        vec![
            ndjson_head(),
            line(&piece("<think>ừm")),
            line(&finished("length")),
        ]
    });
    let t = tauri::async_runtime::block_on(test_model(
        &http,
        RuntimeKind::Ollama,
        &mock.base(),
        "qwen3:8b",
        quick(),
    ));
    // Only reasoning in 8 tokens still proves the model answers.
    assert_eq!(t.status, LocalTestStatus::Ok);
    assert!(t.first_piece_ms.is_some());
    let body = mock.body_of("/api/chat");
    assert_eq!(body["options"]["num_predict"], 8);
    assert_eq!(body["think"], false);

    let missing = serve(|r| match r.path.as_str() {
        "/api/version" => json_answer("200 OK", VERSION),
        "/api/show" => json_answer("404 Not Found", r#"{"error":"model not found"}"#),
        _ => not_found(),
    });
    let t = tauri::async_runtime::block_on(test_model(
        &http,
        RuntimeKind::Ollama,
        &missing.base(),
        "qwen3:8b",
        quick(),
    ));
    assert_eq!(t.status, LocalTestStatus::ModelMissing);
    let port = {
        let l = TcpListener::bind("127.0.0.1:0").unwrap();
        l.local_addr().unwrap().port()
    };
    let t = tauri::async_runtime::block_on(test_model(
        &http,
        RuntimeKind::Ollama,
        &Loopback::v4(port),
        "qwen3:8b",
        quick(),
    ));
    assert_eq!(t.status, LocalTestStatus::Unreachable);
}

/// A question with the learner's circled region as a picture.
fn with_picture(kind: RuntimeKind, mock: &Mock, model: &str) -> LocalChatRequest {
    let mut req = request(kind, mock);
    req.model = model.into();
    req.vision = true;
    req.messages = vec![LocalMessage {
        images: vec![png()],
        ..LocalMessage::text("user", "Chỗ em khoanh trên bảng là gì?")
    }];
    req
}

fn refused_with(r: Result<LocalChatResponse, AiError>, tag: &str) {
    match r {
        Err(AiError::NotAllowed(ref m)) if m.split(':').next() == Some(tag) => {}
        other => panic!("expected {tag}, got {other:?}"),
    }
}

/// `/api/show` of a model whose capabilities list "vision".
fn show_vision() -> String {
    json!({
        "details": {"family": "gemma3"},
        "model_info": {"general.architecture": "gemma3", "gemma3.context_length": 131072},
        "capabilities": ["completion", "vision"]
    })
    .to_string()
}

#[test]
fn a_picture_reaches_an_ollama_model_that_reads_pictures() {
    let show = show_vision();
    let mock = serve(move |r| match (r.method.as_str(), r.path.as_str()) {
        ("GET", "/api/version") => json_answer("200 OK", VERSION),
        ("POST", "/api/show") => json_answer("200 OK", &show),
        ("POST", "/api/chat") => vec![
            ndjson_head(),
            line(&piece("Đó là vectơ lực.")),
            line(&finished("stop")),
        ],
        _ => not_found(),
    });
    let (r, _) = chat(
        &mock,
        &with_picture(RuntimeKind::Ollama, &mock, "gemma3:4b"),
        quick(),
    );
    assert_eq!(r.unwrap().content, "Đó là vectơ lực.");
    assert_eq!(
        mock.seen(),
        vec!["GET /api/version", "POST /api/show", "POST /api/chat"]
    );
    let body = mock.body_of("/api/chat");
    assert_eq!(body["messages"][1]["images"], json!([png()]));
    assert_eq!(
        body["messages"][1]["content"],
        "Chỗ em khoanh trên bảng là gì?"
    );
}

#[test]
fn a_picture_never_reaches_a_model_that_does_not_or_may_not_read_pictures() {
    let no_chat = |m: &Mock| !m.seen().iter().any(|r| r.contains("chat"));
    // Ollama says the model has no "vision" capability.
    let mock = ollama(|_| vec![ndjson_head(), line(&piece("x"))]);
    let (r, _) = chat(
        &mock,
        &with_picture(RuntimeKind::Ollama, &mock, "qwen3:8b"),
        quick(),
    );
    refused_with(r, NO_VISION);
    assert!(no_chat(&mock));
    // An older Ollama without the capabilities list cannot tell.
    let old = include_str!("../../../tests/fixtures/local-ai/ollama-show-vision-old.json");
    let mock = ollama_with(old, |_| vec![ndjson_head(), line(&piece("x"))]);
    let (r, _) = chat(
        &mock,
        &with_picture(RuntimeKind::Ollama, &mock, "llava:7b"),
        quick(),
    );
    refused_with(r, VISION_UNVERIFIED);
    assert!(no_chat(&mock));
    // Any other OpenAI-compatible server cannot tell either.
    let mock = compat(|_| vec![stream_head("text/event-stream"), Step::Send(SSE.into())]);
    let (r, _) = chat(
        &mock,
        &with_picture(RuntimeKind::OpenAiCompatible, &mock, "qwen2.5-7b-instruct"),
        quick(),
    );
    refused_with(r, VISION_UNVERIFIED);
    assert!(no_chat(&mock));
}

#[test]
fn lm_studio_and_llama_cpp_say_whether_their_model_reads_pictures() {
    let posted = |m: &Mock| m.seen().iter().any(|r| r.starts_with("POST /v1/chat"));
    let lm = || {
        serve(|r| match r.path.as_str() {
            "/api/v0/models" => json_answer("200 OK", LMSTUDIO_MODELS),
            "/v1/chat/completions" => vec![
                stream_head("text/event-stream"),
                Step::Send(SSE.as_bytes().to_vec()),
            ],
            _ => not_found(),
        })
    };
    // Type `vlm`: the picture is sent as an image_url part.
    let mock = lm();
    let (r, _) = chat(
        &mock,
        &with_picture(RuntimeKind::LmStudio, &mock, "qwen2-vl-7b-instruct"),
        quick(),
    );
    assert_eq!(r.unwrap().content, "Lực là đại lượng vectơ.");
    let body = mock.body_of("/v1/chat/completions");
    assert_eq!(
        body["messages"][1]["content"][1]["image_url"]["url"],
        format!("data:image/png;base64,{}", png())
    );
    // Type `llm`: refused before the question.
    let mock = lm();
    let (r, _) = chat(
        &mock,
        &with_picture(RuntimeKind::LmStudio, &mock, "qwen2.5-7b-instruct"),
        quick(),
    );
    refused_with(r, NO_VISION);
    assert!(!posted(&mock));
    // Without its REST API LM Studio cannot tell.
    let mock = serve(|r| match r.path.as_str() {
        "/v1/models" => json_answer("200 OK", OPENAI_MODELS),
        "/v1/chat/completions" => vec![stream_head("text/event-stream"), Step::Send(SSE.into())],
        _ => not_found(),
    });
    let (r, _) = chat(
        &mock,
        &with_picture(RuntimeKind::LmStudio, &mock, "qwen2.5-7b-instruct"),
        quick(),
    );
    refused_with(r, VISION_UNVERIFIED);
    assert!(!posted(&mock));

    // llama.cpp: `/props` modalities.
    let llama = |vision: Option<bool>| {
        let mut props: serde_json::Value = serde_json::from_str(PROPS).unwrap();
        match vision {
            Some(v) => props["modalities"]["vision"] = json!(v),
            None => {
                props.as_object_mut().unwrap().remove("modalities");
            }
        }
        let props = props.to_string();
        serve(move |r| match r.path.as_str() {
            "/props" => json_answer("200 OK", &props),
            "/v1/chat/completions" => vec![
                stream_head("text/event-stream"),
                Step::Send(SSE.as_bytes().to_vec()),
            ],
            _ => not_found(),
        })
    };
    let mock = llama(Some(true));
    let (r, _) = chat(
        &mock,
        &with_picture(RuntimeKind::LlamaCpp, &mock, "gemma.gguf"),
        quick(),
    );
    assert!(r.is_ok(), "{r:?}");
    assert_eq!(
        mock.body_of("/v1/chat/completions")["messages"][1]["content"][1]["type"],
        "image_url"
    );
    for (vision, tag) in [(Some(false), NO_VISION), (None, VISION_UNVERIFIED)] {
        let mock = llama(vision);
        let (r, _) = chat(
            &mock,
            &with_picture(RuntimeKind::LlamaCpp, &mock, "gemma.gguf"),
            quick(),
        );
        refused_with(r, tag);
        assert!(!posted(&mock), "{vision:?}");
    }
}

#[test]
fn a_picture_not_asked_for_or_not_valid_is_refused_before_any_request() {
    let show = show_vision();
    let vision_ollama = || {
        let show = show.clone();
        serve(move |r| match r.path.as_str() {
            "/api/version" => json_answer("200 OK", VERSION),
            "/api/show" => json_answer("200 OK", &show),
            _ => not_found(),
        })
    };
    // No `vision` from the caller.
    let mock = vision_ollama();
    let mut req = with_picture(RuntimeKind::Ollama, &mock, "gemma3:4b");
    req.vision = false;
    let (r, _) = chat(&mock, &req, quick());
    refused_with(r, NO_VISION);
    assert!(mock.seen().is_empty());
    // Not a PNG or JPEG, or two pictures.
    for images in [vec!["R0lGODlhAQABAAAAACw=".to_string()], vec![png(), png()]] {
        let mock = vision_ollama();
        let mut req = with_picture(RuntimeKind::Ollama, &mock, "gemma3:4b");
        req.messages[0].images = images;
        let (r, _) = chat(&mock, &req, quick());
        refused_with(r, BAD_IMAGE);
        assert!(mock.seen().is_empty());
    }
}

#[test]
fn a_structured_answer_that_is_json_is_kept_as_sent() {
    let json_text = r#"{"quote":"a </think> b","note":"<think>x"}"#;
    let (head, tail) = json_text.split_at(14);
    let (head, tail) = (head.to_string(), tail.to_string());
    let mock = ollama(move |_| {
        vec![
            ndjson_head(),
            line(&piece(&head)),
            line(&piece(&tail)),
            line(&finished("stop")),
        ]
    });
    let mut req = request(RuntimeKind::Ollama, &mock);
    req.json_schema = Some(json!({"type": "object"}));
    let (r, _) = chat(&mock, &req, quick());
    assert_eq!(r.unwrap().content, json_text);
    assert_eq!(mock.body_of("/api/chat")["format"]["type"], "object");
    // Reasoning before the JSON is still removed.
    let mock = ollama(|_| {
        vec![
            ndjson_head(),
            line(&piece("<think>nháp</think>{\"a\":1}")),
            line(&finished("stop")),
        ]
    });
    let mut req = request(RuntimeKind::Ollama, &mock);
    req.json_schema = Some(json!({"type": "object"}));
    let (r, _) = chat(&mock, &req, quick());
    assert_eq!(r.unwrap().content, "{\"a\":1}");
    // Without a schema the rule applies to any text.
    let text = json_text.to_string();
    let mock = ollama(move |_| vec![ndjson_head(), line(&piece(&text)), line(&finished("stop"))]);
    let (r, _) = chat(&mock, &request(RuntimeKind::Ollama, &mock), quick());
    assert_ne!(r.unwrap().content, json_text);
}
