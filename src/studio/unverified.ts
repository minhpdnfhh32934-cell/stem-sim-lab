import { translate, type Locale } from '@/app/i18n';
import type { LocalizedText } from '@/core/data/dataset';
import type { StudioScenario } from './scenario';
import { engineEvidence, type StudioSession } from './session';

/** Something a lesson shows that no reviewer has checked yet. */
export type UnverifiedItem =
  | { kind: 'scenario'; title: LocalizedText; teacher: boolean }
  | { kind: 'record'; key: string; title: LocalizedText; model: string };

/**
 * One rule for every studio: the lesson's own text and every record copied from curated data
 * whose `review_status` is 'pending'. Numbers computed by code (e.g. a physics engine run) are
 * not data records and carry no status, so they are never listed here.
 */
export function unverifiedItems(
  scenario: StudioScenario,
  session: StudioSession,
): UnverifiedItem[] {
  const items: UnverifiedItem[] = [];
  if (scenario.review_status === 'pending') {
    items.push({ kind: 'scenario', title: scenario.title, teacher: scenario.author === 'teacher' });
  }
  for (const rec of engineEvidence(session)) {
    if (rec.review_status === 'pending') {
      items.push({ kind: 'record', key: rec.key, title: rec.title, model: rec.model });
    }
  }
  return items;
}

/** The same wording wherever an item is listed (report, AI Teacher context). */
export function unverifiedLabel(item: UnverifiedItem, locale: Locale): string {
  const title = item.title[locale];
  if (item.kind === 'record') {
    return translate(locale, 'studio.unverified.record', { title, model: item.model });
  }
  return translate(
    locale,
    item.teacher ? 'studio.unverified.teacher' : 'studio.unverified.scenario',
    {
      title,
    },
  );
}
