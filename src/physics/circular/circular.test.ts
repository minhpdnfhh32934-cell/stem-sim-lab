import { describe, expect, it } from 'vitest';
import { buildDraft } from '@/ai/draft';
import type { Extraction } from '@/ai/spec';
import { basicSplit } from '@/app/sim/basicParams';
import { dopri5 } from '@/core/ode/dopri5';
import { CHECK_TOL, checkAtol, forceLaw, forceLawStart, numericPeriod } from './check';
import { CE, CircularEngine } from './engine';
import { MODE, circular, stateAt } from './model';
import { uniformCircularMotion as scene } from './scenes';

const TAU = 2 * Math.PI;

describe('uniform circular motion — model', () => {
  it('every way of giving the motion yields the same ω, v, T, f, a_ht, F_ht', () => {
    // r = 0.5 m, v = 3 m/s → ω = 6 rad/s, T = π/3 s, f = 3/π Hz, a_ht = 18 m/s², F = 3.6 N (m = 0.2 kg).
    const base = { r: 0.5, m: 0.2 };
    const given = [
      { mode: MODE.v, v: 3 },
      { mode: MODE.omega, omega: 6 },
      { mode: MODE.period, T: Math.PI / 3 },
      { mode: MODE.freq, f: 3 / Math.PI },
    ];
    for (const g of given) {
      const c = circular({ ...base, ...g });
      expect(c.omega, `mode ${g.mode}`).toBeCloseTo(6, 12);
      expect(c.v).toBeCloseTo(3, 12);
      expect(c.T).toBeCloseTo(Math.PI / 3, 12);
      expect(c.f).toBeCloseTo(3 / Math.PI, 12);
      expect(c.aC).toBeCloseTo(18, 11);
      expect(c.F).toBeCloseTo(3.6, 11);
      // The textbook identities hold together.
      expect(c.omega).toBeCloseTo(c.v / c.r, 12);
      expect(c.T).toBeCloseTo((TAU * c.r) / c.v, 12);
      expect(c.f).toBeCloseTo(1 / c.T, 12);
      expect(c.aC).toBeCloseTo(c.omega ** 2 * c.r, 11);
    }
  });

  it('120 rev/min = 2 Hz gives ω = 4π rad/s, not 2 rad/s', () => {
    const c = circular({ mode: MODE.freq, r: 1, f: 2 });
    expect(c.omega).toBeCloseTo(4 * Math.PI, 12);
    expect(c.T).toBeCloseTo(0.5, 12);
  });

  it('position, velocity and acceleration come straight from t', () => {
    const c = circular({ mode: MODE.omega, r: 2, omega: 3, phi0: 0.4, dir: -1, m: 1 });
    for (const t of [0, 0.1, 1.7, 123.456]) {
      const s = stateAt(c, t);
      const phi = 0.4 - 3 * t;
      expect(s.phi).toBe(phi);
      expect(s.x).toBeCloseTo(2 * Math.cos(phi), 12);
      expect(s.y).toBeCloseTo(2 * Math.sin(phi), 12);
      // Radius and speed stay constant; velocity ⟂ radius; acceleration points to the centre.
      expect(Math.hypot(s.x, s.y)).toBeCloseTo(2, 12);
      expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(6, 12);
      expect(s.x * s.vx + s.y * s.vy).toBeCloseTo(0, 11);
      expect(s.ax).toBeCloseTo(-9 * s.x, 11);
      expect(s.ay).toBeCloseTo(-9 * s.y, 11);
    }
    // Clockwise: at φ₀ = 0 the body moves towards −y.
    expect(stateAt(circular({ mode: MODE.v, r: 1, v: 2, dir: -1 }), 0).vy).toBe(-2);
  });
});

describe('uniform circular motion — engine', () => {
  it('phase is exact in t: radius and speed constant to 1e-12 over a long run', () => {
    const p = { mode: MODE.v, r: 1.5, v: 4, phi0: 0.3, dir: 1, m: 1 };
    const e = new CircularEngine();
    e.reset(p);
    const out = new Float64Array(e.stateSize);
    for (let i = 0; i < 240 * 60; i++) {
      e.step();
      if (i % 997 !== 0) continue;
      e.readState(out);
      const t = e.time();
      expect(t).toBe((i + 1) / 240);
      expect(out[CE.phi]).toBe(0.3 + (4 / 1.5) * t);
      expect(Math.abs(Math.hypot(out[CE.x]!, out[CE.y]!) - 1.5)).toBeLessThan(1e-12);
      expect(Math.abs(Math.hypot(out[CE.vx]!, out[CE.vy]!) - 4)).toBeLessThan(1e-12);
    }
    expect(e.finished()).toBe(true);
    expect(e.input()).toBe(false);
  });
});

