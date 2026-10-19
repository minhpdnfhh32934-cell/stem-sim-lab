//! Real streaming of cloud answers (`ai_chat_stream`): Gemini `streamGenerateContent?alt=sse`,
//! Claude and Groq with `"stream": true`. All three answer with server-sent events.
//!
//! - [`SseReader`] frames the events over raw bytes: a line ends in "\n" or "\r\n", an event ends
//!   at a blank line, and an event's bytes are decoded only once the event is complete, so a
//!   Vietnamese character cut between two network chunks stays whole. (A lone "\r" as line end,
//!   allowed by the SSE format but used by none of the three providers, is not supported.)
//! - Each provider reads its own events ([`AIProvider::on_sse`]) into a [`StreamState`]; an error
//!   reported inside the stream becomes the HTTP error it stands for ([`provider_error`]).
//! - The text goes through [`ReasoningStream`], the rule of [`super::reasoning`]: reasoning is
//!   never sent to the page, also when a tag is cut between chunks, and the final text is exactly
//!   `strip_reasoning` of everything received.
//! - Retries (429/5xx, at most [`super::MAX_RETRIES`]) and the quota fallback happen only before
//!   the first [`StreamEvent`] reaches the page, so the text of two attempts or two providers
//!   never mixes. Whitespace before the first visible text is held back (it is not "shown"), so a
//!   model that starts with a newline can still be retried. An error after that ends the call with
//!   that error; the page keeps what it was shown and decides what to do with it. A stop by the
//!   provider's own filter (Claude `refusal`, Gemini `SAFETY` and the like, Groq
//!   `content_filter`) is such an error, also after text was shown: as without streaming, it is
//!   no answer. A provider error after the provider's end mark (its stop reason) ends the stream
//!   and keeps the answer, which was complete.
//! - Finish reasons: any reason but the natural end marks the answer as possibly incomplete, as
//!   for a whole answer (each provider's `truncated`).
//! - Timers: the first answer text (reasoning included: the model is answering) must arrive
//!   within the call's `timeoutSecs` from the start, retries and fallback included (a retry wait
//!   that would pass that deadline gives the provider's error at once, and the fallback is only
//!   asked while enough of that wait is left for it to answer, [`FALLBACK_ROOM`]); then
//!   at most [`IDLE_GAP`] may pass between two chunks, and
//!   [`OVERALL_MAX`] in all. Once the provider said it finished, its closing mark is awaited for
//!   at most [`END_GRACE`]; a silent or broken connection after that point keeps the answer.
//!
//! No new crate: reqwest's `Response::chunk()` reads the body. The event formats follow the
//! providers' documentation; no live call was recorded (the fixtures are hand-written).

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use serde_json::Value;
use tokio::time::Instant;

use super::provider::AIProvider;
use super::reasoning::{ReasoningStream, Shown};
use super::{
    http_status, is_quota_error, provider, retry_delay, with_fallback, AiError, AiState,
    ChatRequest, ChatResponse, Provider, DEFAULT_TIMEOUT_SECS,
};

/// Longest silence between two chunks once the answer has started (as the Gemma stall watch).
pub const IDLE_GAP: Duration = Duration::from_secs(45);
/// Longest streamed answer, in all.
pub const OVERALL_MAX: Duration = Duration::from_secs(600);
/// Longest wait for the closing mark (or the end of the connection) once the provider said its
/// answer is finished: nothing more of the answer can come.
pub const END_GRACE: Duration = Duration::from_secs(2);
/// The fallback is asked only while this much of the first-text wait is left (or a quarter of
/// that wait, when it is shorter): less would only end in its own timeout.
pub const FALLBACK_ROOM: Duration = Duration::from_secs(5);
/// Largest single event.
pub const MAX_EVENT_BYTES: usize = 1 << 20;
/// Largest answer text (reasoning included).
pub const MAX_ANSWER_BYTES: usize = 1 << 20;
/// How much of an error answer is read.
const ERROR_BODY_CAP: usize = 64 * 1024;

/// A change to the answer shown while it streams (cloud providers and local runtimes alike).
///
/// Provisional: when a chat template pre-fills the opening reasoning tag, the model's reasoning
/// arrives first with nothing to mark it, so it is sent as `delta`s and only taken back by a
/// `reset` when its closing tag comes (rule 3 of [`super::reasoning`]). The page may show deltas,
/// but speech, board actions and anything that cannot be taken back wait for the final text the
/// command returns.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", content = "text", rename_all = "camelCase")]
pub enum StreamEvent {
    /// Add this text at the end.
    Delta(String),
    /// Replace everything shown so far (reasoning was recognised late).
    Reset(String),
}

