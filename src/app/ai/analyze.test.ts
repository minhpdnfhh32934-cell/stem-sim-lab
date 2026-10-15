import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MODELS, useAiStore } from '@/ai/aiStore';
import { setLocalClientForTests } from '@/ai/local/client';
import { useLocalAiStore } from '@/ai/local/localAiStore';
import type { LocalRuntimeClient } from '@/ai/local/types';
import { translate } from '@/app/i18n';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import { AiError } from '@/ai/types';
import { BrowserSafety, setSafetyBackendForTests, type Incident } from '@/safety/safety';
import { useChatStore } from '@/teacher/chat/chatStore';
import {
  analyze,
  cancelAnalyze,
  openManual,
  resolveAi,
  resolveAiForAnalysis,
  useAnalyzeStore,
} from './analyze';

function transport(over: Partial<LlmTransport> = {}): LlmTransport {
  return {
    chat: () => Promise.reject(new AiError('network', 'down')),
    models: () => Promise.resolve(['gemini-test']),
    setKey: () => Promise.resolve(),
    hasKey: () => Promise.resolve(false),
    deleteKey: () => Promise.resolve(),
    ...over,
  };
}

describe('AI controller', () => {
  beforeEach(() => {
    useAiStore.setState({
      provider: 'gemini',
      models: { gemini: '', claude: 'm', groq: '' },
    });
    // These tests cover the cloud path: pin the engine (fresh installs default to Gemma).
    useChatStore.setState({ engine: 'cloud' });
    useAnalyzeStore.setState({ phase: 'idle', error: null, draft: null });
  });
  afterEach(() => {
    setTransportForTests(null);
  });

  it('uses the default Gemini model when the model field is empty', async () => {
    const r = await resolveAi();
    expect(r).toMatchObject({ provider: 'gemini', model: DEFAULT_MODELS.gemini });
    useAiStore.setState({ models: { gemini: ' gemini-x ', claude: 'm', groq: '' } });
    expect((await resolveAi()).model).toBe('gemini-x');
  });

  it.each([
    ['429 Too Many Requests: {"error":{"status":"RESOURCE_EXHAUSTED"}}', 'quota'],
    ['400 Bad Request: API key not valid. Please pass a valid API key.', 'badKey'],
    ['403', 'badKey'],
    ['404 Not Found: models/gemini-x is not found', 'badModel'],
    ['500 Internal Server Error', 'http'],
    // Out of credit is a quota problem, as for the fallback (src/ai/errorKind.ts).
    ['402 Payment Required: {}', 'quota'],
    ['400 Bad Request: {"error":{"message":"Your credit balance is too low"}}', 'quota'],
    // No sentence of their own in this dialog yet: the general server error with its detail.
    ['413 Payload Too Large: Request too large', 'http'],
    ['529: overloaded_error: Overloaded', 'http'],
  ])('explains provider error "%s" as %s', async (message, code) => {
    setTransportForTests(transport({ chat: () => Promise.reject(new AiError('http', message)) }));
    await analyze('Một vật rơi tự do từ độ cao 20 m.');
    expect(useAnalyzeStore.getState().error?.code).toBe(code);
  });

  // A local runtime's error, whatever status or code it carries, is never explained as a cloud
  // quota, key, model, Internet, timeout or 18+ problem: it gets the study-partner sentence of AI
  // Teacher, naming the chosen runtime (src/app/ai/localRuntime.ts).
  it.each([
    ['http', 'local-failed: 429: busy', 'localFailed'],
    ['http', 'local-failed: 402: x', 'localFailed'],
    ['http', 'needs-auth: 401', 'localAuth'],
    ['http', 'model-missing: 404: model "x" not found', 'localModelMissing'],
    ['http', 'loading: 503: Loading model', 'localLoading'],
    ['network', 'local-unreachable: error sending request', 'localDown'],
    ['notAllowed', 'remote-model', 'localRemote'],
    ['notAllowed', 'not-loopback', 'localNotSelected'],
    ['notAllowed', 'no-vision', 'localFailed'],
    ['timeout', 'local-stalled: gap 45000 ms', 'localStalled'],
    ['unavailable', 'local-not-selected', 'localNotSelected'],
    // One problem cannot be shortened in Trí nhớ: only a model with a larger window helps.
    [
      'http',
      'local-failed: 400: the request exceeds the available context size',
      'localContextTask',
    ],
  ] as const)('explains local runtime error %s "%s" with %s', async (code, message, key) => {
    useLocalAiStore.getState().select({
      kind: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen3:8b',
      label: 'Ollama · qwen3:8b',
    });
    setTransportForTests(transport({ chat: () => Promise.reject(new AiError(code, message)) }));
    await analyze('Một vật rơi tự do từ độ cao 20 m.');
    expect(useAnalyzeStore.getState().error).toEqual({
      code: 'local',
      detail: translate('vi', `chat.errors.${key}`, { name: 'Ollama' }),
    });
    useLocalAiStore.getState().select(null);
  });

  it('maps a network failure to an error the dialog can explain', async () => {
    setTransportForTests(transport());
    await analyze('Một vật rơi tự do từ độ cao 20 m.');
    expect(useAnalyzeStore.getState().error?.code).toBe('network');
  });

  it('rejects an empty problem without calling the AI', async () => {
    let called = false;
    setTransportForTests(
      transport({
        chat: () => {
          called = true;
          return Promise.reject(new Error('x'));
        },
      }),
    );
    await analyze('   ');
    expect(useAnalyzeStore.getState().error?.code).toBe('empty');
    expect(called).toBe(false);
  });

  it('cancel returns to idle and ignores the late reply', async () => {
    let release: (v: { content: string; model: string; durationMs: number }) => void = () => {};
    setTransportForTests(
      transport({
        chat: () =>
          new Promise((res) => {
            release = res;
          }),
      }),
    );
    const run = analyze('Một vật rơi tự do từ độ cao 20 m.');
    await new Promise((r) => setTimeout(r, 0));
    expect(useAnalyzeStore.getState().phase).toBe('running');
    cancelAnalyze();
    release({
      content: JSON.stringify({ topic: 'freeFall', reason: '', unsupported_parts: [] }),
      model: 'x',
      durationMs: 1,
    });
    await run;
    expect(useAnalyzeStore.getState().phase).toBe('idle');
  });

  it('manual mode opens a draft of defaults with nothing marked as from the problem', async () => {
    await openManual('freeFall');
    const s = useAnalyzeStore.getState();
    expect(s.mode).toBe('manual');
    expect(s.draft?.missing).toEqual([]);
    expect(Object.values(s.draft?.sources ?? {}).every((v) => v === 'default')).toBe(true);
  });

  it('refuses when AI is off', async () => {
    useAiStore.setState({ provider: 'off' });
    await expect(resolveAi()).rejects.toMatchObject({ code: 'unavailable' });
  });

  describe('with the runtime on this computer chosen', () => {
    const selection = {
      kind: 'ollama' as const,
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen3:8b',
      label: 'Ollama · qwen3:8b',
    };
    const local = {
      detect: vi.fn<LocalRuntimeClient['detect']>(),
      probe: vi.fn<LocalRuntimeClient['probe']>(),
      models: vi.fn<LocalRuntimeClient['models']>(),
      modelInfo: vi.fn<LocalRuntimeClient['modelInfo']>(),
      test: vi.fn<LocalRuntimeClient['test']>(),
      chat: vi.fn<LocalRuntimeClient['chat']>(),
    };
    let cloudCalls = 0;
    beforeEach(() => {
      vi.clearAllMocks();
      cloudCalls = 0;
      setLocalClientForTests(local);
      setTransportForTests(
        transport({
          chat: () => {
            cloudCalls++;
            return Promise.reject(new AiError('network', 'down'));
          },
          hasKey: () => Promise.resolve(true),
        }),
      );
      useChatStore.setState({ engine: 'local', engineChosen: true });
    });
    afterEach(() => {
      setLocalClientForTests(null);
      useLocalAiStore.getState().select(null);
    });

    it('reads the problem with the chosen runtime and names it; the cloud is never asked', async () => {
      useLocalAiStore.getState().select(selection);
      local.chat.mockResolvedValue({
        content: JSON.stringify({
          topic: 'unsupported',
          reason: 'ngoài phạm vi',
          unsupported_parts: [],
        }),
        model: 'qwen3:8b',
        runtime: 'ollama',
        durationMs: 5,
        firstPieceMs: 1,
        truncated: false,
        streamed: true,
      });
      await analyze('Một vật rơi tự do từ độ cao 20 m.');
      expect(useAnalyzeStore.getState().phase).toBe('unsupported');
      expect(local.chat).toHaveBeenCalledTimes(1);
      const req = local.chat.mock.calls[0]?.[0];
      expect(req).toMatchObject({ kind: 'ollama', baseUrl: selection.baseUrl, model: 'qwen3:8b' });
      // Not checked on this computer: the schema goes into the prompt, not as structured output.
      expect(req?.jsonSchema).toBeUndefined();
      expect(req?.system).toContain('"topic"');
      expect(cloudCalls).toBe(0);
      const ai = await resolveAiForAnalysis();
      expect(ai.modelLabel?.('qwen3:8b')).toBe('Ollama · qwen3:8b');
    });

    it('a runtime that does not answer is reported as such, and nothing goes online', async () => {
      useLocalAiStore.getState().select(selection);
      local.chat.mockRejectedValue(new AiError('network', 'local-unreachable: refused'));
      await analyze('Một vật rơi tự do từ độ cao 20 m.');
      expect(useAnalyzeStore.getState().error).toEqual({
        code: 'local',
        detail: translate('vi', 'chat.errors.localDown', { name: 'Ollama' }),
      });
      expect(local.chat).toHaveBeenCalledTimes(1);
      expect(cloudCalls).toBe(0);
    });

    it('no runtime and model chosen yet: nothing is sent anywhere', async () => {
      await analyze('Một vật rơi tự do từ độ cao 20 m.');
      expect(useAnalyzeStore.getState().error?.code).toBe('local');
      expect(useAnalyzeStore.getState().error?.detail).toBe(
        translate('vi', 'chat.errors.localNotSelected'),
      );
      expect(local.chat).not.toHaveBeenCalled();
      expect(cloudCalls).toBe(0);
    });
  });

  describe('safety before the AI', () => {
    const counting = () => {
      const seen = { calls: 0 };
      setTransportForTests(
        transport({
          chat: () => {
            seen.calls++;
            return Promise.reject(new AiError('network', 'down'));
          },
        }),
      );
      return seen;
    };

    it.each([
      ['Vật rơi từ 20 m. Gọi em: 0912 345 678', 'personalData', 'inputPersonalData'],
      ['Hướng dẫn chế tạo bom tại nhà', 'unsafe', 'inputUnsafe'],
      ['Em không muốn sống nữa', 'crisis', 'inputCrisis'],
    ] as const)('"%s" is not sent (%s) and logged as kind + time', async (text, code, kind) => {
      const seen = counting();
      await analyze(text);
      expect(useAnalyzeStore.getState().error?.code).toBe(code);
      expect(seen.calls).toBe(0);
      // The log keeps the kind and the time only, never the text.
      const raw = localStorage.getItem('stemsim.incidents') ?? '[]';
      const log = JSON.parse(raw) as Incident[];
      expect(log.map((i) => i.kind)).toEqual([kind]);
      expect(raw).not.toContain(text.slice(0, 10));
    });

    it('makes no AI call while the age question is unanswered', async () => {
      setSafetyBackendForTests(new BrowserSafety());
      const seen = counting();
      await analyze('Một vật rơi tự do từ độ cao 20 m.');
      expect(useAnalyzeStore.getState().error?.code).toBe('notAllowed');
      expect(seen.calls).toBe(0);
    });
  });
});
