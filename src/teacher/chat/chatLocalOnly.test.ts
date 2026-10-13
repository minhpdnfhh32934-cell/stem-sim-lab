import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GpuStatus } from '@/ai/gpu';
import {
  INTEGRATED_INPUT_BUDGET,
  allowGemmaAgain,
  forgetGpuFault,
  noteGpuFault,
} from '@/ai/gpuSafety';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import type { ChatRequest } from '@/ai/types';
import { useChatStore, type ChatMessageRecord } from './chatStore';
import { estimateTokens } from './memory';

/**
 * Local-only stays local (audit G2): when the learner's chosen on-device Gemma fails, the app
 * says why and never sends the question to an online provider instead.
 */
interface GemmaCall {
  system: string;
  messages: { role: string; content: string }[];
  inputBudget?: number;
}
const failure = { current: 'gemma-stalled' as string | null };
const gemmaCalls: GemmaCall[] = [];
vi.mock('@/ai/webGemma', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/ai/webGemma')>();
  return { ...real, webGPUStatus: () => 'webgpu' };
});
vi.mock('@/ai/gemmaTransport', () => ({
  gemmaReady: () => Promise.resolve(true),
  gemmaChatText: (args: GemmaCall) => {
    gemmaCalls.push(args);
    if (failure.current) return Promise.reject(new Error(failure.current));
    const summary = args.system.includes('Bạn tóm tắt');
    return Promise.resolve({
      content: summary ? '- Đang học lực ma sát.' : 'Câu trả lời của Gemma',
      model: 'gemma3-1b',
      truncated: false,
    });
  },
}));
vi.mock('@/app/ai/engineChoice', () => ({ analysisEngine: () => Promise.resolve('gemma') }));
// The desktop card list (src-tauri/src/gpu.rs) is replaced by a fake: no real GPU is touched.
const desktop = { status: null as GpuStatus | null };
vi.mock('@/ai/gpu', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/ai/gpu')>();
  return {
    ...real,
    loadGpuStatus: vi.fn(() => {
      real.useGpuStore.getState().setStatus(desktop.status);
      return Promise.resolve(desktop.status);
    }),
  };
});

const { askTeacher, contextPrompt, gemmaErrorKey } = await import('./chatService');
const { loadGpuStatus, useGpuStore } = await import('@/ai/gpu');

