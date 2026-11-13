import { describe, expect, it } from 'vitest';
import { ExperimentDefinitionSchema } from '../experiment';
import { checkExperimentAgainstModel, ExperimentRuntime } from '../ExperimentRuntime';
import { fitLine } from '../fit';
import { circularModel } from './circular';

const slot = (name: string) => circularModel.variables.indexOf(name);
const STOPWATCH = slot('stopwatch');
const ANGLE = slot('angle');
const TURNS = slot('turnsCounted');
const X = slot('x');
const Z = slot('z');
const PERIOD = slot('period');
const OMEGA = slot('angularVelocity');

const DEG = Math.PI / 180;
const G = 9.81;

const inputsOf = (change: Record<string, number> = {}) => ({
  hangingMass: 0.2,
  bungMass: 0.04,
  length: 0.3,
  gravity: G,
  timedTurns: 10,
  ...change,
});

/** The model alone, stepped by `dt` until it stops; `each` sees the state after every step. */
function whirl(inputs: Record<string, number>, dt: number, each?: (s: Float64Array) => void) {
  const state = new Float64Array(circularModel.variables.length);
  circularModel.init(inputs, state);
  let time = 0;
  let last = dt;
  for (let i = 0; i < 1e7 && !circularModel.isComplete!(state, inputs); i++) {
    last = circularModel.step(state, dt, inputs);
    time += last;
    each?.(state);
  }
  return { state, time, last };
}

/**
 * The bung and the hanger as one system, integrated independently by classical RK4 from Newton's
 * second law alone: no circle, β or ω is assumed. The string (massless, inextensible) runs over a
 * frictionless pivot at the origin (the top of the tube) to the hanger, so the bung's distance ℓ
 * and the hanger's depth d add to a constant and M·d̈ = M·g − F (down positive) gives
 * F = M·g + M·ℓ̈. On the bung: m·p̈ = −F·ê + m·g⃗ with ê = p/ℓ, and ℓ̈ = ê·p̈ + (|ṗ|² − (ê·ṗ)²)/ℓ;
 * eliminating ℓ̈, F = M·m·(g − g·ê_y + (|ṗ|² − (ê·ṗ)²)/ℓ)/(M + m).
 */
function integrateWhirl(
  big: number,
  small: number,
  start: readonly number[],
  seconds: number,
  h: number,
  each: (s: readonly number[], t: number) => void,
) {
  const rate = (s: readonly number[]) => {
    const [px = 0, py = 0, pz = 0, vx = 0, vy = 0, vz = 0] = s;
    const l = Math.hypot(px, py, pz);
    const [ex, ey, ez] = [px / l, py / l, pz / l];
    const radial = ex * vx + ey * vy + ez * vz;
    const w = (vx * vx + vy * vy + vz * vz - radial * radial) / l;
    const pull = (((big * small) / (big + small)) * (G - G * ey + w)) / small; // F/m
    return [vx, vy, vz, -pull * ex, -pull * ey - G, -pull * ez];
  };
  let s = [...start];
  const add = (a: readonly number[], b: readonly number[], k: number) =>
    a.map((v, i) => v + k * (b[i] ?? 0));
  const steps = Math.round(seconds / h);
  for (let i = 1; i <= steps; i++) {
    const k1 = rate(s);
    const k2 = rate(add(s, k1, h / 2));
    const k3 = rate(add(s, k2, h / 2));
    const k4 = rate(add(s, k3, h));
    s = s.map(
      (v, j) => v + (h / 6) * ((k1[j] ?? 0) + 2 * (k2[j] ?? 0) + 2 * (k3[j] ?? 0) + (k4[j] ?? 0)),
    );
    each(s, i * h);
  }
}

