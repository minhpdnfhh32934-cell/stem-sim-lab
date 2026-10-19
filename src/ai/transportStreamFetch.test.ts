// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAiStore } from './aiStore';
import { getTransport } from './transport';
import type { ChatRequest } from './types';

/**
 * Streamed cloud answers without the desktop app (development and the end-to-end tests): the
 * browser transport reads the providers' server-sent events itself. `fetch` is a fake; the
 * bodies are the hand-written fixtures of src-tauri/tests/fixtures/cloud-ai.
 */
const enc = new TextEncoder();

function fixture(name: string): string {
  return readFileSync(
    resolve(import.meta.dirname, '../../src-tauri/tests/fixtures/cloud-ai', name),
    'utf8',
  );
}

/** One SSE event per JSON object. */
function sse(...events: unknown[]): string {
  return events.map((e) => `data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`).join('');
}

/** The bytes of `text` cut every `size` bytes (inside characters and tags too). */
function chunks(text: string, size: number): Uint8Array[] {
  const bytes = enc.encode(text);
  const out: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += size) out.push(bytes.subarray(i, i + size));
  return out;
}

interface Body {
  response: Response;
  cancelled: () => boolean;
}

/** A streamed answer; `open` leaves the stream open after the chunks. */
function streamed(parts: Uint8Array[], open = false): Body {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const p of parts) c.enqueue(p);
      if (!open) c.close();
    },
    cancel() {
      cancelled = true;
    },
  });
  return {
    response: new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }),
    cancelled: () => cancelled,
  };
}

const base: ChatRequest = {
  requestId: 'r',
  provider: 'gemini',
  model: ' gemini-3.8-flash ',
  system: 'sys',
  messages: [{ role: 'user', content: 'Gia tốc là gì?' }],
  temperature: 0.2,
  maxTokens: 512,
};

function chatStream() {
  const t = getTransport();
  if (!t.chatStream) throw new Error('chatStream missing');
  return t.chatStream.bind(t);
}

afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.__STEMSIM_TEST_GEMINI_KEY__ = undefined;
  globalThis.__STEMSIM_TEST_GROQ_KEY__ = undefined;
  globalThis.__STEMSIM_TEST_CLAUDE_KEY__ = undefined;
});

const gemini = (text: string, extra: Record<string, unknown> = {}) => ({
  candidates: [{ content: { parts: [{ text }], role: 'model' }, index: 0, ...extra }],
  modelVersion: 'gemini-3.8-flash-001',
});

