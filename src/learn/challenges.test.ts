import { describe, expect, it } from 'vitest';
import { loadScene, sceneIds } from '@/physics/registry';
import type { Params, PhysicsScene } from '@/physics/types';
import { toSI } from '@/core/units';
import {
  answerValue,
  CHALLENGES,
  challengesFor,
  evaluate,
  optimum,
  startParams,
  type Challenge,
} from './challenges';

async function scene(id: string): Promise<PhysicsScene> {
  return loadScene(id);
}

/** Scan one control, then bisect a sign change: is the target hit within half the tolerance? */
function reachable(s: PhysicsScene, c: Challenge, base: Params): boolean {
  if (c.goal.kind !== 'target') return true;
  const goal = c.goal;
  const key = c.controls[0] ?? '';
  const def = s.params.find((d) => d.key === key);
  const unit = def?.unit ?? '1';
  const lo = toSI(def?.min ?? 0, unit);
  const hi = toSI(def?.max ?? 1, unit);
  const f = (x: number) => {
    const v = answerValue(s, { ...base, [key]: x }, goal.answer);
    return v === null ? null : v - goal.value;
  };
  const N = 400;
  let px: number | null = null;
  let pf: number | null = null;
  for (let i = 0; i <= N; i++) {
    const x = lo + ((hi - lo) * i) / N;
    const fx = f(x);
    if (fx === null) {
      px = null;
      pf = null;
      continue;
    }
    if (Math.abs(fx) <= goal.tol / 2) return true;
    if (px !== null && pf !== null && Math.sign(fx) !== Math.sign(pf)) {
      let a = px;
      let b = x;
      let fa = pf;
      for (let k = 0; k < 60; k++) {
        const m = (a + b) / 2;
        const fm = f(m);
        if (fm === null) break;
        if (Math.abs(fm) <= goal.tol / 2) return true;
        if (Math.sign(fm) === Math.sign(fa)) {
          a = m;
          fa = fm;
        } else b = m;
      }
    }
    px = x;
    pf = fx;
  }
  return false;
}

describe('challenges (answers checked by the engine)', () => {
  it('every physics topic has at least one challenge', () => {
    for (const id of sceneIds()) expect(challengesFor(id).length, id).toBeGreaterThan(0);
  });

  it('ids are unique and controls are real parameters', async () => {
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(CHALLENGES.length);
    for (const c of CHALLENGES) {
      const s = await scene(c.topic);
      for (const k of c.controls)
        expect(
          s.params.some((d) => d.key === k),
          `${c.id}.${k}`,
        ).toBe(true);
      expect(
        s.solve(s.defaults, 'vi').answers.some((a) => a.id === c.goal.answer),
        c.id,
      ).toBe(true);
    }
  });

  for (const g of [9.81, 9.8, 10]) {
    it(`each challenge starts unsolved and can be solved inside the sliders (g = ${g})`, async () => {
      for (const c of CHALLENGES) {
        const s = await scene(c.topic);
        const start = startParams(s, c, g);
        expect(s.validate?.(start) ?? [], c.id).toEqual([]);
        const status = evaluate(s, c, start, {});
        expect(status.state, c.id).toBe('trying');
        expect(reachable(s, c, start), `${c.id} reachable`).toBe(true);
      }
    }, 120_000);
  }

  it('a "max" goal is found by search and accepted near the optimum', async () => {
    const c = CHALLENGES.find((x) => x.id === 'obliqueProjectile.maxRange');
    if (!c) throw new Error('missing');
    const s = await scene(c.topic);
    const start = startParams(s, c);
    const best = optimum(s, c, start);
    // From level ground the range is largest at 45° (closed form v0²/g).
    expect(best.params.angle ?? 0).toBeCloseTo(Math.PI / 4, 2);
    expect(best.value).toBeCloseTo(15 ** 2 / 9.81, 3);
    const at44 = { ...start, angle: (44 * Math.PI) / 180 };
    expect(evaluate(s, c, at44, { angle: 'user' }, best.value).state).toBe('done');
  }, 60_000);

  it('changing a parameter that is not a control asks for a restart', async () => {
    const c = CHALLENGES.find((x) => x.id === 'freeFall.t2');
    if (!c) throw new Error('missing');
    const s = await scene(c.topic);
    const st = evaluate(s, c, startParams(s, c), { g: 'user' });
    expect(st).toEqual({ state: 'changed', keys: ['g'] });
  });
});
