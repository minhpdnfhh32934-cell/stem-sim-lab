import { create } from 'zustand';
import type { Locale } from '@/app/i18n/types';
import type { Answer, ParamSource, Params, PhysicsScene } from '@/physics/types';

/**
 * "Sổ ghi" (#195 step 4): one row each time a physics run stops, so the learner can compare runs.
 * Session only: never saved, never sent. Every number is the lesson's own `solve()` for the
 * parameters of that run; a run the mouse changed has no exact answers.
 */

/** Rows kept per topic; the oldest goes first. */
export const RUN_LOG_MAX = 20;

export interface RunEntry {
  /** Clock time the run stopped (ms since 1970). */
  at: number;
  /** The parameters the learner or the problem set (SI), in the lesson's order. */
  changed: { key: string; value: number }[];
  /** `solve()`'s answers for these parameters; null after an intervention or when unsolvable. */
  answers: Answer[] | null;
  intervened: boolean;
}

/** The row for a run of `scene` with `params` that just stopped. */
export function runEntry(
  scene: PhysicsScene,
  params: Params,
  sources: Record<string, ParamSource>,
  intervened: boolean,
  locale: Locale,
  at: number,
): RunEntry {
  const changed = scene.params
    .filter((d) => (sources[d.key] ?? 'default') !== 'default' && (d.when?.(params) ?? true))
    .flatMap((d) => {
      const value = params[d.key];
      return value === undefined ? [] : [{ key: d.key, value }];
    });
  let answers: Answer[] | null = null;
  if (!intervened) {
    try {
      const solved = scene.solve(params, locale).answers;
      answers = solved.every((a) => Number.isFinite(a.value)) ? solved : null;
    } catch {
      answers = null;
    }
  }
  return { at, changed, answers, intervened };
}

/** What a row says, without its time: two stops of one run with the same inputs give one row. */
const gist = (e: RunEntry) =>
  JSON.stringify([e.intervened, e.changed, e.answers?.map((a) => [a.id, a.value]) ?? null]);

/** `rows` with `entry` added at the end, unless it repeats the last row; at most RUN_LOG_MAX. */
export function appendRun(rows: readonly RunEntry[], entry: RunEntry): RunEntry[] {
  const last = rows[rows.length - 1];
  if (last && gist(last) === gist(entry)) return [...rows];
  return [...rows, entry].slice(-RUN_LOG_MAX);
}

interface RunLogState {
  /** Rows per scene id, oldest first. */
  rows: Record<string, RunEntry[]>;
  add: (sceneId: string, entry: RunEntry) => void;
  clear: (sceneId: string) => void;
}

export const useRunLog = create<RunLogState>()((set) => ({
  rows: {},
  add: (sceneId, entry) => {
    set((s) => ({ rows: { ...s.rows, [sceneId]: appendRun(s.rows[sceneId] ?? [], entry) } }));
  },
  clear: (sceneId) => {
    set((s) => ({ rows: { ...s.rows, [sceneId]: [] } }));
  },
}));
