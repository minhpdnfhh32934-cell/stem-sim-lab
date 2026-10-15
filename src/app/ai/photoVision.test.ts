import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocalClientForTests } from '@/ai/local/client';
import { useLocalAiStore } from '@/ai/local/localAiStore';
import { UNVERIFIED, type LocalRuntimeClient, type ModelDetails } from '@/ai/local/types';
import {
  PHOTO_SYSTEM,
  PHOTO_UNREADABLE,
  cleanTranscription,
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
});
