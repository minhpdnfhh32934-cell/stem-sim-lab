import { invoke, isTauri } from '@tauri-apps/api/core';
import { localDay, useAiStore } from './aiStore';
import { fallbackFor, isQuotaError } from './fallback';
import { classifyKeyTest, maskKey, type KeyTest } from './keyTest';
import { AiError, toAiError, type ChatRequest, type ChatResponse, type Provider } from './types';

/** How the app talks to an LLM. The desktop app always goes through Rust (`AIProvider`). */
export interface LlmTransport {
  chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse>;
  /** The provider's models; also tells whether the stored key works. */
  models(provider: Provider): Promise<string[]>;
  setKey(provider: Provider, key: string): Promise<void>;
  hasKey(provider: Provider): Promise<boolean>;
  deleteKey(provider: Provider): Promise<void>;
  /** AI calls counted today against the daily cap (desktop app only). */
  usageToday?(): Promise<number>;
  /** "Kiểm tra key": one tiny request with the chosen model. */
  testKey?(provider: Provider, model: string): Promise<KeyTest>;
  /** The stored key masked as "••••••••abcd", or null (the key itself never reaches the page). */
  keyHint?(provider: Provider): Promise<string | null>;
}

class TauriTransport implements LlmTransport {
  async chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    const onAbort = () => {
      void invoke('ai_cancel', { requestId: req.requestId });
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    // The Rust gateway counts the call against the user's daily cap and switches to the
    // fallback provider when the chosen one is out of quota/credit.
    const fallback = fallbackFor(req.provider);
    const request = {
      day: localDay(),
      dailyCap: useAiStore.getState().dailyCap,
      ...(fallback ? { fallback } : {}),
      ...req,
    };
    try {
      return await invoke<ChatResponse>('ai_chat', { request });
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
  async usageToday(): Promise<number> {
    const u = await invoke<{ count: number }>('ai_usage', { day: localDay() });
    return u.count;
  }
  testKey(provider: Provider, model: string): Promise<KeyTest> {
    return invoke<KeyTest>('ai_test_key', { provider, model });
  }
  keyHint(provider: Provider): Promise<string | null> {
    return invoke<string | null>('ai_key_hint', { provider });
  }
}

/** Keys used by the browser-only transport (set by tests, never typed in the UI). */
declare global {
  var __STEMSIM_TEST_GEMINI_KEY__: string | undefined;
  var __STEMSIM_TEST_CLAUDE_KEY__: string | undefined;
  var __STEMSIM_TEST_GROQ_KEY__: string | undefined;
}

function injectedKey(provider: Provider): string | undefined {
  if (provider === 'claude') return globalThis.__STEMSIM_TEST_CLAUDE_KEY__;
  if (provider === 'groq') return globalThis.__STEMSIM_TEST_GROQ_KEY__;
  return __EDITION__ === 'main' ? globalThis.__STEMSIM_TEST_GEMINI_KEY__ : undefined;
}

/** "429: {…}" — status plus the start of the body, like the Rust gateway reports it. */
async function httpError(resp: Response): Promise<AiError> {
  const body = await resp.text().catch(() => '');
  return new AiError('http', `${resp.status}: ${body.slice(0, 400)}`);
}

type Http = (url: string, init: RequestInit) => Promise<Response>;

const nodeOnly = typeof window === 'undefined';

/**
 * Same request as `gemini_body` in src-tauri/src/ai/gemini.rs. Only referenced behind
 * `__EDITION__ === 'main'`, so it is not part of the pilot bundle.
 */
async function geminiChat(req: ChatRequest, key: string, http: Http): Promise<string> {
  const url = 'https://generativelanguage.googleapis.com/v1beta';
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
  const resp = await http(`${url}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw await httpError(resp);
  const json = (await resp.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  };
  return (json.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('');
}

async function geminiModels(key: string, http: Http): Promise<string[]> {
  const r = await http('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
    headers: { 'x-goog-api-key': key },
  });
  if (!r.ok) throw new AiError('http', String(r.status));
  const j = (await r.json()) as { models?: { name: string }[] };
  return (j.models ?? []).map((m) => m.name.replace(/^models\//, ''));
}

/** Same request as `claude_body` in src-tauri/src/ai/claude.rs (golden runs from Node). */
async function claudeChat(req: ChatRequest, key: string, http: Http): Promise<string> {
  const name = req.schemaName ?? 'result';
  const body: Record<string, unknown> = {
    model: req.model.trim(),
    system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
    messages: req.messages,
    max_tokens: req.maxTokens ?? 2048,
  };
  if (req.jsonSchema) {
    body.tools = [
      { name, description: 'Return the structured result.', input_schema: req.jsonSchema },
    ];
    body.tool_choice = { type: 'tool', name };
  }
  const resp = await http('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw await httpError(resp);
  const json = (await resp.json()) as {
    content?: { type: string; text?: string; input?: unknown }[];
  };
  const blocks = json.content ?? [];
  const tool = blocks.find((b) => b.type === 'tool_use');
  if (tool) return JSON.stringify(tool.input);
  return blocks.map((b) => (b.type === 'text' ? (b.text ?? '') : '')).join('');
}

/** Same request as `groq_body` in src-tauri/src/ai/groq.rs (OpenAI-compatible). */
export function groqBody(req: ChatRequest): Record<string, unknown> {
  const model = req.model.trim();
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'system', content: req.system }, ...req.messages],
    max_completion_tokens: req.maxTokens ?? 2048,
    temperature: req.temperature ?? 0,
  };
  if (model.startsWith('openai/gpt-oss')) {
    body.include_reasoning = false;
    body.reasoning_effort = 'low';
  } else if (model.startsWith('qwen/')) {
    body.reasoning_effort = 'low';
    if (!req.jsonSchema) body.reasoning_format = 'hidden';
  }
  if (req.jsonSchema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: req.schemaName ?? 'result',
        strict: model.startsWith('openai/gpt-oss') || model.startsWith('qwen/qwen3.8'),
        schema: req.jsonSchema,
      },
    };
  }
  return body;
}

async function groqChat(req: ChatRequest, key: string, http: Http): Promise<string> {
  const resp = await http('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(groqBody(req)),
  });
  if (!resp.ok) throw await httpError(resp);
  const json = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content ?? '';
  return text.replace(/^\s*<think>[\s\S]*?<\/think>\s*/, '');
}

/**
 * Transport without the desktop app: UI development, end-to-end tests (which mock the Gemini
 * server) and golden runs against the real APIs from Node. Keys must never live in the web
 * page, so it only works with a test key injected by the test runner. Claude is only called
 * from Node (Anthropic does not accept browser calls without a special opt-in header).
 */
class FetchTransport implements LlmTransport {
  private key(provider: Provider): string {
    const k = injectedKey(provider);
    if (!k) throw new AiError('missingKey', provider);
    return k;
  }
  private supported(provider: Provider): boolean {
    if (provider === 'claude') return nodeOnly;
    if (provider === 'groq') return true;
    return __EDITION__ === 'main';
  }
  /** Same fallback rule as the Rust gateway (`send_with_fallback`). */
  async chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    const fb = fallbackFor(req.provider);
    const fbUsable = fb && this.supported(fb.provider) && !!injectedKey(fb.provider);
    try {
      return { ...(await this.chatOnce(req, signal)), provider: req.provider, fallback: false };
    } catch (e) {
      if (!fbUsable || !isQuotaError(e)) throw e;
      const answer = await this.chatOnce(
        { ...req, provider: fb.provider, model: fb.model },
        signal,
      );
      return { ...answer, provider: fb.provider, fallback: true };
    }
  }
  private async chatOnce(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    if (!this.supported(req.provider)) throw new AiError('unavailable', 'desktop app only');
    const key = this.key(req.provider);
    const started = performance.now();
    const secs = req.timeoutSecs ?? 30;
    const timeout = AbortSignal.timeout(secs * 1000);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const http: Http = (url, init) => fetch(url, { ...init, signal: combined });
    let content: string;
    try {
      if (req.provider === 'claude') content = await claudeChat(req, key, http);
      else if (req.provider === 'groq') content = await groqChat(req, key, http);
      else if (__EDITION__ === 'main') content = await geminiChat(req, key, http);
      else throw new AiError('unavailable', req.provider);
    } catch (e) {
      if (timeout.aborted) throw new AiError('timeout', `${secs}s`);
      throw toAiError(e);
    }
    if (!content.trim()) throw new AiError('badResponse', 'missing content');
    return { content, model: req.model.trim(), durationMs: performance.now() - started };
  }
  async models(provider: Provider): Promise<string[]> {
    if (provider !== 'gemini' || __EDITION__ !== 'main') {
      throw new AiError('unavailable', 'desktop app only');
    }
    const key = this.key(provider);
    try {
      return await geminiModels(key, (url, init) =>
        fetch(url, { ...init, signal: AbortSignal.timeout(10_000) }),
      );
    } catch (e) {
      throw toAiError(e);
    }
  }
  setKey(): Promise<void> {
    return Promise.reject(new AiError('unavailable', 'desktop app only'));
  }
  hasKey(provider: Provider): Promise<boolean> {
    return Promise.resolve(this.supported(provider) && !!injectedKey(provider));
  }
  deleteKey(): Promise<void> {
    return Promise.resolve();
  }
  async testKey(provider: Provider, model: string): Promise<KeyTest> {
    if (!this.supported(provider)) return { status: 'error', detail: 'desktop app only' };
    const key = injectedKey(provider);
    if (!key) return { status: 'noKey', detail: '' };
    if (provider !== 'gemini' || __EDITION__ !== 'main') {
      return { status: 'error', detail: 'desktop app only' };
    }
    const name = model.trim().replace(/^models\//, '');
    let resp: Response;
    try {
      resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${name}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'OK?' }] }] }),
          signal: AbortSignal.timeout(20_000),
        },
      );
    } catch {
      return { status: 'offline', detail: '' };
    }
    const body = await resp.text();
    const status = classifyKeyTest(resp.status, body);
    return { status, detail: status === 'error' ? `${resp.status}` : '' };
  }
  keyHint(provider: Provider): Promise<string | null> {
    const key = this.supported(provider) ? injectedKey(provider) : undefined;
    return Promise.resolve(key ? maskKey(key) : null);
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
