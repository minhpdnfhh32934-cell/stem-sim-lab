import { describe, expect, it } from 'vitest';
import { DEFAULT_MODELS, migrateAiSettings } from './aiStore';

describe('AI settings migration', () => {
  it('moves the removed LM Studio provider to Gemini and keeps typed cloud models', () => {
    const v1 = {
      provider: 'lmstudio',
      baseUrl: 'http://localhost:1234/v1',
      models: { lmstudio: 'qwen', openai: 'gpt-x', anthropic: '' },
      timeoutSecs: 60,
    };
    expect(migrateAiSettings(v1)).toEqual({
      provider: 'gemini',
      models: { ...DEFAULT_MODELS, openai: 'gpt-x' },
      timeoutSecs: 60,
    });
  });

  it('keeps a valid provider and fills missing values', () => {
    expect(migrateAiSettings({ provider: 'anthropic' })).toEqual({
      provider: 'anthropic',
      models: DEFAULT_MODELS,
      timeoutSecs: 90,
    });
    expect(migrateAiSettings(undefined).provider).toBe('gemini');
  });
});
