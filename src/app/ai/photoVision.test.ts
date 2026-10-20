import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocalClientForTests } from '@/ai/local/client';
import { useLocalAiStore } from '@/ai/local/localAiStore';
import { UNVERIFIED, type LocalRuntimeClient, type ModelDetails } from '@/ai/local/types';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import { AiError } from '@/ai/types';
import { translate } from '@/app/i18n';
import {
  PHOTO_SYSTEM,
  PHOTO_UNREADABLE,
  cleanTranscription,
  readPhotoOnComputer,
  transcribeWithLocalRuntime,
} from './photoVision';

describe('photo transcription helpers', () => {
  it('rejects empty and unreadable readings', () => {
    expect(cleanTranscription('   ')).toBeNull();
    expect(cleanTranscription(`abc ${PHOTO_UNREADABLE} def`)).toBeNull();
  });

  it('keeps readable text, capped for the problem box', () => {
    expect(cleanTranscription('  Một vật rơi tự do.  ')).toBe('Một vật rơi tự do.');
    expect(cleanTranscription('x'.repeat(9000))?.length).toBe(4000);
  });

  it('asks for transcription only, in both languages', () => {
    expect(PHOTO_SYSTEM.vi).toContain(PHOTO_UNREADABLE);
    expect(PHOTO_SYSTEM.en).toContain(PHOTO_UNREADABLE);
  });
});

