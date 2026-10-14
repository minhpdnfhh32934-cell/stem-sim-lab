import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { useGemmaPrefs } from './gemmaPrefs';
import { allowGemmaAgain, gemmaBlockedByGpuFault } from './gpuSafety';

/**
 * "Dừng" must not skip the GPU-fault handling or the idle unload of `webGemmaChat` (review 2,
 * 2026-10-14). No model and no GPU: the worker, WebGPU and the "download finished" flags are fakes,
 * and the worker answers only when a test tells it to.
 */
vi.mock('./modelStore', () => ({
  deleteRepo: () => Promise.resolve(),
  opfsAvailable: () => false,
  repoStored: () => Promise.resolve(true),
}));

type Sent = Record<string, unknown> & { kind: string };
const sent: Sent[] = [];
let terminated = 0;
/** Every worker started; replies to 'load' and 'chat' wait until a test sends them. */
const workers: FakeWorker[] = [];
const current = () => workers.at(-1);

class FakeWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  constructor() {
    workers.push(this);
  }
  postMessage(msg: Sent) {
    sent.push(msg);
    if (msg.kind === 'init') this.answer({ kind: 'inited' });
  }
  answer(data: unknown) {
    setTimeout(() => {
      this.onmessage?.({ data });
    }, 0);
  }
  terminate() {
    terminated += 1;
  }
}

/** Every model counts as downloaded: `get` always finds its flag. */
function fakeIndexedDb() {
  const request = <T>(result: T) => {
    const r: { result: T; onsuccess: (() => void) | null } = { result, onsuccess: null };
    setTimeout(() => r.onsuccess?.(), 0);
    return r;
  };
  const db = {
    transaction: () => ({ objectStore: () => ({ get: (id: string) => request({ id }) }) }),
    close: () => undefined,
  };
  return { open: () => request(db) };
}

vi.stubGlobal('Worker', FakeWorker);
vi.stubGlobal('indexedDB', fakeIndexedDb());
Object.defineProperty(navigator, 'gpu', { value: {}, configurable: true });
afterAll(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'gpu');
});
afterEach(() => {
  allowGemmaAgain();
  useGemmaPrefs.setState({ unloadAfterMin: 0 });
  vi.restoreAllMocks();
});

const { webGemmaChat } = await import('./webGemma');

const lastSent = (kind: string) => sent.filter((m) => m.kind === kind).at(-1);

const ask = (signal: AbortSignal) =>
  webGemmaChat({
    model: 'gemma3-1b',
    system: 'Trả lời ngắn.',
    messages: [{ role: 'user', content: 'Rơi tự do là gì?' }],
    signal,
  });

describe('webGemmaChat after "Dừng"', () => {
  it('a model loading when the learner stops still leaves the GPU memory after the idle time', async () => {
    useGemmaPrefs.setState({ unloadAfterMin: 5 });
    const timers = vi.spyOn(globalThis, 'setTimeout');
    const controller = new AbortController();
    const answer = ask(controller.signal);
    await vi.waitFor(() => {
      expect(lastSent('load')).toBeDefined();
    });
    controller.abort();
    await expect(answer).rejects.toThrow('cancelled');
    current()?.answer({ kind: 'loaded', modelId: 'gemma3-1b', gpu: null });
    await vi.waitFor(() => {
      expect(timers.mock.calls.some(([, ms]) => ms === 5 * 60_000)).toBe(true);
    });
    // Nothing was asked of the model once it was stopped.
    expect(sent.filter((m) => m.kind === 'chat')).toHaveLength(0);
  });

  it('a GPU error that arrives after "Dừng" still turns Gemma off and replaces the worker', async () => {
    const controller = new AbortController();
    const answer = ask(controller.signal);
    await vi.waitFor(() => {
      expect(lastSent('chat')).toBeDefined();
    });
    const chatId = lastSent('chat')?.id;
    const before = terminated;
    controller.abort();
    await expect(answer).rejects.toThrow('cancelled');
    expect(lastSent('stop')).toMatchObject({ id: chatId });
    // The driver reset while the generation was being interrupted.
    current()?.answer({ kind: 'error', id: chatId, message: 'DXGI_ERROR_DEVICE_HUNG' });
    await vi.waitFor(() => {
      expect(gemmaBlockedByGpuFault()).toBe(true);
    });
    expect(terminated).toBe(before + 1);
  });
});
