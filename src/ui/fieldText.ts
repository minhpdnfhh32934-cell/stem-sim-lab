import { formatNumber } from '@/app/i18n';

/** What the field shows when not being edited: 6 significant digits, decimal comma in Vietnamese. */
export const fieldText = (locale: 'vi' | 'en', value: number) =>
  formatNumber(locale, Number(value.toPrecision(6)), {
    maximumSignificantDigits: 6,
    useGrouping: false,
  });

/**
 * A typed number → value, or NaN. Either separator works as the decimal mark ("0,25", "0.25");
 * digits grouped by thousands in the UI language ("1.000" in Vietnamese, "1,000" in English)
 * read as thousands, never as a decimal; hex ("0x10"), "Infinity" and other forms are refused.
 */
export function parseField(text: string, locale: 'vi' | 'en'): number {
  let t = text.trim().replace('−', '-');
  const group = locale === 'vi' ? '.' : ',';
  const grouped = new RegExp(`^-?\\d{1,3}(\\${group}\\d{3})+([.,]\\d+)?$`);
  if (grouped.test(t)) t = t.split(group).join('');
  t = t.replace(',', '.');
  return /^-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t) ? Number(t) : Number.NaN;
}
