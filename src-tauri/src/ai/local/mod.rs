//! Language models run by another program on this computer: Ollama, LM Studio, llama.cpp's
//! `llama-server`, or another OpenAI-compatible server the user picks (user decision
//! 2026-10-14). They are not cloud [`crate::ai::Provider`]s: no key, no daily cap, no retry and
//! never a fallback to the cloud.
//!
//! Rules, enforced here (the page cannot reach these servers: the production CSP has no
//! loopback host):
//! - Only loopback addresses ([`endpoint::parse_loopback`]), checked on every call, through a
//!   client without proxy or redirects ([`endpoint::loopback_client`]).
//! - Every command needs the safety gate open (`require_ai_allowed`).
//! - Detection only asks the three usual addresses ([`endpoint::DEFAULTS`]) and only when the
//!   user presses the button: no other port, no file, no process list.
//! - A prompt is only sent to a server that identified itself as the chosen runtime, and never
//!   to an Ollama model that runs on ollama.com ("cloud" models): a model named like one is
//!   refused for every kind before any request, Ollama's own details are checked for the rest,
//!   and an address that answers as Ollama is only used as Ollama (through its OpenAI-compatible
//!   `/v1` API a renamed cloud model cannot be recognised and `num_ctx` cannot be sent).
//! - Answers stream to the page through a Tauri channel as [`LocalEvent`]s, with the model's
//!   reasoning removed ([`crate::ai::reasoning`]). A stop (`ai_cancel`) drops the request,
//!   which closes the connection: Ollama and llama.cpp stop generating.
//! - Streamed text is provisional (see [`LocalEvent`]): only the returned
//!   [`LocalChatResponse::content`] is final.
//! - A picture goes only to a model whose runtime says it reads pictures, and only when the
//!   caller asked for it ([`vision`]).
//! - Stall timers: first piece 120 s (the runtime may be loading the model), then 45 s between
//!   pieces, at most 600 s in all. Sizes are capped ([`stream`]).
//!
//! Errors are [`AiError`]s whose message starts with a tag the page maps to a friendly sentence:
//! `"<tag>"` or `"<tag>: <detail>"` (see the constants below).

pub mod endpoint;
pub mod llamacpp;
pub mod lmstudio;
pub mod ollama;
pub mod openai_compat;
pub mod runtime;
pub mod stream;
pub mod vision;

use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::time::Instant;

use super::reasoning::{is_json, ReasoningStream};
use super::{require_ai_allowed, stop_requested, AiError, AiState, InflightGuard};
use endpoint::{loopback_client, parse_loopback, Loopback, DEFAULTS};
use runtime::{
    clean_id, error_message, runtime, Cap, ChatOptions, Fingerprint, LocalModel, LocalRuntime,
    ModelDetails, RuntimeKind, StreamFormat,
};
use stream::{sse_line, Lines, Sse, MAX_ANSWER_BYTES, MAX_LINE_BYTES, MAX_MODELS};

// Error tags (the start of the error message).
/// Nothing answers at the address, or the connection broke.
pub const UNREACHABLE: &str = "local-unreachable";
/// The runtime does not have this model.
pub const MODEL_MISSING: &str = "model-missing";
/// The runtime is still loading its model (HTTP 503).
pub const LOADING: &str = "loading";
/// The server wants a key (HTTP 401/403).
pub const NEEDS_AUTH: &str = "needs-auth";
/// No answer in time (first piece, gap between pieces, or overall).
pub const STALLED: &str = "local-stalled";
/// An Ollama "cloud" model, which runs on ollama.com.
pub const REMOTE_MODEL: &str = "remote-model";
/// Something answered, but not the chosen runtime.
pub const NOT_RUNTIME: &str = "not-runtime";
/// Detail of [`NOT_RUNTIME`]: the address is Ollama, chosen as another kind.
pub const IS_OLLAMA: &str = "ollama";
/// The address is not on this computer.
pub const NOT_LOOPBACK: &str = "not-loopback";
/// An answer, a line or a list over its size cap.
pub const TOO_LARGE: &str = "too-large";
/// Any other error the runtime reported.
pub const FAILED: &str = "local-failed";
/// A picture without `vision`, or for a model the runtime says cannot read pictures.
pub const NO_VISION: &str = "no-vision";
/// A picture for a model whose runtime cannot tell whether it reads pictures.
pub const VISION_UNVERIFIED: &str = "vision-unverified";
/// A picture that is not PNG or JPEG base64, is too large, or one too many ([`vision`]).
pub const BAD_IMAGE: &str = "bad-image";

/// Wait for the first piece of an answer (connecting, loading the model, reading the prompt).
pub const FIRST_PIECE: Duration = Duration::from_secs(120);
/// Longest silence between two pieces.
pub const PIECE_GAP: Duration = Duration::from_secs(45);
/// Longest answer, in all.
pub const OVERALL_MAX_SECS: u64 = 600;
/// One identification step during detection.
const PROBE_STEP: Duration = Duration::from_millis(1500);
/// Identification, model check and lists before a question.
const PRECHECK: Duration = Duration::from_secs(10);

const PROBE_BODY_CAP: usize = 256 * 1024;
const LIST_BODY_CAP: usize = 4 * 1024 * 1024;
/// `/api/show` also returns the model's licence and template.
const INFO_BODY_CAP: usize = 2 * 1024 * 1024;
const ERROR_BODY_CAP: usize = 64 * 1024;

const DEFAULT_MAX_TOKENS: u32 = 2048;
const MAX_TOKENS_CAP: u32 = 16_384;
/// Context window asked from Ollama when the page gives none (Ollama's own default is smaller).
const DEFAULT_CONTEXT: u32 = 8192;
const MIN_CONTEXT: u32 = 2048;
const MAX_CONTEXT: u32 = 262_144;

/// One turn of a question. Only user and assistant turns come from the page ([`chat_role`]).
/// Unlike a cloud [`crate::ai::Message`], a turn may carry a picture ([`vision`]).
#[derive(Debug, Clone, Deserialize)]
pub struct LocalMessage {
    pub role: String,
    pub content: String,
    /// PNG or JPEG bytes as plain base64, for a model that reads pictures.
    #[serde(default)]
    pub images: Vec<String>,
}

impl LocalMessage {
    /// A turn without a picture.
    pub fn text(role: &str, content: &str) -> LocalMessage {
        LocalMessage {
            role: role.into(),
            content: content.into(),
            images: Vec::new(),
        }
    }
}

