import { useCallback } from 'react';
import type { LocalizedText } from '@/core/data/dataset';
import { useSettingsStore } from '@/app/settings/settingsStore';

/** Picks the current UI language from a `{ vi, en }` scientific text. */
export function useLocalized(): (text: LocalizedText) => string {
  const locale = useSettingsStore((s) => s.locale);
  return useCallback((text) => text[locale], [locale]);
}
