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
  /**
   * Reads a photographed problem (base64 JPEG) with a vision-capable cloud API.
   * Optional: the desktop gateway has no image endpoint, so only FetchTransport
   * implements it. Callers fall back to the local model when absent.
   */
  transcribePhoto?(req: {
    provider: Provider;
    model: string;
    system: string;
    base64: string;
    timeoutSecs: number;
  }): Promise<string>;
  /** The stored key masked as "••••••••abcd", or null (the key itself never reaches the page). */
  keyHint?(provider: Provider): Promise<string | null>;
  /** AI Teacher's cloud voice: Gemini text-to-speech of text already written in words. */
  tts?(req: TtsRequest, signal?: AbortSignal): Promise<TtsAudio>;
}

export interface TtsRequest {
  requestId: string;
  model: string;
  voice: string;
  style: string;
  text: string;
  timeoutSecs?: number;
}

export interface TtsAudio {
  /** Base64 bytes: WAV, or raw 16-bit PCM when `mimeType` says L16/pcm. */
  audio: string;
  mimeType: string;
}

/**
 * Asks Rust to cancel `requestId` ("Dừng"). Rust registers a request only after its safety, key
 * and daily-cap checks, so a stop sent in that window finds nothing (`ai_cancel` → false): it is
 * sent again every 50 ms while the call still runs, for up to 2 s. Known limit (Rust side,
 * src-tauri/src/ai/mod.rs `ai_chat`): such a call is already counted against the daily cap.
 */
