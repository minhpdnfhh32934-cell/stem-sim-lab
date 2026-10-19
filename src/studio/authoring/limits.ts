import type { StudioScenario } from '../scenario';
import type { AuthorIssue } from './check';

/**
 * Size limits for teacher content. Authored lessons live in localStorage, a few MB shared by the
 * whole app, so an oversized file or lesson is refused before it is stored. A typical lesson is
 * a few KB; the bounds leave room for long texts while capping the worst case
 * (MAX_AUTHORED × MAX_LESSON_CHARS ≈ 2.5 M characters).
 */
export const MAX_FILE_KB = 256;
export const MAX_FILE_CHARS = MAX_FILE_KB * 1024;
export const MAX_LESSON_KB = 64;
export const MAX_LESSON_CHARS = MAX_LESSON_KB * 1024;
export const MAX_TITLE_CHARS = 200;
export const MAX_TEXT_CHARS = 2000;
export const MAX_LIST_ITEMS = 20;
export const MAX_AUTHORED = 40;

/** Teacher-written parts with a label in the editor (`studio.authoring.editor.fields`). */
export const LABELLED_FIELDS = [
  'title',
  'objectives',
  'hints',
  'questions',
  'assumptions',
  'limits',
  'expectedConclusion',
  'question',
  'sources',
] as const;
export type LabelledField = (typeof LABELLED_FIELDS)[number];

const LIST_KEYS = ['objectives', 'hints', 'questions', 'sources', 'assumptions', 'limits'] as const;

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) for (const x of v as unknown[]) strings(x, out);
  else if (typeof v === 'object' && v !== null) for (const x of Object.values(v)) strings(x, out);
  return out;
}

/** Problems of one lesson that would not fit the app's local storage (empty = fits). */
export function sizeIssues(s: StudioScenario): AuthorIssue[] {
  const out: AuthorIssue[] = [];
  for (const field of LIST_KEYS) {
    if (s[field].length > MAX_LIST_ITEMS) {
      out.push({ code: 'listTooLong', params: { field, max: MAX_LIST_ITEMS } });
    }
  }
  const texts: [LabelledField, unknown][] = [
    ['title', s.title],
    ...LIST_KEYS.map((field): [LabelledField, unknown] => [field, s[field]]),
    ['expectedConclusion', s.expectedConclusion],
  ];
  if ('question' in s.binding) texts.push(['question', s.binding.question]);
  for (const [field, value] of texts) {
    const max = field === 'title' ? MAX_TITLE_CHARS : MAX_TEXT_CHARS;
    if (strings(value).some((x) => x.length > max)) {
      out.push({ code: 'textTooLong', params: { field, max } });
    }
  }
  if (JSON.stringify(s).length > MAX_LESSON_CHARS) {
    out.push({ code: 'lessonTooLarge', params: { kb: MAX_LESSON_KB } });
  }
  return out;
}
