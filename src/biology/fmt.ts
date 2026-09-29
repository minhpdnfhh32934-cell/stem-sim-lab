import { formatNumber } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';

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
 * Formats a number with the user's locale (Vietnamese decimal comma). Very small values
 * use scientific notation (2,7 × 10⁻¹²) instead of a long row of zeros.
 */
export function useFmt() {
  const locale = useSettingsStore((s) => s.locale);
  return (v: number, digits = 3) => {
    if (!Number.isFinite(v)) return '—';
    if (v !== 0 && Math.abs(v) < 1e-3) {
      const exp = Math.floor(Math.log10(Math.abs(v)));
      const mant = v / 10 ** exp;
      const m = formatNumber(locale, mant, { maximumSignificantDigits: digits });
      return `${m} × 10${String(exp).replace(/[-0-9]/g, (c) => SUP[c] ?? c)}`;
    }
    return formatNumber(locale, v, { maximumSignificantDigits: digits });
  };
}

/** A "nice" tick step (1, 2 or 5 × 10ᵏ) giving about `count` intervals up to `max`. */
export function niceStep(max: number, count = 4): number {
  const raw = max / count;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
}