async function cancelInRust(requestId: string, running: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 40 && running(); attempt++) {
    try {
      if (await invoke<boolean>('ai_cancel', { requestId })) return;
    } catch {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

class TauriTransport implements LlmTransport {
  async chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    // Stopped before it was sent (e.g. while the key was looked up): send nothing.
    if (signal?.aborted) throw new AiError('cancelled', req.requestId);
    let running = true;
    const onAbort = () => {
      void cancelInRust(req.requestId, () => running);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    // The Rust gateway counts the call against the user's daily cap and switches to the
    // fallback provider when the chosen one is out of quota/credit.
    const { noFallback, ...rest } = req;
    const fallback = noFallback ? undefined : fallbackFor(req.provider);
    const request = {
      day: localDay(),
      dailyCap: useAiStore.getState().dailyCap,
      ...(fallback ? { fallback } : {}),
      ...rest,
    };
    try {
      return await invoke<ChatResponse>('ai_chat', { request });
    } catch (e) {
      throw toAiError(e);
    } finally {
      running = false;
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
  async tts(req: TtsRequest, signal?: AbortSignal): Promise<TtsAudio> {
    if (signal?.aborted) throw new AiError('cancelled', req.requestId);
    let running = true;
    const onAbort = () => {
      void cancelInRust(req.requestId, () => running);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      return await invoke<TtsAudio>('ai_tts', {
        request: { ...req, day: localDay(), dailyCap: useAiStore.getState().dailyCap },
      });
    } catch (e) {
      throw toAiError(e);
    } finally {
      running = false;
      signal?.removeEventListener('abort', onAbort);
    }
  }
}

/** Same request as `tts_body` in src-tauri/src/ai/tts.rs. */
export function ttsBody(req: TtsRequest): Record<string, unknown> {
  const part: Record<string, unknown> = { text: req.text };
  if (req.style.trim()) part.speech_metadata = { style: req.style.trim() };
  return {
    contents: [{ role: 'user', parts: [part] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { voice: req.voice } },
    },
  };
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
  return globalThis.__STEMSIM_TEST_GEMINI_KEY__;
}

/** "429: {…}" — status plus the start of the body, like the Rust gateway reports it. */
async function httpError(resp: Response): Promise<AiError> {
  const body = await resp.text().catch(() => '');
  return new AiError('http', `${resp.status}: ${body.slice(0, 400)}`);
}

type Http = (url: string, init: RequestInit) => Promise<Response>;

/** Answer text, and whether it stopped at the output-token limit (like the Rust gateway). */
interface Reply {
  text: string;
  truncated: boolean;
}

const nodeOnly = typeof window === 'undefined';

/** Same request as `gemini_body` in src-tauri/src/ai/gemini.rs. */
async function geminiChat(req: ChatRequest, key: string, http: Http): Promise<Reply> {
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
    candidates?: {
      content?: { parts?: { text?: string; thought?: boolean }[] };
      finishReason?: string;
    }[];
  };
  const first = json.candidates?.[0];
  const text = (first?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('');
  return { text, truncated: first?.finishReason === 'MAX_TOKENS' };
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
async function claudeChat(req: ChatRequest, key: string, http: Http): Promise<Reply> {
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
    stop_reason?: string;
  };
  const truncated = json.stop_reason === 'max_tokens';
  const blocks = json.content ?? [];
  const tool = blocks.find((b) => b.type === 'tool_use');
  if (tool) return { text: JSON.stringify(tool.input), truncated };
  return {
    text: blocks.map((b) => (b.type === 'text' ? (b.text ?? '') : '')).join(''),
    truncated,
  };
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

async function groqChat(req: ChatRequest, key: string, http: Http): Promise<Reply> {
  const resp = await http('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(groqBody(req)),
  });
  if (!resp.ok) throw await httpError(resp);
  const json = (await resp.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
  };
  const choice = json.choices?.[0];
  return {
    text: (choice?.message?.content ?? '').replace(/^\s*<think>[\s\S]*?<\/think>\s*/, ''),
    truncated: choice?.finish_reason === 'length',
  };
}

export interface VisionRequest {
  provider: Provider;
  model: string;
  system: string;
  base64: string;
  timeoutSecs: number;
}

function visionParts(json: unknown): string {
  const candidates = (json as { candidates?: { content?: { parts?: unknown } }[] }).candidates;
  const parts = candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((p) => {
      if (typeof p === 'object' && p !== null && 'text' in p) {
        const text = (p as { text?: unknown }).text;
        return typeof text === 'string' ? text : '';
      }
      return '';
    })
    .join('');
}

/** Gemini photo reading (inlineData part). Browser/localhost only. */
async function geminiVision(req: VisionRequest, key: string, http: Http): Promise<string> {
  const name = req.model.trim().replace(/^models\//, '');
  const resp = await http(
    `https://generativelanguage.googleapis.com/v1beta/models/${name}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'Đề bài trong ảnh là gì?' },
              { inlineData: { mimeType: 'image/jpeg', data: req.base64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      }),
    },
  );
  if (!resp.ok) throw await httpError(resp);
  return visionParts(await resp.json());
}

/** Groq photo reading (OpenAI-compatible image_url part). Browser/localhost only. */
async function groqVision(req: VisionRequest, key: string, http: Http): Promise<string> {
  const resp = await http('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: req.model.trim(),
      messages: [
        { role: 'system', content: req.system },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Đề bài trong ảnh là gì?' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${req.base64}` } },
          ],
        },
      ],
      max_completion_tokens: 1024,
      temperature: 0.2,
    }),
  });
  if (!resp.ok) throw await httpError(resp);
  const json = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content : '';
}

/**
 * Transport without the desktop app: UI development, end-to-end tests (which mock the Gemini
 * server) and golden runs against the real APIs from Node. Keys typed into the page on
 * localhost/browser live in `sessionKeys`: memory only, never persisted, gone on reload.
 * The desktop app keeps using the OS keychain instead. Claude is only called from Node
 * (Anthropic does not accept browser calls without a special opt-in header).
 */
const sessionKeys = new Map<Provider, string>();

function pageKey(provider: Provider): string | undefined {
  return injectedKey(provider) ?? sessionKeys.get(provider);
}

