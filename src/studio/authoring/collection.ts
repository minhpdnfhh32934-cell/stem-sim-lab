import { slugify } from '@/app/project/fileio';
import { validateScenario, type StudioScenario, type StudioSubject } from '../scenario';
import { asTeacherContent } from './fileFormat';

/** Authored scenarios live under their own id prefix, so they never replace a built-in one. */
export const TEACHER_ID_PREFIX = 'teacher.';

export function scenarioId(
  subject: StudioSubject,
  title: string,
  taken: ReadonlySet<string>,
): string {
  const base = `${TEACHER_ID_PREFIX}${subject}.${slugify(title)}`;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${String(n)}`;
  return id;
}

/** Keeps an imported id when it is a free teacher id; otherwise a new one (never overwrites). */
export function importId(s: StudioScenario, taken: ReadonlySet<string>): string {
  return s.id.startsWith(TEACHER_ID_PREFIX) && !taken.has(s.id)
    ? s.id
    : scenarioId(s.subject, s.title.vi, taken);
}

export function duplicateOf(s: StudioScenario, taken: ReadonlySet<string>): StudioScenario {
  const title = { vi: `${s.title.vi} (bản sao)`, en: `${s.title.en} (copy)` };
  return asTeacherContent({
    ...structuredClone(s),
    title,
    id: scenarioId(s.subject, title.vi, taken),
  });
}

/** Replaces the scenario with the same id, or appends it. */
export function upsert(list: readonly StudioScenario[], s: StudioScenario): StudioScenario[] {
  const i = list.findIndex((x) => x.id === s.id);
  if (i < 0) return [...list, s];
  const next = [...list];
  next[i] = s;
  return next;
}

export const AUTHORED_STORE_VERSION = 1;

export interface PersistedAuthored {
  scenarios: StudioScenario[];
}

/**
 * Turns whatever is in storage into a valid list: records that fail the schema or reuse an id
 * are dropped (a hand-edited or damaged record never crashes the studio).
 */
export function migrateAuthored(persisted: unknown): PersistedAuthored {
  const raw = typeof persisted === 'object' && persisted !== null ? persisted : {};
  const list = (raw as { scenarios?: unknown }).scenarios;
  const scenarios: StudioScenario[] = [];
  const ids = new Set<string>();
  for (const item of Array.isArray(list) ? (list as unknown[]) : []) {
    const r = validateScenario(item);
    if (!r.ok || ids.has(r.scenario.id) || !r.scenario.id.startsWith(TEACHER_ID_PREFIX)) continue;
    ids.add(r.scenario.id);
    scenarios.push(asTeacherContent(r.scenario));
  }
  return { scenarios };
}
