/** Mirrors `ChatRequest`/`ChatResponse`/`AiError` in `src-tauri/src/ai/mod.rs`. */
/**
 * `gemini`: main edition only; `claude`: both editions (PROMPT_PHAN_2 A2); `groq`: free
 * fallback, both editions (user decision 2026-10-05, docs/LEGAL_COMPLIANCE.md §2b).
 */
export type Provider = 'gemini' | 'claude' | 'groq';

/** Provider that answers when the chosen one is out of quota or credit. */
export interface Fallback {
  provider: Provider;
  model: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  requestId: string;
  provider: Provider;
  model: string;
  system: string;
  messages: ChatMessage[];
  jsonSchema?: unknown;
  schemaName?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutSecs?: number;
  /** The user's local date ("YYYY-MM-DD") and the daily cap (0 = none), filled in by the transport. */
  day?: string;
  dailyCap?: number;
  /** Filled in by the transport from Settings ("Dự phòng khi hết lượt"). */
  fallback?: Fallback;
  /**
   * Never switch to the fallback provider for this call. Used by Think, so the draft and the
   * review always come from the two providers the learner chose (the reviewer never checks
   * its own answer). Stays on the web side; the gateway just gets no `fallback`.
   */
  noFallback?: boolean;
}

export interface ChatResponse {
  content: string;
  model: string;
  durationMs: number;
  /** Attempts retried after 429/5xx (Rust gateway only). */
  retries?: number;
  /** Provider that answered. */
  provider?: Provider;
  /** True when the fallback provider answered (the chosen one was out of quota/credit). */
  fallback?: boolean;
  /** The answer stopped at the output-token limit (the AI Teacher offers "Viết tiếp"). */
  truncated?: boolean;
}

/**
 * A change to an answer shown while it streams: `StreamEvent` in src-tauri/src/ai/stream.rs, the
 * same for cloud providers (`ai_chat_stream`) and local runtimes (`local_ai_chat`).
 *
 * Provisional: when a chat template pre-fills the opening reasoning tag, the reasoning arrives
 * first with nothing to mark it and is only taken back by a `reset` when its closing tag comes.
 * Text may be shown, but speech, board actions and anything that cannot be taken back wait for
 * the final text of the call.
 */
export type StreamEvent =
  /** Add this text at the end. */
  | { kind: 'delta'; text: string }
  /** Replace everything shown so far (reasoning was recognised late). */
  | { kind: 'reset'; text: string };

/** The text shown after `e`, given the text shown before it. */
export function applyStreamEvent(shown: string, e: StreamEvent): string {
  return e.kind === 'delta' ? shown + e.text : e.text;
}

/**
 * Follows a streamed answer for a caller that wants the whole text shown so far: after every
 * event `onText` gets the full text (a `reset` replaces it), and when the call ends the final
 * content is the authority (`settle`), so the last text the caller saw is the answer itself,
 * also when an event was lost or arrived late.
 */
export class ShownText {
  private shown = '';
  private events = 0;

  constructor(private readonly onText?: (shown: string) => void) {}

  get text(): string {
    return this.shown;
  }

  /** At least one event arrived. */
  get started(): boolean {
    return this.events > 0;
  }

  apply(e: StreamEvent): void {
    this.events++;
    this.shown = applyStreamEvent(this.shown, e);
    this.onText?.(this.shown);
  }

  /** The call's final content; tells the caller only when it differs from what it saw. */
  settle(final: string): void {
    if (final === this.shown) return;
    this.shown = final;
    this.onText?.(final);
  }
}

export type AiErrorCode =
  | 'timeout'
  | 'cancelled'
  | 'http'
  | 'network'
  | 'missingKey'
  | 'badResponse'
  | 'keychain'
  | 'dailyLimit'
  /** Blocked by the safety gates in Rust (age confirmation / consent / supervisor PIN). */
  | 'notAllowed'
  | 'invalidJson'
  | 'unavailable'
  /**
   * The app itself failed, not the network and not the provider: a desktop command that is
   * missing or got the wrong arguments ("Command ai_chat not found"), or a programming error.
   * Page-only (Rust never sends it); see `toAiError`.
   */
  | 'internal';

export class AiError extends Error {
  override name = 'AiError';
  constructor(
    readonly code: AiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/**
 * How `fetch` reports that no answer came (the Fetch standard's network error is a TypeError):
 * Chromium/WebView2 "Failed to fetch" and, while a body is read, "network error"; Firefox
 * "NetworkError when attempting to fetch resource." / "Error in body stream"; Safari "Load
 * failed"; Node "fetch failed".
 */
const FETCH_FAILURE =
  /^(?:failed to fetch|networkerror when attempting to fetch resource|load failed|fetch failed|network error|error in body stream)\b/i;

/** `fetch` (or a body read) failed because no answer came: a network problem. */
function isFetchFailure(e: unknown): boolean {
  if (e instanceof DOMException) return e.name === 'NetworkError';
  return e instanceof TypeError && FETCH_FAILURE.test(e.message);
}

/**
 * Converts whatever the transport threw into an AiError. Only a failure that really is the
 * network's is called `network`: Rust's own network error (`{code: 'network'}`) or `fetch`'s
 * TypeError. Anything else that is not already an AiError — a plain string or Error from the
 * desktop bridge ("Command ai_chat not found", wrong arguments) or a programming error — is
 * `internal`, so the learner is not sent to check an Internet connection that works.
 */
export function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  // Before the `code` check: a DOMException has a numeric `code` (20 for an AbortError).
  if (e instanceof DOMException && e.name === 'AbortError') return new AiError('cancelled', '');
  // `fetch` stopped by an `AbortSignal.timeout`.
  if (e instanceof DOMException && e.name === 'TimeoutError') return new AiError('timeout', '');
  // Rust's AiError arrives as { code, message }.
  if (typeof e === 'object' && e !== null && 'code' in e && typeof e.code === 'string') {
    const o = e as { code: string; message?: unknown };
    return new AiError(o.code as AiErrorCode, typeof o.message === 'string' ? o.message : '');
  }
  const message = e instanceof Error ? e.message : String(e);
  return new AiError(isFetchFailure(e) ? 'network' : 'internal', message);
}
