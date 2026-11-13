import { describe, expect, it } from 'vitest';
import { fitLine } from '../analysis';
import { type ExperimentDefinition, ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { enzymeModel, substrateAfter } from './enzyme';

const S = enzymeModel.variables.indexOf('substrate');
const CLOCK = enzymeModel.variables.indexOf('clock');
const at = (state: Float64Array, id: string) => state[enzymeModel.variables.indexOf(id)]!;

/** Catalase at the bench: the experiment's constants (see its definition). */
const BASE = {
  substrate: 0.5,
  temperature: 37,
  pH: 7,
  enzymeVolume: 1,
  km: 0.1,
  specificActivity: 0.01,
  q10: 2,
  meltTemperature: 41,
  meltWidth: 3,
  optimumPH: 7,
  pHWidth: 1.5,
  mixtureVolume: 5,
  molarVolume: 24.06,
  window: 10,
  collectionTime: 60,
};
type Inputs = typeof BASE;
const inputsOf = (change: Partial<Inputs> = {}): Inputs => ({ ...BASE, ...change });
const theory = (change: Partial<Inputs> = {}) => enzymeModel.predict!(inputsOf(change));

/** g(T) written out again: Q₁₀ speed-up times the folded share. */
const g = (i: Inputs, t: number) =>
  i.q10 ** ((t - i.meltTemperature) / 10) / (1 + Math.exp((t - i.meltTemperature) / i.meltWidth));

/** The optimum found by golden-section search on g, with no formula for it. */
function searchedOptimum(i: Inputs): number {
  let a = 0;
  let b = 100;
  const r = (Math.sqrt(5) - 1) / 2;
  for (let k = 0; k < 200; k++) {
    const c = b - r * (b - a);
    const d = a + r * (b - a);
    if (g(i, c) > g(i, d)) b = d;
    else a = c;
  }
  return (a + b) / 2;
}

/** V_max from the factors written out independently. */
const vmaxBy = (i: Inputs) =>
  i.specificActivity *
  i.enzymeVolume *
  (g(i, i.temperature) / g(i, searchedOptimum(i))) *
  Math.exp(-((i.pH - i.optimumPH) ** 2) / (2 * i.pHWidth ** 2));

/** dS/dt = −V·S/(K_m + S) by classical RK4 with a fine step: no integrated law involved. */
function rk4(s0: number, time: number, vmax: number, km: number, h = 1e-3): number {
  const f = (s: number) => (-vmax * s) / (km + s);
  let s = s0;
  const n = Math.round(time / h);
  for (let k = 0; k < n; k++) {
    const k1 = f(s);
    const k2 = f(s + (h / 2) * k1);
    const k3 = f(s + (h / 2) * k2);
    const k4 = f(s + h * k3);
    s += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
  }
  return s;
}

/** The model alone, stepped by `dt` until it stops; `each` sees the state after each step. */
function release(
  input: Inputs,
  dt: number,
  each?: (state: Float64Array, advanced: number) => void,
) {
  const state = new Float64Array(enzymeModel.variables.length);
  enzymeModel.init(input, state);
  for (let k = 0; k < 1e7 && !enzymeModel.isComplete!(state, input); k++) {
    const advanced = enzymeModel.step(state, dt, input);
    each?.(state, advanced);
  }
  return state;
}

const relative = (actual: number, expected: number) => Math.abs(actual - expected) / expected;

describe('enzyme activity factors', () => {
  it('peaks at T_opt = Tm + w·ln(s/(1 − s)), as a search of g(T) finds, with f_T = 1 there', () => {
    const t = theory();
    expect(t.optimumTemperature).toBeCloseTo(searchedOptimum(BASE), 6);
    expect(t.optimumTemperature).toBeCloseTo(36.99, 1); // ≈ 37 °C for Tm = 41, w = 3, Q₁₀ = 2
    expect(theory({ temperature: t.optimumTemperature! }).temperatureFactor).toBeCloseTo(1, 12);
  });

  it('rises by about Q₁₀ per 10 °C well below the optimum and collapses above it', () => {
    const cold = theory({ temperature: 5 }).temperatureFactor!;
    const cool = theory({ temperature: 15 }).temperatureFactor!;
    // Far below Tm the folded share is ~1, so g(T + 10)/g(T) → Q₁₀.
    expect(cool / cold).toBeCloseTo(2, 2);
    expect(theory({ temperature: 60 }).temperatureFactor).toBeLessThan(0.02);
    expect(theory({ temperature: 25 }).temperatureFactor).toBeCloseTo(g(BASE, 25) / g(BASE, 37), 3);
  });

  it('gives the pH bell curve: 1 at the optimum, e^(−1/2) one width away, symmetric', () => {
    expect(theory().pHFactor).toBe(1);
    expect(theory({ pH: 8.5 }).pHFactor).toBeCloseTo(Math.exp(-0.5), 12);
    expect(theory({ pH: 5.5 }).pHFactor).toBeCloseTo(Math.exp(-0.5), 12);
    expect(theory({ pH: 4 }).pHFactor).toBeCloseTo(Math.exp(-2), 12);
  });

  it('scales V_max by a·E·f_T·f_pH and v₀ = V_max·S₀/(K_m + S₀)', () => {
    for (const change of [{}, { temperature: 20, pH: 5 }, { enzymeVolume: 2, substrate: 0.05 }]) {
      const i = inputsOf(change);
      const t = theory(change);
      expect(relative(t.vmax!, vmaxBy(i))).toBeLessThan(1e-9);
      expect(
        relative(t.initialRate!, (vmaxBy(i) * i.substrate) / (i.km + i.substrate)),
      ).toBeLessThan(1e-9);
      expect(t.activityFactor).toBeCloseTo(t.temperatureFactor! * t.pHFactor!, 15);
    }
    // At both optima: V_max = 0.01 mol/(L·s), v₀ = 0.01·0.5/0.6.
    expect(theory({ temperature: theory().optimumTemperature! }).initialRate).toBeCloseTo(
      0.01 / 1.2,
      12,
    );
  });
});

describe('enzyme kinetics: the integrated Michaelis–Menten law', () => {
  it('satisfies t = (P + K_m·ln(S₀/(S₀ − P)))/V_max at every step', () => {
    for (const change of [{}, { substrate: 0.05 }, { substrate: 1, enzymeVolume: 2 }]) {
      const i = inputsOf(change);
      const vmax = theory(change).vmax!;
      release(i, 0.01, (state) => {
        const p = i.substrate - at(state, 'substrate');
        const t = (p + i.km * Math.log(i.substrate / (i.substrate - p))) / vmax;
        expect(Math.abs(t - at(state, 'clock'))).toBeLessThan(1e-9);
      });
    }
  });

  it('agrees with an RK4 integration of dS/dt = −V·S/(K_m + S)', () => {
    for (const [s0, time] of [
      [0.5, 10],
      [0.05, 60],
      [1, 60],
    ] as const) {
      expect(relative(substrateAfter(s0, time, 0.01, 0.1), rk4(s0, time, 0.01, 0.1))).toBeLessThan(
        1e-10,
      );
    }
  });

  it('tends to zero order for S ≫ K_m and to first order for S ≪ K_m', () => {
    // S₀ = 1000·K_m: S ≈ S₀ − V·t, plus K_m·ln(S₀/S) ≈ K_m·ln 2 from the slowing it adds.
    expect(substrateAfter(100, 50, 1, 0.1)).toBeCloseTo(50 + 0.1 * Math.log(2), 3);
    expect(relative(substrateAfter(100, 50, 1, 0.1), 50)).toBeLessThan(2e-3);
    // S₀ = K_m/1e6: S ≈ S₀·e^(−V·t/K_m).
    const tiny = 1e-7;
    expect(relative(substrateAfter(tiny, 20, 0.01, 0.1), tiny * Math.exp(-2))).toBeLessThan(1e-5);
  });

  it('is half converted at t½ = (S₀/2 + K_m·ln 2)/V_max', () => {
    const t = theory();
    expect(t.halfTime).toBeCloseTo((0.25 + 0.1 * Math.LN2) / t.vmax!, 12);
    expect(substrateAfter(0.5, t.halfTime!, t.vmax!, 0.1)).toBeCloseTo(0.25, 12);
  });

  it('never moves for no time, and leaves no substrate untouched for a long time', () => {
    expect(substrateAfter(0.5, 0, 0.01, 0.1)).toBe(0.5);
    const late = substrateAfter(0.5, 1e4, 0.01, 0.1);
    expect(late).toBeGreaterThanOrEqual(0);
    expect(late).toBeLessThan(1e-200);
  });
});

describe('enzyme run: oxygen in the gas syringe', () => {
  it('collects ½ mol O₂ per mol H₂O₂ at the molar volume: 30.075 mL from 0.5 mol/L in 5 mL', () => {
    // 0.5 mol/L · 5 mL = 2.5 mmol H₂O₂ → 1.25 mmol O₂ · 24.06 mL/mmol.
    expect(theory().maxOxygen).toBeCloseTo(30.075, 10);
    const state = release(inputsOf({ collectionTime: 1e4 }), 1);
    expect(at(state, 'oxygen')).toBeCloseTo(30.075, 9);
    expect(at(state, 'conversion')).toBeCloseTo(100, 9);
  });

  it('stops exactly on the window and on the collection end, taking only the time it needs', () => {
    const steps: number[] = [];
    const clocks: number[] = [];
    const state = release(BASE, 3, (s, advanced) => {
      steps.push(advanced);
      clocks.push(s[CLOCK]!);
    });
    expect(clocks).toContain(10);
    expect(steps.slice(0, 4)).toEqual([3, 3, 3, 1]); // the 4th step stops on the window
    expect(state[CLOCK]).toBe(60);
    expect(enzymeModel.step(state, 1, BASE)).toBe(0); // the collection is over
  });

  it('freezes the window reading at the window and matches its theory', () => {
    const t = theory();
    const state = release(BASE, 0.01);
    expect(at(state, 'windowOxygen')).toBeCloseTo(t.windowOxygen!, 10);
    expect(at(state, 'windowRate')).toBeCloseTo(t.windowRate!, 12);
    // 1/v̄ = t_w/(S₀ − S(t_w)), with S(t_w) from the RK4 integration, not the integrated law.
    const sw = rk4(0.5, 10, t.vmax!, 0.1);
    expect(relative(at(state, 'inverseWindowRate'), 10 / (0.5 - sw))).toBeLessThan(1e-9);
    expect(relative(t.inverseWindowRate!, 10 / (0.5 - sw))).toBeLessThan(1e-9);
    // The mean over the window falls below the initial rate: the rate only drops as S is used.
    expect(t.windowRate!).toBeLessThan(t.initialRate!);
    expect(at(state, 'oxygen')).toBeCloseTo(t.finalOxygen!, 10);
    expect(at(state, 'conversion')).toBeCloseTo(t.finalConversion!, 10);
  });

  it('is step-size independent and deterministic', () => {
    const fine = release(BASE, 0.001);
    const coarse = release(BASE, 0.37);
    for (const id of ['substrate', 'oxygen', 'windowOxygen', 'windowRate', 'rate']) {
      expect(relative(at(coarse, id), at(fine, id))).toBeLessThan(1e-9);
    }
    expect(release(BASE, 0.01)).toEqual(release(BASE, 0.01));
  });

  it('starts with v₀, 1/S₀ and 1/v̄ = 1/v₀ (the limit of the mean at t = 0)', () => {
    const state = new Float64Array(enzymeModel.variables.length);
    enzymeModel.init(BASE, state);
    const t = theory();
    expect(at(state, 'rate')).toBe(t.initialRate);
    expect(at(state, 'windowRate')).toBe(t.initialRate);
    expect(at(state, 'inverseSubstrate')).toBe(2);
    expect(at(state, 'inverseWindowRate')).toBeCloseTo(1 / t.initialRate!, 12);
    expect(state[S]).toBe(0.5);
  });
});

describe('enzyme refusals', () => {
  it('refuses missing and out-of-range inputs with the reason, never clamping', () => {
    const state = new Float64Array(enzymeModel.variables.length);
    const missing: Record<string, number> = { ...BASE };
    delete missing.km;
    expect(() => enzymeModel.init(missing, state)).toThrow(/"km" is missing/);
    expect(() => enzymeModel.init(inputsOf({ substrate: 0 }), state)).toThrow(/"substrate"/);
    // Neat H₂O₂ is ~42 mol/L: no solution is stronger than 40 mol/L.
    expect(() => enzymeModel.init(inputsOf({ substrate: 45 }), state)).toThrow(/"substrate"/);
    expect(() => enzymeModel.init(inputsOf({ substrate: 40 }), state)).not.toThrow();
    // The extract is part of the 5 mL mixture.
    expect(() => enzymeModel.init(inputsOf({ enzymeVolume: 6 }), state)).toThrow(/mixtureVolume/);
    expect(() => enzymeModel.init(inputsOf({ enzymeVolume: 5 }), state)).not.toThrow();
    expect(() => enzymeModel.predict!(inputsOf({ pH: NaN }))).toThrow(/"pH"/);
    expect(() => enzymeModel.init(inputsOf({ q10: 10, meltWidth: 20 }), state)).toThrow(/optimum/);
    expect(() => enzymeModel.init(inputsOf({ window: 100 }), state)).toThrow(/collectionTime/);
  });

  it('never throws and stays finite across the dial ranges', () => {
    for (const substrate of [0.05, 1])
      for (const temperature of [5, 65])
        for (const pH of [4, 10])
          for (const enzymeVolume of [0.25, 2]) {
            const i = inputsOf({ substrate, temperature, pH, enzymeVolume });
            const values = Object.values(enzymeModel.predict!(i));
            expect(values.every(Number.isFinite)).toBe(true);
            expect(Array.from(release(i, 0.5)).every(Number.isFinite)).toBe(true);
          }
  });
});

/** A test-only definition: the station's run, its results and the Lineweaver–Burk fit. */
const definition: ExperimentDefinition = ExperimentDefinitionSchema.parse({
  id: 'enzyme-test',
  name: 'Enzyme (test)',
  category: 'biology',
  model: enzymeModel.id,
  parameters: [
    { id: 'substrate', label: 'S₀', unit: 'mol/L', default: 0.5, min: 0.05, max: 1 },
    { id: 'temperature', label: 'T', unit: '°C', default: 37, min: 5, max: 65 },
    { id: 'pH', label: 'pH', unit: '', default: 7, min: 4, max: 10 },
    { id: 'enzymeVolume', label: 'E', unit: 'mL', default: 1, min: 0.25, max: 2 },
  ],
  initialConditions: Object.fromEntries(
    Object.entries(BASE).filter(
      ([id]) => !['substrate', 'temperature', 'pH', 'enzymeVolume'].includes(id),
    ),
  ),
  simulation: { timeStep: 0.01, maxDuration: 65, sampleInterval: 0.5 },
  measurements: [{ id: 'oxygen', label: 'O₂', unit: 'mL', variable: 'oxygen' }],
  results: [
    {
      id: 'v0',
      label: 'v₀',
      unit: 'mol/(L·s)',
      variable: 'rate',
      reduce: 'max',
      theory: 'initialRate',
    },
    { id: 'invS', label: '1/S₀', unit: 'L/mol', variable: 'inverseSubstrate', reduce: 'final' },
    { id: 'invV', label: '1/v̄', unit: 'L·s/mol', variable: 'inverseWindowRate', reduce: 'final' },
    {
      id: 'o2',
      label: 'O₂',
      unit: 'mL',
      variable: 'oxygen',
      reduce: 'final',
      theory: 'finalOxygen',
    },
  ],
});

describe('enzyme in the runtime', () => {
  const run = (overrides: Record<string, number> = {}) => {
    const r = new ExperimentRuntime('test', definition, enzymeModel, overrides);
    r.runToCompletion();
    return r;
  };

  it('ends by itself at the collection end with results matching the theory', () => {
    const r = run();
    expect(r.endReason).toBe('model');
    expect(r.time).toBeCloseTo(60, 9);
    const t = r.theory()!;
    expect(r.results!.v0).toBe(t.initialRate); // the rate is fastest at the start
    expect(r.results!.o2).toBeCloseTo(t.finalOxygen!, 9);
  });

  it('puts the 10-s Lineweaver–Burk points above the exact line, most at low S₀', () => {
    const vmax = theory().vmax!;
    const line = (invS: number) => (0.1 / vmax) * invS + 1 / vmax; // 1/v₀ = (K_m/V)·(1/S₀) + 1/V
    const gaps = [0.05, 0.1, 0.25, 0.5, 1].map((substrate) => {
      const p = run({ substrate }).results!;
      return p.invV! / line(p.invS!) - 1;
    });
    // The mean rate over the window is below v₀, so 1/v̄ > 1/v₀; the relative gap shrinks with S₀.
    for (const gap of gaps) expect(gap).toBeGreaterThan(0);
    for (let k = 1; k < gaps.length; k++) expect(gaps[k]!).toBeLessThan(gaps[k - 1]!);
  });

  it('matches the first-order gap t_w·V·K_m/(2(K_m + S₀)²) and the exact line as t_w → 0', () => {
    const vmax = theory().vmax!;
    // v(t) ≈ v₀ − v₀·(dv/dS)·t, so v̄ ≈ v₀·(1 − (dv/dS)·t_w/2), dv/dS = V·K_m/(K_m + S)².
    for (const substrate of [0.05, 0.5]) {
      const short = run({ substrate, window: 0.01 }).results!;
      const gap = (short.invV! * (vmax * substrate)) / (0.1 + substrate) - 1;
      const expected = (0.01 * vmax * 0.1) / (2 * (0.1 + substrate) ** 2);
      expect(relative(gap, expected)).toBeLessThan(1e-2);
    }
    const points = [0.05, 0.1, 0.25, 0.5, 1].map(
      (substrate) => run({ substrate, window: 1e-4 }).results!,
    );
    const fit = fitLine(points.map((p) => ({ x: p.invS!, y: p.invV! })));
    if (fit.status !== 'fitted') throw new Error(fit.status);
    expect(relative(fit.slope, 0.1 / vmax)).toBeLessThan(1e-4);
    expect(relative(fit.intercept, 1 / vmax)).toBeLessThan(1e-4);
  });
});
