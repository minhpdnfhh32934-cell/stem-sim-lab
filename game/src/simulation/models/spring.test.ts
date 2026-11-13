import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../content';
import { type ExperimentDefinition, ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { measureOscillation } from '../oscillation';
import { SPRING_SETTLED, springAcceleration, springModel } from './spring';

const definition: ExperimentDefinition = ExperimentDefinitionSchema.parse(
  (bundledContent.experiments as { id: string }[]).find((e) => e.id === 'hookes-law'),
);
const L0 = 0.2;
const G = 9.81;
const X = springModel.variables.indexOf('extension');
const Y = springModel.variables.indexOf('displacement');
const V = springModel.variables.indexOf('velocity');

/** The static equilibrium of Hooke's law, written out independently of the model: k·Δl = m·g. */
const rest = (m: number, k: number) => (m * G) / k;

const inputs = (mass: number, stiffness: number, offset = 0.1, damping = 0.1) => ({
  mass,
  stiffness,
  gravity: G,
  naturalLength: L0,
  damping,
  offset,
});

/** A whole run as the station makes one: the experiment's own step, samples and end. */
const run = (mass: number, stiffness: number, offset = 0.1, damping = 0.1) => {
  const r = new ExperimentRuntime('test', definition, springModel, {
    mass,
    stiffness,
    offset,
    damping,
    naturalLength: L0,
  });
  r.runToCompletion();
  return r;
};
const samples = (r: ExperimentRuntime, id: string) =>
  r.sampleValues[definition.measurements.findIndex((m) => m.id === id)]!;

/** The model alone, let go and stepped by `dt` for `seconds`; `each` sees x, y and v. */
function release(
  input: Record<string, number>,
  seconds: number,
  dt = 0.001,
  each?: (x: number, y: number, v: number) => void,
) {
  const state = new Float64Array(springModel.variables.length);
  springModel.init(input, state);
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    springModel.step(state, dt, input);
    each?.(state[X]!, state[Y]!, state[V]!);
  }
  return state;
}

/** The lowest points the mass reaches: where its velocity turns from down to up. */
function lowestPoints(input: Record<string, number>, seconds: number) {
  const points: number[] = [];
  let before = 0;
  release(input, seconds, 0.001, (x, _y, v) => {
    if (before > 0 && v <= 0) points.push(x);
    before = v;
  });
  return points;
}

describe('spring theory: statics and dynamics kept apart', () => {
  it('rests at Δl = m·g/k from the natural length: k·Δl = m·g', () => {
    const theory = springModel.predict!(inputs(0.5, 20));
    expect(theory.load).toBeCloseTo(4.905, 12); // 0.5 kg · 9.81 m/s²
    expect(theory.extension).toBeCloseTo(0.24525, 12); // 4.905 N / 20 N/m
    expect(theory.length).toBeCloseTo(0.44525, 12); // L = L₀ + Δl, not Δl
    expect(theory.stiffness).toBe(20);
    expect(theory.load).toBeCloseTo(theory.stiffness! * theory.extension!, 12);
  });

  it('starts at Δl + y₀ and swings between Δl − |y₀| and Δl + |y₀| at most', () => {
    const theory = springModel.predict!(inputs(0.5, 20, -0.05));
    expect(theory.start).toBeCloseTo(0.24525 - 0.05, 12);
    expect(theory.peak).toBeCloseTo(0.24525 + 0.05, 12);
    expect(theory.lowest).toBeCloseTo(0.24525 - 0.05, 12);
  });

  it('gives T₀ = 2π√(m/k), T_d = T₀/√(1 − ζ²), the decay rate ζ·ω₀ and none for ζ ≥ 1', () => {
    const theory = springModel.predict!(inputs(0.5, 20, 0.1, 0.1));
    const t0 = 2 * Math.PI * Math.sqrt(0.5 / 20);
    expect(theory.period0).toBeCloseTo(t0, 12);
    expect(theory.periodDamped).toBeCloseTo(t0 / Math.sqrt(1 - 0.01), 12);
    expect(theory.decayRate).toBeCloseTo(0.1 * Math.sqrt(20 / 0.5), 12);
    expect(theory.envelope0).toBe(0.1); // the tops lie on |y₀|·e^(−ζω₀t), below the envelope
    // T_d² against m at one k and ζ: slope 4π²/(k(1 − ζ²)), and 4π²/slope = k(1 − ζ²).
    expect(theory.periodSquaredSlope).toBeCloseTo((4 * Math.PI ** 2) / (20 * 0.99), 12);
    expect(theory.dampedStiffness).toBeCloseTo(20 * 0.99, 12);
    for (const zeta of [1, 2]) {
      const over = springModel.predict!(inputs(0.5, 20, 0.1, zeta));
      expect([over.periodDamped, over.decayRate, over.dampedStiffness]).toEqual([
        undefined,
        undefined,
        undefined,
      ]);
      expect(over.period0).toBeCloseTo(t0, 12); // still defined: it is the undamped one
    }
  });

  it('accelerates the mass back towards rest, not at all at rest, and damps the motion', () => {
    const input = inputs(0.5, 20);
    const dl = rest(0.5, 20);
    expect(springAcceleration(0, 0, input)).toBe(G); // unstretched: the weight alone
    expect(springAcceleration(dl, 0, input)).toBeCloseTo(0, 12); // k·Δl = m·g
    expect(springAcceleration(dl + 0.1, 0, input)).toBeCloseTo((-20 * 0.1) / 0.5, 12); // −k·y/m
    // Moving down through rest at 1 m/s: the damping alone, −c·v/m with c = 2ζ·√(k·m).
    expect(springAcceleration(dl, 1, input)).toBeCloseTo((-2 * 0.1 * Math.sqrt(10)) / 0.5, 12);
  });
});

