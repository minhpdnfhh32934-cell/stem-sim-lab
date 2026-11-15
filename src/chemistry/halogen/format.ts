import { formatNumber, type Locale } from '@/app/i18n';
import type { LocalizedText } from '@/core/data/dataset';
import { L } from '../common';
import { configString, elementByZ, shellOrder } from '../data/elements';
import type { Halogen } from '../data/halogens';

/** A number in the app's locale with a typographic minus. */
export const num = (locale: Locale, v: number, digits = 4) =>
  formatNumber(locale, v, { maximumSignificantDigits: digits }).replace(/^-/, '−');

/** A temperature with one decimal, as the book prints them ("−101,0"). */
export const deg = (locale: Locale, v: number) =>
  formatNumber(locale, v, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).replace(
    /^-/,
    '−',
  );

export const STATE: Record<Halogen['state'], LocalizedText> = {
  gas: L('Khí', 'Gas'),
  liquid: L('Lỏng', 'Liquid'),
  solid: L('Rắn', 'Solid'),
};

/** "2s² 2p⁵": the outer shell from the element table's configuration. */
export function outerShell(z: number): string {
  const conf = elementByZ(z)?.configuration ?? [];
  const n = Math.max(...conf.map(([shell]) => shell));
  return configString(
    shellOrder(conf.filter(([shell, l]) => shell === n && (l === 's' || l === 'p'))),
  );
}