/// A question for a local runtime.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalChatRequest {
    /// Also the id `ai_cancel` stops.
    pub request_id: String,
    pub kind: RuntimeKind,
    pub base_url: String,
    pub model: String,
    pub system: String,
    pub messages: Vec<LocalMessage>,
    /// The caller means to send a picture: without it a picture is refused ([`vision`]).
    #[serde(default)]
    pub vision: bool,
    /// Structured output, only when the check on this computer said the runtime supports it.
    #[serde(default)]
    pub json_schema: Option<Value>,
    #[serde(default)]
    pub temperature: Option<f64>,
    #[serde(default)]
    pub max_tokens: Option<u32>,
    /// Context window (Ollama `num_ctx`); never more than the model's own.
    #[serde(default)]
    pub context_length: Option<u32>,
    /// Ollama `think` for models that reason first (ignored by other runtimes).
    #[serde(default)]
    pub think: Option<bool>,
    /// Longest answer in seconds (5–600, default 600).
    #[serde(default)]
    pub timeout_secs: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalChatResponse {
    /// The whole answer, reasoning removed.
    pub content: String,
    pub model: String,
    pub runtime: RuntimeKind,
    pub duration_ms: u64,
    /// Time until the first piece of text.
    pub first_piece_ms: Option<u64>,
    /// The answer stopped at the output limit, or the stream ended without its end mark.
    pub truncated: bool,
    /// The text arrived in more than one piece.
    pub streamed: bool,
}

