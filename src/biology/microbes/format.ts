/** How the growth lesson writes its numbers (Vietnamese decimal comma via formatNumber). */
import { formatNumber, type Locale } from '@/app/i18n';

const SUP: Record<string, string> = {
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
const sup = (n: number) => String(n).replace(/[-0-9]/g, (c) => SUP[c] ?? c);

/**
 * A number of cells: whole cells up to a million, then 3 significant digits × 10ᵏ (the formula's
 * value, never a rounded-away power: 2⁷² × 100 reads 4,72 × 10²³).
 */
export function formatCells(locale: Locale, v: number): string {
  if (!Number.isFinite(v)) return '—';
  if (Math.abs(v) < 1e6) return formatNumber(locale, Math.round(v));
  const exp = Math.floor(Math.log10(v));
  let mant = Number((v / 10 ** exp).toPrecision(3));
  let e = exp;
  if (mant >= 10) {
    mant /= 10;
    e += 1;
  }
  return `${formatNumber(locale, mant, { maximumSignificantDigits: 3 })} × 10${sup(e)}`;
}

/** n = t/g: a whole number, else 3 decimals. */
export function formatGenerations(locale: Locale, n: number): string {
  return formatNumber(locale, n, { maximumFractionDigits: 3 });
}
