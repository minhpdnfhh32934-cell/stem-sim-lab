import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../content';
import { type ExperimentDefinition, ExperimentDefinitionSchema } from '../experiment';
import { checkExperimentAgainstModel, ExperimentRuntime } from '../ExperimentRuntime';
import { fitLine } from '../fit';
import { GAS_CONSTANT, kineticsModel } from './kinetics';

/** The reaction-rate station as shipped: its fixed inputs (crystal violet, 1 cm cuvette) and dials. */
const definition: ExperimentDefinition = ExperimentDefinitionSchema.parse(
  (bundledContent.experiments as { id: string }[]).find((e) => e.id === 'reaction-rate'),
);
const FIXED = definition.initialConditions;
const dial = (id: string) => {
  const { default: value, min, max } = definition.parameters.find((p) => p.id === id)!;
  return { default: value, min, max };
};
const DIALS = {
  initialConcentration: dial('initialConcentration'),
  naoh: dial('naoh'),
  temperature: dial('temperature'),
};
const MAX_DURATION = definition.simulation.maxDuration;

type Setting = { initialConcentration?: number; naoh?: number; temperature?: number };
const inputsOf = (s: Setting = {}): Record<string, number> => ({
  ...FIXED,
  initialConcentration: DIALS.initialConcentration.default,
  naoh: DIALS.naoh.default,
  temperature: DIALS.temperature.default,
  ...s,
});

/** A whole run as a station makes one: the experiment's own step, samples and end. */
const run = (s: Setting = {}, timeStep = definition.simulation.timeStep) => {
  const d = { ...definition, simulation: { ...definition.simulation, timeStep } };
  const r = new ExperimentRuntime('test', d, kineticsModel, s);
  r.runToCompletion();
  return r;
};
const samples = (r: ExperimentRuntime, id: string) =>
  r.sampleValues[definition.measurements.findIndex((m) => m.id === id)]!.subarray(0, r.sampleCount);
const times = (r: ExperimentRuntime) => r.sampleTimes.subarray(0, r.sampleCount);

/** Arrhenius written out here, in kelvin: k = k₂₅·exp(−(Eₐ/R)(1/T − 1/298.15 K)). */
const k2 = (celsius: number) =>
  0.1 * Math.exp((-60_000 / 8.31446261815324) * (1 / (celsius + 273.15) - 1 / 298.15));
const relative = (actual: number, expected: number) => Math.abs(actual / expected - 1);

