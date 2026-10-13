import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import type { ChatRequest } from '@/ai/types';
import { useChatStore } from './chatStore';

/**
 * Local-only stays local (audit G2): when the learner's chosen on-device Gemma fails, the app
 * says why and never sends the question to an online provider instead.
 */
const failure = { current: 'gemma-stalled' };
vi.mock('@/ai/webGemma', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/ai/webGemma')>();
  return { ...real, webGPUStatus: () => 'webgpu' };
});
vi.mock('@/ai/gemmaTransport', () => ({
  gemmaReady: () => Promise.resolve(true),
  gemmaChatText: () => Promise.reject(new Error(failure.current)),
}));
vi.mock('@/app/ai/engineChoice', () => ({ analysisEngine: () => Promise.resolve('gemma') }));

const { askTeacher, gemmaErrorKey } = await import('./chatService');

describe('on-device Gemma failures', () => {
  const calls: ChatRequest[] = [];
  beforeEach(() => {
    calls.length = 0;
    useChatStore.setState({ engine: 'gemma', engineChosen: true, messages: [], summary: null });
    const transport: LlmTransport = {
      kind: 'fetch',
      hasKey: () => Promise.resolve(true),
      setKey: () => Promise.resolve(),
      deleteKey: () => Promise.resolve(),
      chat: (req: ChatRequest) => {
        calls.push(req);
        return Promise.resolve({ content: 'online answer', model: 'x', provider: 'gemini' });
      },
      cancel: () => Promise.resolve(),
      models: () => Promise.resolve([]),
      usage: () => Promise.resolve({ count: 0 }),
      edition: () => Promise.resolve('main'),
    } as unknown as LlmTransport;
    setTransportForTests(transport);
  });
  afterEach(() => {
    setTransportForTests(null);
  });

  it.each([
    ['gemma-stalled', /không viết thêm chữ nào/],
    ['gpu-lost', /Card đồ họa vừa ngắt Gemma/],
    ['worker-crashed', /Card đồ họa vừa ngắt Gemma/],
    ['model-missing', /Gemma chưa được tải/],
    ['something odd', /Gemma gặp lỗi khi trả lời/],
  ])('%s → a clear message and nothing sent online', async (raw, text) => {
    failure.current = raw;
    await expect(
      askTeacher('Lực ma sát là gì?', 'vi', [], { includeScreen: false, think: false }),
    ).rejects.toThrow(text);
    expect(calls).toHaveLength(0);
  });

  it('maps raw engine errors to the learner sentence', () => {
    expect(gemmaErrorKey('Error: gemma-stalled')).toBe('chat.errors.gemmaStalled');
    expect(gemmaErrorKey('out of memory')).toBe('chat.errors.gemmaGpu');
    expect(gemmaErrorKey('webgpu-missing')).toBe('chat.errors.gemmaMissing');
  });
});
