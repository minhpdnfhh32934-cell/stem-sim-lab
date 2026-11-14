import { describe, expect, it } from 'vitest';
import { dopri5 } from '@/core/ode/dopri5';
import { checkMisses, sliderEnds, sliderSweep } from '../testing';
import { TL, ThirdLawEngine, runLength } from './engine';
import {
  cartWidth,
  contactTime,
  finalVelocities,
  omega,
  stateAt,
  thirdLawInput,
  type ThirdLawInput,
} from './model';
import { newtonThirdLaw, numericSeparation } from './scenes';

/** Both carts integrated from their own start (cart 1 at x = 0): positions and velocities at t. */
function reference(q: ThirdLawInput, t: number) {
  const half = (cartWidth(q.m1) + cartWidth(q.m2)) / 2;
  const r = dopri5(
    (_t, y, dy) => {
      const F = q.k * Math.max(0, q.l0 - ((y[2] ?? 0) - (y[0] ?? 0) - half));
      dy[0] = y[1] ?? 0;
      dy[1] = -F / q.m1;
      dy[2] = y[3] ?? 0;
      dy[3] = F / q.m2;
    },
    [0, 0, half + q.l0 - q.d, 0],
    0,
    t,
    { rtol: 1e-12, atol: 1e-14, hMax: contactTime(q) / 50 },
  );
  return { x1: r.y[0] ?? 0, v1: r.y[1] ?? 0, x2: r.y[2] ?? 0, v2: r.y[3] ?? 0 };
}

const CASES: [string, ThirdLawInput][] = [
  ['defaults', thirdLawInput(newtonThirdLaw.defaults)],
  ['equal masses', { m1: 3, m2: 3, k: 500, d: 0.08, l0: 0.15 }],
  ['light against heavy', { m1: 0.1, m2: 10, k: 2000, d: 0.12, l0: 0.15 }],
];

describe("Newton's third law: two carts pushed apart by a spring", () => {
  it.each(CASES)('%s: closed form = DOPRI5 while pushing and after (gap, velocities)', (_n, q) => {
    const x0 = stateAt(q, 0).x1;
    for (const f of [0.1, 0.5, 0.9, 1, 1.5, 3]) {
      const t = f * contactTime(q);
      const exact = stateAt(q, t);
      const ref = reference(q, t);
      // The reference starts cart 1 at 0: compare displacements and the gap, not raw positions.
      expect(exact.x1 - x0).toBeCloseTo(ref.x1, 9);
      expect(exact.x2 - exact.x1).toBeCloseTo(ref.x2 - ref.x1, 9);
      expect(exact.v1).toBeCloseTo(ref.v1, 9);
      expect(exact.v2).toBeCloseTo(ref.v2, 9);
    }
  });

  it.each(CASES)('%s: equal and opposite forces, momentum 0, energy ½kd² throughout', (_n, q) => {
    const e = new ThirdLawEngine();
    e.reset({ ...q, tEnd: 2 * contactTime(q) });
    const s = new Float64Array(e.stateSize);
    const E0 = 0.5 * q.k * q.d ** 2;
    let steps = 0;
    while (!e.finished() && steps < 1e6) {
      e.step();
      steps++;
      e.readState(s);
      expect(s[TL.F12]).toBe(-(s[TL.F21] ?? 0));
      expect(q.m1 * (s[TL.v1] ?? 0) + q.m2 * (s[TL.v2] ?? 0)).toBeCloseTo(0, 12);
      expect(s[TL.F12] ?? -1).toBeGreaterThanOrEqual(0);
      expect(e.diagnostics().invariants.energy).toBeCloseTo(E0, 10);
    }
    expect(steps).toBeGreaterThan(0);
    // After the push the carts coast with the velocities of the closed form.
    const { v1, v2 } = finalVelocities(q);
    expect(s[TL.v1]).toBeCloseTo(v1, 12);
    expect(s[TL.v2]).toBeCloseTo(v2, 12);
    expect(s[TL.F12]).toBe(0);
  });

  it('the speeds are in the inverse ratio of the masses; the heavier cart is slower', () => {
    for (const [m1, m2] of [
      [1, 2],
      [4, 1],
      [2.5, 2.5],
    ] as const) {
      const q = thirdLawInput({ ...newtonThirdLaw.defaults, m1, m2 });
      const { v1, v2 } = finalVelocities(q);
      expect(Math.abs(v1) / Math.abs(v2)).toBeCloseTo(m2 / m1, 12);
      expect(v1).toBeLessThan(0);
      expect(v2).toBeGreaterThan(0);
    }
  });

  it('the push lasts a quarter period of the relative motion, ω = √(k/μ)', () => {
    const q = thirdLawInput(newtonThirdLaw.defaults);
    // m1 1 kg, m2 2 kg: μ = 2/3 kg; k 20 N/m: ω = √30 rad/s, a push of about 0,29 s.
    expect(omega(q)).toBeCloseTo(Math.sqrt(30), 12);
    expect(contactTime(q)).toBeCloseTo(Math.PI / (2 * Math.sqrt(30)), 12);
    expect(contactTime(q)).toBeGreaterThan(0.25);
    expect(numericSeparation(q)?.t).toBeCloseTo(contactTime(q), 9);
  });

  it('every cross-check agrees, at the slider ends and over a sweep', () => {
    const sets = [...sliderEnds(newtonThirdLaw), ...sliderSweep(newtonThirdLaw, 200, 255)];
    const misses = sets.map((p) => checkMisses(newtonThirdLaw, p)).filter((m) => m.length > 0);
    expect(misses).toEqual([]);
    for (const p of sets) {
      const checked = newtonThirdLaw.solve(p, 'vi').answers.filter((a) => a.check !== undefined);
      expect(checked.length).toBe(5);
    }
  });

  it('the run is long enough to see both carts coast, and the view frames them', () => {
    for (const p of sliderEnds(newtonThirdLaw)) {
      const q = thirdLawInput(p);
      const tEnd = runLength(q);
      expect(tEnd).toBeGreaterThan(contactTime(q) + 0.49);
      const v = newtonThirdLaw.view(p);
      const end = stateAt(q, tEnd);
      expect(end.x1).toBeGreaterThan(v.xMin);
      expect(end.x2).toBeLessThan(v.xMax);
    }
  });

  it('refuses a compression of 0 or one as long as the spring', () => {
    const v = (d: number) => newtonThirdLaw.validate?.({ ...newtonThirdLaw.defaults, d }) ?? [];
    expect(v(0.05)).toEqual([]);
    expect(v(0)).toHaveLength(1);
    expect(v(0.15)).toHaveLength(1);
  });

  it('Science Card: exact, with the third law first and its sources', () => {
    const c = newtonThirdLaw.scienceCard(newtonThirdLaw.defaults);
    expect(c.confidence).toBe('exact');
    expect(c.equations[0]?.tex).toBe('\\vec{F}_{2\\to 1} = -\\vec{F}_{1\\to 2}');
    expect(c.sources.length).toBeGreaterThanOrEqual(2);
  });

  it('the solution states the equal forces first and numbers in the learner’s format', () => {
    const vi = newtonThirdLaw.solve(newtonThirdLaw.defaults, 'vi');
    // k 20 N/m, d 10 cm: F = 2 N, written with a decimal comma.
    expect(vi.steps[0]?.tex).toContain('20\\cdot 0{,}1 = 2\\,\\text{N}');
    const v1 = vi.answers.find((a) => a.id === 'v1_after')?.value ?? 0;
    expect(v1).toBeCloseTo((-2 / 3) * 0.1 * Math.sqrt(30), 12);
  });
});
