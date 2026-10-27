import { formatNumber } from '@/app/i18n';
import type { Locale } from '@/app/i18n/types';

const SUPERSCRIPT: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
};

/**
 * A small relative deviation the way a learner writes it: "5·10⁻¹³" (one significant digit),
 * a plain number from 10⁻² up ("0,03"), and "0" below 10⁻¹⁵ (pure round-off).
 */
export function formatDeviation(locale: Locale, dev: number): string {
  if (!(dev >= 1e-15)) return '0';
  let exp = Math.floor(Math.log10(dev));
  if (exp >= -2) return formatNumber(locale, dev, { maximumSignificantDigits: 1 });
  let mantissa = Math.round(dev / 10 ** exp);
  if (mantissa === 10) {
    mantissa = 1;
    exp += 1;
  }
  return `${mantissa}·10${String(exp).replace(/[-\d]/g, (c) => SUPERSCRIPT[c] ?? c)}`;
}

/**
 * Formatter for one table column: the same number of decimals on every row (5 significant
 * digits at the column's largest value), so round-off noise (1,4·10⁻¹⁷ next to 0,01) and −0
 * print as 0. Columns of very small or very large numbers keep 5 significant digits per value.
 */
export function columnFormat(locale: Locale, values: readonly number[]): (v: number) => string {
  let max = 0;
  for (const v of values) if (Number.isFinite(v)) max = Math.max(max, Math.abs(v));
  const mag = max > 0 ? Math.floor(Math.log10(max)) : 0;
  if (mag < -3 || mag > 9) {
    return (v) =>
      formatNumber(locale, Math.abs(v) <= 1e-9 * max ? 0 : v, { maximumSignificantDigits: 5 });
  }
  const digits = Math.max(0, 4 - mag);
  return (v) =>
    formatNumber(locale, Number(v.toFixed(digits)) || 0, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
}
