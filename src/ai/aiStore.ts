import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Provider } from './types';

export type ProviderChoice = Provider | 'off';

export interface AiSettingsState {
  provider: ProviderChoice;
  /** LM Studio server (OpenAI-compatible). */
  baseUrl: string;
  models: Record<Provider, string>;
  timeoutSecs: number;
  /** Live connection status (not persisted). */
  status: 'unknown' | 'ok' | 'offline' | 'noKey';
  availableModels: string[];
  setProvider: (p: ProviderChoice) => void;
  setBaseUrl: (u: string) => void;
  setModel: (p: Provider, m: string) => void;
  setTimeoutSecs: (s: number) => void;
}

export const DEFAULT_MODELS: Record<Provider, string> = {
  lmstudio: '',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-5',
};

export const useAiStore = create<AiSettingsState>()(
  persist(
    (set, get) => ({
      provider: 'lmstudio',
      baseUrl: 'http://localhost:1234/v1',
      models: { ...DEFAULT_MODELS },
      timeoutSecs: 60,
      status: 'unknown',
      availableModels: [],
      setProvider: (provider) => {
        set({ provider, status: 'unknown', availableModels: [] });
      },
      setBaseUrl: (baseUrl) => {
        set({ baseUrl, status: 'unknown' });
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
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ provider, baseUrl, models, timeoutSecs }) => ({
        provider,
        baseUrl,
        models,
        timeoutSecs,
      }),
    },
  ),
);