impl From<Shown> for StreamEvent {
    fn from(s: Shown) -> StreamEvent {
        match s {
            Shown::Append(t) => StreamEvent::Delta(t),
            Shown::Replace(t) => StreamEvent::Reset(t),
        }
    }
}

/// One server-sent event.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SseEvent {
    /// The `event:` field ("message" when there is none).
    pub event: String,
    /// The `data:` lines, joined with "\n".
    pub data: String,
}

/// The fields of the event being read, still as bytes.
#[derive(Debug, Default)]
struct Pending {
    event: Vec<u8>,
    data: Vec<u8>,
    has_data: bool,
}

impl Pending {
    fn size(&self) -> usize {
        self.event.len() + self.data.len()
    }

    /// The event is complete: decoded now, and the fields start again. An event without a
    /// `data:` line is not an event (the SSE format).
    fn dispatch(&mut self) -> Option<SseEvent> {
        let p = std::mem::take(self);
        p.has_data.then(|| SseEvent {
            event: if p.event.is_empty() {
                "message".into()
            } else {
                String::from_utf8_lossy(&p.event).into_owned()
            },
            data: String::from_utf8_lossy(&p.data).into_owned(),
        })
    }

    /// Reads one complete line (without its line end).
    fn line(&mut self, line: &[u8]) -> Option<SseEvent> {
        if line.is_empty() {
            return self.dispatch();
        }
        if line[0] == b':' {
            // A comment (keep-alive).
            return None;
        }
        let (name, value) = match line.iter().position(|&b| b == b':') {
            Some(i) => {
                let v = &line[i + 1..];
                (&line[..i], v.strip_prefix(b" ").unwrap_or(v))
            }
            None => (line, &b""[..]),
        };
        match name {
            b"data" => {
                if self.has_data {
                    self.data.push(b'\n');
                }
                self.data.extend_from_slice(value);
                self.has_data = true;
            }
            b"event" => self.event = value.to_vec(),
            // `id`, `retry` and unknown fields.
            _ => {}
        }
        None
    }
}

/// Bytes in, complete server-sent events out, whatever the network chunks look like.
#[derive(Debug)]
pub struct SseReader {
    buf: Vec<u8>,
    /// `buf[..scanned]` holds no line end (so a long line in small chunks is scanned once).
    scanned: usize,
    pending: Pending,
    max_event: usize,
}

impl SseReader {
    pub fn new(max_event: usize) -> SseReader {
        SseReader {
            buf: Vec::new(),
            scanned: 0,
            pending: Pending::default(),
            max_event,
        }
    }

    fn too_large(&self) -> AiError {
        AiError::BadResponse(format!("event over {} bytes", self.max_event))
    }

    /// Adds a network chunk; returns the events it completed, in order.
    pub fn push(&mut self, chunk: &[u8]) -> Result<Vec<SseEvent>, AiError> {
        self.buf.extend_from_slice(chunk);
        let mut events = Vec::new();
        let mut start = 0;
        let mut from = self.scanned;
        while let Some(k) = self.buf[from..].iter().position(|&b| b == b'\n') {
            let end = from + k;
            let line = &self.buf[start..end];
            let line = line.strip_suffix(b"\r").unwrap_or(line);
            events.extend(self.pending.line(line));
            if self.pending.size() > self.max_event {
                return Err(self.too_large());
            }
            start = end + 1;
            from = start;
        }
        self.buf.drain(..start);
        self.scanned = self.buf.len();
        if self.buf.len() + self.pending.size() > self.max_event {
            return Err(self.too_large());
        }
        Ok(events)
    }

    /// The stream ended. An event whose lines all arrived is still read (a server may leave out
    /// the last blank line); a line cut off by the end of the stream is dropped, so the answer
    /// then misses its end mark and is reported as incomplete.
    pub fn finish(&mut self) -> Option<SseEvent> {
        self.buf.clear();
        self.scanned = 0;
        self.pending.dispatch()
    }
}