describe('a photo read by the AI on this computer', () => {
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
    model: 'qwen2.5vl:7b',
    label: 'Ollama · qwen2.5vl:7b',
  };
  const details = (vision: 'yes' | 'no' | 'unverified'): ModelDetails => ({
    model: selection.model,
    contextLength: 8192,
    vision,
    thinking: 'no',
    loaded: null,
    remote: false,
    capabilities: { ...UNVERIFIED, vision },
    declared: UNVERIFIED,
  });
  beforeEach(() => {
    for (const fn of Object.values(local)) fn.mockReset();
    setLocalClientForTests(local);
    useLocalAiStore.setState({ selected: selection, checks: {}, userEndpoints: [] });
  });
  afterEach(() => {
    setLocalClientForTests(null);
    useLocalAiStore.setState({ selected: null, checks: {} });
  });

  it('is sent only to a model this computer saw reading pictures; otherwise nothing is sent', async () => {
    await expect(transcribeWithLocalRuntime('aGVsbG8=', 'vi')).resolves.toBeNull();
    for (const vision of ['no', 'unverified'] as const) {
      useLocalAiStore.getState().recordCheck('ollama', selection.baseUrl, details(vision));
      await expect(transcribeWithLocalRuntime('aGVsbG8=', 'vi')).resolves.toBeNull();
    }
    expect(local.chat).not.toHaveBeenCalled();

    useLocalAiStore.getState().recordCheck('ollama', selection.baseUrl, details('yes'));
    local.chat.mockResolvedValue({
      content: ' Một vật rơi tự do từ 20 m. ',
      model: selection.model,
      runtime: 'ollama',
      durationMs: 3,
      firstPieceMs: 1,
      truncated: false,
      streamed: false,
    });
    await expect(transcribeWithLocalRuntime('aGVsbG8=', 'vi')).resolves.toBe(
      'Một vật rơi tự do từ 20 m.',
    );
    const [req] = local.chat.mock.calls[0] ?? [];
    expect(req).toMatchObject({ kind: 'ollama', model: selection.model, vision: true });
    expect(req?.messages[0]?.images).toEqual(['aGVsbG8=']);
  });

  describe('each cause gets its own sentence, and nothing goes online', () => {
    const cloudCalls: unknown[] = [];
    beforeEach(() => {
      cloudCalls.length = 0;
      setTransportForTests({
        chat: (req: unknown) => {
          cloudCalls.push(req);
          return Promise.reject(new Error('never'));
        },
        transcribePhoto: (req: unknown) => {
          cloudCalls.push(req);
          return Promise.resolve('online');
        },
      } as unknown as LlmTransport);
    });
    afterEach(() => {
      setTransportForTests(null);
    });

    it('no runtime and model picked: says so, opens its Settings page, sends nothing', async () => {
      const expected = {
        kind: 'error',
        message: translate('vi', 'camera.localNotSelected'),
        section: 'runtimes',
      };
      await expect(readPhotoOnComputer('local-missing', 'aGVsbG8=', 'vi')).resolves.toEqual(
        expected,
      );
      useLocalAiStore.setState({ selected: null });
      await expect(readPhotoOnComputer('local', 'aGVsbG8=', 'vi')).resolves.toEqual(expected);
      // Never "the model you chose cannot read pictures": no model was chosen.
      expect(expected.message).not.toMatch(/đã chọn chưa đọc được ảnh/);
      expect(local.chat).not.toHaveBeenCalled();
      expect(cloudCalls).toHaveLength(0);
    });

    it('a model not seen reading pictures here is not asked (unverified, or no)', async () => {
      await expect(readPhotoOnComputer('local', 'aGVsbG8=', 'vi')).resolves.toEqual({
        kind: 'noVision',
      });
      useLocalAiStore.getState().recordCheck('ollama', selection.baseUrl, details('unverified'));
      await expect(readPhotoOnComputer('local', 'aGVsbG8=', 'vi')).resolves.toEqual({
        kind: 'noVision',
      });
      useLocalAiStore.getState().recordCheck('ollama', selection.baseUrl, details('no'));
      await expect(readPhotoOnComputer('local', 'aGVsbG8=', 'vi')).resolves.toEqual({
        kind: 'noVision',
      });
      expect(local.chat).not.toHaveBeenCalled();
      expect(cloudCalls).toHaveLength(0);
    });

    it.each([
      [new AiError('network', 'local-unreachable: connection refused'), 'localDown'],
      [new AiError('timeout', 'local-stalled: first-piece 120000 ms'), 'localStalled'],
      [new AiError('http', 'model-missing: 404: model not found'), 'localModelMissing'],
    ] as const)(
      'a model that reads pictures but whose runtime fails (%s) gets "%s", once',
      async (error, key) => {
        useLocalAiStore.getState().recordCheck('ollama', selection.baseUrl, details('yes'));
        local.chat.mockRejectedValue(error);
        const reading = await readPhotoOnComputer('local', 'aGVsbG8=', 'vi');
        expect(reading).toEqual({
          kind: 'error',
          message: translate('vi', `chat.errors.${key}`, { name: 'Ollama' }),
          section: 'runtimes',
        });
        // Not "cannot read pictures" and not "needs an API key": the runtime is the problem.
        expect(reading.kind === 'error' && reading.message).not.toMatch(/khóa API/);
        expect(local.chat).toHaveBeenCalledTimes(1);
        expect(cloudCalls).toHaveLength(0);
      },
    );

    it('a runtime that says its model reads no pictures is the same as one not seen reading them', async () => {
      useLocalAiStore.getState().recordCheck('ollama', selection.baseUrl, details('yes'));
      for (const message of ['no-vision', 'vision-unverified']) {
        local.chat.mockRejectedValueOnce(new AiError('notAllowed', message));
        await expect(readPhotoOnComputer('local', 'aGVsbG8=', 'vi')).resolves.toEqual({
          kind: 'noVision',
        });
      }
      expect(cloudCalls).toHaveLength(0);
    });

    it.each([
      // The picture itself was refused: take another one (asking again cannot help).
      [new AiError('notAllowed', 'bad-image: over 2 MB'), 'camera.readFailed', null],
      // One photo cannot be shortened in Trí nhớ: only a model with a larger window helps.
      [
        new AiError('http', 'local-failed: 400: the request exceeds the available context size'),
        'chat.errors.localContextTask',
        'runtimes',
      ],
      // The model wrote only its reasoning: never "gặp lỗi", never a raw code.
      [new AiError('badResponse', 'reasoningOnly'), 'chat.errors.localNoAnswer', 'runtimes'],
    ] as const)('%s gets its own sentence and page', async (error, key, section) => {
      useLocalAiStore.getState().recordCheck('ollama', selection.baseUrl, details('yes'));
      local.chat.mockRejectedValue(error);
      await expect(readPhotoOnComputer('local', 'aGVsbG8=', 'vi')).resolves.toEqual({
        kind: 'error',
        message: translate('vi', key, { name: 'Ollama' }),
        section,
      });
      expect(local.chat).toHaveBeenCalledTimes(1);
      expect(cloudCalls).toHaveLength(0);
    });
  });
});
