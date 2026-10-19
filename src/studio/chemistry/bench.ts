import type { ActionRecord } from '../session';

/**
 * Pure state machine of the chemistry bench: one test tube that holds at most two solutions,
 * which are then mixed. It decides which actions are valid; what a mix shows comes only from
 * the reaction library (`library.ts`).
 */
export const TUBE_CAPACITY = 2;

export interface BenchState {
  /** Formulas of the solutions in the order they were added. */
  contents: readonly string[];
  mixed: boolean;
}

export type BenchAction = { op: 'add'; reagent: string } | { op: 'mix' } | { op: 'empty' };

export type BenchError =
  'unknownReagent' | 'sameReagent' | 'tubeFull' | 'alreadyMixed' | 'emptyTube' | 'needTwo';

export type BenchPhase = 'empty' | 'partial' | 'ready' | 'mixed';

export const EMPTY_BENCH: BenchState = { contents: [], mixed: false };

export function benchPhase(s: BenchState): BenchPhase {
  if (s.mixed) return 'mixed';
  if (s.contents.length === 0) return 'empty';
  return s.contents.length < TUBE_CAPACITY ? 'partial' : 'ready';
}

/** Why `a` is not allowed in state `s` (null = allowed). */
export function checkAction(
  s: BenchState,
  a: BenchAction,
  inventory: readonly string[],
): BenchError | null {
  switch (a.op) {
    case 'add':
      if (!inventory.includes(a.reagent)) return 'unknownReagent';
      if (s.mixed) return 'alreadyMixed';
      if (s.contents.includes(a.reagent)) return 'sameReagent';
      if (s.contents.length >= TUBE_CAPACITY) return 'tubeFull';
      return null;
    case 'mix':
      if (s.mixed) return 'alreadyMixed';
      if (s.contents.length === 0) return 'emptyTube';
      if (s.contents.length < TUBE_CAPACITY) return 'needTwo';
      return null;
    case 'empty':
      return s.contents.length === 0 ? 'emptyTube' : null;
  }
}

export type BenchStep = { ok: true; state: BenchState } | { ok: false; error: BenchError };

export function applyAction(
  s: BenchState,
  a: BenchAction,
  inventory: readonly string[],
): BenchStep {
  const error = checkAction(s, a, inventory);
  if (error) return { ok: false, error };
  switch (a.op) {
    case 'add':
      return { ok: true, state: { contents: [...s.contents, a.reagent], mixed: false } };
    case 'mix':
      return { ok: true, state: { contents: s.contents, mixed: true } };
    case 'empty':
      return { ok: true, state: EMPTY_BENCH };
  }
}

export function toRecord(a: BenchAction, at: number): ActionRecord {
  return { op: a.op, arg: a.op === 'add' ? a.reagent : null, at };
}

export function fromRecord(r: ActionRecord): BenchAction | null {
  if (r.op === 'add') return r.arg ? { op: 'add', reagent: r.arg } : null;
  if (r.op === 'mix') return { op: 'mix' };
  if (r.op === 'empty') return { op: 'empty' };
  return null;
}

/**
 * Rebuilds the tube from a stored log. A damaged or hand-edited log is never trusted: replay
 * stops at the first unknown or invalid action.
 */
export function replayBench(
  records: readonly ActionRecord[],
  inventory: readonly string[],
): BenchState {
  let state = EMPTY_BENCH;
  for (const r of records) {
    const a = fromRecord(r);
    if (!a) break;
    const next = applyAction(state, a, inventory);
    if (!next.ok) break;
    state = next.state;
  }
  return state;
}

/**
 * The stored log after a valid action. Emptying the tube starts a new log, so the log only
 * describes the tube as it is now (at most add, add, mix).
 */
export function nextLog(
  records: readonly ActionRecord[],
  a: BenchAction,
  at: number,
): ActionRecord[] {
  return a.op === 'empty' ? [] : [...records, toRecord(a, at)];
}
