/**
 * Reading a streamed cloud answer in the page (the browser transport: development and the
 * end-to-end tests). The web-side twin of src-tauri/src/ai/stream.rs and the providers' `on_sse`:
 * Gemini `streamGenerateContent?alt=sse`, Claude and Groq with `"stream": true`. The desktop app
 * never uses this: Rust streams there (`ai_chat_stream`) and the page only receives the events.
 *
 * - Events are framed by `SseReader` (bytes, so a character cut between chunks stays whole).
 * - Text goes through `ThinkFilter`: reasoning never reaches the page, and the final text is the
 *   reasoning rule applied to everything received.
 * - A stop by the provider's own filter (Gemini SAFETY and the like, Claude `refusal`, Groq
 *   `content_filter`) is no answer, also after text was shown: "empty answer (<reason>)".
 * - An error inside the stream becomes the HTTP error it stands for ("529: overloaded_error: …"),
 *   so the quota rule reads it like an HTTP answer.
 * - Timers: the first answer text within the call's `timeoutSecs` (5–600 s, default 30), then at
 *   most 45 s between chunks and 600 s in all; once the provider said it finished, its closing
 *   mark is awaited for at most 2 s and a silent or broken connection after that keeps the answer.
 */
import { readChunk, SseReader, utf8Length, type SseEvent } from './sse';
import { ThinkFilter } from './thinkFilter';
import { AiError, applyStreamEvent, type Provider } from './types';

/** Longest silence between two chunks once the answer has started (as Rust's IDLE_GAP). */
export const IDLE_GAP_MS = 45_000;
/** Longest streamed answer, in all. */
export const OVERALL_MAX_MS = 600_000;
/** Longest wait for the closing mark once the provider said its answer is finished. */
export const END_GRACE_MS = 2_000;
/** Largest answer text (reasoning included), as Rust. */
export const MAX_ANSWER_BYTES = 1 << 20;
/** Default wait for the first text (seconds), as the gateway's DEFAULT_TIMEOUT_SECS. */
const DEFAULT_TIMEOUT_SECS = 30;

/** The deadlines of one streamed call (`performance.now()` times). */
export interface StreamClock {
  first: number;
  end: number;
  firstMs: number;
  gapMs: number;
  overallMs: number;
}

/** Starts the clock of a call: `timeoutSecs` is the wait for the first text (clamped 5–600). */
export function startClock(
  timeoutSecs: number | undefined,
  limits: { gapMs?: number; overallMs?: number } = {},
): StreamClock {
  const secs = Math.min(600, Math.max(5, timeoutSecs ?? DEFAULT_TIMEOUT_SECS));
  const now = performance.now();
  const overallMs = limits.overallMs ?? OVERALL_MAX_MS;
  const end = now + overallMs;
  return {
    first: Math.min(now + secs * 1000, end),
    end,
    firstMs: secs * 1000,
    gapMs: limits.gapMs ?? IDLE_GAP_MS,
    overallMs,
  };
}

function secs(ms: number): string {
  return `${ms / 1000}s`;
}

/** The error for a timer that ran out (`text`: answer text had arrived), as Rust words it. */
export function expired(clock: StreamClock, text: boolean): AiError {
  if (!text)
    return new AiError('timeout', `first-delta: ${secs(Math.min(clock.firstMs, clock.overallMs))}`);
  if (performance.now() >= clock.end)
    return new AiError('timeout', `overall: ${secs(clock.overallMs)}`);
  return new AiError('timeout', `gap: ${secs(clock.gapMs)}`);
}

/** What a provider has read from its stream so far. */
interface StreamState {
  /** Answer text read since it was last taken (reasoning included: the filter removes it). */
  delta: string;
  model: string | null;
  /** Why the provider stopped, once it said so. */
  finish: string | null;
  truncated: boolean;
  /** The provider marked the end of its answer. */
  ended: boolean;
  /** Nothing more will come (Claude `message_stop`, Groq `[DONE]`). */
  closed: boolean;
}

function finished(st: StreamState, reason: string, cut: string): void {
  st.finish = reason;
  st.ended = true;
  if (reason === cut) st.truncated = true;
}

type Json = Record<string, unknown>;

