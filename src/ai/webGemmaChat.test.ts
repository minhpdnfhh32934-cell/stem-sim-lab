import { afterAll, describe, expect, it, vi } from 'vitest';

/**
 * What `webGemmaChat` sends to the Gemma worker. No model and no GPU: the worker, WebGPU and the
 * "download finished" flags (IndexedDB) are fakes.
 */
vi.mock('./modelStore', () => ({
  deleteRepo: () => Promise.resolve(),
  opfsAvailable: () => false,
  repoStored: () => Promise.resolve(true),
}));

type Sent = Record<string, unknown> & { kind: string };
const sent: Sent[] = [];

class FakeWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  postMessage(msg: Sent) {
    sent.push(msg);
    const reply =
      msg.kind === 'init'
        ? { kind: 'inited' }
        : msg.kind === 'load'
          ? { kind: 'loaded', modelId: msg.modelId, gpu: null }
          : msg.kind === 'chat'
            ? { kind: 'reply', id: msg.id, text: 'Đáp án.', truncated: false }
            : null;
    if (reply) {
      setTimeout(() => {
        this.onmessage?.({ data: reply });
      }, 0);
    }
  }
  terminate() {
    /* nothing to stop */
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

const { webGemmaChat } = await import('./webGemma');
const lastChat = () => sent.filter((m) => m.kind === 'chat').at(-1);
const ask = (extra: { decoding?: 'app' | 'legacy'; temperature?: number } = {}) =>
  webGemmaChat({
    model: 'gemma3-1b',
    system: 'Trả lời ngắn.',
    messages: [{ role: 'user', content: 'Rơi tự do là gì?' }],
    ...extra,
  });

describe('webGemmaChat → worker', () => {
  it('sends no decoding by default (the worker then uses the app rules)', async () => {
    await expect(ask()).resolves.toMatchObject({ content: 'Đáp án.' });
    expect(lastChat()).not.toHaveProperty('decoding');
  });

  it("passes decoding 'legacy' through (evaluation script only)", async () => {
    await ask({ decoding: 'legacy' });
    expect(lastChat()).toMatchObject({ decoding: 'legacy' });
  });

  it('passes temperature 0 (greedy) through unchanged', async () => {
    await ask({ temperature: 0 });
    expect(lastChat()).toMatchObject({ temperature: 0 });
  });
});
