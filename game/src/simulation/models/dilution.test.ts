import { describe, expect, it } from 'vitest';
import { ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { fitLine } from '../fit';
import { dilutionModel } from './dilution';
import { kineticsModel } from './kinetics';

const V = dilutionModel.variables.indexOf('volume');
const WATER = dilutionModel.variables.indexOf('waterAdded');
const C = dilutionModel.variables.indexOf('concentration');
const N = dilutionModel.variables.indexOf('amount');
const A = dilutionModel.variables.indexOf('absorbance');
const FACTOR = dilutionModel.variables.indexOf('dilutionFactor');
const RATIO = dilutionModel.variables.indexOf('volumeRatio');

const FILL = 10;

/** Crystal violet as the reaction-rate experiment states it: ε = 1·10⁷ L/(mol·m), l = 1 cm. */
const inputsOf = (change: Record<string, number> = {}) => ({
  stockConcentration: 2e-5,
  stockVolume: 5,
  finalVolume: 50,
  fillTime: FILL,
  absorptivity: 1e7,
  pathLength: 0.01,
  ...change,
});

/** The model alone, stepped by `dt` run seconds until it stops; `each` sees the state and time. */
function fill(
  inputs: Record<string, number>,
  dt: number,
  each?: (s: Float64Array, t: number) => void,
) {
  const state = new Float64Array(dilutionModel.variables.length);
  dilutionModel.init(inputs, state);
  let time = 0;
  let last = dt;
  for (let i = 0; i < 1e7 && !dilutionModel.isComplete!(state, inputs); i++) {
    last = dilutionModel.step(state, dt, inputs);
    time += last;
    each?.(state, time);
  }
  return { state, time, last };
}

describe('dilution theory: C₁·V₁ = C₂·V₂, worked by hand', () => {
  it('gives a textbook dilution: 25.0 mL of 2.00 mol/L made up to 250 mL is 0.200 mol/L', () => {
    // Any solute: ε·l = 5 L/mol keeps A₂ = 1.0 inside the colorimeter's range.
    const t = dilutionModel.predict!(
      inputsOf({ stockConcentration: 2, stockVolume: 25, finalVolume: 250, absorptivity: 500 }),
    );
    expect(t.finalConcentration).toBeCloseTo(0.2, 15);
    expect(t.dilutionFactor).toBe(10);
    expect(t.volumeRatio).toBe(0.1);
    expect(t.waterAdded).toBe(225);
    expect(t.amount).toBeCloseTo(0.05, 15); // 2.00 mol/L × 0.0250 L
    expect(t.absorbance).toBeCloseTo(1, 14);
  });

  it('gives the default crystal-violet run: 5 mL of 20 µmol/L made up to 50 mL', () => {
    const t = dilutionModel.predict!(inputsOf());
    expect(t.finalConcentration).toBeCloseTo(2e-6, 20); // 2.0 µmol/L
    expect(t.absorbance).toBeCloseTo(0.2, 12); // 1·10⁵ L/mol × 2.0·10⁻⁶ mol/L
    expect(t.amount).toBeCloseTo(1e-7, 22); // 2.0·10⁻⁵ mol/L × 0.005 L
    expect(t.absorbanceSlope).toBeCloseTo(1e5, 9);
    expect([t.stockConcentration, t.finalVolume, t.dilutionFactor]).toEqual([2e-5, 50, 10]);
  });

  it('answers the inverse question: 10 mL of 40 µmol/L makes 100 mL of 4.0 µmol/L', () => {
    // V₁ = C₂·V₂/C₁ = 4.0·10⁻⁶ × 100 / 4.0·10⁻⁵ = 10 mL.
    const t = dilutionModel.predict!(
      inputsOf({ stockConcentration: 4e-5, stockVolume: 10, finalVolume: 100 }),
    );
    expect(t.finalConcentration).toBeCloseTo(4e-6, 20);
  });

  it('chains: two 1-in-10 dilutions make the same solution as one 1-in-100', () => {
    const base = { absorptivity: 1000 }; // ε·l = 10 L/mol: 1, 0.1 and 0.01 mol/L all readable
    const first = dilutionModel.predict!(
      inputsOf({ ...base, stockConcentration: 1, stockVolume: 10, finalVolume: 100 }),
    );
    const second = dilutionModel.predict!(
      inputsOf({
        ...base,
        stockConcentration: first.finalConcentration!,
        stockVolume: 10,
        finalVolume: 100,
      }),
    );
    const once = dilutionModel.predict!(
      inputsOf({ ...base, stockConcentration: 1, stockVolume: 1, finalVolume: 100 }),
    );
    expect(second.finalConcentration).toBeCloseTo(once.finalConcentration!, 16);
    expect(once.finalConcentration).toBeCloseTo(0.01, 16);
  });

  it('agrees with the reaction-rate model: the same dye and cell give the same absorbance', () => {
    const t = dilutionModel.predict!(inputsOf({ stockVolume: 5, finalVolume: 10 })); // 10 µmol/L
    const k = kineticsModel.predict!({
      initialConcentration: t.finalConcentration!,
      naoh: 0.2,
      temperature: 25,
      referenceTemperature: 25,
      referenceRate: 0.1,
      activationEnergy: 60000,
      absorptivity: 1e7,
      pathLength: 0.01,
      endFraction: 0.25,
    });
    expect(t.absorbance).toBeCloseTo(k.initialAbsorbance!, 14);
    expect(t.absorbance).toBeCloseTo(1, 12);
  });

  it('puts C₂ against V₁/V₂ on a line through 0 of slope C₁, and A against C₂ of slope ε·l', () => {
    const law: { x: number; y: number }[] = [];
    const beer: { x: number; y: number }[] = [];
    for (const stockVolume of [1, 2, 5, 10]) {
      for (const finalVolume of [25, 50, 100, 250]) {
        const t = dilutionModel.predict!(inputsOf({ stockVolume, finalVolume }));
        law.push({ x: stockVolume / finalVolume, y: t.finalConcentration! });
        beer.push({ x: t.finalConcentration!, y: t.absorbance! });
      }
    }
    const lawFit = fitLine(law);
    const beerFit = fitLine(beer);
    if (lawFit.status !== 'fitted' || beerFit.status !== 'fitted') throw new Error('no line');
    expect(lawFit.slope / 2e-5).toBeCloseTo(1, 12);
    expect(lawFit.intercept).toBeCloseTo(0, 18);
    expect(beerFit.slope / 1e5).toBeCloseTo(1, 12);
    expect(beerFit.intercept).toBeCloseTo(0, 12);
  });
});

describe('dilution run: solvent up to the mark at a steady rate', () => {
  it('keeps the amount of dye while the volume rises, C = C₁·V₁/V at every step', () => {
    const inputs = inputsOf({ stockConcentration: 4e-5, stockVolume: 2, finalVolume: 250 });
    const n = (4e-5 * 2) / 1000; // 8.0·10⁻⁸ mol
    let steps = 0;
    fill(inputs, 0.02, (s, t) => {
      // V rises linearly: V₁ + (V₂ − V₁)·t/t_fill.
      expect(s[V]!).toBeCloseTo(2 + (248 * t) / FILL, 9);
      expect(s[WATER]!).toBeCloseTo(s[V]! - 2, 12);
      expect(s[C]! / ((4e-5 * 2) / s[V]!)).toBeCloseTo(1, 14);
      expect(s[N]! / n).toBeCloseTo(1, 14);
      expect(s[A]! / (1e5 * s[C]!)).toBeCloseTo(1, 14);
      expect(s[FACTOR]! * s[RATIO]!).toBeCloseTo(1, 14);
      steps++;
    });
    expect(steps).toBeGreaterThanOrEqual(500);
  });

  it('starts with the undiluted stock in the flask', () => {
    const state = new Float64Array(dilutionModel.variables.length);
    dilutionModel.init(inputsOf(), state);
    expect([state[V], state[WATER], state[C], state[FACTOR], state[RATIO]]).toEqual([
      5, 0, 2e-5, 1, 1,
    ]);
  });

  it('ends exactly at the mark after t_fill, whatever the step, with the theory’s result', () => {
    const inputs = inputsOf({ stockVolume: 10, finalVolume: 25 });
    const theory = dilutionModel.predict!(inputs);
    for (const dt of [0.001, 0.02, 0.07, 0.3, 3, 20]) {
      const { state, time, last } = fill(inputs, dt);
      expect(state[V]).toBe(25);
      expect(time).toBeCloseTo(FILL, 9);
      expect(last).toBeLessThanOrEqual(dt);
      // The same arithmetic as the theory once at the mark: the same bits.
      expect(state[C]).toBe(theory.finalConcentration);
      expect(state[A]).toBe(theory.absorbance);
      expect(state[WATER]).toBe(theory.waterAdded);
      expect(state[FACTOR]).toBe(theory.dilutionFactor);
      expect(state[RATIO]).toBe(theory.volumeRatio);
      expect(state[N]! / theory.amount!).toBeCloseTo(1, 14);
      expect(dilutionModel.step(state, dt, inputs)).toBe(0); // nothing after the mark
    }
  });

  it('is deterministic: two runs give the same bits', () => {
    const a = fill(inputsOf(), 0.02).state;
    const b = fill(inputsOf(), 0.02).state;
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe('dilution inputs: refused with a reason, never clamped', () => {
  it('refuses missing, out-of-range and non-finite inputs', () => {
    const state = new Float64Array(dilutionModel.variables.length);
    const missing: Record<string, number> = inputsOf();
    delete missing.stockVolume;
    expect(() => dilutionModel.init(missing, state)).toThrow(/"stockVolume" is missing/);
    expect(() => dilutionModel.predict!(inputsOf({ stockConcentration: 0 }))).toThrow(
      /stockConcentration/,
    );
    expect(() => dilutionModel.predict!(inputsOf({ stockConcentration: 21 }))).toThrow(/20 mol\/L/);
    expect(() => dilutionModel.init(inputsOf({ finalVolume: NaN }), state)).toThrow(/finalVolume/);
    expect(() => dilutionModel.init(inputsOf({ fillTime: Infinity }), state)).toThrow(/fillTime/);
    expect(() => dilutionModel.init(inputsOf({ pathLength: -0.01 }), state)).toThrow(/pathLength/);
  });

  it('refuses a final volume that is not larger than the stock volume', () => {
    expect(() => dilutionModel.predict!(inputsOf({ stockVolume: 10, finalVolume: 10 }))).toThrow(
      /must be larger than the stock volume.*only adds solvent/,
    );
    expect(() => dilutionModel.predict!(inputsOf({ stockVolume: 25, finalVolume: 10 }))).toThrow(
      /V₂ \(10 mL\)/,
    );
  });

  it('refuses a solution the colorimeter cannot read, saying which way to go', () => {
    // 40 µmol/L, 10 mL made up to 15 mL: 26.7 µmol/L, A₂ = 2.67.
    expect(() =>
      dilutionModel.predict!(
        inputsOf({ stockConcentration: 4e-5, stockVolume: 10, finalVolume: 15 }),
      ),
    ).toThrow(/above 2.*dilute more/);
    // 5 µmol/L, 1 mL made up to 1000 mL: 5 nmol/L, A₂ = 0.0005.
    expect(() =>
      dilutionModel.predict!(
        inputsOf({ stockConcentration: 5e-6, stockVolume: 1, finalVolume: 1000 }),
      ),
    ).toThrow(/too faint.*more stock/);
    // Just inside both ends still runs.
    const dark = inputsOf({ stockConcentration: 4e-5, stockVolume: 10, finalVolume: 20.5 });
    expect(dilutionModel.predict!(dark).absorbance).toBeCloseTo(4 / 2.05, 12);
  });
});

describe('dilution in the experiment runtime', () => {
  const definition = ExperimentDefinitionSchema.parse({
    id: 'dilution-test',
    name: 'Dilution',
    category: 'chemistry',
    model: 'chemistry.dilution',
    parameters: [
      { id: 'stockConcentration', label: 'C₁', unit: 'mol/L', default: 2e-5, min: 5e-6, max: 4e-5 },
      { id: 'stockVolume', label: 'V₁', unit: 'mL', default: 5, min: 1, max: 10 },
      { id: 'finalVolume', label: 'V₂', unit: 'mL', default: 50, min: 25, max: 250 },
    ],
    initialConditions: { fillTime: FILL, absorptivity: 1e7, pathLength: 0.01 },
    simulation: { timeStep: 0.02, maxDuration: 12, sampleInterval: 0.05 },
    measurements: [{ id: 'concentration', label: 'C', unit: 'mol/L', variable: 'concentration' }],
    results: [
      {
        id: 'c2',
        label: 'C₂',
        unit: 'mol/L',
        variable: 'concentration',
        reduce: 'final',
        theory: 'finalConcentration',
      },
    ],
  });

  it('ends by itself at the mark after t_fill, inside every dial’s range', () => {
    for (const stockConcentration of [5e-6, 4e-5]) {
      for (const [stockVolume, finalVolume] of [
        [1, 250],
        [10, 25],
      ] as const) {
        const r = new ExperimentRuntime('t', definition, dilutionModel, {
          stockConcentration,
          stockVolume,
          finalVolume,
        });
        r.runToCompletion();
        expect([r.status, r.endReason]).toEqual(['completed', 'model']);
        expect(r.time).toBeCloseTo(FILL, 9);
        expect(r.results!.c2).toBe(r.theory()!.finalConcentration);
      }
    }
  });
});

describe('dilution driven by the volume in the flask (physical lab)', () => {
  const driven = dilutionModel.driven!;

  it('lands on the stepped run’s final state at V₂, bit for bit, and ends there', () => {
    const inputs = inputsOf();
    const stepped = fill(inputs, 0.02).state;
    const state = new Float64Array(dilutionModel.variables.length);
    dilutionModel.init(inputs, state);
    expect(driven.variable).toBe('volume');
    expect(driven.set(state, inputs, 50)).toBe(true);
    expect([...state]).toEqual([...stepped]);
    expect(state[C]).toBe(dilutionModel.predict!(inputs).finalConcentration);
  });

  it('does not end between V₁ and V₂, keeps the amount, and refuses volumes outside them', () => {
    const inputs = inputsOf();
    const state = new Float64Array(dilutionModel.variables.length);
    dilutionModel.init(inputs, state);
    const n = state[N] ?? NaN;
    for (const v of [5, 5.001, 26, 49.999]) {
      expect(driven.set(state, inputs, v)).toBe(false);
      expect(state[V]).toBe(v);
      expect(state[WATER]).toBeCloseTo(v - 5, 12);
      expect(state[N]).toBeCloseTo(n, 22);
      expect(state[FACTOR]).toBeCloseTo(v / 5, 12);
      expect(state[RATIO]).toBeCloseTo(5 / v, 12);
      expect(state[A]).toBeCloseTo(1e5 * state[C]!, 12);
    }
    expect(() => driven.set(state, inputs, 4.999)).toThrow(/outside/);
    expect(() => driven.set(state, inputs, 50.001)).toThrow(/outside/);
    expect(() => driven.set(state, inputs, Number.NaN)).toThrow(/outside/);
  });
});
