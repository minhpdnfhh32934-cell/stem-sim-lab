import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatRequest } from './types';

/**
 * "Dừng" for a cloud answer in the desktop app (review 2). No Rust here: `invoke` is a fake that
 * behaves like `ai_chat` / `ai_cancel` in src-tauri/src/ai/mod.rs, where a request can be cancelled
 * only once it is registered (after the safety, key and daily-cap checks).
 */
const tauri = vi.hoisted(() => ({
  calls: [] as string[],
  handler: (_cmd: string): Promise<unknown> => Promise.resolve(null),
}));
vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: (cmd: string) => {
    tauri.calls.push(cmd);
    return tauri.handler(cmd);
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

beforeEach(() => {
  tauri.calls.length = 0;
});

describe('desktop cloud request and "Dừng"', () => {
  it('a request stopped before it was sent is never sent (nothing counted, nothing paid)', async () => {
    tauri.handler = () => Promise.resolve({ content: 'Trả lời', model: 'm', durationMs: 1 });
    const controller = new AbortController();
    controller.abort();
    await expect(getTransport().chat(request, controller.signal)).rejects.toMatchObject({
      code: 'cancelled',
    });
    expect(tauri.calls).not.toContain('ai_chat');
  });

  it('a stop that reaches Rust before the request is registered is sent again', async () => {
    let registered = false;
    let cancel: (() => void) | null = null;
    tauri.handler = (cmd) => {
      if (cmd === 'ai_chat') {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            registered = true;
          }, 120);
          cancel = () => {
            // Rust's AiError arrives as { code, message }.
            reject(Object.assign(new Error('req-1'), { code: 'cancelled' }));
          };
          // Without a working cancel the answer would arrive (and be paid for).
          setTimeout(() => {
            resolve({ content: 'Trả lời', model: 'm', durationMs: 1 });
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
    const controller = new AbortController();
    const answer = getTransport().chat(request, controller.signal);
    controller.abort();
    await expect(answer).rejects.toMatchObject({ code: 'cancelled' });
    expect(tauri.calls.filter((c) => c === 'ai_cancel').length).toBeGreaterThan(1);
  });
});
