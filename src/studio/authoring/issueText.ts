import type { MessageParams, TFunction } from '@/app/i18n';
import type { LocalizedText } from '@/core/data/dataset';
import type { AuthorIssue } from './check';
import { LABELLED_FIELDS, type LabelledField } from './limits';

const isLabelledField = (v: unknown): v is LabelledField =>
  typeof v === 'string' && (LABELLED_FIELDS as readonly string[]).includes(v);

/** The teacher-facing sentence of an issue (localized params resolved, field names translated). */
export function issueText(
  t: TFunction,
  L: (text: LocalizedText) => string,
  issue: AuthorIssue,
): string {
  const params: MessageParams = {};
  for (const [k, v] of Object.entries(issue.params ?? {})) {
    if (k === 'field' && isLabelledField(v)) params[k] = t(`studio.authoring.editor.fields.${v}`);
    else params[k] = typeof v === 'object' ? L(v) : v;
  }
  return t(`studio.authoring.errors.${issue.code}`, params);
}
