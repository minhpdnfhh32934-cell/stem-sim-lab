/** Mirrors `ChatRequest`/`ChatResponse`/`AiError` in `src-tauri/src/ai.rs`. */
export type Provider = 'lmstudio' | 'openai' | 'anthropic';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  requestId: string;
  provider: Provider;
  baseUrl?: string;
  model: string;
  system: string;
  messages: ChatMessage[];
  jsonSchema?: unknown;
  schemaName?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutSecs?: number;
}

export interface ChatResponse {
  content: string;
  model: string;
  durationMs: number;
}

export type AiErrorCode =
  | 'timeout'
  | 'cancelled'
  | 'http'
  | 'network'
  | 'missingKey'
  | 'badResponse'
  | 'keychain'
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