/// What a provider has read from its stream so far.
#[derive(Debug, Default)]
pub struct StreamState {
    /// Answer text read since the driver last took it (reasoning included: the driver filters it).
    pub delta: String,
    /// Model that answers, if the stream says so.
    pub model: Option<String>,
    /// Why the provider stopped, once it said so (Gemini `finishReason`, Claude `stop_reason`,
    /// Groq `finish_reason`).
    pub finish: Option<String>,
    /// The answer may be incomplete: the provider stopped for another reason than the natural end
    /// of its answer (the output-token limit, a context limit, an unknown reason).
    pub truncated: bool,
    /// The provider marked the end of its answer.
    pub ended: bool,
    /// Nothing more will come (Claude `message_stop`, Groq `[DONE]`): reading stops.
    pub closed: bool,
}

impl StreamState {
    /// The provider said why it stopped; `natural` are its reasons for the natural end of an
    /// answer. Any other reason marks the answer as possibly incomplete, as the provider's
    /// `truncated` does for a whole answer (`ai_chat` and `ai_chat_stream` agree). A stop by the
    /// provider's own filter never comes here: it is an error.
    pub fn finished(&mut self, reason: &str, natural: &[&str]) {
        self.finish = Some(reason.to_string());
        self.ended = true;
        self.truncated |= !natural.contains(&reason);
    }
}

/// The JSON of an event.
pub fn event_json(ev: &SseEvent) -> Result<Value, AiError> {
    serde_json::from_str(&ev.data).map_err(|e| AiError::BadResponse(format!("stream event: {e}")))
}

/// The HTTP status an error type stands for (Claude error types, Google RPC statuses,
/// OpenAI-style codes).
fn status_of(kind: &str) -> Option<u16> {
    Some(match kind {
        "invalid_request_error" | "INVALID_ARGUMENT" | "FAILED_PRECONDITION" => 400,
        "authentication_error" | "UNAUTHENTICATED" | "invalid_api_key" => 401,
        "billing_error" => 402,
        "permission_error" | "PERMISSION_DENIED" => 403,
        "not_found_error" | "NOT_FOUND" | "model_not_found" => 404,
        "request_too_large" => 413,
        "rate_limit_error"
        | "rate_limit_exceeded"
        | "insufficient_quota"
        | "RESOURCE_EXHAUSTED" => 429,
        "api_error" | "server_error" | "internal_server_error" | "INTERNAL" => 500,
        "service_unavailable" | "UNAVAILABLE" => 503,
        "DEADLINE_EXCEEDED" => 504,
        "overloaded_error" => 529,
        _ => return None,
    })
}

/// Most quota names kept from an error's details, and the longest one.
const MAX_QUOTA_IDS: usize = 4;
const MAX_QUOTA_ID_CHARS: usize = 100;

/// The `quotaId`s anywhere in an error's `details` (Gemini names the quota that ran out only
/// there, in `details[].violations[].quotaId`), cleaned and bounded.
fn quota_ids(v: &Value, out: &mut Vec<String>, depth: u8) {
    if depth > 8 || out.len() >= MAX_QUOTA_IDS {
        return;
    }
    match v {
        Value::Array(items) => items.iter().for_each(|i| quota_ids(i, out, depth + 1)),
        Value::Object(fields) => {
            for (name, value) in fields {
                match (name.as_str(), value.as_str()) {
                    ("quotaId", Some(id)) if out.len() < MAX_QUOTA_IDS => out.push(
                        id.chars()
                            .filter(|c| !c.is_control())
                            .take(MAX_QUOTA_ID_CHARS)
                            .collect(),
                    ),
                    _ => quota_ids(value, out, depth + 1),
                }
            }
        }
        _ => {}
    }
}

/// An error the provider reported inside the stream (Claude's `error` event, an `error` object in
/// a Gemini or Groq event), as the HTTP error it stands for: `"<status>: <type>: <message>"`, so
/// the quota rule ([`is_quota_error`]) and the retry rule read it like an HTTP answer. The status
/// is Gemini's numeric `code`, or comes from the error type; an unknown type counts as 500 (the
/// answer had started, so the failure is on the server's side). The quota names in the details
/// are added as `" (quota: …)"`: an HTTP error body holds them too, and the retry rule needs them
/// (a "…PerDay…" quota is not retried).
pub fn provider_error(err: &Value) -> AiError {
    let names: Vec<&str> = ["type", "status", "code"]
        .iter()
        .filter_map(|k| err[*k].as_str())
        .collect();
    let known = names.iter().find_map(|n| status_of(n).map(|s| (*n, s)));
    let status = err["code"]
        .as_u64()
        .and_then(|c| u16::try_from(c).ok())
        .filter(|c| (400..600).contains(c))
        .or(known.map(|(_, s)| s))
        .unwrap_or(500);
    let kind = known
        .map(|(n, _)| n)
        .or_else(|| names.first().copied())
        .unwrap_or("error");
    let mut message: String = err["message"]
        .as_str()
        .unwrap_or_default()
        .chars()
        .filter(|c| !c.is_control())
        .take(400)
        .collect();
    let mut quotas = Vec::new();
    quota_ids(&err["details"], &mut quotas, 0);
    if !quotas.is_empty() {
        message = format!("{message} (quota: {})", quotas.join(", "));
    }
    AiError::Http(format!("{status}: {kind}: {message}"))
}

