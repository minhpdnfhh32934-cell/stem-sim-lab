import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Provider } from './types';

export type ProviderChoice = Provider | 'off';

/**
 * Providers of this edition (PROMPT_PHAN_2 A2): the main edition has Gemini (default) and
 * Claude; the supervised pilot edition has Claude only.
 */
export const PROVIDERS: readonly Provider[] =
  __EDITION__ === 'pilot' ? ['claude'] : ['gemini', 'claude'];
export const DEFAULT_PROVIDER: Provider = __EDITION__ === 'pilot' ? 'claude' : 'gemini';

/** Default timeout of one AI call in seconds, retries included (PROMPT_PHAN_2 A2). */
export const DEFAULT_TIMEOUT_SECS = 30;
/** Default maximum number of AI calls per day (one problem reading ≈ 2–4 calls). */
export const DEFAULT_DAILY_CAP = 100;

export interface AiSettingsState {
  provider: ProviderChoice;
  models: Record<Provider, string>;
  timeoutSecs: number;
  /** Maximum AI calls per day, counted by the Rust gateway (0 = no limit). */
  dailyCap: number;
  /** Live connection status (not persisted). `badKey`: the provider refused the key. */
  status: 'unknown' | 'ok' | 'offline' | 'noKey' | 'badKey';
  setProvider: (p: ProviderChoice) => void;
  setModel: (p: Provider, m: string) => void;
  setTimeoutSecs: (s: number) => void;
  setDailyCap: (n: number) => void;
}

/**
 * Model used when the field is empty (not hard-coded elsewhere; users can change it in
 * Settings). Gemini: a Flash model of Google AI Studio's free tier (checked 2026-10 on
 * ai.google.dev/gemini-api/docs/pricing). Claude: Sonnet 5.5, the fast current model
 * (checked 2026-10 on platform.claude.com/docs/en/models/overview).
 */
export const DEFAULT_MODELS: Record<Provider, string> = {
  gemini: 'gemini-3.8-flash',
  claude: 'claude-sonnet-5-5',
};

interface Persisted {
  provider: ProviderChoice;
  models: Record<Provider, string>;
  timeoutSecs: number;
  dailyCap: number;
}

/**
 * Settings of older versions:
 * - v1 had a local "LM Studio" provider, v1–v2 had OpenAI: both removed, they move to the
 *   edition's default provider.
 * - "anthropic" is now called "claude" (its typed model is kept).
 * - The old default timeout of 90 s becomes the new default of 30 s; other values are kept.
 */
export function migrateAiSettings(old: unknown): Persisted {
  const o = (old ?? {}) as {
    provider?: unknown;
    models?: Record<string, unknown>;
    timeoutSecs?: unknown;
    dailyCap?: unknown;
  };
  const models = { ...DEFAULT_MODELS };
  const typed = (k: string) => {
    const m = o.models?.[k];
    return typeof m === 'string' && m.trim() ? m : null;
  };
  models.gemini = typed('gemini') ?? models.gemini;
  models.claude = typed('claude') ?? typed('anthropic') ?? models.claude;
  const provider = o.provider === 'anthropic' ? 'claude' : o.provider;
  const choices: readonly unknown[] = [...PROVIDERS, 'off'];
  const timeout =
    typeof o.timeoutSecs === 'number' && o.timeoutSecs !== 90
      ? o.timeoutSecs
      : DEFAULT_TIMEOUT_SECS;
  return {
    provider: choices.includes(provider) ? (provider as ProviderChoice) : DEFAULT_PROVIDER,
    models,
    timeoutSecs: timeout,
    dailyCap:
      typeof o.dailyCap === 'number' && o.dailyCap >= 0
        ? Math.round(o.dailyCap)
        : DEFAULT_DAILY_CAP,
  };
}

export const useAiStore = create<AiSettingsState>()(
  persist(
    (set, get) => ({
      provider: DEFAULT_PROVIDER,
      models: { ...DEFAULT_MODELS },
      timeoutSecs: DEFAULT_TIMEOUT_SECS,
      dailyCap: DEFAULT_DAILY_CAP,
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
      setDailyCap: (n) => {
        set({ dailyCap: Math.min(10_000, Math.max(0, Math.round(n))) });
      },
    }),
    {
      name: 'stemsim.ai',
      version: 3,
      storage: createJSONStorage(() => localStorage),
      migrate: migrateAiSettings,
      partialize: ({ provider, models, timeoutSecs, dailyCap }) => ({
        provider,
        models,
        timeoutSecs,
        dailyCap,
      }),
    },
  ),
);

/** The user's local date as "YYYY-MM-DD" (the daily cap resets at local midnight). */
export function localDay(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
