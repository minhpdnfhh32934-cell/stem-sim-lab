import { describe, expect, it } from 'vitest';
import { ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { fitLine } from '../fit';
import { transpirationModel } from './transpiration';

const TIME = transpirationModel.variables.indexOf('labTime');
const DISTANCE = transpirationModel.variables.indexOf('distance');
const UPTAKE = transpirationModel.variables.indexOf('uptake');
const RATE = transpirationModel.variables.indexOf('transpirationRate');

const DURATION = 600;
const LAPSE = 20;

const inputsOf = (change: Record<string, number> = {}) => ({
  illuminance: 5000,
  humidity: 50,
  airSpeed: 0.1,
  temperature: 20,
  leafArea: 0.005,
  leafWidth: 0.05,
  boreDiameter: 0.001,
  scaleLength: 0.25,
  duration: DURATION,
  timeLapse: LAPSE,
  ...change,
});

const predict = (change: Record<string, number> = {}) =>
  transpirationModel.predict!(inputsOf(change));

/** The model alone, stepped by `dt` run seconds until it stops; `each` sees the state. */
function time(inputs: Record<string, number>, dt: number, each?: (s: Float64Array) => void) {
  const state = new Float64Array(transpirationModel.variables.length);
  transpirationModel.init(inputs, state);
  let runTime = 0;
  let last = dt;
  for (let i = 0; i < 1e7 && !transpirationModel.isComplete!(state, inputs); i++) {
    last = transpirationModel.step(state, dt, inputs);
    runTime += last;
    each?.(state);
  }
  return { state, runTime, last };
}

describe('transpiration theory: reference values', () => {
  it('takes e_s(T) within 0.1 % of IAPWS-95 (D at 0 % humidity is e_s itself)', () => {
    // Saturation vapour pressure of water, kPa (IAPWS-95, Wagner & Pruß 2002; CRC Handbook).
    const iapws: [number, number][] = [
      [0, 0.61115],
      [10, 1.2282],
      [20, 2.3393],
      [25, 3.1699],
      [30, 4.247],
      [40, 7.3849],
    ];
    for (const [temperature, reference] of iapws) {
      const d = predict({ temperature, humidity: 0, scaleLength: 2 }).vapourDeficit!;
      expect(Math.abs(d / reference - 1)).toBeLessThan(0.001);
    }
  });

  it('takes g_b from the laminar flat-plate law Sh = 0.664·Re^½·Sc^⅓ for air at 20 °C', () => {
    // g_b = Sh·D_v·ĉ/d: ν = 15.1 mm²/s (dry air), D_v = 1.87e-10·T^2.072 m²/s (Marrero & Mason
    // 1972: 24.2 mm²/s), ĉ = P/(R·T) the molar density of air, d = 0.72·w (Campbell & Norman).
    const nu = 15.1e-6;
    const dv = 1.87e-10 * 293.15 ** 2.072;
    const molarDensity = 101325 / (8.314462618 * 293.15); // ≈ 41.57 mol/m³
    for (const [airSpeed, leafWidth] of [
      [0.1, 0.05],
      [1, 0.05],
      [3, 0.12],
    ] as const) {
      const d = 0.72 * leafWidth;
      const re = (airSpeed * d) / nu;
      const sh = 0.664 * Math.sqrt(re) * Math.cbrt(nu / dv);
      const gb = (sh * dv * molarDensity) / d;
      const model = predict({ airSpeed, leafWidth }).boundaryConductance!;
      expect(Math.abs(model / gb - 1)).toBeLessThan(0.005);
    }
  });

  it('works the default run out by hand: 5 000 lux, 50 %, still air, 20 °C, 10 min', () => {
    const t = predict();
    // e_s(20 °C) = 0.61121·e^(17.502·20/260.97) = 2.337282 kPa; D = half of it.
    expect(t.vapourDeficit).toBeCloseTo(1.168641, 6);
    // Half open at I_½ = 5 000 lux: g_s = 0.01 + 0.29/2; g_b = 0.147·√(0.1/0.036) = 0.147·5/3.
    expect(t.stomatalConductance).toBeCloseTo(0.155, 12);
    expect(t.boundaryConductance).toBeCloseTo(0.245, 12);
    // In series: 0.155·0.245/(0.155 + 0.245); the stomata hold 0.245/0.4 of the resistance.
    expect(t.conductance).toBeCloseTo(0.0949375, 12);
    expect(t.stomatalShare).toBeCloseTo(61.25, 10);
    // E = g·D/P = 0.0949375 × 1.168641 / 101.325 mol/(m²·s).
    expect(t.transpirationRate).toBeCloseTo(1.09497, 5);
    // V = E·A·M/ρ·t = 1.09497e-3 × 0.005 × 18.015 / 0.9982 × 600 mL; x = V/(π·0.5² mm²).
    expect(t.uptake).toBeCloseTo(0.0592844, 7);
    expect(t.distance).toBeCloseTo(0.0754832, 7);
    expect(t.rateSlope).toBeCloseTo(0.93696, 5);
  });
});

describe('transpiration theory: how the conditions act', () => {
  it('adds the two resistances in series: 1/g = 1/g_s + 1/g_b', () => {
    for (const illuminance of [0, 1000, 20000]) {
      for (const airSpeed of [0.1, 3]) {
        const t = predict({ illuminance, airSpeed });
        const resistance = 1 / t.stomatalConductance! + 1 / t.boundaryConductance!;
        expect(1 / t.conductance!).toBeCloseTo(resistance, 9);
        expect(t.stomatalShare).toBeCloseTo(100 / t.stomatalConductance! / resistance, 9);
      }
    }
  });

  it('opens the stomata with light: g_dark in the dark, halfway at 5 000 lux, toward g_max', () => {
    expect(predict({ illuminance: 0 }).stomatalConductance).toBe(0.01);
    expect(predict({ illuminance: 1e5 }).stomatalConductance).toBeCloseTo(0.01 + 0.29 / 1.05, 12);
    const g = [0, 1000, 5000, 20000].map((i) => predict({ illuminance: i }).stomatalConductance!);
    expect(g).toEqual([...g].sort((a, b) => a - b));
  });

  it('drives E with the deficit: ∝ (100 − RH) and ∝ e_s(T), none in saturated air', () => {
    const at = (humidity: number) => predict({ humidity }).transpirationRate!;
    expect(at(30) / at(90)).toBeCloseTo(70 / 10, 12);
    expect(predict({ humidity: 100 }).transpirationRate).toBe(0);
    expect(predict({ humidity: 100 }).distance).toBe(0);
    // At one humidity, E(30 °C)/E(20 °C) is the ratio of the saturation pressures (IAPWS-95).
    const warm = predict({ temperature: 30 }).transpirationRate! / at(50);
    expect(Math.abs(warm / (4.247 / 2.3393) - 1)).toBeLessThan(0.002);
  });

  it('gives the fan little effect with closed stomata and a large one with open stomata', () => {
    const gain = (illuminance: number) =>
      predict({ illuminance, airSpeed: 3 }).transpirationRate! /
      predict({ illuminance, airSpeed: 0.1 }).transpirationRate!;
    expect(gain(0)).toBeGreaterThan(1);
    expect(gain(0)).toBeLessThan(1.04);
    expect(gain(20000)).toBeGreaterThan(1.6);
  });

  it('makes the stomatal share the sensitivity of E to the air: ∂lnE/∂ln u = ½(1 − share)', () => {
    for (const illuminance of [0, 5000, 20000]) {
      const h = 1e-4;
      const ln = (airSpeed: number) =>
        Math.log(predict({ illuminance, airSpeed }).transpirationRate!);
      const slope = (ln(Math.exp(h)) - ln(Math.exp(-h))) / (2 * h); // about u = 1 m/s
      const share = predict({ illuminance, airSpeed: 1 }).stomatalShare! / 100;
      expect(slope).toBeCloseTo(0.5 * (1 - share), 6);
    }
  });

  it('puts E against D on a line through the origin, slope 1000·g/P, for one light and air', () => {
    for (const [illuminance, airSpeed] of [
      [5000, 0.1],
      [20000, 3],
      [0, 0.5],
    ] as const) {
      const at = (humidity: number) => predict({ illuminance, airSpeed, humidity });
      const points = [30, 50, 70, 90].map((h) => ({
        x: at(h).vapourDeficit!,
        y: at(h).transpirationRate!,
      }));
      const fit = fitLine(points);
      if (fit.status !== 'fitted') throw new Error('no line');
      expect(fit.slope).toBeCloseTo(at(50).rateSlope!, 9);
      expect(fit.intercept).toBeCloseTo(0, 12);
      expect(at(50).rateSlope).toBeCloseTo((1000 * at(50).conductance!) / 101.325, 12);
    }
  });

  it('scales V with the leaf area, and x also with 1/r² of the bore; E with neither', () => {
    const base = predict();
    const big = predict({ leafArea: 0.01, boreDiameter: 0.002 });
    expect(big.uptake! / base.uptake!).toBeCloseTo(2, 12);
    expect(big.distance! / base.distance!).toBeCloseTo(0.5, 12);
    expect(big.transpirationRate).toBe(base.transpirationRate);
  });
});

describe('transpiration run: the bubble timed, then stopped at the end of the measuring time', () => {
  it('moves the bubble at a steady speed: x ∝ t, and E from the bubble equals the theory', () => {
    const inputs = inputsOf();
    const theory = transpirationModel.predict!(inputs);
    let checked = 0;
    time(inputs, 0.02, (s) => {
      const t = s[TIME]!;
      expect(s[DISTANCE]!).toBeCloseTo((theory.distance! * t) / DURATION, 12);
      expect(s[UPTAKE]!).toBeCloseTo((theory.uptake! * t) / DURATION, 12);
      expect(Math.abs(s[RATE]! / theory.transpirationRate! - 1)).toBeLessThan(1e-12);
      checked++;
    });
    // 30 run seconds in 0.02 s steps, plus at most one sliver the sums of 0.4 s leave.
    expect(checked === 1500 || checked === 1501).toBe(true);
  });

  it('starts with the bubble at the zero mark and no rate', () => {
    const state = new Float64Array(transpirationModel.variables.length);
    transpirationModel.init(inputsOf(), state);
    expect([state[TIME], state[DISTANCE], state[UPTAKE], state[RATE]]).toEqual([0, 0, 0, 0]);
  });

  it('ends exactly at the measuring time, whatever the step, with the theory’s result', () => {
    const inputs = inputsOf({ illuminance: 20000, humidity: 30, airSpeed: 3 });
    const theory = transpirationModel.predict!(inputs);
    for (const dt of [0.001, 0.02, 0.07, 0.3, 7, 100]) {
      const { state, runTime, last } = time(inputs, dt);
      expect(state[TIME]).toBe(DURATION);
      expect(runTime).toBeCloseTo(DURATION / LAPSE, 9); // 30 run seconds
      expect(last).toBeLessThanOrEqual(dt);
      expect(state[DISTANCE]!).toBeCloseTo(theory.distance!, 12);
    }
    const { state } = time(inputs, 0.02);
    expect(transpirationModel.step(state, 0.02, inputs)).toBe(0); // nothing after the timing
  });

  it('keeps the bubble still in saturated air', () => {
    const { state } = time(inputsOf({ humidity: 100 }), 0.02);
    expect([state[DISTANCE], state[UPTAKE], state[RATE]]).toEqual([0, 0, 0]);
  });

  it('is deterministic: two runs give the same bits', () => {
    const a = time(inputsOf(), 0.02).state;
    const b = time(inputsOf(), 0.02).state;
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe('transpiration inputs: refused with a reason, never clamped', () => {
  it('refuses missing, out-of-range and non-finite inputs', () => {
    const state = new Float64Array(transpirationModel.variables.length);
    const missing: Record<string, number> = inputsOf();
    delete missing.humidity;
    expect(() => transpirationModel.init(missing, state)).toThrow(/"humidity" is missing/);
    expect(() => predict({ humidity: 101 })).toThrow(/0 to 100 %/);
    expect(() => predict({ illuminance: -1 })).toThrow(/illuminance/);
    expect(() => transpirationModel.init(inputsOf({ temperature: NaN }), state)).toThrow(
      /temperature/,
    );
    expect(() => predict({ leafArea: 0 })).toThrow(/leafArea/);
  });

  it('refuses still air below 0.1 m/s, where free convection would set the boundary layer', () => {
    expect(() => predict({ airSpeed: 0 })).toThrow(/free convection/);
    expect(() => predict({ airSpeed: 0.05 })).toThrow(/0\.1 to 10 m\/s/);
  });

  it('refuses a run whose bubble would pass the end of the scale', () => {
    // 20 000 lux, 30 %, 3 m/s: 0.228 m in 10 min fits the 0.25 m scale; 20 min does not.
    const fast = { illuminance: 20000, humidity: 30, airSpeed: 3 };
    expect(predict(fast).distance).toBeCloseTo(0.2282, 4);
    expect(() => predict({ ...fast, duration: 1200 })).toThrow(/0\.456 m, past the end/);
  });
});

describe('transpiration in the experiment runtime', () => {
  const definition = ExperimentDefinitionSchema.parse({
    id: 'transpiration-test',
    name: 'Transpiration',
    category: 'biology',
    model: 'biology.transpiration',
    parameters: [
      { id: 'illuminance', label: 'I', unit: 'lux', default: 5000, min: 0, max: 20000 },
      { id: 'humidity', label: 'RH', unit: '%', default: 50, min: 0, max: 100 },
      { id: 'airSpeed', label: 'u', unit: 'm/s', default: 0.1, min: 0.1, max: 3 },
    ],
    initialConditions: {
      temperature: 20,
      leafArea: 0.005,
      leafWidth: 0.05,
      boreDiameter: 0.001,
      scaleLength: 0.25,
      duration: DURATION,
      timeLapse: LAPSE,
    },
    simulation: { timeStep: 0.02, maxDuration: 35, sampleInterval: 0.1 },
    measurements: [{ id: 'distance', label: 'x', unit: 'm', variable: 'distance' }],
    results: [
      {
        id: 'x',
        label: 'x',
        unit: 'm',
        variable: 'distance',
        reduce: 'final',
        theory: 'distance',
      },
    ],
  });

  it('ends by itself after 600/20 = 30 run seconds at every corner of the dials', () => {
    for (const illuminance of [0, 20000]) {
      for (const humidity of [30, 90]) {
        for (const airSpeed of [0.1, 3]) {
          const r = new ExperimentRuntime('t', definition, transpirationModel, {
            illuminance,
            humidity,
            airSpeed,
          });
          r.runToCompletion();
          expect([r.status, r.endReason]).toEqual(['completed', 'model']);
          expect(r.time).toBeCloseTo(DURATION / LAPSE, 9);
          expect(r.results!.x).toBeCloseTo(r.theory()!.distance!, 12);
        }
      }
    }
  });
});