describe('kinetics theory: pseudo-first order, Beer–Lambert and Arrhenius', () => {
  it('at the reference temperature: k′ = k_ref·[OH⁻], t½ = ln 2/k′, A₀ = ε·l·c₀', () => {
    const t = kineticsModel.predict!(inputsOf());
    expect(t.secondOrderRate).toBeCloseTo(0.1, 15);
    expect(t.rateConstant).toBeCloseTo(0.02, 15); // 0.1 L/(mol·s) · 0.2 mol/L
    expect(t.halfLife).toBeCloseTo(34.657359, 5); // ln 2 / 0.02 s⁻¹
    expect(t.endTime).toBeCloseTo(69.314718, 5); // two half-lives: f = ¼
    expect(t.initialAbsorbance).toBeCloseTo(1, 12); // 1e5 L/(mol·cm) · 1 cm · 1e-5 mol/L
    expect(t.finalAbsorbance).toBeCloseTo(0.25, 12);
    expect(t.finalConcentration).toBeCloseTo(2.5e-6, 18);
    expect(t.inverseTemperatureShift).toBe(0);
    expect(t.lnRateRatio).toBe(0);
  });

  it('the half-life does not depend on the starting concentration, only on k′', () => {
    const halves = [2e-6, 5e-6, 1.5e-5].map(
      (c) => kineticsModel.predict!(inputsOf({ initialConcentration: c })).halfLife!,
    );
    for (const h of halves) expect(h).toBeCloseTo(halves[0]!, 12);
    // Doubling [OH⁻] doubles k′ and halves t½: first order in hydroxide.
    const slow = kineticsModel.predict!(inputsOf({ naoh: 0.1 })).halfLife!;
    expect(slow / kineticsModel.predict!(inputsOf({ naoh: 0.2 })).halfLife!).toBeCloseTo(2, 12);
  });

  it('follows Arrhenius: an Eₐ chosen to double k over 25 → 35 °C doubles it', () => {
    const doubling = (GAS_CONSTANT * Math.LN2) / (1 / 298.15 - 1 / 308.15); // ≈ 52.9 kJ/mol
    const t = kineticsModel.predict!({
      ...inputsOf({ temperature: 35 }),
      activationEnergy: doubling,
    });
    expect(t.secondOrderRate).toBeCloseTo(0.2, 12);
    expect(doubling).toBeGreaterThan(52_800);
    expect(doubling).toBeLessThan(53_000);
    for (const celsius of [15, 20, 37.5, 45]) {
      const p = kineticsModel.predict!(inputsOf({ temperature: celsius }));
      expect(relative(p.secondOrderRate!, k2(celsius))).toBeLessThan(1e-13);
      expect(p.activationTemperature).toBeCloseTo(60_000 / 8.31446261815324, 9); // ≈ 7216 K
      expect(p.lnRateRatio).toBeCloseTo(Math.log(k2(celsius) / 0.1), 12);
    }
    // Warmer is faster, colder slower.
    expect(kineticsModel.predict!(inputsOf({ temperature: 45 })).rateConstant).toBeGreaterThan(
      0.02 * 4.5,
    );
    expect(kineticsModel.predict!(inputsOf({ temperature: 15 })).rateConstant).toBeLessThan(
      0.02 * 0.44,
    );
  });
});

