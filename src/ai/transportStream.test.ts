import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiStore } from './aiStore';
import type { ChatRequest, StreamEvent } from './types';

/**
 * Streamed cloud answers in the desktop app (`ai_chat_stream`). No Rust here: `invoke` and
 * `Channel` are fakes that behave like the command in src-tauri/src/ai/mod.rs.
 */
interface FakeChannel {
  onmessage: (e: StreamEvent) => void;
}
const tauri = vi.hoisted(() => ({
  calls: [] as { cmd: string; args: Record<string, unknown> }[],
  handler: (_cmd: string, _args: Record<string, unknown>): Promise<unknown> =>
    Promise.resolve(null),
}));
vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: (cmd: string, args: Record<string, unknown> = {}) => {
    tauri.calls.push({ cmd, args });
    return tauri.handler(cmd, args);
  },
  Channel: class {
    onmessage: (e: unknown) => void;
    constructor(onmessage?: (e: unknown) => void) {
      this.onmessage = onmessage ?? (() => undefined);
    }
  },
}));

const { getTransport } = await import('./transport');

const request: ChatRequest = {
  requestId: 'req-1',
  provider: 'gemini',
  model: 'gemini-model',
  system: 'Trả lời ngắn.',
  messages: [{ role: 'user', content: 'Lực là gì?' }],
  temperature: 0.2,
  maxTokens: 64,
};

const answer = {
  content: 'Lực là đại lượng vectơ.',
  model: 'm',
  durationMs: 1,
  provider: 'gemini',
};

function channelOf(args: Record<string, unknown>): FakeChannel {
  return args.onEvent as FakeChannel;
}

function stream() {
  const t = getTransport();
  if (!t.chatStream) throw new Error('chatStream missing');
  return t.chatStream.bind(t);
}

beforeEach(() => {
  tauri.calls.length = 0;
  useAiStore.setState({ fallback: 'groq', dailyCap: 100 });
});