function obj(v: unknown): Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Json) : {};
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function eventJson(ev: SseEvent): Json {
  try {
    return obj(JSON.parse(ev.data));
  } catch (e) {
    throw new AiError('badResponse', `stream event: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** The HTTP status an error type stands for (Claude types, Google RPC statuses, OpenAI codes). */
const STATUS_OF: Record<string, number> = {
  invalid_request_error: 400,
  INVALID_ARGUMENT: 400,
  FAILED_PRECONDITION: 400,
  authentication_error: 401,
  UNAUTHENTICATED: 401,
  invalid_api_key: 401,
  billing_error: 402,
  permission_error: 403,
  PERMISSION_DENIED: 403,
  not_found_error: 404,
  NOT_FOUND: 404,
  model_not_found: 404,
  request_too_large: 413,
  rate_limit_error: 429,
  rate_limit_exceeded: 429,
  insufficient_quota: 429,
  RESOURCE_EXHAUSTED: 429,
  api_error: 500,
  server_error: 500,
  internal_server_error: 500,
  INTERNAL: 500,
  service_unavailable: 503,
  UNAVAILABLE: 503,
  DEADLINE_EXCEEDED: 504,
  overloaded_error: 529,
};

const MAX_QUOTA_IDS = 4;
const MAX_QUOTA_ID_CHARS = 100;

/** Without control characters (Unicode Cc), as Rust's `char::is_control` filter. */
function noControl(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001f\u007f-\u009f]/g, '');
}

/** The `quotaId`s anywhere in an error's details (Gemini names the used-up quota only there). */
function quotaIds(v: unknown, out: string[], depth: number): void {
  if (depth > 8 || out.length >= MAX_QUOTA_IDS) return;
  if (Array.isArray(v)) {
    for (const item of v) quotaIds(item, out, depth + 1);
    return;
  }
  if (typeof v !== 'object' || v === null) return;
  for (const [name, value] of Object.entries(v)) {
    if (name === 'quotaId' && typeof value === 'string') {
      if (out.length < MAX_QUOTA_IDS)
        out.push(Array.from(noControl(value)).slice(0, MAX_QUOTA_ID_CHARS).join(''));
    } else {
      quotaIds(value, out, depth + 1);
    }
  }
}

/**
 * An error the provider reported inside the stream, as the HTTP error it stands for:
 * "<status>: <type>: <message>" (as `provider_error` in Rust).
 */
export function providerError(err: unknown): AiError {
  const e = obj(err);
  const names = ['type', 'status', 'code'].map((k) => str(e[k])).filter((n) => n !== undefined);
  const knownName = names.find((n) => STATUS_OF[n] !== undefined);
  const code = e.code;
  const numeric =
    typeof code === 'number' && Number.isInteger(code) && code >= 400 && code < 600
      ? code
      : undefined;
  const status = numeric ?? (knownName !== undefined ? STATUS_OF[knownName] : undefined) ?? 500;
  const kind = knownName ?? names[0] ?? 'error';
  let message = Array.from(noControl(str(e.message) ?? ''))
    .slice(0, 400)
    .join('');
  const quotas: string[] = [];
  quotaIds(e.details, quotas, 0);
  if (quotas.length > 0) message = `${message} (quota: ${quotas.join(', ')})`;
  return new AiError('http', `${status}: ${kind}: ${message}`);
}

/** Gemini finish reasons meaning its own filters stopped the answer. */
const GEMINI_BLOCKED = new Set([
  'SAFETY',
  'RECITATION',
  'PROHIBITED_CONTENT',
  'BLOCKLIST',
  'SPII',
  'IMAGE_SAFETY',
  'IMAGE_PROHIBITED_CONTENT',
  'IMAGE_RECITATION',
]);

function onGemini(ev: SseEvent, st: StreamState): void {
  const v = eventJson(ev);
  if (v.error !== undefined) throw providerError(v.error);
  st.model ??= str(v.modelVersion) ?? null;
  const candidates = v.candidates;
  const candidate = obj(Array.isArray(candidates) ? candidates[0] : undefined);
  const finish = str(candidate.finishReason);
  const blocked =
    str(obj(v.promptFeedback).blockReason) ??
    (finish !== undefined && GEMINI_BLOCKED.has(finish) ? finish : undefined);
  if (blocked !== undefined) throw new AiError('badResponse', `empty answer (${blocked})`);
  const parts = obj(candidate.content).parts;
  if (Array.isArray(parts)) {
    for (const p of parts) {
      const part = obj(p);
      // Thought summaries are not part of the answer.
      if (part.thought === true) continue;
      st.delta += str(part.text) ?? '';
    }
  }
  if (finish !== undefined) finished(st, finish, 'MAX_TOKENS');
}

function onClaude(ev: SseEvent, st: StreamState): void {
  const v = eventJson(ev);
  switch (str(v.type) ?? ev.event) {
    case 'message_start':
      st.model ??= str(obj(v.message).model) ?? null;
      break;
    case 'content_block_delta': {
      const delta = obj(v.delta);
      if (delta.type === 'text_delta') st.delta += str(delta.text) ?? '';
      break;
    }
    case 'message_delta': {
      const reason = str(obj(v.delta).stop_reason);
      if (reason === 'refusal') throw new AiError('badResponse', 'empty answer (refusal)');
      if (reason !== undefined) finished(st, reason, 'max_tokens');
      break;
    }
    case 'message_stop':
      st.ended = true;
      st.closed = true;
      break;
    case 'error':
      throw providerError(v.error);
    default:
    // ping, content_block_start/stop, thinking deltas and future event types.
  }
}

function onGroq(ev: SseEvent, st: StreamState): void {
  if (ev.data.trim() === '[DONE]') {
    st.ended = true;
    st.closed = true;
    return;
  }
  const v = eventJson(ev);
  if (v.error !== undefined) throw providerError(v.error);
  st.model ??= str(v.model) ?? null;
  const choices = v.choices;
  const choice = obj(Array.isArray(choices) ? choices[0] : undefined);
  const finish = str(choice.finish_reason);
  if (finish === 'content_filter') {
    throw new AiError('badResponse', 'empty answer (content_filter)');
  }
  // A separate `reasoning` field is not answer text.
  st.delta += str(obj(choice.delta).content) ?? '';
  if (finish !== undefined) finished(st, finish, 'length');
}

const ON_SSE: Record<Provider, (ev: SseEvent, st: StreamState) => void> = {
  gemini: onGemini,
  claude: onClaude,
  groq: onGroq,
};

/** A streamed answer read to its end. */
export interface StreamedAnswer {
  content: string;
  /** The model that answered, when the stream said so. */
  model: string | null;
  truncated: boolean;
}

/**
 * Reads a successful streamed response of `provider` to its end. `emit` receives the text shown
 * so far after every change (provisional); the returned content is final. Throws the provider's
 * error, an AbortError on a stop, or a timeout.
 */
export async function readCloudStream(
  body: ReadableStream<Uint8Array>,
  provider: Provider,
  clock: StreamClock,
  emit: (shown: string) => void,
  signal?: AbortSignal,
): Promise<StreamedAnswer> {
  const reader = body.getReader();
  const onSse = ON_SSE[provider];
  const sse = new SseReader();
  const filter = new ThinkFilter();
  const st: StreamState = {
    delta: '',
    model: null,
    finish: null,
    truncated: false,
    ended: false,
    closed: false,
  };
  // Read through a function: `handle` changes the state while the loop below runs.
  const closed = () => st.closed;
  let shown = '';
  let bytes = 0;
  const progress = { gotText: false };
  let last = performance.now();
  const handle = (ev: SseEvent) => {
    onSse(ev, st);
    const text = st.delta;
    st.delta = '';
    if (text === '') return;
    progress.gotText = true;
    bytes += utf8Length(text);
    if (bytes > MAX_ANSWER_BYTES) {
      throw new AiError('badResponse', `answer over ${MAX_ANSWER_BYTES} bytes`);
    }
    const change = filter.push(text);
    if (change) {
      shown = applyStreamEvent(shown, change);
      emit(shown);
    }
  };
  try {
    read: while (!closed()) {
      const until = st.ended
        ? Math.min(last + Math.min(clock.gapMs, END_GRACE_MS), clock.end)
        : progress.gotText
          ? Math.min(last + clock.gapMs, clock.end)
          : clock.first;
      let r: Awaited<ReturnType<typeof readChunk>>;
      try {
        r = await readChunk(reader, until, signal);
      } catch (e) {
        // After the end mark, a broken connection loses nothing of the answer.
        if (st.ended && !signal?.aborted) break;
        throw e;
      }
      if (r === 'timeout') {
        if (st.ended) break;
        throw expired(clock, progress.gotText);
      }
      if (r.done) break;
      // Any bytes (keep-alive pings too) show the provider is still sending.
      last = performance.now();
      for (const ev of sse.push(r.value)) {
        handle(ev);
        if (closed()) break read;
      }
    }
    if (!closed()) {
      const ev = sse.finish();
      if (ev) handle(ev);
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
  const fin = filter.finish();
  if (fin.change) emit(applyStreamEvent(shown, fin.change));
  if (fin.text.trim() === '') {
    throw new AiError(
      'badResponse',
      fin.removed ? 'reasoningOnly' : `empty answer (${st.finish ?? 'no text'})`,
    );
  }
  return {
    content: fin.text,
    model: st.model,
    // No end mark: the answer may be incomplete.
    truncated: st.truncated || !st.ended,
  };
}
