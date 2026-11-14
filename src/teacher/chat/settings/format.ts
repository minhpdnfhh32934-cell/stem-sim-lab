import { formatNumber } from '@/app/i18n';
import type { Locale } from '@/app/i18n/types';

/** Sizes of model files in the learner's language, e.g. "343,2 MB", "3,80 GB" (en: "3.80 GB"). */
export function formatBytes(value: number, locale: Locale): string {
  const fixed = (v: number, digits: number) =>
    formatNumber(locale, v, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (value >= 1_000_000_000) return `${fixed(value / 1_000_000_000, 2)} GB`;
  if (value < 1_000_000) return `${fixed(value / 1_000, 0)} KB`;
  return `${fixed(value / 1_000_000, 1)} MB`;
}