function transport(calls: ChatRequest[]): LlmTransport {
  return {
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
}

const AMD_ONLY: GpuStatus = {
  supported: true,
  adapters: [
    {
      id: '1002:15bf:0',
      name: 'AMD Radeon 780M',
      vendorId: 0x1002,
      deviceId: 0x15bf,
      kind: 'integrated',
      dedicatedMb: 512,
      sharedMb: 16000,
    },
  ],
  choice: null,
  choiceName: null,
  startupChoice: null,
  startupApplied: false,
  restartNeeded: false,
};
const RTX_ONLY: GpuStatus = {
  ...AMD_ONLY,
  adapters: [
    {
      id: '10de:2d59:0',
      name: 'NVIDIA GeForce RTX 5060 Laptop GPU',
      vendorId: 0x10de,
      deviceId: 0x2d59,
      kind: 'discrete',
      dedicatedMb: 8151,
      sharedMb: 16000,
    },
  ],
};

describe('on-device Gemma failures', () => {
  const calls: ChatRequest[] = [];
  beforeEach(() => {
    calls.length = 0;
    gemmaCalls.length = 0;
    failure.current = 'gemma-stalled';
    desktop.status = null;
    useGpuStore.setState({ status: null, gemmaInfo: null });
    useChatStore.setState({ engine: 'gemma', engineChosen: true, messages: [], summary: null });
    setTransportForTests(transport(calls));
  });
  afterEach(() => {
    setTransportForTests(null);
    allowGemmaAgain();
    forgetGpuFault();
  });

  it.each([
    ['gemma-stalled', /không viết thêm chữ nào/],
    ['model-missing', /Gemma chưa được tải/],
    ['something odd', /Gemma gặp lỗi khi trả lời/],
    // An out-of-memory error that did not turn Gemma off: asking again is allowed.
    ['out of memory', /Card đồ họa vừa ngắt Gemma/],
  ])('%s → a clear message and nothing sent online', async (raw, text) => {
    failure.current = raw;
    await expect(
      askTeacher('Lực ma sát là gì?', 'vi', [], { includeScreen: false, think: false }),
    ).rejects.toThrow(text);
    expect(calls).toHaveLength(0);
  });

  // The real engine notes a GPU fault (Gemma off until restart) before it reports these errors,
  // so the learner is told Gemma is paused, not invited to ask again (audit GPU-01).
  it.each([
    ['gpu-lost', 'device-lost'],
    ['worker-crashed', 'worker-crashed'],
    ['Failed to download data from buffer.', 'runtime-gpu-error'],
  ] as const)(
    '%s after a GPU fault → Gemma is paused, nothing sent online',
    async (raw, reason) => {
      failure.current = raw;
      noteGpuFault(reason, null);
      const answer = askTeacher('Lực ma sát là gì?', 'vi', [], {
        includeScreen: false,
        think: false,
      });
      await expect(answer).rejects.toThrow(/Gemma tạm dừng tới khi em mở lại app/);
      await expect(answer).rejects.not.toThrow(/em hỏi lại nhé/);
      expect(calls).toHaveLength(0);
    },
  );

  it('maps raw engine errors to the learner sentence', () => {
    expect(gemmaErrorKey('Error: gemma-stalled')).toBe('chat.errors.gemmaStalled');
    expect(gemmaErrorKey('out of memory')).toBe('chat.errors.gemmaGpu');
    expect(gemmaErrorKey('webgpu-missing')).toBe('chat.errors.gemmaMissing');
    noteGpuFault('device-lost', null);
    expect(gemmaErrorKey('gpu-lost')).toBe('chat.errors.gemmaGpuBlocked');
    expect(gemmaErrorKey('worker-crashed')).toBe('chat.errors.gemmaGpuBlocked');
    expect(gemmaErrorKey('out of memory')).toBe('chat.errors.gemmaGpuBlocked');
  });
});

describe('Gemma on an integrated card (audit GPU-01)', () => {
  const calls: ChatRequest[] = [];
  /** 30 turns of ~1 200 characters: far beyond the integrated-card budget. */
  const history: ChatMessageRecord[] = Array.from({ length: 60 }, (_, i) => ({
    id: `m${i}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `Lượt ${i}: `.padEnd(1200, 'a'),
  }));

  beforeEach(() => {
    calls.length = 0;
    gemmaCalls.length = 0;
    failure.current = null;
    desktop.status = AMD_ONLY;
    vi.mocked(loadGpuStatus).mockClear();
    useGpuStore.setState({ status: null, gemmaInfo: null });
    useChatStore.setState({
      engine: 'gemma',
      engineChosen: true,
      gemmaModel: 'gemma3-1b',
      memoryLength: 'medium',
      messages: [],
      summary: null,
      webLookup: false,
    });
    setTransportForTests(transport(calls));
  });
  afterEach(() => {
    setTransportForTests(null);
  });

  it('reads the card list when it is not known yet and keeps the prompt tight', async () => {
    const question = 'Lực ma sát là gì?';
    await askTeacher(question, 'vi', [], { includeScreen: true, think: false });
    expect(loadGpuStatus).toHaveBeenCalledTimes(1);
    const sent = gemmaCalls.at(-1);
    expect(sent?.inputBudget).toBe(INTEGRATED_INPUT_BUDGET);
    const tight = await contextPrompt(question, 'vi', true, false, 'tight');
    const compact = await contextPrompt(question, 'vi', true, false, 'compact');
    expect(tight.system).not.toBe(compact.system);
    expect(sent?.system).toBe(tight.system);
    expect(calls).toHaveLength(0);
  });

  it('a discrete card keeps the normal on-device prompt', async () => {
    desktop.status = RTX_ONLY;
    const question = 'Lực ma sát là gì?';
    await askTeacher(question, 'vi', [], { includeScreen: true, think: false });
    const sent = gemmaCalls.at(-1);
    expect(sent?.inputBudget).toBeGreaterThan(INTEGRATED_INPUT_BUDGET);
    expect(sent?.system).toBe((await contextPrompt(question, 'vi', true, false, 'compact')).system);
  });

  it('the summary of old turns also fits the integrated budget', async () => {
    useGpuStore.setState({ status: AMD_ONLY });
    const reply = await askTeacher('tiếp nhé', 'vi', history, {
      includeScreen: false,
      think: false,
    });
    expect(reply.content).toBe('Câu trả lời của Gemma');
    expect(gemmaCalls).toHaveLength(2);
    const [summaryCall] = gemmaCalls;
    // One message the worker cannot trim: the request itself must fit.
    expect(summaryCall?.messages).toHaveLength(1);
    const tokens =
      estimateTokens(summaryCall?.system ?? '') +
      (summaryCall?.messages ?? []).reduce((n, m) => n + estimateTokens(m.content), 0);
    expect(tokens).toBeLessThanOrEqual(INTEGRATED_INPUT_BUDGET);
    // The newest left-out turn is still summarised.
    expect(summaryCall?.messages[0]?.content).toMatch(/Lượt \d+/);
    expect(useChatStore.getState().summary?.text).toBe('- Đang học lực ma sát.');
  });
});