describe('desktop streamed cloud answer', () => {
  it('shows the deltas in order, takes text back on a reset and returns the final answer', async () => {
    tauri.handler = (cmd, args) => {
      if (cmd !== 'ai_chat_stream') return Promise.resolve(null);
      const ch = channelOf(args);
      ch.onmessage({ kind: 'delta', text: 'Người dùng hỏi' });
      ch.onmessage({ kind: 'reset', text: 'Lực là' });
      ch.onmessage({ kind: 'delta', text: ' đại lượng vectơ.' });
      return Promise.resolve(answer);
    };
    const shown: string[] = [];
    const r = await stream()(request, (t) => shown.push(t));
    expect(shown).toEqual(['Người dùng hỏi', 'Lực là', 'Lực là đại lượng vectơ.']);
    expect(r.content).toBe('Lực là đại lượng vectơ.');
    const call = tauri.calls.find((c) => c.cmd === 'ai_chat_stream');
    // Counted against the daily cap, with the quota fallback, like ai_chat.
    expect(call?.args.request).toMatchObject({
      requestId: 'req-1',
      dailyCap: 100,
      fallback: { provider: 'groq' },
    });
    expect(call?.args.request).not.toHaveProperty('noFallback');
  });

  it('treats deltas as provisional: a reset replaces the text and the final content wins', async () => {
    // Rust sends text before an orphan closing reasoning tag as a delta, then takes it back.
    tauri.handler = (cmd, args) => {
      if (cmd !== 'ai_chat_stream') return Promise.resolve(null);
      const ch = channelOf(args);
      ch.onmessage({ kind: 'delta', text: 'Mình nhẩm 3*4=12 rồi' });
      ch.onmessage({ kind: 'reset', text: 'Đáp số' });
      // The returned content is the answer, even when the last event did not arrive.
      return Promise.resolve({ ...answer, content: 'Đáp số 12.' });
    };
    const shown: string[] = [];
    const r = await stream()(request, (t) => shown.push(t));
    expect(shown).toEqual(['Mình nhẩm 3*4=12 rồi', 'Đáp số', 'Đáp số 12.']);
    expect(r.content).toBe('Đáp số 12.');
    // Nothing more is said when the events already showed the final text.
    tauri.handler = (cmd, args) => {
      if (cmd !== 'ai_chat_stream') return Promise.resolve(null);
      channelOf(args).onmessage({ kind: 'reset', text: 'Đáp số 12.' });
      return Promise.resolve({ ...answer, content: 'Đáp số 12.' });
    };
    shown.length = 0;
    await stream()(request, (t) => shown.push(t));
    expect(shown).toEqual(['Đáp số 12.']);
  });

  it('sends no fallback when asked, and ignores events after the call ended', async () => {
    let late: FakeChannel | null = null;
    tauri.handler = (cmd, args) => {
      if (cmd !== 'ai_chat_stream') return Promise.resolve(null);
      late = channelOf(args);
      late.onmessage({ kind: 'delta', text: answer.content });
      return Promise.resolve(answer);
    };
    const shown: string[] = [];
    await stream()({ ...request, noFallback: true }, (t) => shown.push(t));
    (late as FakeChannel | null)?.onmessage({ kind: 'delta', text: ' B' });
    expect(shown).toEqual([answer.content]);
    expect(tauri.calls[0]?.args.request).not.toHaveProperty('fallback');
  });

  it('a stop before sending sends nothing; a stop while streaming retries ai_cancel', async () => {
    const before = new AbortController();
    before.abort();
    await expect(stream()(request, () => undefined, before.signal)).rejects.toMatchObject({
      code: 'cancelled',
    });
    expect(tauri.calls).toEqual([]);

    let registered = false;
    let cancel: (() => void) | null = null;
    tauri.handler = (cmd, args) => {
      if (cmd === 'ai_chat_stream') {
        channelOf(args).onmessage({ kind: 'delta', text: 'Lực' });
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            registered = true;
          }, 120);
          cancel = () => {
            reject(Object.assign(new Error('req-1'), { code: 'cancelled', message: 'req-1' }));
          };
          setTimeout(() => {
            resolve(answer);
          }, 1500);
        });
      }
      if (cmd === 'ai_cancel') {
        if (registered && cancel) {
          cancel();
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      }
      return Promise.resolve(null);
    };
    const ctl = new AbortController();
    const shown: string[] = [];
    const pending = stream()(request, (t) => shown.push(t), ctl.signal);
    ctl.abort();
    await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
    expect(tauri.calls.filter((c) => c.cmd === 'ai_cancel').length).toBeGreaterThan(1);
    expect(tauri.calls.find((c) => c.cmd === 'ai_cancel')?.args).toEqual({ requestId: 'req-1' });
    expect(shown).toEqual(['Lực']);
  });

  it('an older desktop app without the command answers through ai_chat', async () => {
    tauri.handler = (cmd) => {
      // Tauri rejects with the error as Rust gives it: here a plain string.
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      if (cmd === 'ai_chat_stream') return Promise.reject('Command ai_chat_stream not found');
      if (cmd === 'ai_chat') return Promise.resolve(answer);
      return Promise.resolve(null);
    };
    const shown: string[] = [];
    const r = await stream()(request, (t) => shown.push(t));
    expect(r.content).toBe(answer.content);
    expect(tauri.calls.map((c) => c.cmd)).toEqual(['ai_chat_stream', 'ai_chat']);
    expect(shown).toEqual([]);
  });

  it('reports Rust errors and keeps JSON-schema requests on ai_chat', async () => {
    tauri.handler = (cmd) =>
      cmd === 'ai_chat_stream'
        ? // Rust's AiError arrives as a plain { code, message } object.
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          Promise.reject({ code: 'http', message: '529: overloaded_error: Overloaded' })
        : Promise.resolve(answer);
    await expect(stream()(request, () => undefined)).rejects.toMatchObject({
      name: 'AiError',
      code: 'http',
      message: '529: overloaded_error: Overloaded',
    });
    tauri.calls.length = 0;
    await stream()({ ...request, jsonSchema: { type: 'object' } }, () => undefined);
    expect(tauri.calls.map((c) => c.cmd)).toEqual(['ai_chat']);
  });
});
