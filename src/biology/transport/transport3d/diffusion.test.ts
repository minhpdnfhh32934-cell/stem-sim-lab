import { describe, expect, it } from 'vitest';
import { apportion } from '../../view3d/sampling';
import { fickTimeEnd, twoCompartment } from '../transport';
import { diffusionFrameAt, diffusionModel3d, sideOf, type DiffusionInputs } from './diffusion';
import {
  BOX,
  compartmentVolume,
  diffusionLayout,
  diffusionPlan,
  inSlab,
  particleAt,
  poreHolding,
  type Vec3,
} from './diffusionLayout';

const inputs = (over: Partial<DiffusionInputs> = {}): DiffusionInputs => ({
  particles: 160,
  pores: 4,
  c1: 10,
  c2: 0,
  v1: 1,
  v2: 1,
  pa: 0.2,
  run: 0,
  ...over,
});

const CASES: Partial<DiffusionInputs>[] = [
  {},
  { c1: 2, c2: 18, v1: 3, v2: 0.5 },
  { c1: 7.5, c2: 1.5, v1: 0.5, v2: 5, particles: 400, pores: 8 },
  { c1: 0, c2: 20, pa: 1, pores: 1, particles: 20 },
  { c1: 5, c2: 5, v1: 2, v2: 1 },
];

/** N₁ of the rule: particles · c₁(t)V₁ / (c₁(0)V₁ + c₂(0)V₂), by largest remainders. */
function expected(i: DiffusionInputs, t: number): number[] {
  const c = twoCompartment(i.c1, i.c2, i.v1, i.v2, i.pa, t);
  const amount = i.c1 * i.v1 + i.c2 * i.v2;
  return apportion([c.c1 * i.v1, c.c2 * i.v2], amount / i.particles);
}

describe('diffusion in 3D: counts from Fick’s law', () => {
  it('N₁ + N₂ = particles and N₁(t) = apportion(particles · c₁(t)V₁ / amount) at every sampled t', () => {
    for (const over of CASES) {
      const i = inputs(over);
      const m = diffusionModel3d(i);
      expect(m.tEnd).toBeCloseTo(fickTimeEnd(i.v1, i.v2, i.pa), 12);
      for (let s = 0; s <= 50; s++) {
        const t = (s / 50) * m.tEnd;
        const f = diffusionFrameAt(m, t);
        expect(f.n1 + f.n2).toBe(i.particles);
        expect([f.n1, f.n2]).toEqual(expected(i, t));
        const c = twoCompartment(i.c1, i.c2, i.v1, i.v2, i.pa, t);
        expect(f.c1).toBe(c.c1);
        expect(f.c2).toBe(c.c2);
      }
    }
  });

  it('at large t the concentrations are equal: N₁ / N₂ = V₁ / V₂, as the box volumes', () => {
    for (const [v1, v2] of [
      [1, 1],
      [1, 3],
      [4, 1],
      [0.5, 4.5],
    ] as const) {
      const i = inputs({ v1, v2, particles: 400 });
      const m = diffusionModel3d(i);
      const f = diffusionFrameAt(m, 40 / m.k);
      expect(f.n1).toBe(Math.round((400 * v1) / (v1 + v2)));
      expect(f.n1 / f.n2).toBeCloseTo(v1 / v2, 9);
      const lay = diffusionLayout(v1, v2, 4);
      expect(compartmentVolume(lay, 1) / compartmentVolume(lay, 2)).toBeCloseTo(v1 / v2, 12);
      expect(lay.w1 + lay.w2).toBeCloseTo(BOX.inner, 12);
    }
  });

  it('crossings follow a schedule: one particle per step of N₁, at increasing times', () => {
    for (const over of CASES) {
      const m = diffusionModel3d(inputs(over));
      expect(m.crossers.length).toBe(Math.abs(m.n1Start - m.n1End));
      for (let c = 1; c < m.crossTimes.length; c++)
        expect(m.crossTimes[c]).toBeGreaterThanOrEqual(m.crossTimes[c - 1] ?? 0);
      let prev = 0;
      for (let s = 0; s <= 200; s++) {
        const f = diffusionFrameAt(m, (s / 200) * m.tEnd);
        expect(f.crossed).toBeGreaterThanOrEqual(prev);
        prev = f.crossed;
        // The scheduled time of every crossing done is reached (to rounding of N₁).
        for (let c = 0; c < f.crossed; c++)
          expect(m.crossTimes[c] ?? Infinity).toBeLessThanOrEqual(f.t + 1e-9 * m.tEnd);
      }
    }
  });

  it('no solute (C₁ = C₂ = 0): nothing is drawn', () => {
    const m = diffusionModel3d(inputs({ c1: 0, c2: 0 }));
    expect(m.total).toBe(0);
    expect(diffusionFrameAt(m, m.tEnd / 2)).toMatchObject({ n1: 0, n2: 0, crossed: 0 });
  });

  it('no pore: the picture keeps its starting counts (the chart still follows P·A)', () => {
    const m = diffusionModel3d(inputs({ pores: 0 }));
    expect(m.blocked).toBe(true);
    const f = diffusionFrameAt(m, m.tEnd);
    expect(f).toMatchObject({ n1: 160, n2: 0, crossed: 0 });
    expect(f.c1).toBeLessThan(10);
  });
});