class FetchTransport implements LlmTransport {
  private key(provider: Provider): string {
    const k = pageKey(provider);
    if (!k) throw new AiError('missingKey', provider);
    return k;
  }
  private supported(provider: Provider): boolean {
    if (provider === 'claude') return nodeOnly;
    return true;
  }
  /** Same fallback rule as the Rust gateway (`send_with_fallback`). */
  async chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    const fb = req.noFallback ? undefined : fallbackFor(req.provider);
    const fbUsable = fb && this.supported(fb.provider) && !!pageKey(fb.provider);
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
    let reply: Reply;
    try {
      if (req.provider === 'claude') reply = await claudeChat(req, key, http);
      else if (req.provider === 'groq') reply = await groqChat(req, key, http);
      else reply = await geminiChat(req, key, http);
    } catch (e) {
      if (timeout.aborted) throw new AiError('timeout', `${secs}s`);
      throw toAiError(e);
    }
    if (!reply.text.trim()) throw new AiError('badResponse', 'missing content');
    return {
      content: reply.text,
      model: req.model.trim(),
      durationMs: performance.now() - started,
      truncated: reply.truncated,
    };
  }
  async models(provider: Provider): Promise<string[]> {
    if (provider !== 'gemini') {
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
  setKey(provider: Provider, key: string): Promise<void> {
    const trimmed = key.trim();
    if (!trimmed) return Promise.reject(new AiError('missingKey', provider));
    sessionKeys.set(provider, trimmed);
    return Promise.resolve();
  }
  hasKey(provider: Provider): Promise<boolean> {
    return Promise.resolve(this.supported(provider) && !!pageKey(provider));
  }
  deleteKey(provider: Provider): Promise<void> {
    sessionKeys.delete(provider);
    return Promise.resolve();
  }
  async testKey(provider: Provider, model: string): Promise<KeyTest> {
    if (!this.supported(provider)) return { status: 'error', detail: 'desktop app only' };
    const key = pageKey(provider);
    if (!key) return { status: 'noKey', detail: '' };
    if (provider !== 'gemini') {
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
    const key = this.supported(provider) ? pageKey(provider) : undefined;
    return Promise.resolve(key ? maskKey(key) : null);
  }
  async tts(req: TtsRequest, signal?: AbortSignal): Promise<TtsAudio> {
    const key = this.key('gemini');
    const secs = req.timeoutSecs ?? 45;
    const timeout = AbortSignal.timeout(secs * 1000);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const model = req.model.trim().replace(/^models\//, '');
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify(ttsBody(req)),
          signal: combined,
        },
      );
      if (!resp.ok) throw await httpError(resp);
      const json = (await resp.json()) as {
        candidates?: {
          content?: {
            parts?: {
              inlineData?: { data?: string; mimeType?: string };
              inline_data?: { data?: string; mime_type?: string };
            }[];
          };
        }[];
      };
      for (const p of json.candidates?.[0]?.content?.parts ?? []) {
        const data = p.inlineData?.data ?? p.inline_data?.data;
        if (data) {
          return {
            audio: data,
            mimeType: p.inlineData?.mimeType ?? p.inline_data?.mime_type ?? 'audio/wav',
          };
        }
      }
      throw new AiError('badResponse', 'no audio in the answer');
    } catch (e) {
      if (timeout.aborted) throw new AiError('timeout', `${secs}s`);
      throw toAiError(e);
    }
  }
  async transcribePhoto(req: {
    provider: Provider;
    model: string;
    system: string;
    base64: string;
    timeoutSecs: number;
  }): Promise<string> {
    if (!this.supported(req.provider)) throw new AiError('unavailable', 'desktop app only');
    const key = this.key(req.provider);
    const secs = req.timeoutSecs;
    const timeout = AbortSignal.timeout(secs * 1000);
    const http: Http = (url, init) => fetch(url, { ...init, signal: timeout });
    const vision: VisionRequest = {
      provider: req.provider,
      model: req.model,
      system: req.system,
      base64: req.base64,
      timeoutSecs: secs,
    };
    try {
      if (req.provider === 'groq') return await groqVision(vision, key, http);
      if (req.provider === 'gemini') return await geminiVision(vision, key, http);
      throw new AiError('unavailable', req.provider);
    } catch (e) {
      if (timeout.aborted) throw new AiError('timeout', `${secs}s`);
      throw toAiError(e);
    }
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
