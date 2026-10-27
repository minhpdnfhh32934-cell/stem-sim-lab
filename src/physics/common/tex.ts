import type { Locale } from '@/app/i18n/types';
import { formatNumber } from '@/app/i18n';
import { fromSI, unitLabel } from '@/core/units';

/**
 * Formats a number for KaTeX with `sig` significant digits, using a decimal comma in
 * Vietnamese (written `{,}` so KaTeX does not add list spacing) and thousands grouped like
 * `formatNumber` ("35{.}950"), and ×10ⁿ for very large/small magnitudes. English is not grouped
 * ("35950"): "1{,}234" must have one meaning (1,234 in Vietnamese), see `texNumbers`.
 */
export function texNum(locale: Locale, value: number, sig = 4): string {
  if (!Number.isFinite(value)) return '\\text{—}';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  const exp = Math.floor(Math.log10(abs));
  const sep = locale === 'vi' ? '{,}' : '.';
  const group = locale === 'vi' ? '{.}' : '';
  const plain = (v: number) => {
    const digits = Math.max(0, sig - 1 - Math.floor(Math.log10(Math.abs(v)) + 1e-12));
    let s = v.toFixed(Math.min(12, digits));
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
    const [int = '', frac] = s.split('.');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, group);
    return frac === undefined ? grouped : `${grouped}${sep}${frac}`;
  };
  if (exp >= 6 || exp <= -4) {
    const mant = value / 10 ** exp;
    return `${plain(Number(mant.toPrecision(sig)))} \\cdot 10^{${exp}}`;
  }
  return plain(Number(value.toPrecision(sig)));
}

/** A number as `texNum` writes it: "35{.}950", "9{,}81", "9.81", "8{,}011 \cdot 10^{-16}". */
const TEX_NUM = /(\d+(?:\{\.\}\d{3})*(?:(?:\{,\}|\.)\d+)?)(?:\s*\\cdot\s*10\^\{(-?\d+)\})?/g;

/**
 * The numbers (magnitudes) a TeX string written with `texNum` shows, each with its one meaning:
 * "{.}" groups thousands, "{,}" (Vietnamese) or "." (English) is the decimal mark. Never the
 * several readings of free text ("9,81" is not 981, "35.950" is not 35,95).
 */
export function texNumbers(tex: string): number[] {
  return [...tex.matchAll(TEX_NUM)].map((m) => {
    const mant = Number((m[1] ?? '').replace(/\{\.\}/g, '').replace('{,}', '.'));
    return m[2] === undefined ? mant : mant * 10 ** Number(m[2]);
  });
}

/** Value (SI) converted to `unit` and formatted for KaTeX with the unit appended. */
export function texQty(locale: Locale, valueSI: number, unit: string, sig = 4): string {
  const v = fromSI(valueSI, unit);
  const u = unitLabel(unit);
  if (!u) return texNum(locale, v, sig);
  if (unit === 'deg') return `${texNum(locale, v, sig)}^\\circ`;
  return `${texNum(locale, v, sig)}\\,${texUnit(u)}`;
}

/** A unit label in KaTeX, whose fonts lack "µ", "²", "³" (symbolNotInFont): "m/s²" → \text{m/s}^{2}. */
function texUnit(u: string): string {
  const tex: Record<string, string> = { µ: '\\mathrm{\\mu}', '²': '^{2}', '³': '^{3}' };
  return u
    .split(/([µ²³])/)
    .filter((part) => part !== '')
    .map((part) => tex[part] ?? `\\text{${part}}`)
    .join('');
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/**
 * Plain-text quantity for canvas labels and tables. Below 10⁻³ (exponent −4 and lower) it is written as a power of ten
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
