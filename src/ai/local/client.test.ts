import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StreamEvent } from '../types';
import type { LocalChatRequest, LocalChatResponse } from './types';

/**
 * Local runtimes in the desktop app: every call is a Rust command. No Rust here: `invoke` and
 * `Channel` are fakes that behave like `local_ai_*` and `ai_cancel` in src-tauri/src/ai.
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

const { FetchLocalClient, TauriLocalClient, getLocalClient, setLocalClientForTests } =
  await import('./client');

const request: LocalChatRequest = {
  requestId: 'req-local',
  kind: 'ollama',
  baseUrl: 'http://LOCALHOST:11434/',
  model: 'qwen3:8b',
  system: 'Trả lời ngắn.',
  messages: [{ role: 'user', content: 'Lực là gì?' }],
};

const answer = (content: string): LocalChatResponse => ({
  content,
  model: 'qwen3:8b',
  runtime: 'ollama',
  durationMs: 5,
  firstPieceMs: 1,
  truncated: false,
  streamed: true,
});

function channelOf(args: Record<string, unknown>): FakeChannel {
  return args.onEvent as FakeChannel;
}

beforeEach(() => {
  tauri.calls.length = 0;
  tauri.handler = () => Promise.resolve(null);
  setLocalClientForTests(null);
});

describe('desktop client for local runtimes', () => {
  it('uses Rust in the desktop app, never the browser client', async () => {
    expect(getLocalClient()).toBeInstanceOf(TauriLocalClient);
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const browser = new FetchLocalClient();
    await expect(browser.detect()).rejects.toMatchObject({ code: 'unavailable' });
    await expect(browser.chat(request)).rejects.toMatchObject({ code: 'unavailable' });
    expect(await browser.test('ollama', 'http://127.0.0.1:11434', 'm')).toMatchObject({
      status: 'error',
    });
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('passes each command its arguments, with the address checked and normalised', async () => {
    tauri.handler = (cmd) =>
      Promise.resolve(cmd === 'local_ai_detect' ? [] : { models: [], more: false });
    const c = new TauriLocalClient();
    await c.detect();
    await c.probe(' http://[::1]:8080/v1 ');
    await c.models('lmStudio', 'http://localhost:1234/');
    await c.modelInfo('llamaCpp', 'http://127.0.0.1:8080', 'gemma.gguf');
    await c.test('ollama', 'http://127.0.0.1:11434', 'qwen3:8b');
    expect(tauri.calls).toEqual([
      { cmd: 'local_ai_detect', args: {} },
      { cmd: 'local_ai_probe', args: { baseUrl: 'http://[::1]:8080' } },
      { cmd: 'local_ai_models', args: { kind: 'lmStudio', baseUrl: 'http://localhost:1234' } },
      {
        cmd: 'local_ai_model_info',
        args: { kind: 'llamaCpp', baseUrl: 'http://127.0.0.1:8080', model: 'gemma.gguf' },
      },
      {
        cmd: 'local_ai_test',
        args: { kind: 'ollama', baseUrl: 'http://127.0.0.1:11434', model: 'qwen3:8b' },
      },
    ]);
    tauri.calls.length = 0;
    await expect(c.probe('http://192.168.1.5:11434')).rejects.toMatchObject({
      code: 'notAllowed',
      message: 'not-loopback',
    });
    await expect(c.chat({ ...request, baseUrl: 'https://example.com' })).rejects.toMatchObject({
      message: 'not-loopback',
    });
    expect(tauri.calls).toEqual([]);
  });

  it('streams the whole text so far through the channel; the final content wins', async () => {
    tauri.handler = (cmd, args) => {
      const ch = channelOf(args);
      ch.onmessage({ kind: 'delta', text: 'Mình nhẩm 3*4=12 rồi' });
      // Rust recognised reasoning late (an orphan closing tag): the shown text is replaced.
      ch.onmessage({ kind: 'reset', text: 'Đáp số' });
      // The final content is the authority, even if an event was lost on the way.
      return Promise.resolve(cmd === 'local_ai_chat' ? answer('Đáp số 12.') : null);
    };
    const partials: string[] = [];
    const r = await new TauriLocalClient().chat(request, { onPartial: (t) => partials.push(t) });
    expect(partials).toEqual(['Mình nhẩm 3*4=12 rồi', 'Đáp số', 'Đáp số 12.']);
    expect(r.content).toBe('Đáp số 12.');
    const call = tauri.calls[0];
    expect(call?.cmd).toBe('local_ai_chat');
    expect(call?.args.request).toEqual({ ...request, baseUrl: 'http://localhost:11434' });
  });

  it('ignores events after the call ended', async () => {
    let late: FakeChannel | null = null;
    tauri.handler = (_cmd, args) => {
      late = channelOf(args);
      late.onmessage({ kind: 'delta', text: 'Lực là đại lượng vectơ.' });
      return Promise.resolve(answer('Lực là đại lượng vectơ.'));
    };
    const partials: string[] = [];
    await new TauriLocalClient().chat(request, { onPartial: (t) => partials.push(t) });
    (late as FakeChannel | null)?.onmessage({ kind: 'delta', text: ' Thêm.' });
    expect(partials).toEqual(['Lực là đại lượng vectơ.']);
  });

  it('a stop before sending sends nothing; a stop while streaming retries ai_cancel', async () => {
    const before = new AbortController();
    before.abort();
    await expect(
      new TauriLocalClient().chat(request, { signal: before.signal }),
    ).rejects.toMatchObject({ code: 'cancelled' });
    expect(tauri.calls).toEqual([]);

    let registered = false;
    let cancel: (() => void) | null = null;
    tauri.handler = (cmd, args) => {
      if (cmd === 'local_ai_chat') {
        channelOf(args).onmessage({ kind: 'delta', text: 'Lực' });
        return new Promise((resolve, reject) => {
          // Rust registers the call a little later than the stop arrives.
          setTimeout(() => {
            registered = true;
          }, 120);
          cancel = () => {
            reject(Object.assign(new Error('req-local'), { code: 'cancelled' }));
          };
          setTimeout(() => {
            resolve(answer('Lực là đại lượng vectơ.'));
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
    const partials: string[] = [];
    const pending = new TauriLocalClient().chat(request, {
      signal: ctl.signal,
      onPartial: (t) => partials.push(t),
    });
    ctl.abort();
    await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
    const cancels = tauri.calls.filter((c) => c.cmd === 'ai_cancel');
    expect(cancels.length).toBeGreaterThan(1);
    expect(cancels[0]?.args).toEqual({ requestId: 'req-local' });
    expect(partials).toEqual(['Lực']);
  });

  it('a stop stays a stop when Rust finished the answer before the cancel reached it', async () => {
    tauri.handler = (cmd, args) => {
      if (cmd === 'local_ai_chat') {
        const ch = channelOf(args);
        ch.onmessage({ kind: 'delta', text: 'Lực' });
        // Rust finishes the whole answer a moment later: the stop never finds the call.
        return new Promise((resolve) =>
          setTimeout(() => {
            ch.onmessage({ kind: 'delta', text: ' là đại lượng vectơ.' });
            resolve(answer('Lực là đại lượng vectơ.'));
          }, 30),
        );
      }
      // `ai_cancel`: nothing registered under that id any more.
      return Promise.resolve(false);
    };
    const ctl = new AbortController();
    const partials: string[] = [];
    const pending = new TauriLocalClient().chat(request, {
      signal: ctl.signal,
      onPartial: (t) => partials.push(t),
    });
    ctl.abort();
    await expect(pending).rejects.toMatchObject({ code: 'cancelled', message: 'req-local' });
    // Nothing is shown after "Dừng": not the late piece, not the final answer.
    expect(partials).toEqual(['Lực']);
    expect(tauri.calls.some((c) => c.cmd === 'ai_cancel')).toBe(true);

    // A failure that comes after a stop is a stop too.
    tauri.handler = (cmd) =>
      cmd === 'local_ai_chat'
        ? // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          Promise.reject({ code: 'network', message: 'local-unreachable: closed' })
        : Promise.resolve(false);
    const stop = new AbortController();
    const failing = new TauriLocalClient().chat(request, { signal: stop.signal });
    stop.abort();
    await expect(failing).rejects.toMatchObject({ code: 'cancelled' });
  });

  it('reports Rust errors, and an older desktop app without the commands', async () => {
    tauri.handler = () =>
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      Promise.reject({ code: 'timeout', message: 'local-stalled: gap 45000 ms' });
    await expect(new TauriLocalClient().chat(request)).rejects.toMatchObject({
      name: 'AiError',
      code: 'timeout',
      message: 'local-stalled: gap 45000 ms',
    });
    // Tauri rejects an unknown command with a plain string.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    tauri.handler = (cmd) => Promise.reject(`Command ${cmd} not found`);
    for (const run of [
      () => new TauriLocalClient().detect(),
      () => new TauriLocalClient().chat(request),
      () => new TauriLocalClient().test('ollama', 'http://127.0.0.1:11434', 'm'),
    ]) {
      await expect(run()).rejects.toMatchObject({
        code: 'unavailable',
        message: 'needs-app-update',
      });
    }
  });
});
