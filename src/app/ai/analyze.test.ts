import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_MODELS, useAiStore } from '@/ai/aiStore';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import { AiError } from '@/ai/types';
import { BrowserSafety, setSafetyBackendForTests, type Incident } from '@/safety/safety';
import { analyze, cancelAnalyze, openManual, resolveAi, useAnalyzeStore } from './analyze';

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
  ])('explains provider error "%s" as %s', async (message, code) => {
    setTransportForTests(transport({ chat: () => Promise.reject(new AiError('http', message)) }));
    await analyze('Một vật rơi tự do từ độ cao 20 m.');
    expect(useAnalyzeStore.getState().error?.code).toBe(code);
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
      setSafetyBackendForTests(new BrowserSafety(false));
      const seen = counting();
      await analyze('Một vật rơi tự do từ độ cao 20 m.');
      expect(useAnalyzeStore.getState().error?.code).toBe('notAllowed');
      expect(seen.calls).toBe(0);
    });
  });
});
