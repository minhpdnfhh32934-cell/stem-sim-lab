import { beforeEach, describe, expect, it } from 'vitest';
import { useLocalAiStore } from '@/ai/local/localAiStore';
import { useChatStore } from '@/teacher/chat/chatStore';
import { analysisEngine, analysisEngineFor, engineKind } from './engineChoice';

describe('engine for problem analysis and chat', () => {
  it('uses the API unless Gemma is selected', () => {
    expect(analysisEngineFor('cloud', true, true)).toBe('cloud');
  });
  it('uses Gemma whenever its model is ready', () => {
    expect(analysisEngineFor('gemma', false, true)).toBe('gemma');
    expect(analysisEngineFor('gemma', true, true)).toBe('gemma');
  });
  it('a default (not chosen) Gemma without a model falls back to the API', () => {
    expect(analysisEngineFor('gemma', false, false)).toBe('cloud');
  });
  it('a Gemma the learner chose never silently goes online', () => {
    expect(analysisEngineFor('gemma', true, false)).toBe('gemma-missing');
  });

  it.each([
    // [chosen, gemma ready, local selected] → result
    [true, false, true, 'local'],
    [true, true, true, 'local'],
    [true, false, false, 'local-missing'],
    [true, true, false, 'local-missing'],
    // `local` is always the learner's choice; even an odd "not chosen" never goes online.
    [false, false, false, 'local-missing'],
    [false, true, true, 'local'],
  ] as const)(
    'local runtime: chosen %s, Gemma ready %s, runtime picked %s → %s (never cloud)',
    (chosen, gemma, selected, result) => {
      expect(analysisEngineFor('local', chosen, gemma, selected)).toBe(result);
      expect(analysisEngineFor('local', chosen, gemma, selected)).not.toBe('cloud');
    },
  );

  it('a picked runtime is used only when the local engine is chosen', () => {
    expect(analysisEngineFor('cloud', true, false, true)).toBe('cloud');
    expect(analysisEngineFor('gemma', true, true, true)).toBe('gemma');
    expect(analysisEngineFor('gemma', true, false, true)).toBe('gemma-missing');
  });

  it('names the engine that really answers', () => {
    expect(engineKind('cloud')).toBe('cloud');
    expect(engineKind('gemma')).toBe('gemma');
    expect(engineKind('gemma-missing')).toBe('gemma');
    expect(engineKind('local')).toBe('local');
    expect(engineKind('local-missing')).toBe('local');
  });
});

describe('analysisEngine() reads the stores', () => {
  const selection = {
    kind: 'ollama' as const,
    baseUrl: 'http://127.0.0.1:11434',
    model: 'qwen3:8b',
    label: 'Ollama · qwen3:8b',
  };
  beforeEach(() => {
    useLocalAiStore.setState({ selected: null, checks: {}, userEndpoints: [] });
  });

  it('local without a saved runtime and model → local-missing, never cloud', async () => {
    useChatStore.setState({ engine: 'local', engineChosen: true });
    await expect(analysisEngine()).resolves.toBe('local-missing');
    useLocalAiStore.getState().select(selection);
    await expect(analysisEngine()).resolves.toBe('local');
  });

  it('a saved address off this computer is dropped, so nothing is sent', async () => {
    useChatStore.setState({ engine: 'local', engineChosen: true });
    useLocalAiStore.getState().select({ ...selection, baseUrl: 'http://192.168.1.5:11434' });
    expect(useLocalAiStore.getState().selected).toBeNull();
    await expect(analysisEngine()).resolves.toBe('local-missing');
  });
});