describe('uniform circular motion — DOPRI5 cross-check of the force law', () => {
  const cases = [
    { mode: MODE.v, r: 1, v: 2, m: 0.5, phi0: 0, dir: 1 },
    { mode: MODE.freq, r: 0.3, f: 2, m: 0.1, phi0: 1.2, dir: -1 },
    { mode: MODE.period, r: 4, T: 7, m: 3, phi0: -2, dir: 1 },
  ];

  it.each(cases)('integrated path stays on the circle and matches the engine (%o)', (p) => {
    const c = circular(p);
    const e = new CircularEngine();
    e.reset(p);
    const out = new Float64Array(e.stateSize);
    const f = forceLaw(c);
    let y: ArrayLike<number> = forceLawStart(c);
    let t0 = 0;
    for (const k of [97, 240, 611, 1000]) {
      // Engine time k·Δt; DOPRI5 continues from the previous checkpoint.
      while (e.time() < k * e.dt - 1e-12) e.step();
      const t1 = e.time();
      const r = dopri5(f, y, t0, t1, { ...CHECK_TOL, atol: checkAtol(c) });
      e.readState(out);
      const tol = 1e-8 * Math.max(1, c.r);
      expect(Math.abs(Math.hypot(r.y[0]!, r.y[1]!) - c.r)).toBeLessThan(tol);
      expect(Math.abs(r.y[0]! - out[CE.x]!)).toBeLessThan(tol);
      expect(Math.abs(r.y[1]! - out[CE.y]!)).toBeLessThan(tol);
      expect(Math.abs(r.y[2]! - out[CE.vx]!)).toBeLessThan(1e-8 * Math.max(1, c.v));
      y = r.y;
      t0 = t1;
    }
  });

  it.each(cases)('period from upward y = 0 crossings equals 2πr/v to 9 digits (%o)', (p) => {
    const c = circular(p);
    const T = numericPeriod(c);
    expect(T).not.toBeNull();
    expect(Math.abs(T! / ((2 * Math.PI * c.r) / c.v) - 1)).toBeLessThan(1e-9);
  });
});

describe('uniform circular motion — scene', () => {
  const answer = (p: Record<string, number>, id: string) =>
    scene.solve(p, 'vi').answers.find((a) => a.id === id);

  it('defaults: r = 1 m, v = 2 m/s → ω = 2 rad/s, T = π s, a_ht = 4 m/s², F_ht = 2 N', () => {
    const p = scene.defaults;
    expect(scene.validate?.(p)).toEqual([]);
    expect(answer(p, 'omega')!.value).toBeCloseTo(2, 12);
    expect(answer(p, 'period')!.value).toBeCloseTo(Math.PI, 12);
    expect(answer(p, 'period')!.check).toBeCloseTo(Math.PI, 9);
    expect(answer(p, 'frequency')!.value).toBeCloseTo(1 / Math.PI, 12);
    expect(answer(p, 'a_c')!.value).toBeCloseTo(4, 12);
    expect(answer(p, 'force')!.value).toBeCloseTo(2, 12);
    expect(scene.scienceCard(p).confidence).toBe('exact');
  });

  it('the hidden quantities of the other modes describe the same motion', () => {
    for (const mode of [MODE.omega, MODE.period, MODE.freq]) {
      expect(answer({ ...scene.defaults, mode }, 'a_c')!.value).toBeCloseTo(4, 12);
    }
  });

  it('validate: radius and the given quantity must be positive', () => {
    expect(scene.validate?.({ ...scene.defaults, r: 0 })).toHaveLength(1);
    expect(scene.validate?.({ ...scene.defaults, v: -2 })).toHaveLength(1);
    // A non-positive value of a quantity that is not given does not matter.
    expect(scene.validate?.({ ...scene.defaults, f: 0 })).toEqual([]);
    expect(scene.validate?.({ ...scene.defaults, mode: MODE.freq, f: 0 })).toHaveLength(1);
  });

  it('nothing can be dragged; Basic shows the mode, r, the given quantity, m and φ₀', () => {
    expect(scene.bodies.every((b) => !b.draggable)).toBe(true);
    const visible = scene.params.filter((d) => !d.when || d.when(scene.defaults));
    expect(basicSplit(visible, {}).main.map((d) => d.key)).toEqual(['mode', 'r', 'v', 'm', 'phi0']);
  });

  const text = 'Một vật quay đều trên đường tròn bán kính 50 cm với tần số 2 Hz.';
  const extraction = (key: string, unit: string): Extraction => ({
    quantities: [
      { key: 'r', value: 50, unit: 'cm', quote: 'bán kính 50 cm' },
      { key, value: 2, unit, quote: 'tần số 2 Hz' },
    ],
    questions: [],
    assumptions: [],
    unsupported_parts: [],
    clarifications: [],
  });

  it('"2 Hz" in the f field gives ω = 4π rad/s; the mode follows the stated quantity', () => {
    const d = buildDraft(scene, extraction('f', 'Hz'), text, 9.81);
    expect(d.issues.filter((x) => x.blocking)).toEqual([]);
    expect(d.params.mode).toBe(MODE.freq);
    expect(d.missing).toEqual([]);
    expect(answer(d.params, 'omega')!.value).toBeCloseTo(4 * Math.PI, 12);
  });

  it('"2 Hz" in the ω field is refused, never read as 2 rad/s', () => {
    const d = buildDraft(scene, extraction('omega', 'Hz'), text, 9.81);
    expect(d.issues.some((x) => x.kind === 'badUnit' && x.key === 'omega' && x.blocking)).toBe(
      true,
    );
    expect(d.sources.omega).toBe('default');
  });
});
