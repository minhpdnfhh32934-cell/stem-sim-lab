import { invoke, isTauri } from '@tauri-apps/api/core';
import { AiError, toAiError, type ChatRequest, type ChatResponse, type Provider } from './types';

/** How the app talks to an LLM. The desktop app always goes through Rust. */
export interface LlmTransport {
  chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse>;
  /** The provider's models; also tells whether the stored key works. */
  models(provider: Provider): Promise<string[]>;
  setKey(provider: Provider, key: string): Promise<void>;
  hasKey(provider: Provider): Promise<boolean>;
  deleteKey(provider: Provider): Promise<void>;
}

class TauriTransport implements LlmTransport {
  async chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    const onAbort = () => {
      void invoke('ai_cancel', { requestId: req.requestId });
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      return await invoke<ChatResponse>('ai_chat', { request: req });
    } catch (e) {
      throw toAiError(e);
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }
  }
  async models(provider: Provider): Promise<string[]> {
    try {
      const r = await invoke<{ models: string[] }>('ai_models', { provider });
      return r.models;
    } catch (e) {
      throw toAiError(e);
    }
  }
  async setKey(provider: Provider, key: string): Promise<void> {
    try {
      await invoke('ai_set_key', { provider, key });
    } catch (e) {
      throw toAiError(e);
    }
  }
  hasKey(provider: Provider): Promise<boolean> {
    return invoke<boolean>('ai_has_key', { provider });
  }
  async deleteKey(provider: Provider): Promise<void> {
    await invoke('ai_delete_key', { provider });
  }
}

/** Key used by the browser-only transport (set by end-to-end tests, never typed in the UI). */
declare global {
  var __STEMSIM_TEST_GEMINI_KEY__: string | undefined;
}

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Browser-only transport for UI development and end-to-end tests (which mock the Gemini
 * server). Keys must never live in the web page, so it only works with a test key injected
 * by the test runner; the desktop app always goes through Rust (`TauriTransport`).
 */
class FetchTransport implements LlmTransport {
  private key(): string {
    const k = globalThis.__STEMSIM_TEST_GEMINI_KEY__;
    if (!k) throw new AiError('missingKey', 'gemini');
    return k;
  }
  async chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    if (req.provider !== 'gemini') {
      throw new AiError('unavailable', 'desktop app only');
    }
    const key = this.key();
    const started = performance.now();
    const timeout = AbortSignal.timeout((req.timeoutSecs ?? 60) * 1000);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    // Same body as `gemini_body` in src-tauri/src/ai.rs.
    const generationConfig: Record<string, unknown> = {
      temperature: req.temperature ?? 0,
      maxOutputTokens: Math.max(req.maxTokens ?? 2048, 8192),
    };
    if (req.jsonSchema) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseJsonSchema = req.jsonSchema;
    }
    const body = {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: req.messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig,
    };
    const model = req.model.trim().replace(/^models\//, '');
    let resp: Response;
    try {
      resp = await fetch(`${GEMINI_URL}/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body),
        signal: combined,
      });
    } catch (e) {
      if (timeout.aborted) throw new AiError('timeout', `${req.timeoutSecs ?? 60}s`);
      throw toAiError(e);
    }
    if (!resp.ok) throw new AiError('http', `${resp.status}`);
    const json = (await resp.json()) as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    };
    const content = (json.candidates?.[0]?.content?.parts ?? [])
      .filter((p) => !p.thought)
      .map((p) => p.text ?? '')
      .join('');
    if (!content.trim()) throw new AiError('badResponse', 'missing content');
    return { content, model, durationMs: performance.now() - started };
  }
  async models(provider: Provider): Promise<string[]> {
    if (provider !== 'gemini') throw new AiError('unavailable', 'desktop app only');
    const key = this.key();
    try {
      const r = await fetch(`${GEMINI_URL}/models?pageSize=1000`, {
        headers: { 'x-goog-api-key': key },
        signal: AbortSignal.timeout(10_000),
      });
      if (!r.ok) throw new AiError('http', String(r.status));
      const j = (await r.json()) as { models?: { name: string }[] };
      return (j.models ?? []).map((m) => m.name.replace(/^models\//, ''));
    } catch (e) {
      throw toAiError(e);
    }
  }
  setKey(): Promise<void> {
    return Promise.reject(new AiError('unavailable', 'desktop app only'));
  }
  hasKey(provider: Provider): Promise<boolean> {
    return Promise.resolve(provider === 'gemini' && !!globalThis.__STEMSIM_TEST_GEMINI_KEY__);
  }
  deleteKey(): Promise<void> {
    return Promise.resolve();
  }
}

let override: LlmTransport | null = null;

/** Tests can inject a fake transport. */
export function setTransportForTests(t: LlmTransport | null): void {
  override = t;
}

export function getTransport(): LlmTransport {
  if (override) return override;
  return isTauri() ? new TauriTransport() : new FetchTransport();
}

export const newRequestId = () =>
  `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