describe('browser transport: streamed answers', () => {
  it('Gemini: streamGenerateContent with alt=sse, characters and think tags cut anywhere', async () => {
    globalThis.__STEMSIM_TEST_GEMINI_KEY__ = 'g';
    const body = sse(
      gemini('<thi'),
      gemini('nk>BÍ MẬT: thử 3 kg</th'),
      gemini('ink>Gia tốc '),
      gemini('a = Δv/Δt.', { finishReason: 'STOP' }),
    );
    // Every chunk size, including cuts inside "ố", "Δ" and the tags.
    for (const size of [1, 2, 3, 5, 7, 64]) {
      const fetch = vi.fn((_url: string, _init: RequestInit) =>
        Promise.resolve(streamed(chunks(body, size)).response),
      );
      vi.stubGlobal('fetch', fetch);
      const shown: string[] = [];
      const r = await chatStream()(base, (t) => shown.push(t));
      expect(r).toMatchObject({
        content: 'Gia tốc a = Δv/Δt.',
        model: 'gemini-3.8-flash-001',
        provider: 'gemini',
        fallback: false,
        truncated: false,
      });
      expect(shown.at(-1)).toBe('Gia tốc a = Δv/Δt.');
      for (const s of shown) {
        expect(s).not.toContain('BÍ MẬT');
        expect(s).not.toContain('<');
        expect(s).not.toContain('�');
      }
      const [url, init] = fetch.mock.calls[0]!;
      expect(url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:streamGenerateContent?alt=sse',
      );
      expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('g');
      const sent = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(sent).toMatchObject({
        systemInstruction: { parts: [{ text: 'sys' }] },
        contents: [{ role: 'user', parts: [{ text: 'Gia tốc là gì?' }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
      });
    }
  });

  it('reads the Gemini, Groq and Claude fixtures (thoughts left out)', async () => {
    const cases = [
      [
        'gemini',
        'gemini-stream.sse',
        'Gia tốc là độ biến thiên vận tốc theo thời gian: a = Δv/Δt.',
      ],
      ['groq', 'groq-stream.sse', 'Vận tốc là đại lượng vectơ.'],
      ['claude', 'claude-stream.sse', 'Lực là đại lượng vectơ.'],
    ] as const;
    globalThis.__STEMSIM_TEST_GEMINI_KEY__ = 'g';
    globalThis.__STEMSIM_TEST_GROQ_KEY__ = 'q';
    globalThis.__STEMSIM_TEST_CLAUDE_KEY__ = 'c';
    for (const [provider, file, text] of cases) {
      const fetch = vi.fn((_url: string, _init: RequestInit) =>
        Promise.resolve(streamed(chunks(fixture(file), 11)).response),
      );
      vi.stubGlobal('fetch', fetch);
      const r = await chatStream()({ ...base, provider, model: 'm' }, () => undefined);
      expect(r.content, provider).toBe(text);
      expect(r.truncated, provider).toBe(false);
      const sent = JSON.parse(fetch.mock.calls[0]![1].body as string) as Record<string, unknown>;
      if (provider !== 'gemini') expect(sent.stream).toBe(true);
    }
  });

  it('an answer cut at the output limit or without its end mark is incomplete', async () => {
    globalThis.__STEMSIM_TEST_GROQ_KEY__ = 'q';
    const groq = (content: string, finish: string | null = null) => ({
      model: 'qwen/qwen3.8-27b',
      choices: [{ index: 0, delta: { content }, finish_reason: finish }],
    });
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        streamed([
          enc.encode(sse(groq('Vậy a = 5 m/s². <think>Mình kiểm'), groq(' tra', 'length'))),
        ]).response,
      ),
    );
    const r = await chatStream()({ ...base, provider: 'groq' }, () => undefined);
    expect(r).toMatchObject({
      content: 'Vậy a = 5 m/s².',
      truncated: true,
      model: 'qwen/qwen3.8-27b',
    });
    vi.stubGlobal('fetch', () =>
      Promise.resolve(streamed([enc.encode(sse(groq('Gia tốc')))]).response),
    );
    expect((await chatStream()({ ...base, provider: 'groq' }, () => undefined)).truncated).toBe(
      true,
    );
  });

  it('only reasoning, a filter stop and an error inside the stream are errors', async () => {
    globalThis.__STEMSIM_TEST_GEMINI_KEY__ = 'g';
    globalThis.__STEMSIM_TEST_CLAUDE_KEY__ = 'c';
    const run = (provider: ChatRequest['provider'], body: string) => {
      vi.stubGlobal('fetch', () => Promise.resolve(streamed([enc.encode(body)]).response));
      return chatStream()({ ...base, provider, noFallback: true }, () => undefined);
    };
    await expect(
      run('gemini', sse(gemini('<think>chỉ có nháp</think>', { finishReason: 'STOP' }))),
    ).rejects.toMatchObject({ code: 'badResponse', message: 'reasoningOnly' });
    const shown: string[] = [];
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        streamed([enc.encode(sse(gemini('Một phần'), gemini('', { finishReason: 'SAFETY' })))])
          .response,
      ),
    );
    await expect(chatStream()(base, (t) => shown.push(t))).rejects.toMatchObject({
      code: 'badResponse',
      message: 'empty answer (SAFETY)',
    });
    expect(shown).toEqual(['Một phần']);
    const overloaded =
      'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n\n';
    await expect(run('claude', overloaded)).rejects.toMatchObject({
      code: 'http',
      message: '529: overloaded_error: Overloaded',
    });
  });

  it('a quota error before any text goes to the fallback; HTTP errors keep their status', async () => {
    globalThis.__STEMSIM_TEST_GEMINI_KEY__ = 'g';
    globalThis.__STEMSIM_TEST_GROQ_KEY__ = 'q';
    useAiStore.setState({ fallback: 'groq', models: { gemini: '', claude: '', groq: '' } });
    const urls: string[] = [];
    vi.stubGlobal('fetch', (url: string) => {
      urls.push(url);
      if (url.includes('generativelanguage')) {
        return Promise.resolve(
          new Response('{"error":{"status":"RESOURCE_EXHAUSTED"}}', { status: 429 }),
        );
      }
      return Promise.resolve(streamed(chunks(fixture('groq-stream.sse'), 9)).response);
    });
    const r = await chatStream()(base, () => undefined);
    expect(r).toMatchObject({ provider: 'groq', fallback: true });
    expect(r.content).toBe('Vận tốc là đại lượng vectơ.');
    expect(urls).toHaveLength(2);
    // Without the fallback the provider's own error comes back.
    urls.length = 0;
    await expect(
      chatStream()({ ...base, noFallback: true }, () => undefined),
    ).rejects.toMatchObject({ code: 'http', message: expect.stringMatching(/^429: /) as string });
    expect(urls).toHaveLength(1);
  });

  it('a stop while streaming cancels the body and rejects as cancelled', async () => {
    globalThis.__STEMSIM_TEST_GEMINI_KEY__ = 'g';
    const body = streamed([enc.encode(sse(gemini('Gia tốc ')))], true);
    vi.stubGlobal('fetch', () => Promise.resolve(body.response));
    const ctl = new AbortController();
    const shown: string[] = [];
    const pending = chatStream()(
      { ...base, noFallback: true },
      (t) => {
        shown.push(t);
        ctl.abort();
      },
      ctl.signal,
    );
    await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
    expect(shown).toEqual(['Gia tốc ']);
    expect(body.cancelled()).toBe(true);
  });
});

