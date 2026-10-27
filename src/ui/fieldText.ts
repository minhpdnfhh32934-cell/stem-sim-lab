import { formatNumber } from '@/app/i18n';

/** What the field shows when not being edited: 6 significant digits, decimal comma in Vietnamese. */
export const fieldText = (locale: 'vi' | 'en', value: number) =>
  formatNumber(locale, Number(value.toPrecision(6)), {
    maximumSignificantDigits: 6,
    useGrouping: false,
  });

/**
 * A typed number → value, or NaN. One "." or "," is the decimal mark, in either language
 * ("0,25" = "0.25"); a parameter never needs thousands, so two separators ("1.000.5") are refused,
 * as are hex ("0x10"), "Infinity" and values beyond the number range ("1e400").
 */
export function parseField(text: string): number {
  const t = text.trim().replace('−', '-');
  if ((t.match(/[.,]/g) ?? []).length > 1) return Number.NaN;
  const n = t.replace(',', '.');
  if (!/^-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(n)) return Number.NaN;
  const v = Number(n);
  return Number.isFinite(v) ? v : Number.NaN;
}
