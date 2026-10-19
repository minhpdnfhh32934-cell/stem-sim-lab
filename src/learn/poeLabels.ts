import { formatNumber, type Locale, type TFunction } from '@/app/i18n';
import type { PoeChoice } from './poe';

/** Text of a POE choice ("Tăng √2 ≈ 1,41 lần", "Không đổi" …) in the UI locale. */
export function choiceLabel(t: TFunction, locale: Locale, c: PoeChoice): string {
  if (c.kind === 'direction') return t(`learn.dir.${c.dir}`);
  if (Math.abs(c.ratio - 1) < 1e-9) return t('learn.ratio.same');
  if (Math.abs(c.ratio - 0.5) < 1e-9) return t('learn.ratio.half');
  if (Math.abs(c.ratio - Math.SQRT2) < 1e-9) return t('learn.ratio.sqrt2');
  return t('learn.ratio.times', { n: formatNumber(locale, c.ratio, { maximumFractionDigits: 2 }) });
}
