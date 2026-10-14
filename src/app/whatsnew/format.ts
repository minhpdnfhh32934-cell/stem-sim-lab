import type { Locale } from '@/app/i18n';
import type { ReleaseStatus } from './releaseNotes';

/** i18n key part of each status (`whatsnew.status.*`, `whatsnew.statusHint.*`). */
export const STATUS_KEY = {
  released: 'released',
  'merged-not-released': 'mergedNotReleased',
  'in-review': 'inReview',
  development: 'development',
  unverified: 'unverified',
} as const satisfies Record<ReleaseStatus, string>;

/**
 * A release date from versions.json as a day in Vietnam (`13/10/2026`), the time zone the
 * history documents use. A bare date (`2026-10-09`) stays that day.
 */
export function formatReleaseDate(iso: string, locale: Locale): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00+07:00`) : new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}
