import { describe, expect, it } from 'vitest';
import { answerValue } from '@/learn/challenges';
import { freeFall } from '@/physics/projectile/scenes';
import { physicsFreeFall as sc } from '../scenarios/physicsFreeFall';
import {
  checkBinding,
  conditionParams,
  controlRange,
  maxCheckGap,
  mergeOnTime,
  poeById,
  runComparison,
  toEvidence,
  verdictFor,
} from './comparison';
import { runEngine } from './engineRun';

const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);
const text = (i: number) => ({ vi: `#${String(i)}`, en: `#${String(i)}` });
const poe = poeById('freeFall.h0');
const pb = (() => {
  if (sc.binding.kind !== 'physics') throw new Error('physics scenario expected');
  return sc.binding;
})();

describe('physics studio adapter (freeFall)', () => {
  it('the built-in binding matches the scene, its POE and its graphs', () => {
    expect(checkBinding(freeFall, pb)).toEqual([]);
    expect(checkBinding(freeFall, { ...pb, controls: ['nope'] })).toContain('unknown control nope');
    expect(checkBinding(freeFall, { ...pb, poe: 'pulley.m2' }).join()).toContain(
      'belongs to pulley',
    );
  });

  it('keeps the scaled condition B inside the scene slider range', () => {
    if (!poe) throw new Error('poe');
    const [lo, hi] = controlRange(freeFall, poe, 'h0');
    expect(lo).toBeGreaterThan(0);
    expect(hi * poe.factor).toBeCloseTo(200, 9);
  });

  for (const g of [9.8, 9.81, 10]) {
    for (const h0 of [45, 12.5, 100]) {
      it(`engine numbers equal scene.solve() (h0 = ${String(h0)} m, g = ${String(g)})`, async () => {
        const r = await runComparison(freeFall, sc, { h0 }, g);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const { A, B, ratio, outcome } = r.cmp;
        expect(A.params).toMatchObject({ h0, v0: 0, g });
        expect(B.params.h0).toBeCloseTo(2 * h0, 12);
        for (const run of [A, B]) {
          for (const v of run.values) {
            const solved = answerValue(freeFall, run.params, v.answer);
            expect(solved).not.toBeNull();
            expect(v.check).toBe(solved);
            expect(rel(v.engine ?? NaN, solved ?? NaN)).toBeLessThan(1e-9);
          }
        }
        // Closed form t = √(2h/g): the engine is not a mirror of solve(), check it directly.
        const tA = A.values.find((v) => v.answer === 'time_of_flight')?.engine ?? NaN;
        expect(rel(tA, Math.sqrt((2 * h0) / g))).toBeLessThan(1e-9);
        expect(ratio).toBeCloseTo(Math.SQRT2, 9);
        expect(outcome).not.toBeNull();
        const choice = poe?.choices[outcome?.correct ?? -1];
        expect(choice).toEqual({ kind: 'ratio', ratio: Math.SQRT2 });
      });
    }
  }

  it('the graph is built from the engine states only', async () => {
    const r = await runComparison(freeFall, sc, { h0: 45 }, 9.81);
    if (!r.ok) throw new Error(r.reason);
    const { graph, A, B } = r.cmp;
    expect([...graph.x].sort((a, b) => a - b)).toEqual(graph.x);
    expect(graph.a[0]).toBe(45);
    expect(graph.b[0]).toBe(90);
    // Each run's last point is the engine's exact landing (y = 0 at endTime).
    const at = (t: number) => graph.x.findIndex((x) => Math.abs(x - t) < 1e-8);
    const lastA = at(A.trace.endTime);
    expect(lastA).toBeGreaterThan(0);
    expect(graph.a[lastA]).toBe(0);
    expect(graph.a.slice(lastA + 1).every((v) => v === null)).toBe(true);
    expect(graph.b[at(B.trace.endTime)]).toBe(0);
    const direct = await runEngine('phys.projectile', freeFall.engineParams?.(A.params) ?? {}, {
      tMax: 20,
      sampleDt: 20 / 600,
    });
    expect(direct.times).toEqual(A.trace.times);
  });

  it('evidence holds only engine values (with the analytic check beside them)', async () => {
    const r = await runComparison(freeFall, sc, { h0: 45 }, 9.81);
    if (!r.ok) throw new Error(r.reason);
    const ev = toEvidence(freeFall, sc, r.cmp, 123);
    expect(ev?.kind).toBe('engine');
    expect(ev?.model).toBe('phys.projectile');
    const tB = ev?.quantities.find((q) => q.id === 'time_of_flight' && q.condition === 'B');
    expect(tB?.value).toBe(r.cmp.B.values[0]?.engine);
    const ratio = ev?.quantities.find((q) => q.condition === 'B/A');
    expect(ratio?.value).toBe(r.cmp.ratio);
    expect(ev?.conditions.map((c) => c.inputs.find((q) => q.id === 'h0')?.value)).toEqual([45, 90]);
    expect(maxCheckGap(ev?.quantities ?? [])).toBeLessThan(1e-9);
  });

  it('reports an invalid start instead of inventing a result', async () => {
    const r = await runComparison(freeFall, { ...sc, initial: { h0: 45, v0: 0 } }, { h0: 0 }, 9.81);
    // h0 = 0 lands at t = 0: the ratio is undefined, so no choice can be marked right.
    if (r.ok) {
      expect(r.cmp.ratio).toBeNull();
      expect(verdictFor(r.cmp.outcome, null, text).match).toBeNull();
    }
  });

  it('verdictFor compares the learner choice with the computed one', () => {
    const outcome = { before: 1, after: Math.SQRT2, correct: 1 };
    const p = { choice: '1', label: '√2', at: 1 };
    expect(verdictFor(outcome, p, text)).toEqual({
      correct: '1',
      correctText: { vi: '#1', en: '#1' },
      match: true,
    });
    expect(verdictFor(outcome, { ...p, choice: '3' }, text).match).toBe(false);
    expect(verdictFor({ ...outcome, correct: -1 }, p, text)).toEqual({
      correct: null,
      correctText: null,
      match: null,
    });
  });

  it('merges two time grids without inventing values', () => {
    expect(mergeOnTime({ t: [0, 1, 1.5], y: [3, 2, 0] }, { t: [0, 1, 2], y: [5, 4, 0] })).toEqual({
      x: [0, 1, 1.5, 2],
      a: [3, 2, 0, null],
      b: [5, 4, null, 0],
    });
  });

  it('condition B scales only the POE parameter', () => {
    if (!poe) throw new Error('setup');
    const { A, B } = conditionParams(freeFall, sc, pb, poe, { h0: 30, m: 99 }, 9.81);
    expect(A.m).toBe(freeFall.defaults.m);
    expect({ ...B, h0: A.h0 }).toEqual(A);
    expect(B.h0).toBe(60);
  });
});