/// Time limits of one streamed call (tests use short ones).
#[derive(Debug, Clone, Copy)]
pub struct Timing {
    /// Until the first answer text, from the start of the call (retries and fallback included).
    pub first_delta: Duration,
    /// Between two chunks once the answer has started.
    pub gap: Duration,
    /// The whole call.
    pub overall: Duration,
}

impl Timing {
    /// `timeout_secs` is the page's timeout of a call (default 30 s, 5–600 s), here the wait for
    /// the first text.
    pub fn chat(timeout_secs: Option<u64>) -> Timing {
        Timing {
            first_delta: Duration::from_secs(
                timeout_secs.unwrap_or(DEFAULT_TIMEOUT_SECS).clamp(5, 600),
            ),
            gap: IDLE_GAP,
            overall: OVERALL_MAX,
        }
    }

    fn start(self) -> Clock {
        let now = Instant::now();
        let end = now + self.overall;
        Clock {
            first: (now + self.first_delta).min(end),
            end,
            timing: self,
        }
    }
}

/// The deadlines of one call.
#[derive(Debug, Clone, Copy)]
struct Clock {
    first: Instant,
    end: Instant,
    timing: Timing,
}

impl Clock {
    /// Enough of the first-text wait is left for the fallback to answer: at least
    /// [`FALLBACK_ROOM`], or a quarter of the wait when that is less.
    fn room_for_fallback(&self) -> bool {
        let need = FALLBACK_ROOM.min(self.timing.first_delta / 4);
        self.first.saturating_duration_since(Instant::now()) >= need
    }

    /// The error for a timer that ran out (`text`: answer text had arrived).
    fn expired(&self, text: bool) -> AiError {
        let t = self.timing;
        let (phase, limit) = if !text {
            ("first-delta", t.first_delta.min(t.overall))
        } else if Instant::now() >= self.end {
            ("overall", t.overall)
        } else {
            ("gap", t.gap)
        };
        AiError::Timeout(format!("{phase}: {limit:?}"))
    }
}

/// Sends events to the page and remembers whether anything was sent. Until the first visible
/// text, whitespace is held back: an answer that starts with a newline has shown nothing yet, so
/// it may still be retried or replaced by the fallback.
pub(crate) struct Emitter<'a> {
    sink: &'a (dyn Fn(StreamEvent) + Send + Sync),
    sent: AtomicBool,
    /// What the page would show now, while it is only whitespace (nothing sent yet).
    held: Mutex<String>,
}

impl<'a> Emitter<'a> {
    pub(crate) fn new(sink: &'a (dyn Fn(StreamEvent) + Send + Sync)) -> Emitter<'a> {
        Emitter {
            sink,
            sent: AtomicBool::new(false),
            held: Mutex::new(String::new()),
        }
    }

    fn send(&self, e: StreamEvent) {
        if self.sent() {
            (self.sink)(e);
            return;
        }
        let mut held = self.held.lock().unwrap_or_else(|p| p.into_inner());
        match e {
            StreamEvent::Delta(t) => held.push_str(&t),
            StreamEvent::Reset(t) => *held = t,
        }
        if held.trim().is_empty() {
            return;
        }
        // Nothing was shown before: the whole text so far is one delta.
        self.sent.store(true, Ordering::SeqCst);
        (self.sink)(StreamEvent::Delta(std::mem::take(&mut *held)));
    }

    /// A new attempt (a retry or the fallback) starts: whitespace held from the last one goes.
    fn restart(&self) {
        if !self.sent() {
            self.held.lock().unwrap_or_else(|p| p.into_inner()).clear();
        }
    }

    /// Something reached the page: no new attempt and no fallback any more.
    pub(crate) fn sent(&self) -> bool {
        self.sent.load(Ordering::SeqCst)
    }
}

/// Why an attempt failed, and how long to wait before the next one (`None`: no new attempt).
struct Failed {
    error: AiError,
    retry: Option<Duration>,
}

impl From<AiError> for Failed {
    fn from(error: AiError) -> Failed {
        Failed { error, retry: None }
    }
}

/// One provider's streamed call.
struct Call<'a> {
    http: &'a reqwest::Client,
    base: &'a str,
    p: &'a dyn AIProvider,
    key: &'a str,
    req: &'a ChatRequest,
    clock: Clock,
    emit: &'a Emitter<'a>,
}

