import { formatNumber } from '@/app/i18n';
import type { Locale } from '@/app/i18n/types';

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

/**
 * A number as the textbook writes large and small ones: "5·10¹⁴", "3,8·10⁻⁷", "1·10⁵" (Vietnamese
 * decimal comma), "10⁻¹²" for a power of ten; plain between 0,01 and 10 000.
 */
export function sci(locale: Locale, v: number, sig = 3): string {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(v)) + 1e-12);
  if (exp >= -2 && exp <= 4) return formatNumber(locale, Number(v.toPrecision(sig)));
  let mant = Number((v / 10 ** exp).toPrecision(sig));
  let e = exp;
  if (Math.abs(mant) >= 10) {
    mant /= 10;
    e += 1;
  }
  const power = `10${String(e).replace(/[-\d]/g, (c) => SUP[c] ?? c)}`;
  return mant === 1 ? power : `${formatNumber(locale, mant)}·${power}`;
}
