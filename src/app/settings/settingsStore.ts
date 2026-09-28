import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Locale } from '@/app/i18n/types';
import { DEFAULT_GRAVITY, GRAVITY_PRESETS, type GravityPreset } from '@/core/constants';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

/** Font scale steps offered in Settings (1 = 14px base). */
export const FONT_SCALES = [0.9, 1, 1.1, 1.25, 1.4] as const;
export type FontScale = (typeof FONT_SCALES)[number];

export interface SettingsState {
  theme: ThemePreference;
  locale: Locale;
  fontScale: FontScale;
  /** g used only when a problem does not state it (always shown as a default). */
  defaultGravity: GravityPreset;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: (current: ResolvedTheme) => void;
  setLocale: (locale: Locale) => void;
  setFontScale: (scale: FontScale) => void;
  stepFontScale: (direction: 1 | -1) => void;
  setDefaultGravity: (g: GravityPreset) => void;
}

export const DEFAULT_SETTINGS = {
  theme: 'system',
  locale: 'vi',
  fontScale: 1,
  defaultGravity: DEFAULT_GRAVITY,
} as const satisfies Pick<SettingsState, 'theme' | 'locale' | 'fontScale' | 'defaultGravity'>;

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
      setDefaultGravity: (defaultGravity) => {
        if ((GRAVITY_PRESETS as readonly number[]).includes(defaultGravity))
          set({ defaultGravity });
      },
    }),
    {
      name: 'stemsim.settings',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ theme, locale, fontScale, defaultGravity }) => ({
        theme,
        locale,
        fontScale,
        defaultGravity,
      }),
    },
  ),
);