describe('spring run: m·y″ + c·y′ + k·y = 0 about rest, then rest at k·Δl = m·g', () => {
  it('held at y₀ below rest and let go: up past rest, back down, each swing smaller, then rests', () => {
    const r = run(0.5, 20, 0.1);
    const dl = rest(0.5, 20);
    const y = samples(r, 'displacement');
    const x = samples(r, 'extension');
    expect(y[0]).toBeCloseTo(0.1, 12); // held at y₀ …
    expect(x[0]).toBeCloseTo(dl + 0.1, 12); // … that is, at x = Δl + y₀
    expect(y[1]).toBeLessThan(y[0]!); // let go at rest: it rises
    const m = measureOscillation(r.sampleTimes, y, r.sampleCount);
    expect(m.crossings.length).toBeGreaterThanOrEqual(4);
    const swings = m.peaks.map((p) => p.amplitude);
    for (let i = 1; i < swings.length; i++) expect(swings[i]).toBeLessThan(swings[i - 1]!);
    expect(r.endReason).toBe('model');
    expect(Math.abs(y[r.sampleCount - 1]!)).toBeLessThanOrEqual(SPRING_SETTLED * dl);
  });

  it('measures, from its own samples, the damped period and the decay rate the theory gives', () => {
    for (const [m, k, zeta] of [
      [0.5, 20, 0.1],
      [2, 200, 0.05],
      [0.3, 10, 0.2],
    ] as const) {
      const r = run(m, k, 0.05, zeta);
      const theory = r.theory()!;
      const measured = measureOscillation(r.sampleTimes, samples(r, 'displacement'), r.sampleCount);
      expect(measured.period!.cycles).toBeGreaterThanOrEqual(2);
      expect(Math.abs(measured.period!.value / theory.periodDamped! - 1)).toBeLessThan(2e-3);
      // Damped, so not T₀: the difference is the factor 1/√(1 − ζ²).
      expect(measured.period!.value).toBeGreaterThan(theory.period0!);
      expect(Math.abs(measured.decay!.rate / theory.decayRate! - 1)).toBeLessThan(2e-2);
      expect(Math.abs(measured.decay!.zeta! / zeta - 1)).toBeLessThan(2e-2);
      // The fitted line through the tops starts at the theory's |y₀| — not at |y₀|/√(1 − ζ²),
      // 2 % higher at ζ = 0.2, which the panel once drew beside the peaks as their theory.
      expect(Math.abs(measured.decay!.amplitude0 / theory.envelope0! - 1)).toBeLessThan(2e-3);
    }
  });

  it('critically and over-damped: back to rest without swinging past it', () => {
    for (const zeta of [1, 2]) {
      const r = run(0.5, 20, 0.1, zeta);
      const y = samples(r, 'displacement');
      for (let i = 0; i < r.sampleCount; i++) expect(y[i]).toBeGreaterThanOrEqual(-1e-12);
      expect(r.endReason).toBe('model');
      const m = measureOscillation(r.sampleTimes, y, r.sampleCount);
      expect([m.period, m.decay]).toEqual([null, null]);
    }
  });

  it('held at rest (y₀ = 0) it is at rest at once: a static measurement', () => {
    const r = run(0.5, 20, 0);
    expect(r.endReason).toBe('model');
    expect(r.time).toBeLessThan(0.01);
    expect(r.results?.extension).toBeCloseTo(rest(0.5, 20), 9);
    expect(r.results?.stiffness).toBeCloseTo(20, 6);
  });

  it('comes to rest at k·Δl = m·g across the range of masses, springs and damping', () => {
    for (const [m, k, y0, zeta] of [
      [0.05, 200, 0.002, 0.1], // the least stretch: 2.5 mm
      [0.1, 5, 0.1, 0.05],
      [0.5, 20, 0.1, 0.1], // the default
      [3, 100, -0.1, 0.5],
      [5, 200, 0.2, 2], // the heaviest mass, overdamped
    ] as const) {
      const r = run(m, k, y0, zeta);
      const dl = rest(m, k);
      expect(r.endReason).toBe('model');
      expect(r.time).toBeLessThan(definition.simulation.maxDuration);
      expect(r.results?.load).toBeCloseTo(m * G, 12);
      expect(Math.abs(r.results!.extension! - dl)).toBeLessThanOrEqual(SPRING_SETTLED * dl);
      expect(Math.abs(r.results!.stiffness! / k - 1)).toBeLessThan(1.01 * SPRING_SETTLED);
    }
  });

  it('loses its swing only to the damping: undamped, it keeps swinging from Δl − y₀ to Δl + y₀', () => {
    const dl = rest(0.5, 20);
    const free = lowestPoints(inputs(0.5, 20, -0.1, 0), 6);
    expect(free.length).toBeGreaterThanOrEqual(5);
    for (const x of free) expect(Math.abs(x - (dl + 0.1))).toBeLessThan(1e-3 * dl);
    const damped = lowestPoints(inputs(0.5, 20, -0.1, 0.1), 6);
    for (let i = 1; i < damped.length; i++) expect(damped[i]).toBeLessThan(damped[i - 1]!);
  });

  it('never goes past the bounds the stand checks: Δl ± |y₀|', () => {
    for (const [m, k, y0] of [
      [0.5, 20, 0.2],
      [0.5, 20, -0.1],
      [0.05, 200, 0.002],
    ] as const) {
      const theory = springModel.predict!(inputs(m, k, y0));
      let [lo, hi] = [Infinity, -Infinity];
      release(inputs(m, k, y0), 4, 0.001, (x) => {
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
      });
      expect(hi).toBeLessThanOrEqual(theory.peak! + 1e-9);
      expect(lo).toBeGreaterThanOrEqual(theory.lowest! - 1e-9);
    }
  });

  it('does not depend on the time step: 2 ms, 1 ms and 0.5 ms agree with 0.1 ms', () => {
    const at = (dt: number) => release(inputs(0.5, 20), 1.5, dt)[X]!;
    const fine = at(0.0001);
    for (const dt of [0.002, 0.001, 0.0005]) {
      expect(Math.abs(at(dt) - fine)).toBeLessThan(1e-3 * 0.1); // 0.1 % of the swing
    }
  });

  it('records what the model computed: finite samples on F = k·x, L = L₀ + x and y = x − Δl', () => {
    const r = run(0.3, 20);
    const [x, y, force, length] = ['extension', 'displacement', 'force', 'length'].map((id) =>
      samples(r, id),
    );
    const dl = rest(0.3, 20);
    expect(r.sampleCount).toBeGreaterThan(100);
    for (let i = 0; i < r.sampleCount; i++) {
      expect(Number.isFinite(x![i]!) && Number.isFinite(force![i]!)).toBe(true);
      expect(force![i]).toBeCloseTo(20 * x![i]!, 12);
      expect(length![i]).toBeCloseTo(L0 + x![i]!, 12);
      expect(y![i]).toBeCloseTo(x![i]! - dl, 12);
    }
  });

  it('never divides by zero: m·g/x is 0 while the spring is unstretched', () => {
    const state = new Float64Array(springModel.variables.length);
    springModel.init(inputs(0.5, 20, -rest(0.5, 20)), state); // held at the natural length
    expect([...state].every(Number.isFinite)).toBe(true);
    expect(state[X]).toBeCloseTo(0, 15);
    expect(state[springModel.variables.indexOf('ratio')]).toBe(0);
    expect(springModel.isComplete!(state, inputs(0.5, 20))).toBe(false); // held, not at rest
  });
});
