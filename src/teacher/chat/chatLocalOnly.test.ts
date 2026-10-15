import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GpuStatus } from '@/ai/gpu';
import {
  INTEGRATED_INPUT_BUDGET,
  allowGemmaAgain,
  forgetGpuFault,
  noteGpuFault,
} from '@/ai/gpuSafety';
import { setLocalClientForTests } from '@/ai/local/client';
import { useLocalAiStore } from '@/ai/local/localAiStore';
import {
  UNVERIFIED,
  type LocalChatRequest,
  type LocalChatResponse,
  type LocalRuntimeClient,
} from '@/ai/local/types';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import { AiError, type ChatRequest } from '@/ai/types';
import type { AnalysisEngine } from '@/app/ai/engineChoice';
import { translate } from '@/app/i18n';
import { useChatStore, type ChatMessageRecord } from './chatStore';
import { LOCAL_CONTEXT_MARGIN, estimateTokens } from './memory';

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
/** The engine the app picks (Settings and the chat store decide it in the app). */
const picked = { current: 'gemma' as AnalysisEngine };
vi.mock('@/app/ai/engineChoice', () => ({ analysisEngine: () => Promise.resolve(picked.current) }));
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

const { AnswerStopped, TeacherError, askTeacher, contextPrompt, gemmaErrorKey } =
  await import('./chatService');
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

describe('a quick button after the teacher’s check question (final review)', () => {
  const calls: ChatRequest[] = [];
  const asked: ChatMessageRecord[] = [
    { id: 'q', role: 'user', content: 'Định luật II Newton nói gì?' },
    {
      id: 'a',
      role: 'assistant',
      content: 'a = F/m. Nếu khối lượng tăng gấp đôi mà lực giữ nguyên thì gia tốc thế nào?',
    },
  ];

  beforeEach(() => {
    calls.length = 0;
    gemmaCalls.length = 0;
    failure.current = null;
    desktop.status = RTX_ONLY;
    useGpuStore.setState({ status: RTX_ONLY, gemmaInfo: null });
    useChatStore.setState({
      engine: 'gemma',
      engineChosen: true,
      gemmaModel: 'gemma3-1b',
      messages: [],
      summary: null,
      webLookup: false,
    });
    setTransportForTests(transport(calls));
  });
  afterEach(() => {
    setTransportForTests(null);
  });

  it('is reworked, never judged as the learner’s answer', async () => {
    const { getDictionary } = await import('@/app/i18n');
    for (const prompt of Object.values(getDictionary('vi').teacher.chipPrompts)) {
      gemmaCalls.length = 0;
      await askTeacher(prompt, 'vi', asked, {
        includeScreen: false,
        think: false,
        quickAction: true,
      });
      expect(gemmaCalls.at(-1)?.system, prompt).not.toContain('Không khen ngay');
    }
    // The same path with a typed answer does judge it.
    gemmaCalls.length = 0;
    await askTeacher('Gia tốc tăng gấp đôi ạ.', 'vi', asked, {
      includeScreen: false,
      think: false,
    });
    expect(gemmaCalls.at(-1)?.system).toContain('Không khen ngay');
  });
});

