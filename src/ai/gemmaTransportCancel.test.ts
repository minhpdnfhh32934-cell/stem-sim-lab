import { describe, expect, it, vi } from 'vitest';
import { AiError } from './types';

/**
 * Cancelling "Phân tích đề" or leaving "Giải thích" must stop the in-app Gemma generation: the
 * pipeline hands its signal to the transport, and the transport must pass it on to webGemmaChat
 * (which posts the worker 'stop' only for a passed signal). No model and no GPU: webGemma is a fake
 * that resolves only when told to, or rejects with "cancelled" when its signal aborts.
 */
const calls: { signal?: AbortSignal }[] = [];

vi.mock('./webGemma', () => ({
  webGPUStatus: () => 'webgpu',
  webGemmaReady: () => Promise.resolve(true),
  webGemmaStatus: () => Promise.resolve('ready'),
  webGemmaChat: (args: { signal?: AbortSignal }) => {
    calls.push(args);
    // Never finishes by itself: only the stop signal ends this generation.
    return new Promise((_resolve, reject) => {
      args.signal?.addEventListener('abort', () => {
        reject(new Error('cancelled'));
      });
    });
  },
}));

const { gemmaTransport } = await import('./gemmaTransport');

describe('in-app Gemma transport', () => {
  it('passes the stop signal to the generation and reports a cancel as AiError("cancelled")', async () => {
    const ctrl = new AbortController();
    const pending = gemmaTransport.chat(
      {
        requestId: 'r1',
        provider: 'gemini',
        model: 'gemma3-1b',
        system: 's',
        messages: [{ role: 'user', content: 'Một vật rơi tự do từ 20 m.' }],
        maxTokens: 2048,
        timeoutSecs: 30,
      },
      ctrl.signal,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]?.signal).toBe(ctrl.signal);
    ctrl.abort();
    const err = await pending.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiError);
    expect((err as AiError).code).toBe('cancelled');
  });
});