describe('kinetics run: the colour fades as c₀·e^(−k′t)', () => {
  it('matches c₀·2^(−t/t½) at every sample, with A = ε·l·c and the extent 1 − c/c₀', () => {
    for (const s of [{}, { temperature: 40, naoh: 0.1 }, { initialConcentration: 3e-6 }]) {
      const r = run(s);
      const input = inputsOf(s);
      const half = Math.LN2 / (k2(input.temperature!) * input.naoh!);
      const c = samples(r, 'concentration');
      const a = samples(r, 'absorbance');
      const ln = samples(r, 'lnAbsorbance');
      const extent = samples(r, 'extent');
      times(r).forEach((t, i) => {
        const expected = input.initialConcentration! * 2 ** (-t / half);
        expect(relative(c[i]!, expected)).toBeLessThan(1e-11);
        expect(relative(a[i]!, 1e5 * c[i]!)).toBeLessThan(1e-12); // ε·l = 1e7 · 0.01
        expect(ln[i]).toBeCloseTo(Math.log(a[i]!), 12);
        expect(extent[i]! + c[i]! / input.initialConcentration!).toBeCloseTo(1, 12);
      });
    }
  });

  it('gives a straight ln A against t, slope −k′, through ln A₀', () => {
    const r = run({ temperature: 30, naoh: 0.15, initialConcentration: 8e-6 });
    const ln = samples(r, 'lnAbsorbance');
    const fit = fitLine(Array.from(times(r), (x, i) => ({ x, y: ln[i]! })));
    if (fit.status !== 'fitted') throw new Error('no fit');
    expect(relative(-fit.slope, k2(30) * 0.15)).toBeLessThan(1e-9);
    expect(fit.intercept).toBeCloseTo(Math.log(0.8), 9); // A₀ = 1e5 · 8e-6
    expect(fit.r2).toBeCloseTo(1, 12);
  });

  it('ends by itself at f·c₀, after ln(1/f)/k′, with results that agree with its theory', () => {
    const r = run();
    expect(r.endReason).toBe('model');
    expect(r.time).toBeCloseTo(Math.log(4) / 0.02, 9);
    const results = r.results!;
    const theory = r.theory()!;
    for (const id of ['rateConstant', 'halfLife', 'finalAbsorbance']) {
      expect(relative(results[id]!, theory[id]!)).toBeLessThan(1e-9);
    }
    expect(results.lnRateRatio).toBeCloseTo(theory.lnRateRatio!, 9); // 0 at T_ref
    expect(results.finalAbsorbance).toBeCloseTo(0.25, 12);
    expect(results.halfLife).toBeCloseTo(Math.LN2 / 0.02, 8);
  });

  it('does not depend on the step size: the same half-life and end for any step', () => {
    const reference = run({ temperature: 20 }, 0.001);
    for (const dt of [0.05, 0.37, 1]) {
      const r = run({ temperature: 20 }, dt);
      expect(relative(r.results!.halfLife!, reference.results!.halfLife!)).toBeLessThan(1e-10);
      expect(relative(r.results!.rateConstant!, reference.results!.rateConstant!)).toBeLessThan(
        1e-12,
      );
      expect(r.time).toBeCloseTo(reference.time, 9);
    }
  });

  it('stops exactly on the end: the last step returns only the time it needs, then 0', () => {
    const input = inputsOf();
    const state = new Float64Array(kineticsModel.variables.length);
    kineticsModel.init(input, state);
    const end = Math.log(4) / 0.02;
    expect(kineticsModel.step(state, 60, input)).toBe(60);
    expect(kineticsModel.isComplete!(state, input)).toBe(false);
    expect(kineticsModel.step(state, 60, input)).toBeCloseTo(end - 60, 12);
    expect(kineticsModel.isComplete!(state, input)).toBe(true);
    expect(state[kineticsModel.variables.indexOf('concentration')]).toBe(2.5e-6);
    expect(kineticsModel.step(state, 60, input)).toBe(0);
    // One 60 s step crossed t½ = 34.66 s: found on ln A within the step, not at its end.
    expect(state[kineticsModel.variables.indexOf('halfTime')]).toBeCloseTo(Math.LN2 / 0.02, 9);
  });

  it('is deterministic: two runs of one setting give identical samples', () => {
    const [a, b] = [run({ temperature: 33 }), run({ temperature: 33 })];
    expect(Array.from(samples(a, 'absorbance'))).toEqual(Array.from(samples(b, 'absorbance')));
    expect(a.results).toEqual(b.results);
  });

  it('starts at t = 0 with no rate yet: 0, never 0/0', () => {
    const state = new Float64Array(kineticsModel.variables.length);
    kineticsModel.init(inputsOf(), state);
    for (const id of ['observedRate', 'lnRateRatio', 'halfTime', 'extent', 'elapsed']) {
      expect(state[kineticsModel.variables.indexOf(id)]).toBe(0);
    }
    expect(state[kineticsModel.variables.indexOf('absorbance')]).toBeCloseTo(1, 12);
  });
});

describe('kinetics across runs: the order in OH⁻ and the Arrhenius plot', () => {
  it('k′ against [OH⁻] at one temperature: a line through 0, slope k(T)', () => {
    const points = [0.1, 0.15, 0.2, 0.25].map((naoh) => ({
      x: naoh,
      y: run({ naoh, temperature: 35 }).results!.rateConstant!,
    }));
    const fit = fitLine(points);
    if (fit.status !== 'fitted') throw new Error('no fit');
    expect(relative(fit.slope, k2(35))).toBeLessThan(1e-9);
    expect(Math.abs(fit.intercept)).toBeLessThan(1e-12);
  });

  it('ln(k/k_ref) against 1/T_ref − 1/T: a line through 0, slope Eₐ/R', () => {
    const points = [20, 25, 35, 45].map((temperature) => {
      const results = run({ temperature, naoh: 0.1 }).results!;
      return { x: results.inverseTemperatureShift!, y: results.lnRateRatio! };
    });
    const fit = fitLine(points);
    if (fit.status !== 'fitted') throw new Error('no fit');
    expect(relative(fit.slope * 8.31446261815324, 60_000)).toBeLessThan(1e-9); // Eₐ = R·slope
    expect(Math.abs(fit.intercept)).toBeLessThan(1e-9);
  });
});

