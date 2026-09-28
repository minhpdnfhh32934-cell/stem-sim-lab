import { invoke, isTauri } from '@tauri-apps/api/core';
import { AiError, toAiError, type ChatRequest, type ChatResponse, type Provider } from './types';

/** How the app talks to an LLM. The desktop app always goes through Rust. */
export interface LlmTransport {
  chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse>;
  models(provider: Provider, baseUrl?: string): Promise<string[]>;
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
  async models(provider: Provider, baseUrl?: string): Promise<string[]> {
    try {
      const r = await invoke<{ models: string[] }>('ai_models', {
        provider,
        baseUrlOverride: baseUrl ?? null,
      });
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

/**
 * Browser-only transport for UI development and end-to-end tests: talks to LM Studio's
 * OpenAI-compatible server directly. Cloud providers are not available here (keys must
 * never live in the web page).
 */
class FetchTransport implements LlmTransport {
  async chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    if (req.provider !== 'lmstudio') {
      throw new AiError('unavailable', 'Cloud providers need the desktop app');
    }
    const started = performance.now();
    const base = (req.baseUrl ?? 'http://localhost:1234/v1').replace(/\/+$/, '');
    const timeout = AbortSignal.timeout((req.timeoutSecs ?? 60) * 1000);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const body: Record<string, unknown> = {
      model: req.model,
      messages: [{ role: 'system', content: req.system }, ...req.messages],
      temperature: req.temperature ?? 0,
      max_tokens: req.maxTokens ?? 2048,
      stream: false,
    };
    if (req.jsonSchema) {
      body.response_format = {
        type: 'json_schema',
        json_schema: { name: req.schemaName ?? 'result', strict: true, schema: req.jsonSchema },
      };
    }
    let resp: Response;
    try {
      resp = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: combined,
      });
    } catch (e) {
      if (timeout.aborted) throw new AiError('timeout', `${req.timeoutSecs ?? 60}s`);
      throw toAiError(e);
    }
    if (!resp.ok) throw new AiError('http', `${resp.status}`);
    const json = (await resp.json()) as {
      model?: string;
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new AiError('badResponse', 'missing content');
    return { content, model: json.model ?? req.model, durationMs: performance.now() - started };
  }
  async models(provider: Provider, baseUrl?: string): Promise<string[]> {
    if (provider !== 'lmstudio') throw new AiError('unavailable', 'desktop app only');
    const base = (baseUrl ?? 'http://localhost:1234/v1').replace(/\/+$/, '');
    try {
      const r = await fetch(`${base}/models`, { signal: AbortSignal.timeout(4000) });
      if (!r.ok) throw new AiError('http', String(r.status));
      const j = (await r.json()) as { data?: { id: string }[] };
      return (j.data ?? []).map((m) => m.id);
    } catch (e) {
      throw toAiError(e);
    }
  }
  setKey(): Promise<void> {
    return Promise.reject(new AiError('unavailable', 'desktop app only'));
  }
  hasKey(): Promise<boolean> {
    return Promise.resolve(false);
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
