import type { Locale } from '@/app/i18n/types';
import { formatNumber } from '@/app/i18n';
import { fromSI, unitLabel } from '@/core/units';

/**
 * Formats a number for KaTeX with `sig` significant digits, using a decimal comma in
 * Vietnamese (written `{,}` so KaTeX does not add list spacing) and ×10ⁿ for very
 * large/small magnitudes.
 */
export function texNum(locale: Locale, value: number, sig = 4): string {
  if (!Number.isFinite(value)) return '\\text{—}';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  const exp = Math.floor(Math.log10(abs));
  const sep = locale === 'vi' ? '{,}' : '.';
  const plain = (v: number) => {
    const digits = Math.max(0, sig - 1 - Math.floor(Math.log10(Math.abs(v)) + 1e-12));
    let s = v.toFixed(Math.min(12, digits));
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s.replace('.', sep).replace('-', '-');
  };
  if (exp >= 6 || exp <= -4) {
    const mant = value / 10 ** exp;
    return `${plain(Number(mant.toPrecision(sig)))} \\cdot 10^{${exp}}`;
  }
  return plain(Number(value.toPrecision(sig)));
}

/** Value (SI) converted to `unit` and formatted for KaTeX with the unit appended. */
export function texQty(locale: Locale, valueSI: number, unit: string, sig = 4): string {
  const v = fromSI(valueSI, unit);
  const u = unitLabel(unit);
  if (!u) return texNum(locale, v, sig);
  if (unit === 'deg') return `${texNum(locale, v, sig)}^\\circ`;
  return `${texNum(locale, v, sig)}\\,\\text{${u}}`;
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/**
 * Plain-text quantity for canvas labels and tables. Below 10⁻⁴ it is written as a power of ten
 * like `texNum` ("8,01·10⁻¹⁶ N"), never as a run of zeros.
 */
export function fmtQty(locale: Locale, valueSI: number, unit: string, sig = 4): string {
  const v = Number(fromSI(valueSI, unit).toPrecision(sig));
  const num = (x: number) =>
    formatNumber(locale, Number(x.toPrecision(sig)), { maximumSignificantDigits: sig });
  const exp = v !== 0 && Number.isFinite(v) ? Math.floor(Math.log10(Math.abs(v))) : 0;
  const pow = String(exp)
    .replace('-', '⁻')
    .replace(/\d/g, (d) => SUP.charAt(Number(d)));
  const s = exp <= -4 ? `${num(v / 10 ** exp)}·10${pow}` : num(v);
  const u = unitLabel(unit, locale);
  return u ? (unit === 'deg' ? `${s}°` : `${s} ${u}`) : s;
}
