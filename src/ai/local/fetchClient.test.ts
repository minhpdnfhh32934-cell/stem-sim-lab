// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserSafety, setSafetyBackendForTests, statusOf } from '@/safety/safety';
import { FetchLocalClient } from './fetchClient';
import type { LocalChatRequest } from './types';

/**
 * The browser client for local runtimes against fake servers: `fetch` is stubbed, so no runtime
 * on this computer is ever contacted. The bodies are the fixtures shared with the Rust tests.
 */
const root = resolve(import.meta.dirname, '../../..');
const fixture = (name: string) =>
  readFileSync(resolve(root, 'src-tauri/tests/fixtures/local-ai', name), 'utf8');
const enc = new TextEncoder();

type Handler = (init: RequestInit) => Response | Promise<Response>;

interface Call {
  key: string;
  init: RequestInit;
}

/** A fake set of servers: "GET http://127.0.0.1:11434/api/version" → answer. */
function servers(routes: Record<string, Handler>): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) => {
    const key = `${init.method ?? 'GET'} ${url}`;
    calls.push({ key, init });
    const handler = routes[key];
    // Nothing listens at that address.
    if (!handler) return Promise.reject(new TypeError('fetch failed'));
    return Promise.resolve(handler(init));
  });
  return calls;
}

const json =
  (body: unknown, status = 200) =>
  () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
const text =
  (body: string, status = 200) =>
  () =>
    new Response(body, { status });

interface Body {
  handler: Handler;
  cancelled: () => boolean;
}

/** A streamed answer cut in `size`-byte chunks; `open` keeps the stream open afterwards. */
function streamed(body: string, size = 7, open = false): Body {
  let cancelled = false;
  const bytes = enc.encode(body);
  return {
    handler: () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(c) {
            for (let i = 0; i < bytes.length; i += size) c.enqueue(bytes.slice(i, i + size));
            if (!open) c.close();
          },
          cancel() {
            cancelled = true;
          },
        }),
      ),
    cancelled: () => cancelled,
  };
}

const sse = (...events: unknown[]) =>
  events.map((e) => `data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`).join('');
const piece = (content: string, finish: string | null = null) => ({
  model: 'gemma.gguf',
  choices: [{ index: 0, delta: { content }, finish_reason: finish }],
});

const OLLAMA = 'http://127.0.0.1:11434';
const LMS = 'http://127.0.0.1:1234';
const LLAMA = 'http://127.0.0.1:8080';

/** A running Ollama with qwen3:8b. */
function ollamaRoutes(chat?: Handler): Record<string, Handler> {
  return {
    [`GET ${OLLAMA}/api/version`]: text(fixture('ollama-version.json')),
    [`GET ${OLLAMA}/api/tags`]: text(fixture('ollama-tags.json')),
    [`POST ${OLLAMA}/api/show`]: text(fixture('ollama-show.json')),
    ...(chat ? { [`POST ${OLLAMA}/api/chat`]: chat } : {}),
  };
}

/** A running llama-server (not Ollama: /api/version is unknown there). */
function llamaRoutes(chat?: Handler): Record<string, Handler> {
  return {
    [`GET ${LLAMA}/props`]: text(fixture('llamacpp-props.json')),
    [`GET ${LLAMA}/health`]: json({ status: 'ok' }),
    [`GET ${LLAMA}/api/version`]: text('Not Found', 404),
    [`GET ${LLAMA}/v1/models`]: text(fixture('llamacpp-models.json')),
    ...(chat ? { [`POST ${LLAMA}/v1/chat/completions`]: chat } : {}),
  };
}

const ask = (over: Partial<LocalChatRequest> = {}): LocalChatRequest => ({
  requestId: 'req-local',
  kind: 'ollama',
  baseUrl: OLLAMA,
  model: 'qwen3:8b',
  system: 'Trả lời ngắn.',
  messages: [{ role: 'user', content: 'Gia tốc là gì?' }],
  ...over,
});