describe('diffusion in 3D: places (illustration)', () => {
  it('each side holds the model’s count; no particle is in the membrane outside a pore', () => {
    for (const over of CASES) {
      const m = diffusionModel3d(inputs(over));
      const plan = diffusionPlan(m);
      const lay = plan.layout;
      const p: Vec3 = [0, 0, 0];
      // Every particle of every sampled frame is checked; failures are collected and asserted
      // once (about a million expect() calls made this test time out in the full parallel run).
      const bad: string[] = [];
      for (let s = 0; s <= 300; s++) {
        const f = diffusionFrameAt(m, (s / 300) * m.tEnd);
        let left = 0;
        for (let j = 0; j < m.total; j++) {
          particleAt(plan, f, j, true, p);
          if (p[0] < lay.xm) left++;
          const at = `step ${s} particle ${j}`;
          if ((p[0] < lay.xm ? 1 : 2) !== sideOf(m, f, j)) bad.push(`${at}: wrong side`);
          // Inside the box …
          if (
            p[0] < lay.x0 + BOX.r - 1e-9 ||
            p[0] > lay.x1 - BOX.r + 1e-9 ||
            Math.abs(p[1]) > BOX.hy - BOX.r + 1e-9 ||
            Math.abs(p[2]) > BOX.hz - BOX.r + 1e-9
          )
            bad.push(`${at}: outside the box at ${p.join(', ')}`);
          // … and in the slab only inside a pore's channel.
          if (inSlab(lay, p) && poreHolding(lay, p) < 0) bad.push(`${at}: in the membrane`);
        }
        if (left !== f.n1) bad.push(`step ${s}: ${left} on the left, N₁ = ${f.n1}`);
      }
      expect(bad.slice(0, 5), JSON.stringify(over)).toEqual([]);
    }
  });

  it('with no pore no particle ever enters the membrane', () => {
    const m = diffusionModel3d(inputs({ pores: 0 }));
    const plan = diffusionPlan(m);
    const p: Vec3 = [0, 0, 0];
    for (let s = 0; s <= 50; s++) {
      const f = diffusionFrameAt(m, (s / 50) * m.tEnd);
      for (let j = 0; j < m.total; j++)
        expect(inSlab(plan.layout, particleAt(plan, f, j, true, p))).toBe(false);
    }
  });

  it('the jitter is seeded by the lesson’s run; without jitter the walk stays at its start', () => {
    const m0 = diffusionModel3d(inputs());
    const m1 = diffusionModel3d(inputs({ run: 1 }));
    const a = diffusionPlan(m0);
    const b = diffusionPlan(m0);
    const c = diffusionPlan(m1);
    expect(a.walks).toEqual(b.walks);
    expect(a.walks).not.toEqual(c.walks);
    // A particle that never crosses: frozen without jitter, wandering with it.
    const j = m0.total - 1;
    expect(m0.crossIndex[j]).toBe(-1);
    const at = (t: number, jitter: boolean) =>
      particleAt(a, diffusionFrameAt(m0, t), j, jitter, [0, 0, 0]);
    expect(at(m0.tEnd / 2, false)).toEqual(at(0, false));
    expect(at(m0.tEnd / 2, true)).not.toEqual(at(0, true));
  });
});
