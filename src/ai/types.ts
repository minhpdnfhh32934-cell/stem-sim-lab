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
  | 'unavailable';

export class AiError extends Error {
  override name = 'AiError';
  constructor(
    readonly code: AiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** Converts whatever the transport threw into an AiError. */
export function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  if (typeof e === 'object' && e !== null && 'code' in e) {
    const o = e as { code: string; message?: unknown };
    return new AiError(o.code as AiErrorCode, typeof o.message === 'string' ? o.message : '');
  }
  if (e instanceof DOMException && e.name === 'AbortError') return new AiError('cancelled', '');
  return new AiError('network', e instanceof Error ? e.message : String(e));
}