describe('kinetics domain: refused with a reason, never clamped', () => {
  it('fits the station definition', () => {
    expect(checkExperimentAgainstModel(definition, kineticsModel)).toEqual([]);
  });

  it('every corner of the dials runs, ends by the model and before the time limit', () => {
    const { initialConcentration: c, naoh, temperature: t } = DIALS;
    for (const initialConcentration of [c.min, c.max]) {
      for (const n of [naoh.min, naoh.max]) {
        for (const temperature of [t.min, t.max]) {
          const s = { initialConcentration, naoh: n, temperature };
          expect(() => kineticsModel.predict!(inputsOf(s))).not.toThrow();
          const r = run(s);
          expect(r.status).toBe('completed');
          expect(r.endReason).toBe('model');
        }
      }
    }
    // The slowest corner, 20 °C and 0.1 mol/L: two half-lives ≈ 209 s, inside the time limit, so
    // no run is cut off before t½ (a cut-off run would keep halfTime = 0 as its result).
    const slowest = kineticsModel.predict!(
      inputsOf({ naoh: naoh.min, temperature: t.min }),
    ).endTime!;
    expect(slowest).toBeCloseTo((2 * Math.LN2) / (k2(20) * 0.1), 9);
    expect(slowest).toBeGreaterThan(200);
    expect(slowest).toBeLessThan(MAX_DURATION);
  });

  it('refuses missing, non-finite and out-of-domain inputs', () => {
    const state = new Float64Array(kineticsModel.variables.length);
    const missing = inputsOf();
    delete missing.naoh;
    expect(() => kineticsModel.init(missing, state)).toThrow('"naoh" is missing');
    expect(() => kineticsModel.predict!(inputsOf({ temperature: NaN }))).toThrow('temperature');
    expect(() => kineticsModel.predict!({ ...inputsOf(), endFraction: 0.5 })).toThrow(
      'endFraction',
    );
    expect(() => kineticsModel.predict!(inputsOf({ temperature: 101 }))).toThrow('0 to 100 °C');
  });

  it('refuses a hydroxide not in excess and a dye too dark to read', () => {
    expect(
      () => kineticsModel.predict!(inputsOf({ naoh: 9e-4, initialConcentration: 1e-5 })), // 90×, not 100×
    ).toThrow('pseudo-first order');
    expect(() => kineticsModel.predict!(inputsOf({ initialConcentration: 3e-5, naoh: 1 }))).toThrow(
      'linear range',
    );
  });

  it('refuses an end absorbance too faint to read, including one that underflows to 0', () => {
    // f·A₀ = 0.25 · 1e5 · 2e-9 = 5e-5, below 0.001.
    expect(() => kineticsModel.predict!(inputsOf({ initialConcentration: 2e-9 }))).toThrow(
      'too faint',
    );
    // ε·l = 1e-200 · 1e-200 underflows: A₀ = 0, refused at init, before ln A = −∞ is computed.
    const state = new Float64Array(kineticsModel.variables.length);
    const underflow = { ...inputsOf(), absorptivity: 1e-200, pathLength: 1e-200 };
    expect(() => kineticsModel.init(underflow, state)).toThrow('too faint');
    // The station's faintest dye still reads: f·A₀ = 0.25 · 0.2 = 0.05.
    expect(
      kineticsModel.predict!(inputsOf({ initialConcentration: 2e-6 })).finalAbsorbance,
    ).toBeCloseTo(0.05, 12);
  });
});