describe('a runtime on this computer (Ollama, LM Studio, llama.cpp…)', () => {
  const calls: ChatRequest[] = [];
  const usage = vi.fn(() => Promise.resolve({ count: 0 }));
  const local = {
    detect: vi.fn<LocalRuntimeClient['detect']>(),
    probe: vi.fn<LocalRuntimeClient['probe']>(),
    models: vi.fn<LocalRuntimeClient['models']>(),
    modelInfo: vi.fn<LocalRuntimeClient['modelInfo']>(),
    test: vi.fn<LocalRuntimeClient['test']>(),
    chat: vi.fn<LocalRuntimeClient['chat']>(),
  };
  const selection = {
    kind: 'ollama' as const,
    baseUrl: 'http://127.0.0.1:11434',
    model: 'qwen3:8b',
    label: 'Ollama · qwen3:8b',
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
  const ask = (question: string, extra: Partial<Parameters<typeof askTeacher>[3]> = {}) =>
    askTeacher(question, 'vi', [], { includeScreen: false, think: false, ...extra });

  beforeEach(() => {
    calls.length = 0;
    gemmaCalls.length = 0;
    failure.current = null;
    picked.current = 'local';
    usage.mockClear();
    for (const fn of Object.values(local)) fn.mockReset();
    useChatStore.setState({
      engine: 'local',
      engineChosen: true,
      messages: [],
      summary: null,
      webLookup: false,
      memoryLength: 'medium',
      verifierProvider: 'claude',
      verifierModel: '',
    });
    useLocalAiStore.setState({ selected: selection, checks: {}, userEndpoints: [] });
    setLocalClientForTests(local);
    const cloud = transport(calls) as unknown as { usage: unknown };
    cloud.usage = usage;
    setTransportForTests(cloud as unknown as LlmTransport);
  });
  afterEach(() => {
    picked.current = 'gemma';
    setLocalClientForTests(null);
    setTransportForTests(null);
    useLocalAiStore.setState({ selected: null, checks: {} });
  });

  it('answers in pieces through the same filter, named after the runtime, all on this computer', async () => {
    local.chat.mockImplementation((_req, opts) => {
      opts?.onPartial?.('Rơi tự do ');
      opts?.onPartial?.('Rơi tự do <thi');
      opts?.onPartial?.('Rơi tự do <think>nháp 3 kg</think> là chuyển động.');
      return Promise.resolve(answer('Rơi tự do là chuyển động chỉ chịu trọng lực.'));
    });
    const seen: string[] = [];
    const question = 'Rơi tự do là gì?';
    const reply = await ask(question, { onPartial: (t) => seen.push(t) });
    expect(seen[0]).toBe('Rơi tự do ');
    // Hidden reasoning is never shown, not even while it is being written.
    expect(seen.filter((t) => /<|think|nháp|3 kg/u.test(t))).toEqual([]);
    expect(reply.content).toBe('Rơi tự do là chuyển động chỉ chịu trọng lực.');
    expect(reply.metadata.model).toBe('Ollama · qwen3:8b');
    expect(local.chat).toHaveBeenCalledTimes(1);
    const [req] = local.chat.mock.calls[0] ?? [];
    // Unknown context ("Chưa xác minh"): the small on-device budget and prompt.
    expect(req).toMatchObject({
      kind: 'ollama',
      baseUrl: selection.baseUrl,
      model: 'qwen3:8b',
      maxTokens: 1024,
      contextLength: 4000 + 1024 + 512,
    });
    expect(req?.system).toBe((await contextPrompt(question, 'vi', false, false, 'compact')).system);
    // Nothing went online and nothing counted against the daily cap.
    expect(calls).toHaveLength(0);
    expect(usage).not.toHaveBeenCalled();
    expect(gemmaCalls).toHaveLength(0);
  });

  it('a model with a large context seen on this computer gets the full prompt and answer', async () => {
    useLocalAiStore.getState().recordCheck('ollama', selection.baseUrl, {
      model: 'qwen3:8b',
      contextLength: 40960,
      vision: 'no',
      thinking: 'yes',
      loaded: null,
      remote: false,
      capabilities: { ...UNVERIFIED, listModels: 'yes', contextLength: 'yes', vision: 'no' },
      declared: UNVERIFIED,
    });
    local.chat.mockResolvedValue(answer('Định luật II: a = F/m.'));
    const question = 'Định luật II Newton là gì?';
    await ask(question);
    const [req] = local.chat.mock.calls[0] ?? [];
    expect(req?.maxTokens).toBe(4096);
    // The window this request needs, not the model's whole 40k one.
    expect(req?.contextLength).toBe(12000 + 4096 + 512);
    expect(req?.system).toBe((await contextPrompt(question, 'vi', false, false, 'full')).system);
    // A small window keeps the compact prompt and never asks for more than the model has.
    local.chat.mockClear();
    useLocalAiStore.getState().recordCheck('ollama', selection.baseUrl, {
      model: 'qwen3:8b',
      contextLength: 4096,
      vision: 'no',
      thinking: 'yes',
      loaded: null,
      remote: false,
      capabilities: { ...UNVERIFIED, contextLength: 'yes' },
      declared: UNVERIFIED,
    });
    await ask(question);
    const [small] = local.chat.mock.calls[0] ?? [];
    expect(small?.contextLength).toBeLessThanOrEqual(4096);
    expect(small?.system).toBe(
      (await contextPrompt(question, 'vi', false, false, 'compact')).system,
    );
    expect(calls).toHaveLength(0);
  });

  it.each([
    [new AiError('network', 'local-unreachable: connection refused'), 'localDown', true],
    [new AiError('timeout', 'local-stalled: first-piece 120000 ms'), 'localStalled', true],
    [
      new AiError('http', 'model-missing: 404: model "qwen3:8b" not found'),
      'localModelMissing',
      true,
    ],
    [new AiError('http', 'loading: 503: Loading model'), 'localLoading', true],
    [new AiError('http', 'needs-auth: 401'), 'localAuth', false],
    [new AiError('notAllowed', 'remote-model'), 'localRemote', false],
    [new AiError('badResponse', 'not-runtime'), 'localNotRuntime', false],
    [new AiError('unavailable', 'needs-app-update'), 'localUpdate', false],
    [
      new AiError('http', 'local-failed: 400: the request exceeds the available context size'),
      'localContext',
      false,
    ],
    // A busy runtime is not a provider's quota: no fallback, one request only.
    [new AiError('http', 'local-failed: 429: busy'), 'localFailed', true],
    // The model wrote only its reasoning, or nothing before its limit: said as such.
    [new AiError('badResponse', 'reasoningOnly'), 'localNoAnswer', true],
    [new AiError('badResponse', 'empty answer (length)'), 'localNoAnswer', true],
  ] as const)('%s → "%s", never retried, nothing sent online', async (error, key, retry) => {
    local.chat.mockRejectedValue(error);
    const failed = ask('Lực ma sát là gì?');
    await expect(failed).rejects.toBeInstanceOf(TeacherError);
    await expect(failed).rejects.toThrow(translate('vi', `chat.errors.${key}`, { name: 'Ollama' }));
    await expect(failed).rejects.toMatchObject({ retry });
    expect(local.chat).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(0);
    expect(usage).not.toHaveBeenCalled();
  });

  it('no runtime and model chosen yet: nothing is sent anywhere, not even to Wikipedia', async () => {
    picked.current = 'local-missing';
    useLocalAiStore.setState({ selected: null });
    useChatStore.setState({ webLookup: true });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const failed = ask('Lực ma sát là gì?');
    await expect(failed).rejects.toThrow(translate('vi', 'chat.errors.localNotSelected'));
    await expect(failed).rejects.toMatchObject({ section: 'runtimes', retry: false });
    expect(local.chat).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
    fetchSpy.mockRestore();
  });

  it('Think: the draft is written on this computer, only the review goes online (no fallback)', async () => {
    local.chat.mockResolvedValue(answer('Bản nháp: lực ma sát cản chuyển động.'));
    const reply = await ask('Lực ma sát là gì?', { think: true, onPartial: () => undefined });
    expect(local.chat).toHaveBeenCalledTimes(1);
    // The draft is not shown while it is written: it is reviewed first.
    expect(local.chat.mock.calls[0]?.[1]?.onPartial).toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ provider: 'claude', noFallback: true });
    expect(calls[0]?.messages.at(-1)?.content).toContain('lực ma sát cản chuyển động');
    expect(reply.metadata.model).toBe('Ollama · qwen3:8b');
    expect(reply.metadata.checkedBy).toMatch(/^claude · /);
  });

  it('takes back streamed text as soon as a piece is unsafe, and blocks the answer', async () => {
    local.chat.mockImplementation((_req, opts) => {
      opts?.onPartial?.('Bài này ');
      opts?.onPartial?.('Bài này gọi số 0912345678 ');
      return Promise.resolve(answer('Bài này gọi số 0912345678 để nhận lời giải'));
    });
    const seen: string[] = [];
    await expect(ask('Giải giúp em', { onPartial: (t) => seen.push(t) })).rejects.toThrow(
      translate('vi', 'chat.errors.filtered'),
    );
    expect(seen.at(-1)).toBe('');
    expect(seen.filter((t) => t.includes('0912345678'))).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  /** Long earlier turns: far beyond the budget, so the older ones are summarised first. */
  const longHistory = (turns: number): ChatMessageRecord[] =>
    Array.from({ length: turns }, (_, i) => ({
      id: `h${i}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Lượt ${i}: `.padEnd(1200, 'a'),
    }));
  const isSummary = (req: LocalChatRequest | undefined) =>
    req?.system.includes('Bạn tóm tắt') === true;
  /** What the runtime must hold for a request: its text, its answer and the margin. */
  const needed = (req: LocalChatRequest | undefined) =>
    estimateTokens(req?.system ?? '') +
    (req?.messages ?? []).reduce((n, m) => n + estimateTokens(m.content), 0) +
    (req?.maxTokens ?? 0) +
    LOCAL_CONTEXT_MARGIN;
  const withSummary = () => {
    local.chat.mockImplementation((req) =>
      Promise.resolve(
        answer(isSummary(req) ? '- Đang học lực ma sát.' : 'Lực ma sát cản chuyển động.'),
      ),
    );
  };

  it('the summary of older turns fits the window sent with it (unknown context)', async () => {
    withSummary();
    const reply = await askTeacher('tiếp nhé', 'vi', longHistory(80), {
      includeScreen: false,
      think: false,
    });
    expect(reply.content).toBe('Lực ma sát cản chuyển động.');
    expect(local.chat).toHaveBeenCalledTimes(2);
    const [summary] = local.chat.mock.calls[0] ?? [];
    expect(isSummary(summary)).toBe(true);
    expect(summary?.maxTokens).toBe(400);
    // Ollama would cut a longer request without a word: it must fit the window it is sent with.
    expect(needed(summary)).toBeLessThanOrEqual(summary?.contextLength ?? 0);
    // The newest left-out turns are still summarised.
    expect(summary?.messages[0]?.content).toMatch(/Lượt \d+/);
    expect(useChatStore.getState().summary?.text).toBe('- Đang học lực ma sát.');
    expect(calls).toHaveLength(0);
  });

  it('the summary of older turns fits a small window seen on this computer', async () => {
    useLocalAiStore.getState().recordCheck('ollama', selection.baseUrl, {
      model: 'qwen3:8b',
      contextLength: 4096,
      vision: 'no',
      thinking: 'yes',
      loaded: null,
      remote: false,
      capabilities: { ...UNVERIFIED, contextLength: 'yes' },
      declared: UNVERIFIED,
    });
    withSummary();
    await askTeacher('tiếp nhé', 'vi', longHistory(30), { includeScreen: false, think: false });
    expect(local.chat).toHaveBeenCalledTimes(2);
    const [summary] = local.chat.mock.calls[0] ?? [];
    expect(isSummary(summary)).toBe(true);
    expect(summary?.contextLength).toBeLessThanOrEqual(4096);
    expect(needed(summary)).toBeLessThanOrEqual(summary?.contextLength ?? 0);
  });

  it.each([
    [new AiError('timeout', 'local-stalled: first-piece 120000 ms'), 'localStalled'],
    [new AiError('network', 'local-unreachable: connection refused'), 'localDown'],
    [new AiError('http', 'loading: 503: Loading model'), 'localLoading'],
    [new AiError('http', 'needs-auth: 401'), 'localAuth'],
  ] as const)(
    'a runtime that fails the summary (%s) is not asked the question too',
    async (error, key) => {
      local.chat.mockRejectedValue(error);
      const failed = askTeacher('tiếp nhé', 'vi', longHistory(30), {
        includeScreen: false,
        think: false,
      });
      await expect(failed).rejects.toBeInstanceOf(TeacherError);
      await expect(failed).rejects.toThrow(
        translate('vi', `chat.errors.${key}`, { name: 'Ollama' }),
      );
      // One request for one question: the learner never waits for a second time-out.
      expect(local.chat).toHaveBeenCalledTimes(1);
      expect(isSummary(local.chat.mock.calls[0]?.[0])).toBe(true);
      expect(calls).toHaveLength(0);
      expect(usage).not.toHaveBeenCalled();
    },
  );

  it('a summary the model could not hold, or an unsafe one, is skipped: the question is asked', async () => {
    local.chat.mockImplementation((req) =>
      isSummary(req)
        ? Promise.reject(
            new AiError(
              'http',
              'local-failed: 400: the request exceeds the available context size',
            ),
          )
        : Promise.resolve(answer('Lực ma sát cản chuyển động.')),
    );
    const reply = await askTeacher('tiếp nhé', 'vi', longHistory(30), {
      includeScreen: false,
      think: false,
    });
    expect(reply.content).toBe('Lực ma sát cản chuyển động.');
    expect(local.chat).toHaveBeenCalledTimes(2);
    expect(useChatStore.getState().summary).toBeNull();

    local.chat.mockReset();
    local.chat.mockImplementation((req) =>
      Promise.resolve(
        answer(isSummary(req) ? 'Gọi số 0912345678 nhé.' : 'Lực ma sát cản chuyển động.'),
      ),
    );
    await askTeacher('tiếp nhé', 'vi', longHistory(30), { includeScreen: false, think: false });
    expect(local.chat).toHaveBeenCalledTimes(2);
    expect(useChatStore.getState().summary).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it.each([
    // A thinking model can spend the summary's 400 tokens on its reasoning: no summary text.
    [new AiError('badResponse', 'reasoningOnly')],
    [new AiError('badResponse', 'empty answer (length)')],
    [new AiError('badResponse', 'empty answer (stop)')],
    // An error of this one request, not of the runtime: the question may still be answered.
    [new AiError('http', 'local-failed: 500: summary failed')],
  ])('a summary that brings no text (%s) is skipped: the question is asked', async (error) => {
    local.chat.mockImplementation((req) =>
      isSummary(req)
        ? Promise.reject(error)
        : Promise.resolve(answer('Lực ma sát cản chuyển động.')),
    );
    const reply = await askTeacher('tiếp nhé', 'vi', longHistory(30), {
      includeScreen: false,
      think: false,
    });
    expect(reply.content).toBe('Lực ma sát cản chuyển động.');
    expect(local.chat).toHaveBeenCalledTimes(2);
    expect(isSummary(local.chat.mock.calls[0]?.[0])).toBe(true);
    expect(isSummary(local.chat.mock.calls[1]?.[0])).toBe(false);
    expect(useChatStore.getState().summary).toBeNull();
    expect(calls).toHaveLength(0);
    expect(usage).not.toHaveBeenCalled();
  });

  it('the summary asks a model that reasons first not to; the question is sent as before', async () => {
    withSummary();
    await askTeacher('tiếp nhé', 'vi', longHistory(30), { includeScreen: false, think: false });
    expect(local.chat).toHaveBeenCalledTimes(2);
    const [summary] = local.chat.mock.calls[0] ?? [];
    const [question] = local.chat.mock.calls[1] ?? [];
    expect(isSummary(summary)).toBe(true);
    // The clients send it only to a model seen reasoning first (Ollama `think`).
    expect(summary?.think).toBe(false);
    expect(question).not.toHaveProperty('think');
  });

  it('"Dừng" stops the request to the runtime and nothing else is asked', async () => {
    local.chat.mockImplementation(
      (_req, opts) =>
        new Promise((_resolve, reject) => {
          opts?.signal?.addEventListener('abort', () => {
            reject(new AiError('cancelled', 'x'));
          });
        }),
    );
    const controller = new AbortController();
    const answerP = ask('Lực ma sát là gì?', { signal: controller.signal });
    await vi.waitFor(() => {
      expect(local.chat).toHaveBeenCalledTimes(1);
    });
    controller.abort();
    await expect(answerP).rejects.toBeInstanceOf(AnswerStopped);
    expect(local.chat.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(calls).toHaveLength(0);
  });
});