/// The answer of one attempt as it streams in.
struct Answer<'a> {
    p: &'a dyn AIProvider,
    emit: &'a Emitter<'a>,
    tries: u32,
    reader: SseReader,
    st: StreamState,
    filter: ReasoningStream,
    bytes: usize,
    /// Answer text arrived (the first-delta timer is satisfied).
    got_text: bool,
}

impl Answer<'_> {
    fn event(&mut self, ev: &SseEvent) -> Result<(), Failed> {
        if let Err(error) = self.p.on_sse(ev, &mut self.st) {
            // The provider already said why it stopped: the answer is complete, and an error the
            // provider reports now (instead of its closing mark) ends the stream. A stop by its
            // filter (`empty answer (…)`) is still no answer.
            if self.st.ended && matches!(error, AiError::Http(_)) {
                self.st.closed = true;
                return Ok(());
            }
            // An error inside the stream may be retried like the HTTP error it stands for (only
            // while nothing was shown, see `stream_provider`).
            let retry = match &error {
                AiError::Http(m) => retry_delay(http_status(m), None, m, self.tries),
                _ => None,
            };
            return Err(Failed { error, retry });
        }
        let text = std::mem::take(&mut self.st.delta);
        if text.is_empty() {
            return Ok(());
        }
        self.got_text = true;
        self.bytes += text.len();
        if self.bytes > MAX_ANSWER_BYTES {
            return Err(
                AiError::BadResponse(format!("answer over {MAX_ANSWER_BYTES} bytes")).into(),
            );
        }
        if let Some(change) = self.filter.push(&text) {
            self.emit.send(change.into());
        }
        Ok(())
    }

    /// The end of the stream: the final text (reasoning removed) or why there is none.
    fn finish(mut self, req: &ChatRequest, started: Instant) -> Result<ChatResponse, Failed> {
        let (all, change) = self.filter.finish();
        if let Some(change) = change {
            self.emit.send(change.into());
        }
        if all.text.trim().is_empty() {
            return Err(AiError::BadResponse(if all.removed {
                "reasoningOnly".into()
            } else {
                format!(
                    "empty answer ({})",
                    self.st.finish.as_deref().unwrap_or("no text")
                )
            })
            .into());
        }
        Ok(ChatResponse {
            content: all.text,
            model: self.st.model.take().unwrap_or_else(|| req.model.clone()),
            duration_ms: started.elapsed().as_millis() as u64,
            retries: self.tries,
            provider: req.provider,
            fallback: false,
            // No end mark: the answer may be incomplete.
            truncated: self.st.truncated || !self.st.ended,
        })
    }
}

