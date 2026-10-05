import type { TFunction } from '@/app/i18n';
import { toSafetyError } from './safety';

/** A safety error in simple words ("Sai mã PIN (còn 3 lần thử)", "Đợi 42 giây"…). */
export function safetyErrorText(t: TFunction, e: unknown): string {
  const err = toSafetyError(e);
  switch (err.code) {
    case 'wrongPin':
      return t('safety.settings.wrongPin', { left: err.message || '?' });
    case 'locked':
      return t('safety.settings.tooMany', { secs: err.message || '60' });
    case 'invalid':
      return /pin/i.test(err.message)
        ? t('safety.gate.pinInvalid')
        : /year/i.test(err.message)
          ? t('safety.gate.yearInvalid')
          : err.message;
    default:
      return err.message || err.code;
  }
}
