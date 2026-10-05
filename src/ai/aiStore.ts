import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Provider } from './types';

export type ProviderChoice = Provider | 'off';

export const PROVIDERS: readonly Provider[] = ['gemini', 'openai', 'anthropic'];

export interface AiSettingsState {
  provider: ProviderChoice;
  models: Record<Provider, string>;
  timeoutSecs: number;
  /** Live connection status (not persisted). `badKey`: the provider refused the key. */
  status: 'unknown' | 'ok' | 'offline' | 'noKey' | 'badKey';
  setProvider: (p: ProviderChoice) => void;
  setModel: (p: Provider, m: string) => void;
  setTimeoutSecs: (s: number) => void;
}

/**
 * Model used when the field is empty. Gemini: a Flash model of Google AI Studio's free tier
 * (checked 2026-10 on ai.google.dev/gemini-api/docs/pricing); students can change it in Settings.
 */
export const DEFAULT_MODELS: Record<Provider, string> = {
  gemini: 'gemini-3.8-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-5',
};

interface Persisted {
  provider: ProviderChoice;
  models: Record<Provider, string>;
  timeoutSecs: number;
}

/**
 * Version 1 had a local "LM Studio" provider (removed: the app now uses Gemini by default).
 * Its settings move to Gemini; the cloud models the user typed are kept.
 */
export function migrateAiSettings(old: unknown): Persisted {
  const o = (old ?? {}) as {
    provider?: unknown;
    models?: Record<string, unknown>;
    timeoutSecs?: unknown;
  };
  const models = { ...DEFAULT_MODELS };
  for (const p of PROVIDERS) {
    const m = o.models?.[p];
    if (typeof m === 'string' && m.trim()) models[p] = m;
  }
  const choices: readonly unknown[] = [...PROVIDERS, 'off'];
  return {
    // "lmstudio" (or anything unknown) becomes Gemini.
    provider: choices.includes(o.provider) ? (o.provider as ProviderChoice) : 'gemini',
    models,
    timeoutSecs: typeof o.timeoutSecs === 'number' ? o.timeoutSecs : 90,
  };
}

export const useAiStore = create<AiSettingsState>()(
  persist(
    (set, get) => ({
      provider: 'gemini',
      models: { ...DEFAULT_MODELS },
      timeoutSecs: 90,
      status: 'unknown',
      setProvider: (provider) => {
        set({ provider, status: 'unknown' });
      },
      setModel: (p, m) => {
        set({ models: { ...get().models, [p]: m } });
      },
      setTimeoutSecs: (s) => {
        set({ timeoutSecs: Math.min(600, Math.max(5, Math.round(s))) });
      },
    }),
    {
      name: 'stemsim.ai',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      migrate: migrateAiSettings,
      partialize: ({ provider, models, timeoutSecs }) => ({ provider, models, timeoutSecs }),
    },
  ),
);
