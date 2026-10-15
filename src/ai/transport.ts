import { Channel, invoke, isTauri } from '@tauri-apps/api/core';
import { localDay, useAiStore } from './aiStore';
import {
  expired,
  GEMINI_BLOCKED,
  NATURAL_END,
  readCloudStream,
  roomForFallback,
  startClock,
  type StreamClock,
} from './cloudStream';
import { fallbackFor, isQuotaError } from './fallback';
import { classifyKeyTest, maskKey, type KeyTest } from './keyTest';
import { visibleAnswer } from './reasoning';
import {
  AiError,
  ShownText,
  toAiError,
  type ChatRequest,
  type ChatResponse,
  type Provider,
  type StreamEvent,
} from './types';

/** How the app talks to an LLM. The desktop app always goes through Rust (`AIProvider`). */
export interface LlmTransport {
  chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse>;
  /**
   * A text answer that streams while it is written: `onText` gets the text shown so far after
   * every change (provisional: a late reasoning tag can take text back, see `StreamEvent`); the
   * returned `content` is the final text. Requests with a JSON schema are not streamed (they are
   * answered as by `chat`, without `onText`). Optional: callers use `chat` when it is absent.
   */
  chatStream?(
    req: ChatRequest,
    onText: (shown: string) => void,
    signal?: AbortSignal,
  ): Promise<ChatResponse>;
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
 * Asks Rust to cancel `requestId` ("Dừng"), for cloud calls and local runtimes alike. Rust
 * registers a call before any check (src-tauri/src/ai/mod.rs `InflightGuard`), but the stop can
 * still reach Rust before the call itself does (`ai_cancel` → false): it is sent again every 50 ms
 * while the call still runs, for up to 2 s.
 */
export async function cancelInRust(requestId: string, running: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 40 && running(); attempt++) {
    try {
      if (await invoke<boolean>('ai_cancel', { requestId })) return;
    } catch {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/**
 * Tauri's answer for a command the app does not have ("Command ai_chat_stream not found"): the web
 * part was updated without the desktop app (src-tauri/src/webupdate.rs).
 */
export function isMissingCommand(e: unknown): boolean {
  return typeof e === 'string' && /^command \S+ not found$/i.test(e.trim());
}

/**
 * What the Rust gateway gets: the call is counted against the user's daily cap, and the fallback
 * provider answers when the chosen one is out of quota/credit (unless `noFallback`).
 */
function gatewayRequest(req: ChatRequest): Omit<ChatRequest, 'noFallback'> {
  const { noFallback, ...rest } = req;
  const fallback = noFallback ? undefined : fallbackFor(req.provider);
  return {
    day: localDay(),
    dailyCap: useAiStore.getState().dailyCap,
    ...(fallback ? { fallback } : {}),
    ...rest,
  };
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
    try {
      return await invoke<ChatResponse>('ai_chat', { request: gatewayRequest(req) });
    } catch (e) {
      throw toAiError(e);
    } finally {
      running = false;
      signal?.removeEventListener('abort', onAbort);
    }
  }
  /**
   * `ai_chat_stream`: Rust streams the answer through a channel (reasoning already removed) and
   * returns the final answer. The deltas are provisional (`ShownText`): `onText` always gets the
   * whole text so far, a reset replaces it, and the returned content is the authority, so the
   * last text `onText` gets is the answer. Events that arrive after the call ended are ignored.
   * An older desktop app without the command answers the whole text through `ai_chat` instead.
   */
  async chatStream(
    req: ChatRequest,
    onText: (shown: string) => void,
    signal?: AbortSignal,
  ): Promise<ChatResponse> {
    if (req.jsonSchema !== undefined) return this.chat(req, signal);
    if (signal?.aborted) throw new AiError('cancelled', req.requestId);
    let running = true;
    const onAbort = () => {
      void cancelInRust(req.requestId, () => running);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    const shown = new ShownText(onText);
    const onEvent = new Channel<StreamEvent>((e) => {
      if (running) shown.apply(e);
    });
    try {
      const answer = await invoke<ChatResponse>('ai_chat_stream', {
        request: gatewayRequest(req),
        onEvent,
      });
      shown.settle(answer.content);
      return answer;
    } catch (e) {
      if (shown.started || !isMissingCommand(e)) throw toAiError(e);
    } finally {
      running = false;
      signal?.removeEventListener('abort', onAbort);
    }
    return this.chat(req, signal);
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

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta';
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

function geminiModel(model: string): string {
  return model.trim().replace(/^models\//, '');
}

/** Same body as `gemini_body` in src-tauri/src/ai/gemini.rs. */
function geminiBody(req: ChatRequest): Record<string, unknown> {
  const generationConfig: Record<string, unknown> = {
    temperature: req.temperature ?? 0,
    maxOutputTokens: Math.max(req.maxTokens ?? 2048, 8192),
  };
  if (req.jsonSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseJsonSchema = req.jsonSchema;
  }
  return {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: req.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig,
  };
}

/** Same request as `GeminiProvider::chat_request` in src-tauri/src/ai/gemini.rs. */
async function geminiChat(req: ChatRequest, key: string, http: Http): Promise<Reply> {
  const resp = await http(`${GEMINI_URL}/models/${geminiModel(req.model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(geminiBody(req)),
  });
  if (!resp.ok) throw await httpError(resp);
  const json = (await resp.json()) as {
    candidates?: {
      content?: { parts?: { text?: string; thought?: boolean }[] };
      finishReason?: string;
    }[];
    promptFeedback?: { blockReason?: string };
  };
  const first = json.candidates?.[0];
  const finish = first?.finishReason;
  // A stop by Gemini's own filters is no answer, even with some text (as when streamed).
  if (finish !== undefined && GEMINI_BLOCKED.has(finish)) {
    throw new AiError('badResponse', `empty answer (${finish})`);
  }
  const text = (first?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('');
  if (!text.trim()) {
    const reason = finish ?? json.promptFeedback?.blockReason ?? 'no text';
    throw new AiError('badResponse', `empty answer (${reason})`);
  }
  return { text, truncated: incomplete(finish, 'gemini') };
}

/** Any finish reason but the provider's natural end (`NATURAL_END`), as Rust's `truncated`. */
function incomplete(reason: string | undefined, provider: Provider): boolean {
  return reason !== undefined && !NATURAL_END[provider].includes(reason);
}

async function geminiModels(key: string, http: Http): Promise<string[]> {
  const r = await http('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
    headers: { 'x-goog-api-key': key },
  });
  if (!r.ok) throw new AiError('http', String(r.status));
  const j = (await r.json()) as { models?: { name: string }[] };
  return (j.models ?? []).map((m) => m.name.replace(/^models\//, ''));
}

function claudeHeaders(key: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
  };
}

/** Same body as `claude_body` in src-tauri/src/ai/claude.rs. */
function claudeBody(req: ChatRequest): Record<string, unknown> {
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
  return body;
}

/** Same request as `ClaudeProvider::chat_request` (golden runs from Node). */
async function claudeChat(req: ChatRequest, key: string, http: Http): Promise<Reply> {
  const resp = await http(CLAUDE_URL, {
    method: 'POST',
    headers: claudeHeaders(key),
    body: JSON.stringify(claudeBody(req)),
  });
  if (!resp.ok) throw await httpError(resp);
  const json = (await resp.json()) as {
    content?: { type: string; text?: string; input?: unknown }[];
    stop_reason?: string;
  };
  // A refusal is no answer, even with some text (as when streamed).
  if (json.stop_reason === 'refusal') throw new AiError('badResponse', 'empty answer (refusal)');
  const truncated = incomplete(json.stop_reason, 'claude');
  const blocks = json.content;
  if (!Array.isArray(blocks)) throw new AiError('badResponse', 'missing content');
  const tool = blocks.find((b) => b.type === 'tool_use');
  if (tool) return { text: JSON.stringify(tool.input), truncated };
  const text = blocks.map((b) => (b.type === 'text' ? (b.text ?? '') : '')).join('');
  if (!text.trim()) {
    throw new AiError('badResponse', `empty answer (${json.stop_reason ?? 'no text'})`);
  }
  return { text, truncated };
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
  const resp = await http(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(groqBody(req)),
  });
  if (!resp.ok) throw await httpError(resp);
  const json = (await resp.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
  };
  const choice = json.choices?.[0];
  const finish = choice?.finish_reason;
  // A content-filter stop is no answer, even with some text (as when streamed).
  if (finish === 'content_filter') {
    throw new AiError('badResponse', 'empty answer (content_filter)');
  }
  // The raw answer: reasoning is removed for every provider in `chatOnce` (`visibleAnswer`).
  const text = choice?.message?.content ?? '';
  if (!text.trim()) throw new AiError('badResponse', `empty answer (${finish ?? 'no text'})`);
  return { text, truncated: incomplete(finish, 'groq') };
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

/**
 * The streamed request of a provider, as `stream_request` in src-tauri/src/ai/{gemini,claude,
 * groq}.rs: Gemini `streamGenerateContent?alt=sse`, Claude and Groq with `"stream": true`.
 */
function streamRequest(req: ChatRequest, key: string): { url: string; init: RequestInit } {
  if (req.provider === 'gemini') {
    return {
      url: `${GEMINI_URL}/models/${geminiModel(req.model)}:streamGenerateContent?alt=sse`,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(geminiBody(req)),
      },
    };
  }
  if (req.provider === 'claude') {
    return {
      url: CLAUDE_URL,
      init: {
        method: 'POST',
        headers: claudeHeaders(key),
        body: JSON.stringify({ ...claudeBody(req), stream: true }),
      },
    };
  }
  return {
    url: GROQ_URL,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ ...groqBody(req), stream: true }),
    },
  };
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
  /**
   * Streamed text answer (Gemini and Groq; Claude from Node only), with the gateway's rules: the
   * fallback answers only for a quota error that came before any visible text was shown (leading
   * whitespace is held back) and while enough of the first-text wait is left
   * (`roomForFallback`); no retries (as `chat` here).
   */
  async chatStream(
    req: ChatRequest,
    onText: (shown: string) => void,
    signal?: AbortSignal,
  ): Promise<ChatResponse> {
    if (req.jsonSchema !== undefined) return this.chat(req, signal);
    const fb = req.noFallback ? undefined : fallbackFor(req.provider);
    const fbUsable = fb && this.supported(fb.provider) && !!pageKey(fb.provider);
    const clock = startClock(req.timeoutSecs);
    const progress = { shown: false };
    // Until the first visible text, whitespace is held back (as Rust's `Emitter`): an answer that
    // starts with a newline has shown nothing yet, so the fallback may still answer.
    const emit = (text: string) => {
      if (!progress.shown && text.trim() === '') return;
      progress.shown = true;
      onText(text);
    };
    try {
      return {
        ...(await this.streamOnce(req, clock, emit, signal)),
        provider: req.provider,
        fallback: false,
      };
    } catch (e) {
      // The fallback shares the first-text deadline: with too little of it left it could only
      // time out, so the provider's own quota error is returned instead.
      const switchable = !progress.shown && isQuotaError(e) && roomForFallback(clock);
      if (!fbUsable || !switchable) throw e;
      const answer = await this.streamOnce(
        { ...req, provider: fb.provider, model: fb.model },
        clock,
        emit,
        signal,
      );
      return { ...answer, provider: fb.provider, fallback: true };
    }
  }
  private async streamOnce(
    req: ChatRequest,
    clock: StreamClock,
    emit: (shown: string) => void,
    signal?: AbortSignal,
  ): Promise<ChatResponse> {
    if (!this.supported(req.provider)) throw new AiError('unavailable', 'desktop app only');
    const key = this.key(req.provider);
    if (signal?.aborted) throw new AiError('cancelled', req.requestId);
    const started = performance.now();
    // Aborting closes the connection: on a stop, and when no answer starts before the deadline.
    const ctl = new AbortController();
    const onAbort = () => {
      ctl.abort();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    const deadline = { passed: false };
    const timer = setTimeout(
      () => {
        deadline.passed = true;
        ctl.abort();
      },
      Math.max(0, clock.first - performance.now()),
    );
    try {
      const { url, init } = streamRequest(req, key);
      let resp: Response;
      try {
        resp = await fetch(url, { ...init, signal: ctl.signal });
      } finally {
        clearTimeout(timer);
      }
      if (!resp.ok) throw await httpError(resp);
      if (!resp.body) throw new AiError('badResponse', 'missing content');
      const answer = await readCloudStream(resp.body, req.provider, clock, emit, signal);
      return {
        content: answer.content,
        model: answer.model ?? req.model.trim(),
        durationMs: performance.now() - started,
        truncated: answer.truncated,
      };
    } catch (e) {
      if (signal?.aborted) throw new AiError('cancelled', req.requestId);
      if (deadline.passed) throw expired(clock, false);
      throw toAiError(e);
    } finally {
      signal?.removeEventListener('abort', onAbort);
      ctl.abort();
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
    // As the Rust gateway: the model's reasoning is removed for every provider; an answer that
    // was only reasoning is an error, and a JSON answer to a schema is kept exactly as sent.
    const content = visibleAnswer(reply.text, req.jsonSchema !== undefined);
    if (content === null) throw new AiError('badResponse', 'reasoningOnly');
    if (!content.trim()) throw new AiError('badResponse', 'missing content');
    return {
      content,
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
