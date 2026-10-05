import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Provider } from './types';

export type ProviderChoice = Provider | 'off';
export type AiStatus =
  | 'unknown'
  | 'ok'
  | 'offline'
  | 'noKey'
  | 'badKey'
  | 'quota'
  | 'badModel'
  | 'error'
  /** The safety gates are closed (src/safety): no AI call is made. */
  | 'notAllowed';

/**
 * Providers of this edition (PROMPT_PHAN_2 A2 + user decision 2026-10-05): the main edition has
 * Gemini (default), Claude and Groq; the supervised pilot edition has Claude and Groq (no Gemini:
 * its terms exclude users under 18).
 */
export const PROVIDERS: readonly Provider[] =
  __EDITION__ === 'pilot' ? ['claude', 'groq'] : ['gemini', 'claude', 'groq'];
export const DEFAULT_PROVIDER: Provider = __EDITION__ === 'pilot' ? 'claude' : 'gemini';
/** Free fallback when the chosen provider is out of quota/credit (used only if it has a key). */
export const DEFAULT_FALLBACK: ProviderChoice = 'groq';

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
  /** "Dự phòng khi hết lượt": provider used when the chosen one is out of quota/credit. */
  fallback: ProviderChoice;
  /**
   * Live connection status (not persisted). `badKey`: the provider refused the key; `quota`:
   * rate or quota limit; `badModel`: the model name is unknown; `error`: other server error.
   */
  status: AiStatus;
  /** Server message when `status` is `error`. */
  statusDetail: string;
  setProvider: (p: ProviderChoice) => void;
  setModel: (p: Provider, m: string) => void;
  setTimeoutSecs: (s: number) => void;
  setDailyCap: (n: number) => void;
  setFallback: (p: ProviderChoice) => void;
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
  // Groq free tier, strict JSON schema; Qwen models rank high on the SEA-HELM Vietnamese
  // leaderboard (checked 2026-10-05). Re-check with the golden set (LLM_PROVIDER=groq).
  groq: 'qwen/qwen3.8-27b',
};

/** The model to use for a provider (an empty field means the default model). */
export function modelFor(models: Record<Provider, string>, p: Provider): string {
  return models[p].trim() || DEFAULT_MODELS[p];
}

interface Persisted {
  provider: ProviderChoice;
  models: Record<Provider, string>;
  timeoutSecs: number;
  dailyCap: number;
  fallback: ProviderChoice;
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
    fallback?: unknown;
  };
  const models = { ...DEFAULT_MODELS };
  const typed = (k: string) => {
    const m = o.models?.[k];
    return typeof m === 'string' && m.trim() ? m : null;
  };
  models.gemini = typed('gemini') ?? models.gemini;
  models.claude = typed('claude') ?? typed('anthropic') ?? models.claude;
  models.groq = typed('groq') ?? models.groq;
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
    fallback: choices.includes(o.fallback) ? (o.fallback as ProviderChoice) : DEFAULT_FALLBACK,
  };
}

export const useAiStore = create<AiSettingsState>()(
  persist(
    (set, get) => ({
      provider: DEFAULT_PROVIDER,
      models: { ...DEFAULT_MODELS },
      timeoutSecs: DEFAULT_TIMEOUT_SECS,
      dailyCap: DEFAULT_DAILY_CAP,
      fallback: DEFAULT_FALLBACK,
      status: 'unknown',
      statusDetail: '',
      setProvider: (provider) => {
        set({ provider, status: 'unknown', statusDetail: '' });
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
      setFallback: (fallback) => {
        set({ fallback });
      },
    }),
    {
      name: 'stemsim.ai',
      version: 4,
      storage: createJSONStorage(() => localStorage),
      migrate: migrateAiSettings,
      partialize: ({ provider, models, timeoutSecs, dailyCap, fallback }) => ({
        provider,
        models,
        timeoutSecs,
        dailyCap,
        fallback,
      }),
    },
  ),
);

/** The user's local date as "YYYY-MM-DD" (the daily cap resets at local midnight). */
export function localDay(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
