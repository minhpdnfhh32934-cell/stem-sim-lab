import { useCallback } from 'react';
import { useSettingsStore } from '@/app/settings/settingsStore';
import en from './locales/en';
import vi from './locales/vi';
import type { Locale, MessageKey, MessageParams, Messages } from './types';

export type { Locale, MessageKey, MessageParams } from './types';
export { LOCALES } from './types';

const dictionaries: Record<Locale, Messages> = { vi, en };

/**
 * Looks up a dotted key and substitutes `{name}` placeholders.
 * Falls back to Vietnamese, then to the key itself, so a missing string is visible but never crashes.
 */
export function translate(locale: Locale, key: MessageKey, params?: MessageParams): string {
  const raw = lookup(dictionaries[locale], key) ?? lookup(dictionaries.vi, key) ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : formatParam(locale, value);
  });
}

function lookup(dict: unknown, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function formatParam(locale: Locale, value: string | number): string {
  // Vietnamese uses a decimal comma (1,5) — numbers must follow the UI locale.
  return typeof value === 'number' ? formatNumber(locale, value) : value;
}

export function formatNumber(
  locale: Locale,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', options).format(value);
}

export type TFunction = (key: MessageKey, params?: MessageParams) => string;

/** React hook returning a `t()` bound to the current UI locale. */
export function useT(): TFunction {
  const locale = useSettingsStore((s) => s.locale);
  return useCallback((key, params) => translate(locale, key, params), [locale]);
}

/** For tests and tooling: every locale's raw dictionary. */
export function getDictionary(locale: Locale): Messages {
  return dictionaries[locale];
}