/// The start of an error answer, best effort.
async fn error_body(resp: &mut reqwest::Response, until: Instant) -> String {
    let mut buf = Vec::new();
    let _ = tokio::time::timeout_at(until, async {
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

/// One attempt: sends the request and streams the answer to the page.
async fn attempt(c: &Call<'_>, started: Instant, tries: u32) -> Result<ChatResponse, Failed> {
    let clock = c.clock;
    c.emit.restart();
    let sent = c.p.stream_request(c.http, c.base, c.key, c.req).send();
    let mut resp = match tokio::time::timeout_at(clock.first, sent).await {
        Err(_) => return Err(clock.expired(false).into()),
        Ok(Err(e)) => return Err(AiError::Network(e.to_string()).into()),
        Ok(Ok(r)) => r,
    };
    let status = resp.status();
    if !status.is_success() {
        let retry_after = resp
            .headers()
            .get("retry-after")
            .and_then(|v| v.to_str().ok())
            .map(str::to_string);
        let body = error_body(&mut resp, clock.first).await;
        let snippet: String = body.chars().take(400).collect();
        return Err(Failed {
            retry: retry_delay(status.as_u16(), retry_after.as_deref(), &body, tries),
            error: AiError::Http(format!("{status}: {snippet}")),
        });
    }
    let mut answer = Answer {
        p: c.p,
        emit: c.emit,
        tries,
        reader: SseReader::new(MAX_EVENT_BYTES),
        st: StreamState::default(),
        filter: ReasoningStream::new(),
        bytes: 0,
        got_text: false,
    };
    let mut last = Instant::now();
    'read: while !answer.st.closed {
        let until = if answer.st.ended {
            // The provider said it finished: only its closing mark may still come.
            (last + clock.timing.gap.min(END_GRACE)).min(clock.end)
        } else if answer.got_text {
            (last + clock.timing.gap).min(clock.end)
        } else {
            clock.first
        };
        let chunk = match tokio::time::timeout_at(until, resp.chunk()).await {
            // After the end mark, a silent or broken connection loses nothing of the answer.
            Err(_) | Ok(Err(_)) if answer.st.ended => break,
            Err(_) => return Err(clock.expired(answer.got_text).into()),
            Ok(Err(e)) => return Err(AiError::Network(e.to_string()).into()),
            Ok(Ok(None)) => break,
            Ok(Ok(Some(chunk))) => chunk,
        };
        // Any bytes (keep-alive pings too) show the provider is still sending.
        last = Instant::now();
        for ev in answer.reader.push(&chunk)? {
            answer.event(&ev)?;
            if answer.st.closed {
                break 'read;
            }
        }
    }
    if !answer.st.closed {
        if let Some(ev) = answer.reader.finish() {
            answer.event(&ev)?;
        }
    }
    answer.finish(c.req, started)
}

/// One provider: retries a 429/5xx (as `send` does) only while nothing reached the page. The wait
/// counts towards the first-delta timer: a wait that cannot end before it gives the error itself
/// (a quota error may then still go to the fallback) instead of waiting for a timeout.
async fn stream_provider(c: Call<'_>) -> Result<ChatResponse, AiError> {
    let started = Instant::now();
    let mut tries = 0;
    loop {
        match attempt(&c, started, tries).await {
            Ok(r) => return Ok(r),
            Err(Failed {
                retry: Some(wait),
                error,
            }) if !c.emit.sent() => {
                if Instant::now() + wait >= c.clock.first {
                    return Err(error);
                }
                tokio::time::sleep(wait).await;
                tries += 1;
            }
            Err(f) => return Err(f.error),
        }
    }
}

/// Structured (JSON schema) answers are not streamed: they keep using `ai_chat`, where the whole
/// answer is checked at once.
pub fn streamable(req: &ChatRequest) -> Result<(), AiError> {
    if req.json_schema.is_some() {
        return Err(AiError::Unavailable("jsonSchema".into()));
    }
    Ok(())
}

/// A streamed answer with the fallback rule of `ai_chat` ([`with_fallback`]), except that the
/// fallback only answers while nothing reached the page. `base_of` gives each provider's API
/// address (its `base_url()` in the app, a mock server in tests); `sink` receives the events.
pub(crate) async fn stream_with_fallback<K, B>(
    state: &AiState,
    http: &reqwest::Client,
    req: &ChatRequest,
    key_of: K,
    base_of: B,
    timing: Timing,
    sink: &(dyn Fn(StreamEvent) + Send + Sync),
) -> Result<ChatResponse, AiError>
where
    K: Fn(Provider) -> Result<String, AiError>,
    B: Fn(Provider) -> String,
{
    streamable(req)?;
    let emit = Emitter::new(sink);
    let clock = timing.start();
    let send = |r: ChatRequest, key: String| {
        let base = base_of(r.provider);
        let emit = &emit;
        async move {
            stream_provider(Call {
                http,
                base: &base,
                p: provider(r.provider),
                key: &key,
                req: &r,
                clock,
                emit,
            })
            .await
        }
    };
    // The fallback shares the first-text deadline: when little of it is left (the first provider
    // reasoned quietly, then ran out of quota), the fallback could only time out, so the
    // provider's own error is returned and nothing is marked out of quota.
    with_fallback(state, req, key_of, send, |e| {
        is_quota_error(e) && !emit.sent() && clock.room_for_fallback()
    })
    .await
}

#[cfg(test)]
mod tests;

#[cfg(test)]
mod server_tests;