function bodyOf(calls: Call[], key: string): Record<string, unknown> {
  const body = calls.find((c) => c.key === key)?.init.body;
  if (typeof body !== 'string') throw new Error(`no JSON body for ${key}`);
  return JSON.parse(body) as Record<string, unknown>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('browser client for local runtimes', () => {
  it('detects the three usual addresses only, with private requests', async () => {
    const html = text(fixture('html-page.html'));
    const calls = servers({
      ...ollamaRoutes(),
      // Something unrelated on 8080 answers every path with a web page.
      [`GET ${LLAMA}/api/version`]: html,
      [`GET ${LLAMA}/api/v0/models`]: html,
      [`GET ${LLAMA}/props`]: html,
      [`GET ${LLAMA}/v1/models`]: html,
    });
    const probes = await new FetchLocalClient().detect();
    expect(probes).toEqual([
      { expected: 'ollama', kind: 'ollama', baseUrl: OLLAMA, status: 'found', version: '0.12.6' },
      { expected: 'lmStudio', kind: null, baseUrl: LMS, status: 'unreachable', version: null },
      { expected: 'llamaCpp', kind: null, baseUrl: LLAMA, status: 'notRuntime', version: null },
    ]);
    for (const c of calls) {
      expect(c.key).toMatch(/^GET http:\/\/127\.0\.0\.1:(11434|1234|8080)\//);
      expect(c.init).toMatchObject({
        redirect: 'manual',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
    }
    // Nothing answers at 1234: one request, no other way is tried.
    expect(calls.filter((c) => c.key.includes(':1234/'))).toHaveLength(1);
  });

  it('identifies a typed address, and refuses one off this computer without a request', async () => {
    const calls = servers(llamaRoutes());
    const p = await new FetchLocalClient().probe('  HTTP://127.0.0.1:8080/v1/ ');
    expect(p).toEqual({
      expected: null,
      kind: 'llamaCpp',
      baseUrl: LLAMA,
      status: 'found',
      version: 'b6700-1a2b3c4d',
    });
    calls.length = 0;
    await expect(new FetchLocalClient().probe('http://192.168.1.5:11434')).rejects.toMatchObject({
      code: 'notAllowed',
      message: 'not-loopback',
    });
    expect(calls).toEqual([]);
  });

  it('lists models, through /v1/models when LM Studio has no /api/v0', async () => {
    servers({
      [`GET ${LMS}/api/version`]: text('Not Found', 404),
      [`GET ${LMS}/api/v0/models`]: json({ error: 'Unexpected endpoint' }),
      [`GET ${LMS}/v1/models`]: text(fixture('openai-models.json')),
    });
    const list = await new FetchLocalClient().models('lmStudio', LMS);
    expect(list.more).toBe(false);
    expect(list.models.map((m) => m.id)).toEqual(['qwen2.5-7b-instruct', 'phi-4-mini']);
  });

  it('an Ollama address is only used as Ollama', async () => {
    const calls = servers({
      ...ollamaRoutes(),
      [`GET ${OLLAMA}/v1/models`]: text(fixture('openai-models.json')),
    });
    const client = new FetchLocalClient();
    await expect(client.models('openAiCompatible', OLLAMA)).rejects.toMatchObject({
      code: 'badResponse',
      message: 'not-runtime: ollama',
    });
    expect(calls.map((c) => c.key)).toEqual([`GET ${OLLAMA}/api/version`]);
    const t = await client.test('openAiCompatible', OLLAMA, 'qwen3:8b');
    expect(t).toMatchObject({ status: 'notRuntime', detail: 'ollama' });
    expect(calls.some((c) => c.key.includes('/chat'))).toBe(false);
  });

  it('reads model details: Ollama /api/show, llama.cpp /props and /health', async () => {
    const calls = servers({ ...ollamaRoutes(), ...llamaRoutes() });
    const client = new FetchLocalClient();
    const d = await client.modelInfo('ollama', OLLAMA, 'qwen3:8b');
    expect(d).toMatchObject({ contextLength: 40960, thinking: 'yes', remote: false });
    expect(bodyOf(calls, `POST ${OLLAMA}/api/show`)).toEqual({ model: 'qwen3:8b' });
    const l = await client.modelInfo('llamaCpp', LLAMA, 'gemma-3-4b-it-Q4_K_M.gguf');
    expect(l).toMatchObject({ contextLength: 4096, loaded: true, vision: 'no' });
    expect(l.capabilities.loadState).toBe('yes');
  });

  it('streams an Ollama answer cut anywhere, with num_ctx, think and the final text', async () => {
    const body = streamed(fixture('ollama-chat.ndjson'), 5);
    const calls = servers(ollamaRoutes(body.handler));
    const partials: string[] = [];
    const r = await new FetchLocalClient().chat(ask({ think: false, temperature: 0.2 }), {
      onPartial: (t) => partials.push(t),
    });
    expect(r).toMatchObject({
      content: 'Gia tốc a = 2 m/s², lớn dần.',
      model: 'qwen3:8b',
      runtime: 'ollama',
      truncated: false,
      streamed: true,
    });
    expect(r.firstPieceMs).not.toBeNull();
    expect(partials.at(-1)).toBe(r.content);
    expect(partials.length).toBeGreaterThan(2);
    for (const p of partials) expect(r.content.startsWith(p)).toBe(true);
    const sent = bodyOf(calls, `POST ${OLLAMA}/api/chat`);
    // The model's own context (40960) is larger than the default asked for (8192).
    expect(sent).toMatchObject({
      stream: true,
      think: false,
      options: { num_ctx: 8192, num_predict: 2048, temperature: 0.2 },
    });
    // Identified first, checked second, asked last; never anything else.
    expect(calls.map((c) => c.key)).toEqual([
      `GET ${OLLAMA}/api/version`,
      `POST ${OLLAMA}/api/show`,
      `POST ${OLLAMA}/api/chat`,
    ]);
  });

  it('never shows reasoning, also when its tags are cut between chunks', async () => {
    const answer = sse(
      piece('<thi'),
      piece('nk>BÍ MẬT: thử 3 kg</th'),
      piece('ink>Lực là '),
      piece('đại lượng vectơ.', 'stop'),
      '[DONE]',
    );
    for (const size of [1, 3, 8, 64]) {
      servers(llamaRoutes(streamed(answer, size).handler));
      const partials: string[] = [];
      const r = await new FetchLocalClient().chat(
        ask({ kind: 'llamaCpp', baseUrl: LLAMA, model: 'gemma.gguf' }),
        { onPartial: (t) => partials.push(t) },
      );
      expect(r.content).toBe('Lực là đại lượng vectơ.');
      expect(r.truncated).toBe(false);
      for (const p of partials) {
        expect(p).not.toContain('BÍ MẬT');
        expect(p).not.toContain('<');
        expect(p).not.toContain('�');
      }
    }
  });

  it('a late closing tag takes back what was shown; the final content wins', async () => {
    const answer = sse(piece('Mình nhẩm 3*4=12 rồi'), piece('</think>Đáp số 12', 'stop'));
    servers(llamaRoutes(streamed(answer, 4096).handler));
    const partials: string[] = [];
    const r = await new FetchLocalClient().chat(
      ask({ kind: 'llamaCpp', baseUrl: LLAMA, model: 'gemma.gguf' }),
      { onPartial: (t) => partials.push(t) },
    );
    expect(partials).toEqual(['Mình nhẩm 3*4=12 rồi', 'Đáp số 12']);
    expect(r.content).toBe('Đáp số 12');
  });

  it('marks an answer cut at the output limit, or without its end mark, as incomplete', async () => {
    servers(llamaRoutes(streamed(sse(piece('Vậy a = 5'), piece(' m/s².', 'length'))).handler));
    const req = ask({ kind: 'llamaCpp', baseUrl: LLAMA, model: 'gemma.gguf' });
    expect((await new FetchLocalClient().chat(req)).truncated).toBe(true);
    servers(llamaRoutes(streamed(sse(piece('Vậy a = 5 m/s².'))).handler));
    expect(await new FetchLocalClient().chat(req)).toMatchObject({
      content: 'Vậy a = 5 m/s².',
      truncated: true,
    });
    servers(llamaRoutes(streamed(sse(piece('<think>chỉ có nháp</think>', 'stop'))).handler));
    await expect(new FetchLocalClient().chat(req)).rejects.toMatchObject({
      code: 'badResponse',
      message: 'reasoningOnly',
    });
  });

  it('"Dừng" closes the connection and rejects as cancelled', async () => {
    const body = streamed(sse(piece('Lực ')), 4096, true);
    servers(llamaRoutes(body.handler));
    const ctl = new AbortController();
    const partials: string[] = [];
    const pending = new FetchLocalClient().chat(
      ask({ kind: 'llamaCpp', baseUrl: LLAMA, model: 'gemma.gguf' }),
      {
        signal: ctl.signal,
        onPartial: (t) => {
          partials.push(t);
          ctl.abort();
        },
      },
    );
    await expect(pending).rejects.toMatchObject({ code: 'cancelled', message: 'req-local' });
    expect(partials).toEqual(['Lực ']);
    expect(body.cancelled()).toBe(true);
  });

  it('never asks about a cloud model, and refuses a copied one before the question', async () => {
    const calls = servers(ollamaRoutes(streamed(fixture('ollama-chat.ndjson')).handler));
    const client = new FetchLocalClient();
    await expect(client.chat(ask({ model: 'gpt-oss:120b-cloud' }))).rejects.toMatchObject({
      code: 'notAllowed',
      message: 'remote-model',
    });
    expect(calls).toEqual([]);
    // A cloud model copied under a local-looking name: Ollama's details still say remote.
    const later = servers({
      ...ollamaRoutes(streamed(fixture('ollama-chat.ndjson')).handler),
      [`POST ${OLLAMA}/api/show`]: text(fixture('ollama-show-remote.json')),
    });
    await expect(client.chat(ask({ model: 'my-copy:latest' }))).rejects.toMatchObject({
      code: 'notAllowed',
      message: 'remote-model',
    });
    expect(later.some((c) => c.key.endsWith('/api/chat'))).toBe(false);
  });

  it('sends nothing while the safety gate is closed or to an address off this computer', async () => {
    const calls = servers(ollamaRoutes(streamed(fixture('ollama-chat.ndjson')).handler));
    const client = new FetchLocalClient();
    await expect(client.chat(ask({ baseUrl: 'http://10.0.0.2:11434' }))).rejects.toMatchObject({
      code: 'notAllowed',
      message: 'not-loopback',
    });
    class Closed extends BrowserSafety {
      override status() {
        return Promise.resolve(statusOf({}));
      }
    }
    setSafetyBackendForTests(new Closed());
    await expect(client.chat(ask())).rejects.toMatchObject({ code: 'notAllowed' });
    await expect(client.detect()).rejects.toMatchObject({ code: 'notAllowed' });
    expect(await client.test('ollama', OLLAMA, 'qwen3:8b')).toMatchObject({
      status: 'notAllowed',
    });
    expect(calls).toEqual([]);
  });

  it('stall timers: no first piece, then a gap between pieces', async () => {
    const client = new FetchLocalClient({ firstPieceMs: 60, gapMs: 40 });
    const req = ask({ kind: 'llamaCpp', baseUrl: LLAMA, model: 'gemma.gguf' });
    servers(llamaRoutes(streamed('', 1, true).handler));
    await expect(client.chat(req)).rejects.toMatchObject({
      code: 'timeout',
      message: 'local-stalled: first-piece 60 ms',
    });
    servers(llamaRoutes(streamed(sse(piece('Lực')), 4096, true).handler));
    const partials: string[] = [];
    await expect(client.chat(req, { onPartial: (t) => partials.push(t) })).rejects.toMatchObject({
      code: 'timeout',
      message: 'local-stalled: gap 40 ms',
    });
    expect(partials).toEqual(['Lực']);
  });

  it('maps runtime refusals: model missing, loading, a key, a redirect, a too-large answer', async () => {
    const req = ask({ kind: 'llamaCpp', baseUrl: LLAMA, model: 'gemma.gguf' });
    const client = new FetchLocalClient();
    const failWith = (h: Handler) => {
      servers(llamaRoutes(h));
      return client.chat(req);
    };
    await expect(failWith(text('{"error":{"message":"model not found"}}', 404))).rejects.toThrow(
      /^model-missing: 404/,
    );
    await expect(failWith(text('{"error":{"message":"Loading model"}}', 503))).rejects.toThrow(
      /^loading: 503/,
    );
    await expect(failWith(text('secret', 401))).rejects.toThrow('needs-auth: 401');
    await expect(
      failWith(() => new Response(null, { status: 307, headers: { Location: 'http://x.y/' } })),
    ).rejects.toThrow('local-failed: 307: redirect not followed');
    servers(llamaRoutes(streamed(sse(piece('0123456789ABC', 'stop'))).handler));
    await expect(new FetchLocalClient({ maxAnswerBytes: 10 }).chat(req)).rejects.toThrow(
      'too-large: answer over 10 bytes',
    );
    servers({ [`GET ${LLAMA}/props`]: text('Loading model', 503) });
    expect(await client.test('llamaCpp', LLAMA, 'gemma.gguf')).toMatchObject({
      status: 'loading',
    });
  });

  it('"Kiểm tra trả lời": a tiny streamed answer; nothing answering is unreachable', async () => {
    const calls = servers(ollamaRoutes(streamed(fixture('ollama-chat.ndjson'), 64).handler));
    const t = await new FetchLocalClient().test('ollama', OLLAMA, 'qwen3:8b');
    expect(t).toMatchObject({ status: 'ok', streamed: true, detail: '' });
    expect(t.firstPieceMs).not.toBeNull();
    expect(bodyOf(calls, `POST ${OLLAMA}/api/chat`)).toMatchObject({
      options: { num_predict: 8 },
      think: false,
    });
    servers({});
    expect(await new FetchLocalClient().test('ollama', OLLAMA, 'qwen3:8b')).toMatchObject({
      status: 'unreachable',
    });
  });
});