/** Claude's server-sent events (`event:` names and JSON data). */
function claudeSse(...events: Record<string, unknown>[]): string {
  return events.map((e) => `event: ${String(e.type)}\ndata: ${JSON.stringify(e)}\n\n`).join('');
}

const claudeText = (text: string) => ({
  type: 'content_block_delta',
  index: 0,
  delta: { type: 'text_delta', text },
});
const claudeStop = (stop_reason: string) => ({ type: 'message_delta', delta: { stop_reason } });

describe('browser transport: the Rust streaming rules (review 2026-10-15)', () => {
  it('every finish reason but the natural end marks a streamed answer incomplete', async () => {
    globalThis.__STEMSIM_TEST_GEMINI_KEY__ = 'g';
    globalThis.__STEMSIM_TEST_CLAUDE_KEY__ = 'c';
    globalThis.__STEMSIM_TEST_GROQ_KEY__ = 'q';
    const groq = (content: string, finish: string | null) => ({
      choices: [{ index: 0, delta: { content }, finish_reason: finish }],
    });
    const cases: [ChatRequest['provider'], string, boolean][] = [
      ['gemini', sse(gemini('Bước 1', { finishReason: 'OTHER' })), true],
      ['gemini', sse(gemini('Bước 1', { finishReason: 'LANGUAGE' })), true],
      ['gemini', sse(gemini('Bước 1', { finishReason: 'STOP' })), false],
      [
        'claude',
        claudeSse(claudeText('Bước 1'), claudeStop('model_context_window_exceeded')),
        true,
      ],
      ['claude', claudeSse(claudeText('Bước 1'), claudeStop('stop_sequence')), false],
      ['claude', claudeSse(claudeText('Bước 1'), claudeStop('end_turn')), false],
      ['groq', sse(groq('Bước 1', 'tool_calls'), '[DONE]'), true],
      ['groq', sse(groq('Bước 1', 'stop'), '[DONE]'), false],
    ];
    for (const [provider, body, truncated] of cases) {
      vi.stubGlobal('fetch', () => Promise.resolve(streamed([enc.encode(body)]).response));
      const r = await chatStream()({ ...base, provider, noFallback: true }, () => undefined);
      expect(r.content, body).toBe('Bước 1');
      expect(r.truncated, body).toBe(truncated);
    }
  });

  it('whitespace before the first visible text is no shown answer: the fallback may answer', async () => {
    globalThis.__STEMSIM_TEST_GEMINI_KEY__ = 'g';
    globalThis.__STEMSIM_TEST_GROQ_KEY__ = 'q';
    useAiStore.setState({ fallback: 'groq', models: { gemini: '', claude: '', groq: '' } });
    const urls: string[] = [];
    vi.stubGlobal('fetch', (url: string) => {
      urls.push(url);
      if (url.includes('generativelanguage')) {
        const body = sse(gemini('\n'), {
          error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' },
        });
        return Promise.resolve(streamed([enc.encode(body)]).response);
      }
      return Promise.resolve(streamed(chunks(fixture('groq-stream.sse'), 9)).response);
    });
    const shown: string[] = [];
    const r = await chatStream()(base, (t) => shown.push(t));
    expect(r).toMatchObject({ provider: 'groq', fallback: true });
    expect(r.content).toBe('Vận tốc là đại lượng vectơ.');
    expect(urls).toHaveLength(2);
    // The newline was never shown.
    expect(shown.every((s) => s.trim() !== '')).toBe(true);
  });

  it('a provider error after the end mark keeps the complete answer', async () => {
    globalThis.__STEMSIM_TEST_GEMINI_KEY__ = 'g';
    globalThis.__STEMSIM_TEST_CLAUDE_KEY__ = 'c';
    const overloaded =
      'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n\n';
    const run = (provider: ChatRequest['provider'], body: string) => {
      vi.stubGlobal('fetch', () => Promise.resolve(streamed([enc.encode(body)]).response));
      return chatStream()({ ...base, provider, noFallback: true }, () => undefined);
    };
    await expect(
      run('claude', claudeSse(claudeText('Lực'), claudeStop('end_turn')) + overloaded),
    ).resolves.toMatchObject({ content: 'Lực', truncated: false });
    await expect(
      run(
        'gemini',
        sse(gemini('Lực là vectơ.', { finishReason: 'STOP' }), {
          error: { code: 503, status: 'UNAVAILABLE', message: 'overloaded' },
        }),
      ),
    ).resolves.toMatchObject({ content: 'Lực là vectơ.', truncated: false });
    // Before the end mark it is still the error it stands for.
    await expect(run('claude', claudeSse(claudeText('Lực')) + overloaded)).rejects.toMatchObject({
      code: 'http',
      message: '529: overloaded_error: Overloaded',
    });
  });

  it('the fallback is asked only while enough of the first-text wait is left', async () => {
    globalThis.__STEMSIM_TEST_GEMINI_KEY__ = 'g';
    globalThis.__STEMSIM_TEST_GROQ_KEY__ = 'q';
    useAiStore.setState({ fallback: 'groq', models: { gemini: '', claude: '', groq: '' } });
    const urls: string[] = [];
    vi.stubGlobal('fetch', (url: string) => {
      urls.push(url);
      if (url.includes('generativelanguage')) {
        return Promise.resolve(
          new Response('{"error":{"status":"RESOURCE_EXHAUSTED"}}', { status: 429 }),
        );
      }
      return Promise.resolve(streamed(chunks(fixture('groq-stream.sse'), 9)).response);
    });
    // A 5 s wait: the fallback needs a quarter of it (1,25 s) left.
    const now = vi.spyOn(performance, 'now');
    try {
      now.mockReturnValueOnce(1000).mockReturnValue(1000 + 4000);
      await expect(
        chatStream()({ ...base, timeoutSecs: 5 }, () => undefined),
      ).rejects.toMatchObject({ code: 'http', message: expect.stringMatching(/^429: /) as string });
      expect(urls).toHaveLength(1);
      urls.length = 0;
      now.mockReset();
      now.mockReturnValueOnce(1000).mockReturnValue(1000 + 3000);
      const r = await chatStream()({ ...base, timeoutSecs: 5 }, () => undefined);
      expect(r).toMatchObject({ provider: 'groq', fallback: true });
      expect(urls).toHaveLength(2);
    } finally {
      now.mockRestore();
    }
  });
});

