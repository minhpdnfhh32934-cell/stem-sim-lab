import { formatNumber } from '@/app/i18n';

/** What the field shows when not being edited: 6 significant digits, decimal comma in Vietnamese. */
export const fieldText = (locale: 'vi' | 'en', value: number) =>
  formatNumber(locale, Number(value.toPrecision(6)), {
    maximumSignificantDigits: 6,
    useGrouping: false,
  });

/** "0,25" or "0.25" (either separator, whatever the language) → 0.25; anything else → NaN. */
export function parseField(text: string): number {
  const t = text.trim().replace('−', '-').replace(',', '.');
  return t === '' ? Number.NaN : Number(t);
}
