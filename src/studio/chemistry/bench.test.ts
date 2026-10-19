import { describe, expect, it } from 'vitest';
import {
  applyAction,
  benchPhase,
  checkAction,
  EMPTY_BENCH,
  nextLog,
  replayBench,
  toRecord,
  type BenchAction,
  type BenchState,
} from './bench';

const INV = ['NaCl', 'AgNO3', 'BaCl2', 'H2SO4'];

function run(actions: BenchAction[]): BenchState {
  let s = EMPTY_BENCH;
  for (const a of actions) {
    const r = applyAction(s, a, INV);
    if (!r.ok) throw new Error(r.error);
    s = r.state;
  }
  return s;
}

describe('bench state machine', () => {
  it('add → add → mix → empty, with phases', () => {
    expect(benchPhase(EMPTY_BENCH)).toBe('empty');
    const one = run([{ op: 'add', reagent: 'NaCl' }]);
    expect(benchPhase(one)).toBe('partial');
    const two = run([
      { op: 'add', reagent: 'NaCl' },
      { op: 'add', reagent: 'AgNO3' },
    ]);
    expect(benchPhase(two)).toBe('ready');
    expect(two.contents).toEqual(['NaCl', 'AgNO3']);
    const mixed = run([
      { op: 'add', reagent: 'NaCl' },
      { op: 'add', reagent: 'AgNO3' },
      { op: 'mix' },
    ]);
    expect(benchPhase(mixed)).toBe('mixed');
    const r = applyAction(mixed, { op: 'empty' }, INV);
    expect(r).toEqual({ ok: true, state: EMPTY_BENCH });
  });

  it('rejects invalid actions with a reason and leaves the state unchanged', () => {
    const one = run([{ op: 'add', reagent: 'NaCl' }]);
    const two = run([
      { op: 'add', reagent: 'NaCl' },
      { op: 'add', reagent: 'AgNO3' },
    ]);
    const mixed = run([
      { op: 'add', reagent: 'NaCl' },
      { op: 'add', reagent: 'AgNO3' },
      { op: 'mix' },
    ]);
    expect(checkAction(EMPTY_BENCH, { op: 'mix' }, INV)).toBe('emptyTube');
    expect(checkAction(EMPTY_BENCH, { op: 'empty' }, INV)).toBe('emptyTube');
    expect(checkAction(one, { op: 'mix' }, INV)).toBe('needTwo');
    expect(checkAction(one, { op: 'add', reagent: 'NaCl' }, INV)).toBe('sameReagent');
    expect(checkAction(two, { op: 'add', reagent: 'BaCl2' }, INV)).toBe('tubeFull');
    expect(checkAction(mixed, { op: 'mix' }, INV)).toBe('alreadyMixed');
    expect(checkAction(mixed, { op: 'add', reagent: 'BaCl2' }, INV)).toBe('alreadyMixed');
    expect(checkAction(EMPTY_BENCH, { op: 'add', reagent: 'CuSO4' }, INV)).toBe('unknownReagent');
    expect(applyAction(one, { op: 'mix' }, INV)).toEqual({ ok: false, error: 'needTwo' });
  });

  it('keeps the order of addition (NaCl then AgNO₃ ≠ AgNO₃ then NaCl as a log)', () => {
    const a = run([
      { op: 'add', reagent: 'AgNO3' },
      { op: 'add', reagent: 'NaCl' },
    ]);
    expect(a.contents).toEqual(['AgNO3', 'NaCl']);
  });
});

describe('stored log', () => {
  it('replays a valid log and starts a new log when the tube is emptied', () => {
    let log = nextLog([], { op: 'add', reagent: 'NaCl' }, 1);
    log = nextLog(log, { op: 'add', reagent: 'AgNO3' }, 2);
    log = nextLog(log, { op: 'mix' }, 3);
    expect(replayBench(log, INV)).toEqual({ contents: ['NaCl', 'AgNO3'], mixed: true });
    expect(nextLog(log, { op: 'empty' }, 4)).toEqual([]);
  });

  it('stops at the first damaged or invalid record instead of trusting it', () => {
    const log = [
      toRecord({ op: 'add', reagent: 'NaCl' }, 1),
      { op: 'add', arg: 'NaCl', at: 2 }, // same reagent twice: invalid
      toRecord({ op: 'mix' }, 3),
    ];
    expect(replayBench(log, INV)).toEqual({ contents: ['NaCl'], mixed: false });
    expect(replayBench([{ op: 'pour', arg: null, at: 1 }], INV)).toEqual(EMPTY_BENCH);
    expect(replayBench([{ op: 'add', arg: null, at: 1 }], INV)).toEqual(EMPTY_BENCH);
    expect(replayBench([{ op: 'add', arg: 'CuSO4', at: 1 }], INV)).toEqual(EMPTY_BENCH);
  });
});