describe('circular-motion theory: M·g = m·ω²·L, sin β = m/M', () => {
  it('matches a case worked by hand (g = 10 m/s², M = 0.2 kg, m = 0.05 kg, L = 0.4 m)', () => {
    // ω² = M·g/(m·L) = 2/0.02 = 100, so ω = 10 rad/s; sin β = 0.05/0.2 = 1/4, cos β = √15/4.
    const t = circularModel.predict!(inputsOf({ gravity: 10, bungMass: 0.05, length: 0.4 }));
    expect(t.tension).toBeCloseTo(2, 14);
    expect(t.angularVelocity).toBeCloseTo(10, 13);
    expect(t.period).toBeCloseTo(Math.PI / 5, 13); // 0.6283 s
    expect(t.timeForTurns).toBeCloseTo(2 * Math.PI, 12); // 10 turns
    expect(t.droopAngle).toBeCloseTo(14.4775121859, 9); // asin ¼ in degrees
    expect(t.drop).toBeCloseTo(0.1, 14); // L·sin β
    expect(t.radius).toBeCloseTo(Math.sqrt(0.15), 14); // 0.4·√15/4 = √0.15 ≈ 0.3873 m
    expect(t.speed).toBeCloseTo(10 * Math.sqrt(0.15), 12); // ≈ 3.873 m/s
    expect(t.acceleration).toBeCloseTo(100 * Math.sqrt(0.15), 11); // ≈ 38.73 m/s²
    expect(t.centripetalForce).toBeCloseTo(2 * (Math.sqrt(15) / 4), 12); // M·g·cos β ≈ 1.936 N
    expect(t.periodSquared).toBeCloseTo((4 * Math.PI ** 2) / 100, 13);
    expect(t.omegaSquared).toBeCloseTo(100, 11);
    expect(t.periodSquaredSlope).toBeCloseTo(Math.PI ** 2 / 10, 13); // 4π²·0.05/2 s²/m
    expect(t.forceSlope).toBeCloseTo(0.02, 15); // m·L
  });

  it('gives the school values at the default dials (M 0.2 kg, m 0.04 kg, L 0.3 m)', () => {
    const t = circularModel.predict!(inputsOf());
    // ω² = 0.2 × 9.81 / (0.04 × 0.3) = 1.962/0.012 = 163.5; T = 2π/√163.5.
    expect(t.omegaSquared).toBeCloseTo(163.5, 10);
    expect(t.angularVelocity).toBeCloseTo(12.7867118525, 9);
    expect(t.period).toBeCloseTo(0.491383975774, 11);
    expect(t.droopAngle).toBeCloseTo(11.5369590328, 9); // asin 0.2
    expect(t.radius).toBeCloseTo(0.3 * Math.sqrt(0.96), 14);
  });

  it('keeps the textbook relations among T, ω, r, v and a', () => {
    const cases: Record<string, number>[] = [
      {},
      { hangingMass: 0.1, bungMass: 0.05, length: 0.4 },
      { length: 0.2 },
    ];
    for (const change of cases) {
      const t = circularModel.predict!(inputsOf(change));
      const [T, w, r, v] = [t.period!, t.angularVelocity!, t.radius!, t.speed!];
      const [m, length] = [change.bungMass ?? 0.04, change.length ?? 0.3];
      expect(w).toBeCloseTo((2 * Math.PI) / T, 12);
      expect(v).toBeCloseTo((2 * Math.PI * r) / T, 12);
      expect(t.acceleration).toBeCloseTo((v * v) / r, 10);
      expect(t.acceleration).toBeCloseTo((4 * Math.PI ** 2 * r) / (T * T), 10);
      expect(t.centripetalForce).toBeCloseTo(m * t.acceleration!, 12);
      expect(t.centripetalForce).toBeCloseTo(t.tension! * Math.cos(t.droopAngle! * DEG), 12);
      // With L in place of r the textbook F = m·ω²·r is exact here: the tension is m·ω²·L.
      expect(t.tension).toBeCloseTo(m * w * w * length, 12);
    }
  });

  it('balances the forces on the bung at the predicted circle (Newton’s second law, as vectors)', () => {
    for (const [big, small, length] of [
      [0.2, 0.04, 0.3],
      [0.1, 0.05, 0.4],
      [0.4, 0.03, 0.2],
      [0.3, 0.29, 1], // nearly hanging: β ≈ 75°
    ] as const) {
      const t = circularModel.predict!(inputsOf({ hangingMass: big, bungMass: small, length }));
      const [r, h, w] = [t.radius!, t.drop!, t.angularVelocity!];
      expect(Math.hypot(r, h)).toBeCloseTo(length, 14); // the string is L long
      const [ex, ey] = [r / length, -h / length]; // pivot → bung, the bung at (r, −h, 0)
      const fx = -big * G * ex; // the tension along the string, towards the pivot
      const fy = -big * G * ey - small * G;
      expect(fx).toBeCloseTo(-small * w * w * r, 12); // m·a: ω²·r towards the axis
      expect(fy).toBeCloseTo(0, 12); // no vertical acceleration
    }
  });

  it('is a steady motion of the full bung-and-hanger dynamics, integrated independently', () => {
    for (const [big, small, length] of [
      [0.2, 0.04, 0.3],
      [0.1, 0.05, 0.4],
      [0.4, 0.03, 0.2],
    ] as const) {
      const t = circularModel.predict!(inputsOf({ hangingMass: big, bungMass: small, length }));
      const [r, h, v, T] = [t.radius!, t.drop!, t.speed!, t.period!];
      // At the start mark (r, −h, 0) moving anticlockwise seen from above: velocity along −z.
      let unwrapped = 0;
      let previous = 0;
      let crossed = NaN;
      integrateWhirl(big, small, [r, -h, 0, 0, 0, -v], 10.5 * T, T / 4000, (s, time) => {
        const [px = 0, py = 0, pz = 0] = s;
        expect(Math.hypot(px, py, pz)).toBeCloseTo(length, 8); // the marker stays put
        expect(-py).toBeCloseTo(h, 8);
        const angle = Math.atan2(-pz, px);
        unwrapped += ((angle - previous + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
        previous = angle;
        if (Number.isNaN(crossed) && unwrapped >= 20 * Math.PI) crossed = time;
      });
      expect(crossed).toBeCloseTo(10 * T, 3); // the tenth turn, to the integrator's step
      expect(crossed).toBeCloseTo(t.timeForTurns!, 3);
    }
  });

  it('puts T² against L on a line through the origin of slope 4π²·m/(M·g)', () => {
    const at = (length: number) => circularModel.predict!(inputsOf({ length }));
    const fit = fitLine(
      [0.2, 0.25, 0.3, 0.35, 0.4].map((l) => ({ x: l, y: at(l).periodSquared! })),
    );
    if (fit.status !== 'fitted') throw new Error('no line');
    expect(fit.slope).toBeCloseTo((4 * Math.PI ** 2 * 0.04) / (0.2 * G), 12); // ≈ 0.8049 s²/m
    expect(fit.slope).toBeCloseTo(at(0.3).periodSquaredSlope!, 12);
    expect(fit.intercept).toBeCloseTo(0, 12);
  });

  it('puts M·g against ω² on a line through the origin of slope m·L', () => {
    const points = [0.1, 0.2, 0.3, 0.4].map((hangingMass) => {
      const t = circularModel.predict!(inputsOf({ hangingMass }));
      return { x: t.omegaSquared!, y: t.tension! };
    });
    const fit = fitLine(points);
    if (fit.status !== 'fitted') throw new Error('no line');
    expect(fit.slope).toBeCloseTo(0.04 * 0.3, 12);
    expect(fit.slope).toBeCloseTo(circularModel.predict!(inputsOf()).forceSlope!, 12);
    expect(fit.intercept).toBeCloseTo(0, 12);
  });
});

describe('circular-motion run: θ = ω·t stepped exactly, timed over N turns', () => {
  it('moves uniformly round the circle: θ = ω·t, x = r·cos θ, z = −r·sin θ', () => {
    const inputs = inputsOf();
    const t = circularModel.predict!(inputs);
    let steps = 0;
    whirl(inputs, 0.001, (s) => {
      const time = s[STOPWATCH]!;
      expect(s[ANGLE]!).toBeCloseTo(t.angularVelocity! * time, 9);
      expect(s[X]!).toBeCloseTo(t.radius! * Math.cos(t.angularVelocity! * time), 9);
      expect(s[Z]!).toBeCloseTo(-t.radius! * Math.sin(t.angularVelocity! * time), 9);
      expect(Math.hypot(s[X]!, s[Z]!)).toBeCloseTo(t.radius!, 12);
      steps++;
    });
    expect(steps).toBe(Math.ceil(t.timeForTurns! / 0.001));
  });

  it('counts each whole turn as the bung passes the start mark and times it', () => {
    const inputs = inputsOf({ hangingMass: 0.1, bungMass: 0.05, length: 0.4 });
    const T = circularModel.predict!(inputs).period!;
    const seen: number[] = [];
    whirl(inputs, 0.001, (s) => {
      const n = s[TURNS]!;
      if (n === 0) {
        expect([s[PERIOD], s[OMEGA]]).toEqual([0, 0]); // nothing timed before the first turn
        return;
      }
      if (seen[seen.length - 1] !== n) seen.push(n);
      expect(s[STOPWATCH]!).toBeGreaterThanOrEqual(n * T - 1e-12);
      expect(s[STOPWATCH]!).toBeLessThan((n + 1) * T);
      expect(s[PERIOD]!).toBeCloseTo(T, 12); // lap time / turns, the lap found inside its step
      expect(s[OMEGA]!).toBeCloseTo((2 * Math.PI) / T, 10);
    });
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('stops exactly at the Nth turn, whatever the step, with the theory’s results', () => {
    const inputs = inputsOf({ hangingMass: 0.4, bungMass: 0.03, length: 0.2 });
    const t = circularModel.predict!(inputs);
    for (const dt of [0.0001, 0.001, 0.0037, 0.02, 0.3, 5]) {
      const { state, time, last } = whirl(inputs, dt);
      expect(state[ANGLE]).toBe(20 * Math.PI);
      expect(state[TURNS]).toBe(10);
      expect(time).toBeCloseTo(t.timeForTurns!, 11); // ≈ 2.457 s
      expect(state[STOPWATCH]!).toBeCloseTo(t.timeForTurns!, 11);
      expect(last).toBeLessThanOrEqual(dt + 1e-12);
      expect(state[PERIOD]!).toBeCloseTo(t.period!, 12);
      expect(state[OMEGA]!).toBeCloseTo(t.angularVelocity!, 10);
      expect(state[X]!).toBeCloseTo(t.radius!, 12); // back at the start mark
      expect(state[Z]!).toBeCloseTo(0, 12);
      expect(circularModel.step(state, dt, inputs)).toBe(0); // nothing after the last turn
    }
  });

  it('is deterministic: two runs give the same bits', () => {
    const a = whirl(inputsOf(), 0.001).state;
    const b = whirl(inputsOf(), 0.001).state;
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('times one turn when N = 1', () => {
    const inputs = inputsOf({ timedTurns: 1 });
    const { state } = whirl(inputs, 0.001);
    expect(state[STOPWATCH]!).toBeCloseTo(circularModel.predict!(inputs).period!, 12);
    expect(state[TURNS]).toBe(1);
  });
});

describe('circular-motion inputs: refused with a reason, never clamped', () => {
  it('refuses missing, out-of-range and non-finite inputs', () => {
    const state = new Float64Array(circularModel.variables.length);
    const missing: Record<string, number> = inputsOf();
    delete missing.length;
    expect(() => circularModel.init(missing, state)).toThrow(/"length" is missing/);
    expect(() => circularModel.predict!(inputsOf({ length: 0 }))).toThrow(/"length" must be/);
    expect(() => circularModel.init(inputsOf({ gravity: NaN }), state)).toThrow(/gravity/);
    expect(() => circularModel.init(inputsOf({ bungMass: Infinity }), state)).toThrow(/bungMass/);
    expect(() => circularModel.predict!(inputsOf({ timedTurns: 2.5 }))).toThrow(/whole number/);
    expect(() => circularModel.predict!(inputsOf({ timedTurns: 0 }))).toThrow(/whole number/);
  });

  it('refuses a hanging mass no heavier than the bung: it cannot hold it up and in', () => {
    expect(() => circularModel.predict!(inputsOf({ hangingMass: 0.04 }))).toThrow(
      /must be heavier than the bung/,
    );
    expect(() => circularModel.predict!(inputsOf({ hangingMass: 0.03 }))).toThrow(/sin β = m\/M/);
    // Just heavier still runs: the string hangs almost straight down, r ≪ L.
    const t = circularModel.predict!(inputsOf({ hangingMass: 0.0401 }));
    expect(t.droopAngle).toBeGreaterThan(85);
    expect(t.radius).toBeLessThan(0.03);
  });
});

describe('circular motion in the experiment runtime', () => {
  const presets = (values: number[]) => values.map((value) => ({ label: `${value}`, value }));
  const definition = ExperimentDefinitionSchema.parse({
    id: 'circular-test',
    name: 'Uniform circular motion',
    category: 'physics',
    model: 'mechanics.circular-motion',
    parameters: [
      { id: 'hangingMass', label: 'M', unit: 'kg', default: 0.2, min: 0.1, max: 0.4 },
      { id: 'length', label: 'L', unit: 'm', default: 0.3, min: 0.2, max: 0.4 },
      { id: 'bungMass', label: 'm', unit: 'kg', default: 0.04, min: 0.03, max: 0.05 },
      {
        id: 'stopwatchResolution',
        label: 'd',
        unit: 's',
        default: 0.01,
        min: 0.01,
        max: 0.2,
        presets: presets([0.01, 0.1, 0.2]),
      },
    ],
    initialConditions: { gravity: G, timedTurns: 10 },
    simulation: { timeStep: 0.001, maxDuration: 12, sampleInterval: 0.01 },
    measurements: [{ id: 'angle', label: 'θ', unit: 'rad', variable: 'angle' }],
    results: [
      ['period', 's', 'period', 'period'],
      ['angularVelocity', 'rad/s', 'angularVelocity', 'angularVelocity'],
      ['radius', 'm', 'radius', 'radius'],
      ['speed', 'm/s', 'speed', 'speed'],
      ['timeForTurns', 's', 'stopwatch', 'timeForTurns'],
    ].map(([id, unit, variable, theory]) => ({
      id,
      label: id,
      unit,
      variable,
      reduce: 'final',
      theory,
    })),
    instruments: [
      {
        result: 'timeForTurns',
        quantity: 't_N',
        name: 'Stopwatch',
        resolution: 'stopwatchResolution',
        excludes: 'reaction time',
      },
    ],
  });

  it('fits the model', () => {
    expect(checkExperimentAgainstModel(definition, circularModel)).toEqual([]);
  });

  it('ends by itself after N turns at every corner of the dials, well inside maxDuration', () => {
    for (const hangingMass of [0.1, 0.4]) {
      for (const length of [0.2, 0.4]) {
        for (const bungMass of [0.03, 0.05]) {
          const r = new ExperimentRuntime('t', definition, circularModel, {
            hangingMass,
            length,
            bungMass,
          });
          r.runToCompletion();
          expect([r.status, r.endReason]).toEqual(['completed', 'model']);
          const theory = r.theory()!;
          expect(r.time).toBeCloseTo(theory.timeForTurns!, 9);
          expect(r.time).toBeLessThan(10); // slowest: M 0.1, m 0.05, L 0.4 → 8.97 s
          for (const id of ['period', 'angularVelocity', 'radius', 'speed', 'timeForTurns']) {
            expect(r.results![id]).toBeCloseTo(theory[id]!, 9);
          }
        }
      }
    }
  });
});
