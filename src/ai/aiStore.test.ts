import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DAILY_CAP,
  DEFAULT_MODELS,
  DEFAULT_TIMEOUT_SECS,
  PROVIDERS,
  localDay,
  migrateAiSettings,
} from './aiStore';

describe('AI settings migration', () => {
  it('moves the removed LM Studio provider to Gemini', () => {
    const v1 = {
      provider: 'lmstudio',
      baseUrl: 'http://localhost:1234/v1',
      models: { lmstudio: 'qwen', openai: 'gpt-x', anthropic: '' },
      timeoutSecs: 60,
    };
    expect(migrateAiSettings(v1)).toEqual({
      provider: 'gemini',
      models: DEFAULT_MODELS,
      timeoutSecs: 60,
      dailyCap: DEFAULT_DAILY_CAP,
      fallback: 'groq',
    });
  });

  it('moves the removed OpenAI provider to Gemini and renames Anthropic to Claude', () => {
    expect(migrateAiSettings({ provider: 'openai' }).provider).toBe('gemini');
    const old = { provider: 'anthropic', models: { anthropic: 'claude-x', gemini: 'g' } };
    expect(migrateAiSettings(old)).toMatchObject({
      provider: 'claude',
      models: { claude: 'claude-x', gemini: 'g' },
    });
  });

  it('replaces the old 90 s default timeout and fills missing values', () => {
    expect(migrateAiSettings({ provider: 'gemini', timeoutSecs: 90 }).timeoutSecs).toBe(
      DEFAULT_TIMEOUT_SECS,
    );
    expect(migrateAiSettings({ timeoutSecs: 45, dailyCap: 0 })).toMatchObject({
      timeoutSecs: 45,
      dailyCap: 0,
    });
    expect(migrateAiSettings(undefined)).toEqual({
      provider: 'gemini',
      models: DEFAULT_MODELS,
      timeoutSecs: 30,
      dailyCap: DEFAULT_DAILY_CAP,
      fallback: 'groq',
    });
  });

  it('main edition offers Gemini first, then Claude and the free Groq', () => {
    expect(PROVIDERS).toEqual(['gemini', 'claude', 'groq']);
  });

  it('keeps a valid fallback choice and its typed model', () => {
    expect(migrateAiSettings({ fallback: 'off' }).fallback).toBe('off');
    expect(migrateAiSettings({ fallback: 'openai' }).fallback).toBe('groq');
    expect(migrateAiSettings({ models: { groq: 'openai/gpt-oss-120b' } }).models.groq).toBe(
      'openai/gpt-oss-120b',
    );
  });

  it('formats the local day for the daily cap', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
