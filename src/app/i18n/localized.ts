import { useCallback } from 'react';
import { pickTex, type LocalizedTex } from '@/core/data/dataset';
import { useSettingsStore } from '@/app/settings/settingsStore';

/**
 * Picks the current UI language from a `{ vi, en }` scientific text, or from a KaTeX symbol that
 * may differ by language (a plain string is the same in both, #258).
 */
export function useLocalized(): (text: LocalizedTex) => string {
  const locale = useSettingsStore((s) => s.locale);
  return useCallback((text) => pickTex(text, locale), [locale]);
}
