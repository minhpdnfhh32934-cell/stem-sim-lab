import { formatNumber, type Locale } from '@/app/i18n';
import type { Couple } from './model';

/** E° as Bảng 15.1 prints it: sign shown, the book's decimals ("+0,340", "−2,92"). */
export const volts = (locale: Locale, c: Couple): string =>
  formatNumber(locale, c.E_V, {
    minimumFractionDigits: c.decimals,
    maximumFractionDigits: c.decimals,
    signDisplay: 'exceptZero',
  });

/** A cell's EMF to the table's 0,001 V. */
export const emfText = (locale: Locale, v: number): string =>
  formatNumber(locale, v, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