/// A change to the answer shown while it streams: the same events as a streamed cloud answer
/// (provisional until the final [`LocalChatResponse::content`], see
/// [`crate::ai::stream::StreamEvent`]).
pub use super::stream::StreamEvent as LocalEvent;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ProbeStatus {
    Found,
    /// Found, still loading its model.
    Loading,
    /// Something answered and wants a key.
    NeedsAuth,
    /// Something answered, but no known runtime.
    NotRuntime,
    /// Nothing answers.
    Unreachable,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeProbe {
    /// Detection: the runtime this is the usual address of.
    pub expected: Option<RuntimeKind>,
    /// The runtime that answered.
    pub kind: Option<RuntimeKind>,
    pub base_url: String,
    pub status: ProbeStatus,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalModels {
    pub models: Vec<LocalModel>,
    /// The runtime offered more models than the list keeps.
    pub more: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum LocalTestStatus {
    Ok,
    Unreachable,
    NotRuntime,
    NeedsAuth,
    ModelMissing,
    Loading,
    RemoteModel,
    Stalled,
    Error,
    /// The safety gate is closed, or the address is not on this computer.
    NotAllowed,
}

/// Result of "Kiểm tra trả lời": a tiny streamed answer (it loads the model into memory).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalTest {
    pub status: LocalTestStatus,
    pub first_piece_ms: Option<u64>,
    pub streamed: bool,
    /// Short runtime message for the "error" case; `ollama` for "notRuntime" when the address is
    /// Ollama chosen as another kind.
    pub detail: String,
}

/// Time and size limits of one answer (tests inject small ones).
#[derive(Debug, Clone, Copy)]
pub(crate) struct Limits {
    pub first_piece: Duration,
    pub gap: Duration,
    pub overall: Duration,
    pub precheck: Duration,
    pub max_answer: usize,
    pub max_line: usize,
}

impl Limits {
    pub(crate) fn chat(timeout_secs: Option<u64>) -> Limits {
        Limits {
            first_piece: FIRST_PIECE,
            gap: PIECE_GAP,
            overall: Duration::from_secs(
                timeout_secs
                    .unwrap_or(OVERALL_MAX_SECS)
                    .clamp(5, OVERALL_MAX_SECS),
            ),
            precheck: PRECHECK,
            max_answer: MAX_ANSWER_BYTES,
            max_line: MAX_LINE_BYTES,
        }
    }

    /// "Kiểm tra trả lời": the model may have to load first.
    fn test() -> Limits {
        Limits {
            overall: FIRST_PIECE + Duration::from_secs(30),
            ..Limits::chat(None)
        }
    }
}

/// Only user and assistant turns come from the page.
pub(crate) fn chat_role(role: &str) -> &'static str {
    if role == "assistant" {
        "assistant"
    } else {
        "user"
    }
}

/// Runtime text, shortened and without control characters.
fn detail(s: &str) -> String {
    s.chars()
        .filter(|c| !c.is_control())
        .take(200)
        .collect::<String>()
        .trim()
        .to_string()
}

/// The tag at the start of an error message.
pub(crate) fn tag_of(e: &AiError) -> &str {
    let msg = match e {
        AiError::Timeout(m)
        | AiError::Cancelled(m)
        | AiError::Http(m)
        | AiError::Network(m)
        | AiError::MissingKey(m)
        | AiError::BadResponse(m)
        | AiError::Keychain(m)
        | AiError::DailyLimit(m)
        | AiError::NotAllowed(m)
        | AiError::Unavailable(m) => m,
    };
    msg.split(':').next().unwrap_or_default().trim()
}

fn net_error(e: &reqwest::Error) -> AiError {
    if e.is_timeout() && !e.is_connect() {
        AiError::Timeout(format!("{STALLED}: {e}"))
    } else {
        AiError::Network(format!("{UNREACHABLE}: {e}"))
    }
}

/// An error the runtime reported inside the stream.
pub(crate) fn stream_error(msg: &str) -> AiError {
    let lower = msg.to_ascii_lowercase();
    let tag = if lower.contains("model") && lower.contains("not found") {
        MODEL_MISSING
    } else if lower.contains("loading") {
        LOADING
    } else {
        FAILED
    };
    AiError::Http(format!("{tag}: {}", detail(msg)))
}

/// An HTTP error answer of a runtime.
pub(crate) fn status_error(status: u16, body: &str) -> AiError {
    let msg = serde_json::from_str::<Value>(body)
        .ok()
        .and_then(|v| error_message(&v))
        .unwrap_or_else(|| body.to_string());
    let msg = detail(&msg);
    let lower = msg.to_ascii_lowercase();
    let tag = match status {
        401 | 403 => return AiError::Http(format!("{NEEDS_AUTH}: {status}")),
        300..=399 => return AiError::Http(format!("{FAILED}: {status}: redirect not followed")),
        404 => MODEL_MISSING,
        503 => LOADING,
        400 | 422
            if lower.contains("model")
                && (lower.contains("not found") || lower.contains("not_found")) =>
        {
            MODEL_MISSING
        }
        _ => FAILED,
    };
    AiError::Http(format!("{tag}: {status}: {msg}"))
}

/// Sends a small request and reads its whole (capped) answer.
async fn fetch_text(
    rb: reqwest::RequestBuilder,
    limit: Duration,
    cap: usize,
) -> Result<(u16, String), AiError> {
    let work = async {
        let mut resp = rb.send().await.map_err(|e| net_error(&e))?;
        let status = resp.status().as_u16();
        let mut buf = Vec::new();
        while let Some(chunk) = resp.chunk().await.map_err(|e| net_error(&e))? {
            if buf.len() + chunk.len() > cap {
                return Err(AiError::BadResponse(format!(
                    "{TOO_LARGE}: answer over {cap} bytes"
                )));
            }
            buf.extend_from_slice(&chunk);
        }
        Ok((status, String::from_utf8_lossy(&buf).into_owned()))
    };
    tokio::time::timeout(limit, work).await.map_err(|_| {
        AiError::Timeout(format!("{STALLED}: no answer in {} ms", limit.as_millis()))
    })?
}

/// The start of an error answer, best effort.
async fn error_body(resp: &mut reqwest::Response, limit: Duration) -> String {
    let mut buf = Vec::new();
    let _ = tokio::time::timeout(limit, async {
        while let Ok(Some(chunk)) = resp.chunk().await {
            buf.extend_from_slice(&chunk);
            if buf.len() > ERROR_BODY_CAP {
                break;
            }
        }
    })
    .await;
    buf.truncate(ERROR_BODY_CAP);
    String::from_utf8_lossy(&buf).into_owned()
}

fn json_of(body: &str) -> Result<Value, AiError> {
    serde_json::from_str(body).map_err(|_| AiError::BadResponse(NOT_RUNTIME.into()))
}

/// Asks the address which runtime it is: Ollama, then LM Studio, then llama.cpp, then any
/// OpenAI-compatible server. Nothing about the learner is sent.
pub(crate) async fn probe(http: &reqwest::Client, base: &Loopback, step: Duration) -> RuntimeProbe {
    let mut result = RuntimeProbe {
        expected: None,
        kind: None,
        base_url: base.base(),
        status: ProbeStatus::NotRuntime,
        version: None,
    };
    for (step_no, kind) in RuntimeKind::PROBE_ORDER.into_iter().enumerate() {
        let rt = runtime(kind);
        match fetch_text(rt.fingerprint_request(http, base), step, PROBE_BODY_CAP).await {
            // Nothing listens there: no need to ask the other ways.
            Err(AiError::Network(_)) if step_no == 0 => {
                result.status = ProbeStatus::Unreachable;
                return result;
            }
            // Too slow, too large or a broken connection: not this runtime.
            Err(_) => {}
            Ok((status, body)) => match rt.parse_fingerprint(status, &body) {
                Fingerprint::Match { version, loading } => {
                    result.kind = Some(kind);
                    result.version = version;
                    result.status = if loading {
                        ProbeStatus::Loading
                    } else {
                        ProbeStatus::Found
                    };
                    return result;
                }
                Fingerprint::NeedsAuth => result.status = ProbeStatus::NeedsAuth,
                Fingerprint::NotThis => {}
            },
        }
    }
    result
}

/// The three usual addresses, at the same time.
pub(crate) async fn detect(http: &reqwest::Client, step: Duration) -> Vec<RuntimeProbe> {
    let at = |(kind, port): (RuntimeKind, u16)| async move {
        let mut p = probe(http, &Loopback::v4(port), step).await;
        p.expected = Some(kind);
        p
    };
    let [a, b, c] = DEFAULTS;
    let (a, b, c) = tokio::join!(at(a), at(b), at(c));
    vec![a, b, c]
}

/// The API asked for is missing: a 404, or an error object where a list was expected (servers
/// answer an unknown path in different ways).
fn api_missing(status: u16, body: &str) -> bool {
    status == 404
        || (status == 200
            && serde_json::from_str::<Value>(body)
                .is_ok_and(|v| v.get("error").is_some() && v.get("data").is_none()))
}

/// An address chosen as another kind must not be Ollama. Ollama also serves the
/// OpenAI-compatible `/v1` API, but there a cloud model copied under another name looks local
/// and `num_ctx` cannot be sent (Ollama's small default context would cut the system and safety
/// instructions from the front). So an address that answers Ollama's fingerprint is only used as
/// Ollama, and is refused under any other kind before a list or a prompt. An error while asking
/// is returned too: nothing is sent unless the address is known not to be Ollama.
async fn refuse_ollama_as_other(
    http: &reqwest::Client,
    rt: &dyn LocalRuntime,
    base: &Loopback,
    limit: Duration,
) -> Result<(), AiError> {
    if rt.kind() == RuntimeKind::Ollama {
        return Ok(());
    }
    let ollama = runtime(RuntimeKind::Ollama);
    let (status, body) = fetch_text(
        ollama.fingerprint_request(http, base),
        limit,
        PROBE_BODY_CAP,
    )
    .await?;
    match ollama.parse_fingerprint(status, &body) {
        Fingerprint::Match { .. } => {
            Err(AiError::BadResponse(format!("{NOT_RUNTIME}: {IS_OLLAMA}")))
        }
        Fingerprint::NeedsAuth | Fingerprint::NotThis => Ok(()),
    }
}

pub(crate) async fn list_models(
    http: &reqwest::Client,
    rt: &dyn LocalRuntime,
    base: &Loopback,
    limit: Duration,
) -> Result<LocalModels, AiError> {
    refuse_ollama_as_other(http, rt, base, limit).await?;
    fetch_models(http, rt, base, limit).await
}

/// The model list, from the runtime's own API or its fallback (LM Studio without `/api/v0`).
async fn fetch_models(
    http: &reqwest::Client,
    rt: &dyn LocalRuntime,
    base: &Loopback,
    limit: Duration,
) -> Result<LocalModels, AiError> {
    let (mut status, mut body) =
        fetch_text(rt.models_request(http, base), limit, LIST_BODY_CAP).await?;
    let mut parser = rt;
    if api_missing(status, &body) {
        if let Some(fallback) = rt.models_fallback() {
            (status, body) =
                fetch_text(fallback.models_request(http, base), limit, LIST_BODY_CAP).await?;
            parser = fallback;
        }
    }
    if status == 404 {
        return Err(AiError::BadResponse(NOT_RUNTIME.into()));
    }
    if !(200..300).contains(&status) {
        return Err(status_error(status, &body));
    }
    let mut models = parser.parse_models(&json_of(&body)?);
    let more = models.len() > MAX_MODELS;
    models.truncate(MAX_MODELS);
    Ok(LocalModels { models, more })
}

/// The error message for a model the runtime's list does not hold.
fn not_listed() -> String {
    format!("{MODEL_MISSING}: not listed")
}

/// What the runtime says about one model: its own details request, else its model list.
async fn details_of(
    http: &reqwest::Client,
    rt: &dyn LocalRuntime,
    base: &Loopback,
    model: &str,
    limit: Duration,
) -> Result<ModelDetails, AiError> {
    match rt.info_request(http, base, model) {
        Some(rb) => {
            let (status, body) = fetch_text(rb, limit, INFO_BODY_CAP).await?;
            if !(200..300).contains(&status) {
                return Err(status_error(status, &body));
            }
            Ok(rt.parse_info(&json_of(&body)?, model))
        }
        None => {
            let list = fetch_models(http, rt, base, limit).await?;
            let m = list
                .models
                .iter()
                .find(|m| m.id == model)
                .ok_or_else(|| AiError::Http(not_listed()))?;
            Ok(ModelDetails::from_listing(m, rt.declared()))
        }
    }
}

pub(crate) async fn model_info(
    http: &reqwest::Client,
    rt: &dyn LocalRuntime,
    base: &Loopback,
    model: &str,
    limit: Duration,
) -> Result<ModelDetails, AiError> {
    refuse_ollama_as_other(http, rt, base, limit).await?;
    let mut details = details_of(http, rt, base, model, limit).await?;
    if let Some(rb) = rt.health_request(http, base) {
        if let Ok((status, body)) = fetch_text(rb, limit, PROBE_BODY_CAP).await {
            if let Some(loaded) = rt.parse_health(status, &body) {
                details.loaded = Some(loaded);
                details.capabilities.load_state = Cap::Yes;
            }
        }
    }
    Ok(details)
}

/// The chosen address must not be Ollama chosen as another kind ([`refuse_ollama_as_other`]),
/// and must answer as the chosen runtime, before it gets a prompt. The Ollama check comes first,
/// as for lists and details: an Ollama address chosen as another kind is named as such
/// (`not-runtime: ollama`) whatever that kind's own fingerprint says.
///
/// LM Studio without its `/api/v0` REST API is identified by its OpenAI-compatible model list,
/// as its model list is. Detection ([`probe`]) does not do this: `/v1/models` alone cannot tell
/// LM Studio from llama.cpp or any other server, so detection reports such a server as
/// OpenAI-compatible, and both kinds work with it.
async fn identify(
    http: &reqwest::Client,
    rt: &dyn LocalRuntime,
    base: &Loopback,
    limit: Duration,
) -> Result<(), AiError> {
    refuse_ollama_as_other(http, rt, base, limit).await?;
    let (mut status, body) =
        fetch_text(rt.fingerprint_request(http, base), limit, PROBE_BODY_CAP).await?;
    let mut print = rt.parse_fingerprint(status, &body);
    if print == Fingerprint::NotThis && api_missing(status, &body) {
        if let Some(fallback) = rt.models_fallback() {
            let (fb_status, fb_body) = fetch_text(
                fallback.fingerprint_request(http, base),
                limit,
                PROBE_BODY_CAP,
            )
            .await?;
            status = fb_status;
            print = fallback.parse_fingerprint(fb_status, &fb_body);
        }
    }
    match print {
        Fingerprint::Match { loading: false, .. } => Ok(()),
        Fingerprint::Match { loading: true, .. } => {
            Err(AiError::Http(format!("{LOADING}: {status}")))
        }
        Fingerprint::NeedsAuth => Err(AiError::Http(format!("{NEEDS_AUTH}: {status}"))),
        Fingerprint::NotThis => Err(AiError::BadResponse(NOT_RUNTIME.into())),
    }
}

/// Generation settings; for Ollama also checks that the model exists and runs on this computer
/// (a cloud model may have been copied under a name without "cloud"), and returns what Ollama
/// said about the model.
async fn prepare(
    http: &reqwest::Client,
    rt: &dyn LocalRuntime,
    base: &Loopback,
    req: &LocalChatRequest,
    model: &str,
    limit: Duration,
) -> Result<(ChatOptions, Option<ModelDetails>), AiError> {
    let asked = req
        .context_length
        .map(|c| c.clamp(MIN_CONTEXT, MAX_CONTEXT));
    let mut opts = ChatOptions {
        max_tokens: req
            .max_tokens
            .unwrap_or(DEFAULT_MAX_TOKENS)
            .clamp(1, MAX_TOKENS_CAP),
        context_length: asked.unwrap_or(DEFAULT_CONTEXT),
        think: None,
    };
    if rt.kind() != RuntimeKind::Ollama {
        return Ok((opts, None));
    }
    let d = details_of(http, rt, base, model, limit).await?;
    if d.remote {
        return Err(AiError::NotAllowed(REMOTE_MODEL.into()));
    }
    let own = d
        .context_length
        .map(|c| u32::try_from(c).unwrap_or(u32::MAX));
    opts.context_length = match (asked, own) {
        (Some(a), Some(o)) => a.min(o),
        (Some(a), None) => a,
        (None, Some(o)) => o.min(DEFAULT_CONTEXT),
        (None, None) => DEFAULT_CONTEXT,
    };
    opts.think = req.think.filter(|_| d.thinking == Cap::Yes);
    Ok((opts, Some(d)))
}

/// A question with a picture: the model must read pictures, by what its runtime says
/// ([`vision::allow`]). Ollama's details came with [`prepare`]; the others are asked now. A
/// runtime that cannot tell (any other OpenAI-compatible server: its model list says nothing
/// about pictures) is not asked, and a model missing from the runtime's list is not known either:
/// both are [`VISION_UNVERIFIED`], never a missing model.
async fn check_vision(
    http: &reqwest::Client,
    rt: &dyn LocalRuntime,
    base: &Loopback,
    model: &str,
    known: Option<&ModelDetails>,
    limit: Duration,
) -> Result<(), AiError> {
    let vision = match known {
        Some(d) => d.vision,
        None if rt.kind() == RuntimeKind::OpenAiCompatible => Cap::Unverified,
        None => match details_of(http, rt, base, model, limit).await {
            Ok(d) => d.vision,
            Err(AiError::Http(m)) if m == not_listed() => Cap::Unverified,
            Err(e) => return Err(e),
        },
    };
    vision::allow(vision)
}

/// The answer as it streams in.
struct Answer {
    format: StreamFormat,
    filter: ReasoningStream,
    bytes: usize,
    max: usize,
    pieces: u32,
    started: Instant,
    first_piece_ms: Option<u64>,
    model: Option<String>,
    /// `Some(truncated)` once the end mark arrived.
    done: Option<bool>,
}

impl Answer {
    fn line(
        &mut self,
        rt: &dyn LocalRuntime,
        line: &str,
        emit: &mut (dyn FnMut(LocalEvent) + Send),
    ) -> Result<(), AiError> {
        let data = match self.format {
            StreamFormat::Ndjson if line.trim().is_empty() => return Ok(()),
            StreamFormat::Ndjson => line,
            StreamFormat::Sse => match sse_line(line) {
                Sse::Data(d) => d,
                Sse::Done => {
                    self.done.get_or_insert(false);
                    return Ok(());
                }
                Sse::Error(e) => {
                    let msg = serde_json::from_str::<Value>(e)
                        .ok()
                        .and_then(|v| {
                            error_message(&v).or_else(|| v["message"].as_str().map(str::to_string))
                        })
                        .unwrap_or_else(|| e.to_string());
                    return Err(stream_error(&msg));
                }
                Sse::Ignore => return Ok(()),
            },
        };
        let piece = rt.parse_event(data)?;
        if self.model.is_none() {
            self.model = piece.model.as_deref().and_then(clean_id);
        }
        if let Some(text) = piece.text.filter(|t| !t.is_empty()) {
            self.bytes += text.len();
            if self.bytes > self.max {
                return Err(AiError::BadResponse(format!(
                    "{TOO_LARGE}: answer over {} bytes",
                    self.max
                )));
            }
            self.pieces += 1;
            if self.first_piece_ms.is_none() {
                self.first_piece_ms = Some(self.started.elapsed().as_millis() as u64);
            }
            if let Some(change) = self.filter.push(&text) {
                emit(change.into());
            }
        }
        if piece.done.is_some() {
            self.done = piece.done;
        }
        Ok(())
    }
}

/// A streamed answer before the empty-answer rule: final text and its numbers.
struct Streamed {
    text: String,
    removed: bool,
    model: Option<String>,
    first_piece_ms: Option<u64>,
    truncated: bool,
    pieces: u32,
    duration_ms: u64,
}

fn stalled(phase: &str, after: Duration) -> AiError {
    AiError::Timeout(format!("{STALLED}: {phase} {} ms", after.as_millis()))
}

/// Identifies the runtime, checks the model, sends the question and streams the answer.
async fn stream_answer(
    http: &reqwest::Client,
    rt: &dyn LocalRuntime,
    base: &Loopback,
    req: &LocalChatRequest,
    limits: Limits,
    emit: &mut (dyn FnMut(LocalEvent) + Send),
) -> Result<Streamed, AiError> {
    let started = Instant::now();
    let overall_end = started + limits.overall;
    let first_end = (started + limits.first_piece).min(overall_end);
    let model = clean_id(&req.model)
        .ok_or_else(|| AiError::Http(format!("{MODEL_MISSING}: invalid name")))?;
    // A name in Ollama's cloud form is refused for every kind, before any request: any of these
    // servers may be Ollama, or forward to it.
    if ollama::is_cloud_name(&model) {
        return Err(AiError::NotAllowed(REMOTE_MODEL.into()));
    }
    // Pictures are checked before any request too (format, size, count, asked for).
    let pictures = vision::check_request(req)?;
    identify(http, rt, base, limits.precheck).await?;
    let (opts, details) = prepare(http, rt, base, req, &model, limits.precheck).await?;
    if pictures > 0 {
        check_vision(http, rt, base, &model, details.as_ref(), limits.precheck).await?;
    }

    let sent = tokio::time::timeout_at(first_end, rt.chat_request(http, base, req, &opts).send());
    let mut resp = match sent.await {
        Err(_) => {
            return Err(stalled(
                "first-piece",
                limits.first_piece.min(limits.overall),
            ))
        }
        Ok(Err(e)) => return Err(net_error(&e)),
        Ok(Ok(r)) => r,
    };
    let status = resp.status().as_u16();
    if !(200..300).contains(&status) {
        let body = error_body(&mut resp, limits.gap.min(Duration::from_secs(5))).await;
        return Err(status_error(status, &body));
    }

    let mut lines = Lines::new(limits.max_line);
    let mut answer = Answer {
        format: rt.stream_format(),
        filter: ReasoningStream::new(),
        bytes: 0,
        max: limits.max_answer,
        pieces: 0,
        started,
        first_piece_ms: None,
        model: None,
        done: None,
    };
    let mut got_bytes = false;
    let mut last = Instant::now();
    while answer.done.is_none() {
        let until = if got_bytes {
            (last + limits.gap).min(overall_end)
        } else {
            first_end
        };
        let chunk = match tokio::time::timeout_at(until, resp.chunk()).await {
            Err(_) if Instant::now() >= overall_end => {
                return Err(stalled("overall", limits.overall))
            }
            Err(_) if got_bytes => return Err(stalled("gap", limits.gap)),
            Err(_) => return Err(stalled("first-piece", limits.first_piece)),
            Ok(Err(e)) => return Err(net_error(&e)),
            Ok(Ok(None)) => break,
            Ok(Ok(Some(c))) => c,
        };
        // Any bytes (reasoning, keep-alive comments) show the runtime is still working.
        got_bytes = true;
        last = Instant::now();
        for line in lines.push(&chunk)? {
            answer.line(rt, &line, emit)?;
            if answer.done.is_some() {
                break;
            }
        }
    }
    if answer.done.is_none() {
        if let Some(line) = lines.finish() {
            answer.line(rt, &line, emit)?;
        }
    }
    // A structured answer that is JSON is kept as sent, as for the cloud
    // (`reasoning::visible_structured`): a reasoning word inside a value is data.
    let structured = req.json_schema.is_some() && is_json(answer.filter.raw());
    let raw = structured.then(|| answer.filter.raw().to_string());
    let (all, change) = answer.filter.finish();
    if let Some(change) = change {
        emit(change.into());
    }
    let (text, removed) = match raw {
        Some(raw) => (raw, false),
        None => (all.text, all.removed),
    };
    Ok(Streamed {
        text,
        removed,
        model: answer.model,
        first_piece_ms: answer.first_piece_ms,
        // No end mark: the answer may be incomplete.
        truncated: answer.done.unwrap_or(true),
        pieces: answer.pieces,
        duration_ms: started.elapsed().as_millis() as u64,
    })
}

/// One question to a local runtime. Never counted, never retried, never sent to the cloud.
pub(crate) async fn run_chat(
    http: &reqwest::Client,
    rt: &dyn LocalRuntime,
    base: &Loopback,
    req: &LocalChatRequest,
    limits: Limits,
    emit: &mut (dyn FnMut(LocalEvent) + Send),
) -> Result<LocalChatResponse, AiError> {
    let s = stream_answer(http, rt, base, req, limits, emit).await?;
    if s.text.trim().is_empty() {
        return Err(AiError::BadResponse(if s.removed {
            "reasoningOnly".into()
        } else {
            format!(
                "empty answer ({})",
                if s.truncated { "length" } else { "stop" }
            )
        }));
    }
    Ok(LocalChatResponse {
        content: s.text,
        model: s.model.unwrap_or_else(|| req.model.trim().to_string()),
        runtime: rt.kind(),
        duration_ms: s.duration_ms,
        first_piece_ms: s.first_piece_ms,
        truncated: s.truncated,
        streamed: s.pieces > 1,
    })
}

/// [`run_chat`] registered in `AiState.inflight`, so `ai_cancel` stops it.
pub(crate) async fn chat_cancellable(
    state: &AiState,
    http: &reqwest::Client,
    req: &LocalChatRequest,
    limits: Limits,
    emit: &mut (dyn FnMut(LocalEvent) + Send),
) -> Result<LocalChatResponse, AiError> {
    let (_inflight, mut stop) = InflightGuard::register(state, &req.request_id)?;
    let base = parse_loopback(&req.base_url)?;
    if stop_requested(&mut stop) {
        return Err(AiError::Cancelled(req.request_id.clone()));
    }
    // A stop drops `run_chat`, and with it the HTTP response: the connection closes.
    tokio::select! {
        r = run_chat(http, runtime(req.kind), &base, req, limits, emit) => r,
        _ = &mut stop => Err(AiError::Cancelled(req.request_id.clone())),
    }
}

fn test_status(e: &AiError) -> LocalTestStatus {
    match tag_of(e) {
        UNREACHABLE => LocalTestStatus::Unreachable,
        NOT_RUNTIME => LocalTestStatus::NotRuntime,
        NEEDS_AUTH => LocalTestStatus::NeedsAuth,
        MODEL_MISSING => LocalTestStatus::ModelMissing,
        LOADING => LocalTestStatus::Loading,
        REMOTE_MODEL => LocalTestStatus::RemoteModel,
        STALLED => LocalTestStatus::Stalled,
        NOT_LOOPBACK | "ageGate" => LocalTestStatus::NotAllowed,
        _ => LocalTestStatus::Error,
    }
}

/// The error said the address is Ollama, chosen as another kind.
fn is_ollama_error(e: &AiError) -> bool {
    matches!(e, AiError::BadResponse(m) if *m == format!("{NOT_RUNTIME}: {IS_OLLAMA}"))
}

fn test_failed(e: &AiError) -> LocalTest {
    let status = test_status(e);
    LocalTest {
        status,
        first_piece_ms: None,
        streamed: false,
        detail: if status == LocalTestStatus::Error {
            detail(&e.to_string())
        } else if is_ollama_error(e) {
            IS_OLLAMA.into()
        } else {
            String::new()
        },
    }
}

/// A tiny streamed answer (at most 8 tokens). An answer that is only reasoning still proves the
/// model answers.
pub(crate) async fn test_model(
    http: &reqwest::Client,
    kind: RuntimeKind,
    base: &Loopback,
    model: &str,
    limits: Limits,
) -> LocalTest {
    let req = LocalChatRequest {
        request_id: "local-test".into(),
        kind,
        base_url: base.base(),
        model: model.to_string(),
        system: "Reply with the single word OK.".into(),
        messages: vec![LocalMessage::text("user", "OK?")],
        vision: false,
        json_schema: None,
        temperature: None,
        max_tokens: Some(8),
        context_length: None,
        think: Some(false),
        timeout_secs: None,
    };
    let mut ignore = |_: LocalEvent| {};
    match stream_answer(http, runtime(kind), base, &req, limits, &mut ignore).await {
        Ok(s) => LocalTest {
            status: LocalTestStatus::Ok,
            first_piece_ms: s.first_piece_ms,
            streamed: s.pieces > 1,
            detail: String::new(),
        },
        Err(e) => test_failed(&e),
    }
}

fn invalid_model() -> AiError {
    AiError::Http(format!("{MODEL_MISSING}: invalid name"))
}

/// "Tìm trên máy này": asks the three usual addresses which runtime answers. Only when the user
/// presses the button.
#[tauri::command]
pub async fn local_ai_detect(app: tauri::AppHandle) -> Result<Vec<RuntimeProbe>, AiError> {
    require_ai_allowed(&app)?;
    let http = loopback_client()?;
    Ok(detect(&http, PROBE_STEP).await)
}

/// Identifies the runtime at an address the user typed (loopback only).
#[tauri::command]
pub async fn local_ai_probe(
    app: tauri::AppHandle,
    base_url: String,
) -> Result<RuntimeProbe, AiError> {
    require_ai_allowed(&app)?;
    let base = parse_loopback(&base_url)?;
    let http = loopback_client()?;
    Ok(probe(&http, &base, PROBE_STEP).await)
}

#[tauri::command]
pub async fn local_ai_models(
    app: tauri::AppHandle,
    kind: RuntimeKind,
    base_url: String,
) -> Result<LocalModels, AiError> {
    require_ai_allowed(&app)?;
    let base = parse_loopback(&base_url)?;
    let http = loopback_client()?;
    list_models(&http, runtime(kind), &base, PRECHECK).await
}

#[tauri::command]
pub async fn local_ai_model_info(
    app: tauri::AppHandle,
    kind: RuntimeKind,
    base_url: String,
    model: String,
) -> Result<ModelDetails, AiError> {
    require_ai_allowed(&app)?;
    let base = parse_loopback(&base_url)?;
    let model = clean_id(&model).ok_or_else(invalid_model)?;
    let http = loopback_client()?;
    model_info(&http, runtime(kind), &base, &model, PRECHECK).await
}

/// "Kiểm tra trả lời". Never run automatically: it makes the runtime load the model.
#[tauri::command]
pub async fn local_ai_test(
    app: tauri::AppHandle,
    kind: RuntimeKind,
    base_url: String,
    model: String,
) -> LocalTest {
    if let Err(e) = require_ai_allowed(&app) {
        return test_failed(&e);
    }
    let base = match parse_loopback(&base_url) {
        Ok(b) => b,
        Err(e) => return test_failed(&e),
    };
    let http = match loopback_client() {
        Ok(h) => h,
        Err(e) => return test_failed(&e),
    };
    test_model(&http, kind, &base, &model, Limits::test()).await
}

/// A question to a local runtime; the answer streams through `on_event`. `ai_cancel` with the
/// request id stops it.
#[tauri::command]
pub async fn local_ai_chat(
    app: tauri::AppHandle,
    state: tauri::State<'_, AiState>,
    request: LocalChatRequest,
    on_event: tauri::ipc::Channel<LocalEvent>,
) -> Result<LocalChatResponse, AiError> {
    require_ai_allowed(&app)?;
    let http = loopback_client()?;
    let mut emit = move |e: LocalEvent| {
        // A closed page simply stops receiving; the answer is still returned.
        let _ = on_event.send(e);
    };
    let limits = Limits::chat(request.timeout_secs);
    chat_cancellable(state.inner(), &http, &request, limits, &mut emit).await
}

// Test modules stay at the end: the wiring tests read only the source above the first test
// attribute.
#[cfg(test)]
mod tests {
    use super::*;

    /// The non-test source of the local module.
    fn sources() -> Vec<(&'static str, &'static str)> {
        let strip = |s: &'static str| s.split("#[cfg(test)]").next().unwrap_or_default();
        vec![
            ("mod.rs", strip(include_str!("mod.rs"))),
            ("endpoint.rs", strip(include_str!("endpoint.rs"))),
            ("runtime.rs", strip(include_str!("runtime.rs"))),
            ("stream.rs", strip(include_str!("stream.rs"))),
            ("ollama.rs", strip(include_str!("ollama.rs"))),
            ("openai_compat.rs", strip(include_str!("openai_compat.rs"))),
            ("lmstudio.rs", strip(include_str!("lmstudio.rs"))),
            ("llamacpp.rs", strip(include_str!("llamacpp.rs"))),
            ("vision.rs", strip(include_str!("vision.rs"))),
        ]
    }

    #[test]
    fn local_calls_never_count_retry_use_keys_or_fall_back_to_the_cloud() {
        for (file, code) in sources() {
            for banned in [
                "count_call",
                "count_usage",
                "usage::",
                "send_with_fallback",
                // The cloud fallback rule and the cloud stream's fallback.
                "with_fallback",
                "stream::stream_with_fallback",
                "retry_delay",
                "api_key(",
                "keyring",
                "Provider::",
                "ai::client()",
                "super::client",
            ] {
                assert!(!code.contains(banned), "{file} uses {banned}");
            }
            assert!(
                !code.contains("Client::new"),
                "{file} builds its own client"
            );
        }
        // The only client is the loopback one (no proxy, no redirects).
        let builders: Vec<&str> = sources()
            .into_iter()
            .filter(|(_, code)| code.contains("Client::builder"))
            .map(|(file, _)| file)
            .collect();
        assert_eq!(builders, vec!["endpoint.rs"]);
        let endpoint = sources()[1].1;
        assert_eq!(endpoint.matches("Client::builder").count(), 1);
        let client_fn = endpoint
            .split("pub fn loopback_client()")
            .nth(1)
            .unwrap_or_default();
        assert!(client_fn.contains("Client::builder"));
        for (file, code) in sources() {
            assert_eq!(
                cloud_stream_uses(file, code),
                Vec::<String>::new(),
                "{file}"
            );
        }
    }

    /// The cloud stream module as `file` can name it. In `mod.rs`, `super::stream` is the cloud
    /// stream; in the adapters it is the local one, and the cloud one is reached as
    /// `super::super::stream` or `crate::ai::stream`.
    fn cloud_paths(file: &str) -> Vec<&'static str> {
        let mut cloud = vec!["crate::ai::stream", "super::super::stream"];
        if file == "mod.rs" {
            cloud.push("super::stream");
        }
        cloud
    }

    /// The code without `//` comments (a use statement never holds "//").
    fn without_comments(code: &str) -> String {
        code.lines()
            .map(|l| l.split("//").next().unwrap_or_default())
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// Splits `s` at the commas outside braces.
    fn split_top(s: &str) -> Vec<&str> {
        let (mut depth, mut from, mut out) = (0usize, 0, Vec::new());
        for (i, c) in s.char_indices() {
            match c {
                '{' => depth += 1,
                '}' => depth = depth.saturating_sub(1),
                ',' if depth == 0 => {
                    out.push(&s[from..i]);
                    from = i + 1;
                }
                _ => {}
            }
        }
        out.push(&s[from..]);
        out
    }

    /// The paths of one use tree, groups expanded ("a::{b, c::{d}}" gives a::b and a::c::d),
    /// aliases dropped and "x::self" read as "x".
    fn expand(prefix: &str, tree: &str, out: &mut Vec<String>) {
        let tree = tree.trim();
        if tree.is_empty() {
            return;
        }
        let join = |a: &str, b: &str| match (a.is_empty(), b.is_empty()) {
            (true, _) => b.to_string(),
            (_, true) => a.to_string(),
            _ => format!("{a}::{b}"),
        };
        if let (Some(open), Some(close)) = (tree.find('{'), tree.rfind('}')) {
            let head = tree[..open].trim().trim_end_matches("::");
            let base = join(prefix, head);
            for part in split_top(&tree[open + 1..close]) {
                expand(&base, part, out);
            }
            return;
        }
        let path: String = tree
            .split(" as ")
            .next()
            .unwrap_or(tree)
            .split_whitespace()
            .collect();
        let path = join(prefix, &path);
        out.push(path.strip_suffix("::self").unwrap_or(&path).to_string());
    }

    /// Every path the `use` statements of `code` name, whitespace removed and groups expanded.
    fn use_paths(code: &str) -> Vec<String> {
        let code = without_comments(code);
        let mut out = Vec::new();
        for (at, _) in code.match_indices("use ") {
            // Only the keyword: at a statement start ("pub use", "pub(crate) use" too).
            let before = code[..at].trim_end();
            let keyword = before.is_empty()
                || before.ends_with([';', '{', '}', ']', ')'])
                || before.ends_with(" pub")
                || before.ends_with("\npub")
                || before == "pub";
            if !keyword {
                continue;
            }
            let Some(end) = code[at..].find(';') else {
                continue;
            };
            let tree = code[at + 4..at + end]
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ");
            expand("", &tree, &mut out);
        }
        out
    }

    /// What `file` uses of the cloud stream module other than its event shape (`StreamEvent`):
    /// a path into it in the code, the module itself, its parent's glob, or any such path in a
    /// use statement, grouped imports included ("use super::{stream, …}").
    fn cloud_stream_uses(file: &str, code: &str) -> Vec<String> {
        let code = without_comments(code);
        let code = code.as_str();
        let mut found = Vec::new();
        for cloud in cloud_paths(file) {
            let event = format!("{cloud}::StreamEvent");
            // Paths written out in the code.
            let path = format!("{cloud}::");
            for (at, _) in code.match_indices(&path) {
                let rest = &code[at + path.len()..];
                if !rest.starts_with("StreamEvent") {
                    found.push(format!(
                        "{path}{}",
                        rest.chars().take(30).collect::<String>()
                    ));
                }
            }
            for (at, _) in code.match_indices(cloud) {
                if !code[at + cloud.len()..].starts_with("::") {
                    found.push(format!("{cloud} (the module itself)"));
                }
            }
            // Use statements, grouped or not.
            let parent = cloud.rsplit_once("::").map_or("", |(p, _)| p);
            for p in use_paths(code) {
                let into = p == cloud || p.starts_with(&format!("{cloud}::"));
                if (into && p != event) || p == parent || p == format!("{parent}::*") {
                    found.push(format!("use {p}"));
                }
            }
        }
        found
    }

    #[test]
    fn the_cloud_stream_check_reads_grouped_imports() {
        let caught = |file: &str, code: &str| !cloud_stream_uses(file, code).is_empty();
        for (file, code) in [
            ("mod.rs", "use super::{stream, AiError};"),
            (
                "mod.rs",
                "use super::{\n    reasoning::is_json,\n    stream::Timing,\n};",
            ),
            ("mod.rs", "use super::*;"),
            ("mod.rs", "use super::stream::{self, StreamEvent};"),
            ("ollama.rs", "use crate::ai::{stream::Timing};"),
            (
                "ollama.rs",
                "use crate::ai::{\n    stream::{StreamEvent, Timing},\n    AiError,\n};",
            ),
            ("ollama.rs", "use super::super::{stream};"),
            ("ollama.rs", "use crate::ai::*;"),
            ("ollama.rs", "use crate::ai;"),
            (
                "ollama.rs",
                "fn f() { crate::ai::stream::stream_with_fallback(); }",
            ),
        ] {
            assert!(caught(file, code), "{file}: {code}");
        }
        for (file, code) in [
            (
                "mod.rs",
                "pub use super::stream::StreamEvent as LocalEvent;",
            ),
            ("mod.rs", "use super::{stream::StreamEvent, AiError};"),
            ("mod.rs", "use stream::{sse_line, Lines};"),
            ("ollama.rs", "use super::stream::{sse_line, Lines};"),
            ("ollama.rs", "use crate::ai::{reasoning::js_trim, AiError};"),
            // Words in comments are no imports.
            (
                "ollama.rs",
                "// We use crate::ai::stream rules here.\nfn f() {}",
            ),
        ] {
            assert!(!caught(file, code), "{file}: {code}");
        }
    }

    #[test]
    fn every_local_command_checks_the_gate_before_anything_else() {
        let code = sources()[0].1;
        let commands: Vec<&str> = code.split("#[tauri::command]").skip(1).collect();
        assert_eq!(commands.len(), 6);
        for c in commands {
            let name = c
                .split("pub async fn ")
                .nth(1)
                .and_then(|s| s.split('(').next())
                .unwrap_or_default();
            assert!(name.starts_with("local_ai_"), "{name}");
            let body = c.split_once('{').map(|(_, b)| b).unwrap_or_default();
            let gate = body.find("require_ai_allowed(&app)").unwrap_or(usize::MAX);
            for later in ["parse_loopback(", "loopback_client()", "chat_cancellable("] {
                if let Some(at) = body.find(later) {
                    assert!(gate < at, "{name}: {later} before the gate");
                }
            }
            assert!(gate < usize::MAX, "{name} has no gate");
        }
        let lib = include_str!("../../lib.rs");
        for cmd in [
            "ai::local::local_ai_detect",
            "ai::local::local_ai_probe",
            "ai::local::local_ai_models",
            "ai::local::local_ai_model_info",
            "ai::local::local_ai_test",
            "ai::local::local_ai_chat",
        ] {
            assert!(lib.contains(cmd), "{cmd} is not registered");
        }
    }

    #[test]
    fn errors_carry_tags_the_page_can_map() {
        assert_eq!(
            tag_of(&status_error(404, r#"{"error":"model 'x' not found"}"#)),
            MODEL_MISSING
        );
        assert_eq!(tag_of(&status_error(503, "Loading model")), LOADING);
        assert_eq!(tag_of(&status_error(401, "secret")), NEEDS_AUTH);
        assert!(!status_error(401, "secret").to_string().contains("secret"));
        assert_eq!(tag_of(&status_error(307, "")), FAILED);
        assert_eq!(
            tag_of(&status_error(
                400,
                r#"{"error":{"message":"model \"x\" not found"}}"#
            )),
            MODEL_MISSING
        );
        assert_eq!(tag_of(&status_error(500, "boom")), FAILED);
        assert_eq!(tag_of(&stream_error("Loading model")), LOADING);
        // The AiError code stays one of the existing ones (the page already knows them).
        let v = serde_json::to_value(status_error(503, "")).unwrap();
        assert_eq!(v["code"], "http");
        assert!(v["message"].as_str().unwrap().starts_with("loading: 503"));
        assert_eq!(
            test_status(&AiError::NotAllowed(REMOTE_MODEL.into())),
            LocalTestStatus::RemoteModel
        );
        assert_eq!(
            test_status(&AiError::NotAllowed("ageGate".into())),
            LocalTestStatus::NotAllowed
        );
        assert_eq!(
            test_status(&AiError::Timeout(format!("{STALLED}: gap 45000 ms"))),
            LocalTestStatus::Stalled
        );
        // Picture refusals carry their own tags.
        for tag in [NO_VISION, VISION_UNVERIFIED, BAD_IMAGE] {
            assert_eq!(tag_of(&AiError::NotAllowed(format!("{tag}: x"))), tag);
        }
    }

    #[test]
    fn events_and_results_use_the_page_names() {
        assert_eq!(
            serde_json::to_value(LocalEvent::Delta("Lực".into())).unwrap(),
            serde_json::json!({"kind": "delta", "text": "Lực"})
        );
        assert_eq!(
            serde_json::to_value(LocalEvent::Reset("".into())).unwrap()["kind"],
            "reset"
        );
        let r: LocalChatRequest = serde_json::from_value(serde_json::json!({
            "requestId": "x", "kind": "lmStudio", "baseUrl": "http://127.0.0.1:1234",
            "model": "m", "system": "s", "messages": [{"role": "user", "content": "hỏi"}],
            "contextLength": 4096
        }))
        .unwrap();
        assert_eq!(r.kind, RuntimeKind::LmStudio);
        assert_eq!(r.context_length, Some(4096));
        // Pictures and `vision` are optional.
        assert!(!r.vision && r.messages[0].images.is_empty());
        let r: LocalChatRequest = serde_json::from_value(serde_json::json!({
            "requestId": "x", "kind": "ollama", "baseUrl": "http://127.0.0.1:11434",
            "model": "m", "system": "s", "vision": true,
            "messages": [{"role": "user", "content": "hỏi", "images": ["iVBORw0KGgo="]}]
        }))
        .unwrap();
        assert!(r.vision);
        assert_eq!(r.messages[0].images, vec!["iVBORw0KGgo=".to_string()]);
        assert_eq!(
            serde_json::to_value(ProbeStatus::NeedsAuth).unwrap(),
            "needsAuth"
        );
        assert_eq!(
            serde_json::to_value(LocalTestStatus::ModelMissing).unwrap(),
            "modelMissing"
        );
    }

    #[test]
    fn limits_follow_the_gemma_stall_watch() {
        let l = Limits::chat(None);
        assert_eq!(l.first_piece, Duration::from_secs(120));
        assert_eq!(l.gap, Duration::from_secs(45));
        assert_eq!(l.overall, Duration::from_secs(600));
        assert_eq!(Limits::chat(Some(9999)).overall, Duration::from_secs(600));
        assert_eq!(Limits::chat(Some(1)).overall, Duration::from_secs(5));
    }
}

#[cfg(test)]
mod server_tests;
