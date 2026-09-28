import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Locale } from '@/app/i18n/types';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

/** Font scale steps offered in Settings (1 = 14px base). */
export const FONT_SCALES = [0.9, 1, 1.1, 1.25, 1.4] as const;
export type FontScale = (typeof FONT_SCALES)[number];

export interface SettingsState {
  theme: ThemePreference;
  locale: Locale;
  fontScale: FontScale;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: (current: ResolvedTheme) => void;
  setLocale: (locale: Locale) => void;
  setFontScale: (scale: FontScale) => void;
  stepFontScale: (direction: 1 | -1) => void;
}

export const DEFAULT_SETTINGS = {
  theme: 'system',
  locale: 'vi',
  fontScale: 1,
} as const satisfies Pick<SettingsState, 'theme' | 'locale' | 'fontScale'>;

/** Returns the next font scale step in `direction`, clamped to the available steps. */
export function nextFontScale(current: FontScale, direction: 1 | -1): FontScale {
  const index = FONT_SCALES.indexOf(current);
  const next = Math.min(FONT_SCALES.length - 1, Math.max(0, index + direction));
  return FONT_SCALES[next] ?? current;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,
      setTheme: (theme) => {
        set({ theme });
      },
      toggleTheme: (current) => {
        set({ theme: current === 'dark' ? 'light' : 'dark' });
      },
      setLocale: (locale) => {
        set({ locale });
      },
      setFontScale: (fontScale) => {
        set({ fontScale });
      },
      stepFontScale: (direction) => {
        set({ fontScale: nextFontScale(get().fontScale, direction) });
      },
    }),
    {
      name: 'stemsim.settings',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ theme, locale, fontScale }) => ({ theme, locale, fontScale }),
    },
  ),
);