describe('browser transport: whole answers follow the gateway (review 2026-10-15)', () => {
  const answer = (body: unknown) => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(JSON.stringify(body))));
  };
  const chat = (req: Partial<ChatRequest> = {}) =>
    getTransport().chat({ ...base, noFallback: true, ...req });

  it('a filter stop is no answer, even with some text', async () => {
    globalThis.__STEMSIM_TEST_GEMINI_KEY__ = 'g';
    globalThis.__STEMSIM_TEST_CLAUDE_KEY__ = 'c';
    globalThis.__STEMSIM_TEST_GROQ_KEY__ = 'q';
    answer({
      candidates: [{ content: { parts: [{ text: 'Một phần' }] }, finishReason: 'SAFETY' }],
    });
    await expect(chat()).rejects.toMatchObject({ message: 'empty answer (SAFETY)' });
    answer({ promptFeedback: { blockReason: 'PROHIBITED_CONTENT' } });
    await expect(chat()).rejects.toMatchObject({ message: 'empty answer (PROHIBITED_CONTENT)' });
    answer({ content: [{ type: 'text', text: 'Một phần' }], stop_reason: 'refusal' });
    await expect(chat({ provider: 'claude' })).rejects.toMatchObject({
      message: 'empty answer (refusal)',
    });
    answer({ choices: [{ message: { content: 'Một phần' }, finish_reason: 'content_filter' }] });
    await expect(chat({ provider: 'groq' })).rejects.toMatchObject({
      message: 'empty answer (content_filter)',
    });
  });

  it('every finish reason but the natural end marks a whole answer incomplete', async () => {
    globalThis.__STEMSIM_TEST_GEMINI_KEY__ = 'g';
    globalThis.__STEMSIM_TEST_CLAUDE_KEY__ = 'c';
    globalThis.__STEMSIM_TEST_GROQ_KEY__ = 'q';
    const gem = (finishReason: string) => ({
      candidates: [{ content: { parts: [{ text: 'Bước 1' }] }, finishReason }],
    });
    for (const [reason, truncated] of [
      ['OTHER', true],
      ['MAX_TOKENS', true],
      ['STOP', false],
    ] as const) {
      answer(gem(reason));
      expect((await chat()).truncated, reason).toBe(truncated);
    }
    answer({ content: [{ type: 'text', text: 'Bước 1' }], stop_reason: 'pause_turn' });
    expect((await chat({ provider: 'claude' })).truncated).toBe(true);
    answer({ content: [{ type: 'text', text: 'Bước 1' }], stop_reason: 'stop_sequence' });
    expect((await chat({ provider: 'claude' })).truncated).toBe(false);
  });

  it('reasoning is removed for every provider with the shared rule', async () => {
    globalThis.__STEMSIM_TEST_GEMINI_KEY__ = 'g';
    globalThis.__STEMSIM_TEST_GROQ_KEY__ = 'q';
    const gem = (text: string) => ({
      candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }],
    });
    answer(gem('<think>thử 3 kg</think>Đáp số 12 N.'));
    expect((await chat()).content).toBe('Đáp số 12 N.');
    answer(gem('<think>chỉ có nháp</think>'));
    await expect(chat()).rejects.toMatchObject({ code: 'badResponse', message: 'reasoningOnly' });
    // A tag written as code is code (the old Groq-only rule cut it).
    answer({
      choices: [
        { message: { content: 'Qwen dùng thẻ `<think>` để nháp.' }, finish_reason: 'stop' },
      ],
    });
    expect((await chat({ provider: 'groq' })).content).toBe('Qwen dùng thẻ `<think>` để nháp.');
    // A JSON answer to a schema is kept exactly, "</think>" in a value included.
    const json = '{"note":"thẻ </think> là dữ liệu"}';
    answer(gem(json));
    expect((await chat({ jsonSchema: { type: 'object' } })).content).toBe(json);
  });
});
