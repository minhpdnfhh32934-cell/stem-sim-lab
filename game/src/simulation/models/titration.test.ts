import { describe, expect, it } from 'vitest';
import { type ExperimentDefinition, ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { titrationModel, titrationPH } from './titration';

const KW = 1e-14;
const EPS = Number.EPSILON;
const VOLUME = titrationModel.variables.indexOf('volume');
const PH = titrationModel.variables.indexOf('pH');

/** Acid in the flask (mol/L, mL) and the base's concentration (mol/L). */
const SETUPS = {
  standard: { acidConcentration: 0.1, acidVolume: 25, baseConcentration: 0.1 },
  second: { acidConcentration: 0.15, acidVolume: 20, baseConcentration: 0.1 },
  baseRich: { acidConcentration: 0.05, acidVolume: 10, baseConcentration: 0.2 },
  dilute: { acidConcentration: 1e-3, acidVolume: 25, baseConcentration: 1e-3 },
  molar: { acidConcentration: 1, acidVolume: 25, baseConcentration: 1 },
  ceiling: { acidConcentration: 100, acidVolume: 25, baseConcentration: 100 },
  smallSample: { acidConcentration: 0.1, acidVolume: 1e-3, baseConcentration: 0.1 },
  largeSample: { acidConcentration: 0.1, acidVolume: 1e6, baseConcentration: 0.1 },
};
type Setup = (typeof SETUPS)[keyof typeof SETUPS];
type Inputs = Setup & { kw: number; flowRate: number; endpointPH: number };

/** A setup's inputs: phenolphthalein, and a flow of Va/250 per second, so runs take minutes. */
const inputsOf = (setup: Setup, change: Partial<Inputs> = {}): Inputs => ({
  kw: KW,
  flowRate: setup.acidVolume / 250,
  endpointPH: 8.2,
  ...setup,
  ...change,
});

/** Equivalence written out independently of the model: as many moles of base as of acid. */
const equivalenceOf = (s: Setup) => (s.acidConcentration * s.acidVolume) / s.baseConcentration;

const relative = (actual: number, expected: number) => Math.abs(actual - expected) / expected;

const theory = (inputs: Inputs) => {
  const t = titrationModel.predict!(inputs);
  return { equivalence: t.equivalenceVolume ?? NaN, endpoint: t.endpointVolume ?? NaN };
};

/**
 * The pH from the charge balance alone, independent of the model's algebra (no excess D, no
 * quadratic, no branch): [H⁺] + [Na⁺] − [Cl⁻] − Kw/[H⁺] = 0, bisected on L = log₁₀[H⁺]. It shares
 * only the chemistry with the model: full dissociation, volumes that add, ideal activities, Kw.
 */
function chargeBalance(inputs: Inputs, volume: number) {
  const total = inputs.acidVolume + volume;
  const sodium = (inputs.baseConcentration * volume) / total;
  const chloride = (inputs.acidConcentration * inputs.acidVolume) / total;
  const balance = (l: number) => {
    const h = 10 ** l;
    return h + sodium - chloride - inputs.kw / h;
  };
  // [H⁺] and [OH⁻] are each at most |[Cl⁻] − [Na⁺]| + √Kw, so [H⁺] lies within [Kw/top, top].
  const top = sodium + chloride + Math.sqrt(inputs.kw);
  let low = Math.log10(inputs.kw / top) - 1;
  let high = Math.log10(top) + 1;
  if (!(balance(low) < 0 && balance(high) > 0)) throw new Error('The root is not bracketed');
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    if (balance(mid) > 0) high = mid;
    else low = mid;
  }
  const hydrogen = 10 ** ((low + high) / 2);
  return { pH: -(low + high) / 2, hydrogen, hydroxide: inputs.kw / hydrogen, chloride };
}

/** The volume at which the charge balance reaches `pH`, by bisection: no closed form either. */
function chargeBalanceVolume(inputs: Inputs, pH: number): number {
  let low = 0;
  let high = inputs.acidVolume;
  for (let i = 0; chargeBalance(inputs, high).pH < pH; i++) {
    if (i > 2000) throw new Error(`pH ${pH} is never reached`);
    high *= 2;
  }
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    if (chargeBalance(inputs, mid).pH < pH) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/**
 * How far two correct double-precision pH values can differ at a volume. Both evaluate a balance
 * in which [Na⁺] and [Cl⁻] cancel, together off by at most about 4ε·[Cl⁻], and the balance moves
 * by ln 10·([H⁺] + [OH⁻]) per pH unit; 16ε leaves a 4× margin, and 1e-13 covers the last bit of
 * log₁₀ where the first term vanishes. Near equivalence it is the problem's conditioning, not error.
 */
const tolerance = (o: ReturnType<typeof chargeBalance>) =>
  (16 * EPS * o.chloride) / (Math.LN10 * (o.hydrogen + o.hydroxide)) + 1e-13;

/** 0 to 2·Veq in 4,000 steps, 1,000 steps of 1e-9·Veq either side of Veq, and 10, 100, 1000·Veq. */
function volumes(equivalence: number): number[] {
  const all = new Set<number>();
  for (let i = 0; i <= 4000; i++) all.add((i * 2 * equivalence) / 4000);
  for (let i = -1000; i <= 1000; i++) all.add(equivalence * (1 + i * 1e-9));
  for (const m of [10, 100, 1000]) all.add(m * equivalence);
  return [...all].sort((a, b) => a - b);
}

const SIMULATION = { timeStep: 0.01, maxDuration: 600, sampleInterval: 0.1 };

/**
 * A test-only definition: its ranges are wider than the model's, so what the model refuses is
 * refused by the model; Kw is a fixed input, as content will have it.
 */
const definition = (simulation = SIMULATION): ExperimentDefinition =>
  ExperimentDefinitionSchema.parse({
    id: 'titration-test',
    name: 'Titration (test)',
    category: 'chemistry',
    model: titrationModel.id,
    parameters: [
      { id: 'acidConcentration', label: 'Acid', unit: 'mol/L', default: 0.1, min: 0, max: 1000 },
      { id: 'acidVolume', label: 'Sample', unit: 'mL', default: 25, min: 0, max: 1e7 },
      { id: 'baseConcentration', label: 'Base', unit: 'mol/L', default: 0.1, min: 0, max: 1000 },
      { id: 'flowRate', label: 'Flow', unit: 'mL/s', default: 0.1, min: 0, max: 1e7 },
      { id: 'endpointPH', label: 'Endpoint', unit: '', default: 8.2, min: 0, max: 14 },
    ],
    initialConditions: { kw: KW },
    simulation,
    measurements: [
      { id: 'volume', label: 'Base added', unit: 'mL', variable: 'volume' },
      { id: 'pH', label: 'pH', unit: '', variable: 'pH' },
    ],
    results: [
      {
        id: 'volume',
        label: 'Base added',
        unit: 'mL',
        variable: 'volume',
        reduce: 'final',
        theory: 'endpointVolume',
      },
      { id: 'pH', label: 'pH', unit: '', variable: 'pH', reduce: 'final' },
      {
        id: 'inferred',
        label: 'Acid from the burette',
        unit: 'mol/L',
        variable: 'inferredAcidConcentration',
        reduce: 'final',
      },
      { id: 'time', label: 'Time', unit: 's', variable: 'time', reduce: 'final' },
    ],
  });

/** A whole run through the real runtime. */
function run(inputs: Inputs, simulation = SIMULATION) {
  const r = new ExperimentRuntime('test', definition(simulation), titrationModel, inputs);
  r.runToCompletion();
  return r;
}
const sampled = (r: ExperimentRuntime, id: 'volume' | 'pH') =>
  r.sampleValues[r.definition.measurements.findIndex((m) => m.id === id)]!;

/** init, predict and the runtime refuse `inputs`, naming `subject`; init writes nothing. */
function expectRefused(inputs: Readonly<Record<string, number>>, subject: string) {
  const state = new Float64Array([-1, -1, -1]);
  expect(() => titrationModel.init(inputs, state)).toThrow(subject);
  expect(Array.from(state)).toEqual([-1, -1, -1]);
  expect(() => titrationModel.predict!(inputs)).toThrow(subject);
}

describe('titration theory', () => {
  it('matches the textbook table for 25.00 mL of 0.100 M HCl and 0.100 M NaOH', () => {
    const inputs = inputsOf(SETUPS.standard);
    for (const [volume, pH] of [
      [0, 1.0],
      [12.5, 1.48],
      [24.9, 3.7],
      [24.99, 4.7],
      [25, 7.0],
      [25.01, 9.3],
      [25.1, 10.3],
      [30, 11.96],
    ] as const) {
      expect(titrationPH(inputs, volume)).toBeCloseTo(pH, 2);
    }
    expect(relative(theory(inputs).equivalence, 25)).toBeLessThanOrEqual(2 * EPS);
  });

  it('matches it for a second setup: 20.00 mL of 0.150 M acid, 0.100 M base', () => {
    const inputs = inputsOf(SETUPS.second);
    for (const [volume, pH] of [
      [0, 0.82],
      [15, 1.37],
      [29.9, 3.7],
      [30, 7.0],
      [30.1, 10.3],
      [40, 12.22],
    ] as const) {
      expect(titrationPH(inputs, volume)).toBeCloseTo(pH, 2);
    }
    expect(relative(theory(inputs).equivalence, 30)).toBeLessThanOrEqual(2 * EPS);
  });

  it('dilute (0.001 M): the endpoint comes 0.079 mL late, the result 0.32 % high', () => {
    const inputs = inputsOf(SETUPS.dilute);
    const { equivalence, endpoint } = theory(inputs);
    expect(titrationPH(inputs, 0)).toBeCloseTo(3, 2);
    expect(titrationPH(inputs, equivalence)).toBeCloseTo(7, 2);
    const oracle = chargeBalanceVolume(inputs, 8.2);
    expect(relative(endpoint, oracle)).toBeLessThanOrEqual(1e-13);
    expect(endpoint - equivalence).toBeCloseTo(0.07905, 5);
    const inferred = run(inputs).results!.inferred!;
    expect(relative(inferred, (1e-3 * oracle) / 25)).toBeLessThanOrEqual(1e-13);
    expect(inferred / 1e-3 - 1).toBeCloseTo(0.00316, 5);
  });

  it('keeps equivalence and endpoint apart: they meet only at the neutral pH', () => {
    const at = (endpointPH: number) => inputsOf(SETUPS.standard, { endpointPH });
    const phenolphthalein = theory(at(8.2));
    expect(relative(phenolphthalein.endpoint, chargeBalanceVolume(at(8.2), 8.2))).toBeLessThan(
      1e-13,
    );
    expect(phenolphthalein.endpoint - phenolphthalein.equivalence).toBeCloseTo(7.893e-4, 7);
    const methylRed = theory(at(5));
    expect(relative(methylRed.endpoint, chargeBalanceVolume(at(5), 5))).toBeLessThan(1e-13);
    expect(methylRed.endpoint - methylRed.equivalence).toBeCloseTo(-5e-3, 5);
    const neutral = theory(at(7));
    expect(relative(neutral.endpoint, neutral.equivalence)).toBeLessThanOrEqual(2 * EPS);
    const atEquivalence = chargeBalance(at(8.2), phenolphthalein.equivalence);
    expect(Math.abs(atEquivalence.pH - 7)).toBeLessThanOrEqual(tolerance(atEquivalence));
  });
});

describe('titration numerics', () => {
  it('scales with the sample: 1 µL and 1 m³ titrate like 25 mL', () => {
    const reference = theory(inputsOf(SETUPS.standard));
    for (const setup of [SETUPS.smallSample, SETUPS.largeSample]) {
      const inputs = inputsOf(setup);
      const { equivalence, endpoint } = theory(inputs);
      const perMillilitre = (v: number) => v / setup.acidVolume;
      expect(relative(perMillilitre(equivalence), reference.equivalence / 25)).toBeLessThan(
        4 * EPS,
      );
      expect(relative(perMillilitre(endpoint), reference.endpoint / 25)).toBeLessThan(4 * EPS);
      const r = run(inputs);
      expect(r.endReason).toBe('model');
      expect(r.results?.volume).toBe(endpoint);
    }
  });

  it('agrees with the charge balance from the start, through equivalence, far beyond', () => {
    for (const [name, setup] of Object.entries(SETUPS)) {
      const inputs = inputsOf(setup);
      let worst = 0;
      let at = NaN;
      for (const volume of volumes(equivalenceOf(setup))) {
        const oracle = chargeBalance(inputs, volume);
        const ratio = Math.abs(titrationPH(inputs, volume) - oracle.pH) / tolerance(oracle);
        if (ratio > worst) [worst, at] = [ratio, volume];
      }
      expect(worst, `${name}, worst at ${at} mL`).toBeLessThanOrEqual(1);
    }
  });

  it('rises strictly as base is added', () => {
    for (const [name, setup] of Object.entries(SETUPS)) {
      const inputs = inputsOf(setup);
      let falls = 0;
      let previous = -Infinity;
      for (const volume of volumes(equivalenceOf(setup))) {
        const pH = titrationPH(inputs, volume);
        if (!(pH > previous)) falls++;
        previous = pH;
      }
      const r = run(inputs);
      const pHs = sampled(r, 'pH');
      for (let i = 1; i < r.sampleCount; i++) if (!(pHs[i]! > pHs[i - 1]!)) falls++;
      expect(falls, name).toBe(0);
    }
  });

  it('stays exact far beyond equivalence, where (D + s)/2 alone would lose its digits', () => {
    for (const setup of [SETUPS.standard, SETUPS.ceiling]) {
      const inputs = inputsOf(setup);
      const limit = 14 + Math.log10(setup.baseConcentration); // −log₁₀(Kw/Cb)
      let previous = -Infinity;
      for (const m of [10, 100, 1000]) {
        const volume = m * equivalenceOf(setup);
        const pH = titrationPH(inputs, volume);
        const oracle = chargeBalance(inputs, volume);
        expect(Number.isFinite(pH)).toBe(true);
        expect(pH).toBeGreaterThan(previous);
        expect(pH).toBeLessThan(limit);
        expect(Math.abs(pH - oracle.pH)).toBeLessThanOrEqual(tolerance(oracle));
        previous = pH;
      }
    }
  });
});

describe('titration runs', () => {
  it('stops at the endpoint pH, for every indicator and setup', () => {
    for (const setup of Object.values(SETUPS)) {
      for (const endpointPH of [4, 5, 7, 8.2, 9, 10]) {
        const inputs = inputsOf(setup, { endpointPH });
        const end = theory(inputs).endpoint;
        const r = run(inputs);
        expect(r.endReason).toBe('model');
        expect(r.results?.volume).toBe(end);
        expect(r.results?.pH).toBe(titrationPH(inputs, end));
        const off = Math.abs(r.results!.pH! - endpointPH);
        expect(off).toBeLessThanOrEqual(tolerance(chargeBalance(inputs, end)));
      }
    }
  });

  it('ends on the endpoint inside a step, adding only the time that took, at any step', () => {
    const inputs = inputsOf(SETUPS.standard);
    const end = theory(inputs).endpoint;
    const state = new Float64Array(titrationModel.variables.length);
    titrationModel.init(inputs, state);
    state[VOLUME] = end - (inputs.flowRate * 0.01) / 2;
    expect(titrationModel.step(state, 0.01, inputs)).toBeCloseTo(0.005, 12);
    expect(state[VOLUME]).toBe(end);
    expect(titrationModel.isComplete!(state, inputs)).toBe(true);

    const ends = [0.001, 0.01, 1 / 60, 0.37, 1].map((timeStep) => {
      const r = run(inputs, { timeStep, maxDuration: 600, sampleInterval: 0.1 });
      expect(r.endReason).toBe('model');
      const steps = Math.ceil(r.time / timeStep);
      expect(Math.abs(r.time - end / inputs.flowRate)).toBeLessThan((steps + 2) * EPS * r.time);
      const last = r.sampleCount - 1;
      expect(r.sampleTimes[last]).toBe(r.time);
      expect(sampled(r, 'volume')[last]).toBe(end);
      return { volume: r.results?.volume, pH: r.results?.pH, inferred: r.results?.inferred };
    });
    for (const e of ends) expect(e).toEqual(ends[0]);
  });

  it('ends exactly on a step boundary without an extra step, and never fails near one', () => {
    // 0.25 mL a step, exactly, to an endpoint of exactly 25 mL.
    const exact: Inputs = {
      acidConcentration: 0.5,
      acidVolume: 25,
      baseConcentration: 0.5,
      kw: KW,
      flowRate: 0.5,
      endpointPH: 7,
    };
    expect(theory(exact).endpoint).toBe(25);
    const r = run(exact, { timeStep: 0.5, maxDuration: 600, sampleInterval: 0.5 });
    expect(r.endReason).toBe('model');
    expect(r.time).toBe(50);
    expect(r.results?.volume).toBe(25);
    expect(r.sampleCount).toBe(101);
    expect(Array.from(r.sampleTimes.subarray(0, 101))).toEqual(
      Array.from({ length: 101 }, (_, i) => i * 0.5),
    );

    // Meant to land on a boundary: rounding may leave one more step, of ~1e-17 s.
    const inputs = inputsOf(SETUPS.standard);
    const end = theory(inputs).endpoint;
    for (const n of [7, 1000, 25000]) {
      const flowRate = end / (n * 0.01);
      const near = run({ ...inputs, flowRate }, { ...SIMULATION, maxDuration: 1000 });
      expect(near.status).toBe('completed');
      expect(near.endReason).toBe('model');
      expect(near.results?.volume).toBe(end);
      expect(Math.abs(near.time - n * 0.01)).toBeLessThan((n + 3) * EPS * near.time);
    }
  });

  it('adds nothing once the endpoint is reached, however often it is asked', () => {
    const inputs = inputsOf(SETUPS.standard);
    const end = theory(inputs).endpoint;
    for (const volume of [end, end + 1]) {
      const state = new Float64Array(titrationModel.variables.length);
      state[VOLUME] = volume;
      state[PH] = titrationPH(inputs, volume);
      const before = Array.from(state);
      for (let i = 0; i < 3; i++) expect(titrationModel.step(state, 0.01, inputs)).toBe(0);
      expect(Array.from(state)).toEqual(before);
    }
    const r = run(inputs);
    const snapshot = () => ({
      status: r.status,
      endReason: r.endReason,
      time: r.time,
      samples: r.sampleCount,
      results: r.results,
    });
    const ended = snapshot();
    r.advance(1);
    r.runToCompletion();
    expect(r.start()).toBe(false);
    r.advance(1);
    expect(snapshot()).toEqual(ended);
  });

  it('with no flow adds nothing, and the time limit ends a run cleanly', () => {
    const closed = inputsOf(SETUPS.standard, { flowRate: 0 });
    const start = titrationPH(closed, 0);
    const r = run(closed, { timeStep: 0.01, maxDuration: 5, sampleInterval: 0.1 });
    expect(r.status).toBe('completed');
    expect(r.endReason).toBe('time-limit');
    expect(Math.abs(r.time - 5)).toBeLessThanOrEqual(1e-9);
    expect(r.results).toMatchObject({ volume: 0, pH: start, inferred: 0 });
    expect(r.sampleCount).toBe(51);
    for (let i = 0; i < r.sampleCount; i++) {
      expect(sampled(r, 'volume')[i]).toBe(0);
      expect(sampled(r, 'pH')[i]).toBe(start);
    }

    const inputs = inputsOf(SETUPS.standard);
    const short = run(inputs, { timeStep: 0.01, maxDuration: 100, sampleInterval: 1 });
    expect(short.status).toBe('completed');
    expect(short.endReason).toBe('time-limit');
    const volume = short.results!.volume!;
    expect(volume).toBeLessThan(theory(inputs).endpoint);
    expect(Math.abs(volume - 10)).toBeLessThan(10_002 * EPS * 10);
    expect(short.results?.pH).toBe(titrationPH(inputs, volume));
  });
});

describe('titration inputs', () => {
  it('refuses every input outside its domain, by name, and accepts every limit', () => {
    const base = inputsOf(SETUPS.standard);
    // Just past each limit: the next doubles or so.
    const outside: Record<keyof Inputs, number[]> = {
      acidConcentration: [0, -0.1, 100 * (1 + EPS)],
      acidVolume: [0, -1, 1e6 * (1 + EPS)],
      baseConcentration: [0, -0.1, 100 * (1 + EPS)],
      kw: [0, 1e-16 * (1 - EPS), 1e-12 * (1 + EPS)],
      flowRate: [-Number.MIN_VALUE, -1],
      endpointPH: [4 * (1 - EPS), 10 * (1 + EPS)],
    };
    for (const [id, values] of Object.entries(outside)) {
      for (const value of [NaN, Infinity, -Infinity, ...values]) {
        expectRefused({ ...base, [id]: value }, `"${id}"`);
      }
      expectRefused(Object.fromEntries(Object.entries(base).filter(([k]) => k !== id)), `"${id}"`);
    }
    // Starts at pH 5.00, above the endpoint; excess base tends to pH 9.70, below it.
    expectRefused({ ...base, acidConcentration: 1e-5, endpointPH: 4 }, 'endpoint pH 4');
    expectRefused({ ...base, baseConcentration: 5e-5, endpointPH: 10 }, 'endpoint pH 10');

    // Values the definition allows reach the model, which refuses them as the run is made.
    for (const [change, subject] of [
      [{ acidConcentration: 0 }, '"acidConcentration"'],
      [{ kw: 0 }, '"kw"'],
      [{ kw: 1e-11 }, '"kw"'],
      [{ acidConcentration: 1e-5, endpointPH: 4 }, 'endpoint pH 4'],
    ] as const) {
      const inputs = { ...base, ...change };
      expect(() => new ExperimentRuntime('test', definition(), titrationModel, inputs)).toThrow(
        subject,
      );
    }

    for (const change of [
      { acidConcentration: 100 },
      { acidVolume: 1e6 },
      { baseConcentration: 100 },
      { kw: 1e-16 },
      { kw: 1e-12 },
      { flowRate: 0 },
      { endpointPH: 4 },
      { endpointPH: 10 },
    ]) {
      const inputs = { ...base, ...change };
      expect(() => titrationModel.init(inputs, new Float64Array(3))).not.toThrow();
      const { equivalence, endpoint } = theory(inputs);
      expect(Number.isFinite(equivalence) && Number.isFinite(endpoint)).toBe(true);
    }
  });

  it('predicts from the inputs it is given, and only from them', () => {
    const changed = inputsOf(SETUPS.standard, {
      acidConcentration: 0.2,
      acidVolume: 40,
      baseConcentration: 0.05,
      flowRate: 1,
      endpointPH: 9,
    });
    const r = new ExperimentRuntime('test', definition(), titrationModel, changed);
    const t = r.theory()!;
    expect(t).toEqual(titrationModel.predict!(changed));
    expect(relative(t.equivalenceVolume!, 160)).toBeLessThanOrEqual(2 * EPS);
    r.runToCompletion();
    expect(r.results?.volume).toBe(t.endpointVolume);

    const base = theory(inputsOf(SETUPS.standard));
    const later = theory(inputsOf(SETUPS.standard, { endpointPH: 9 }));
    expect(later.equivalence).toBe(base.equivalence);
    expect(later.endpoint).toBeGreaterThan(base.endpoint);
    expect(theory(inputsOf(SETUPS.standard, { flowRate: 0.7 }))).toEqual(base);

    const frozen = Object.freeze(inputsOf(SETUPS.standard));
    expect(titrationModel.predict!(frozen)).toEqual(
      titrationModel.predict!(inputsOf(SETUPS.standard)),
    );
    expect(() => titrationModel.init(frozen, new Float64Array(3))).not.toThrow();
  });
});

describe('titration station theory', () => {
  /** The station: 0.085 mol/L HCl in the flask (fixed), what its dials allow, Kw at 25 °C. */
  const STATION = { acidConcentration: 0.085, kw: KW, flowRate: 0.25 };
  const DIALS = {
    acidVolume: [10, 15, 20, 25],
    baseConcentration: [0.05, 0.08, 0.1, 0.15, 0.2],
    endpointPH: [4.4, 6, 8.2],
  };
  const stationInputs = (acidVolume: number, baseConcentration: number, endpointPH: number) => ({
    ...STATION,
    acidVolume,
    baseConcentration,
    endpointPH,
  });

  it('predicts for every setting its dials allow, within one 50 mL burette', () => {
    // The endpoint is reached when start pH < endpointPH < the pH excess base tends to: the start,
    // −log₁₀ 0.085 = 1.07, depends only on the fixed acid, the limit only on Cb (≥ 12.7 for
    // Cb ≥ 0.05), and every endpoint is within 4.4 … 8.2: so the whole box, not just this grid.
    for (const va of DIALS.acidVolume) {
      for (const cb of DIALS.baseConcentration) {
        for (const pH of DIALS.endpointPH) {
          const inputs = stationInputs(va, cb, pH);
          const t = titrationModel.predict!(inputs);
          expect(t.endpointVolume, `${va} mL, ${cb} mol/L, pH ${pH}`).toBeGreaterThan(0);
          expect(t.endpointVolume).toBeLessThan(50);
          expect(relative(t.endpointVolume!, chargeBalanceVolume(inputs, pH))).toBeLessThan(1e-12);
        }
      }
    }
  });

  it('gives the pH at equivalence as pKw/2, which is the charge balance at Ca·Va/Cb', () => {
    for (const kw of [1e-16, 1e-14, 1e-12]) {
      const inputs = inputsOf(SETUPS.standard, { kw });
      const t = titrationModel.predict!(inputs);
      expect(Math.abs(t.equivalencePH! - -Math.log10(kw) / 2)).toBeLessThan(1e-14);
      const oracle = chargeBalance(inputs, equivalenceOf(SETUPS.standard));
      expect(Math.abs(t.equivalencePH! - oracle.pH)).toBeLessThanOrEqual(tolerance(oracle));
    }
    expect(titrationModel.predict!(inputsOf(SETUPS.standard)).equivalencePH).toBeCloseTo(7, 12);
  });

  it('reads Ca from the burette, off by exactly the indicator error (Vend − Veq)/Veq', () => {
    // Methyl orange (yellow from pH 4.4) comes before equivalence, phenolphthalein (pink from 8.2)
    // after it; for 25 mL of 0.085 mol/L acid and 0.1 mol/L base, Veq = 21.25 mL.
    for (const [pH, low, high] of [
      [4.4, -0.0185, -0.0183],
      [8.2, 7.2e-4, 7.4e-4],
    ] as const) {
      const inputs = stationInputs(25, 0.1, pH);
      const t = titrationModel.predict!(inputs);
      expect(t.acidConcentration).toBe(0.085);
      expect(relative(t.equivalenceVolume!, 21.25)).toBeLessThanOrEqual(2 * EPS);
      const r = run(inputs);
      expect(r.endReason).toBe('model');
      const end = r.results!.volume!;
      expect(end - 21.25).toBeGreaterThan(low);
      expect(end - 21.25).toBeLessThan(high);
      // Against the bisected charge balance, not the model's own volume.
      const oracle = chargeBalanceVolume(inputs, pH);
      expect(relative(end, oracle)).toBeLessThanOrEqual(1e-12);
      const inferred = r.results!.inferred!;
      expect(relative(inferred, (0.1 * oracle) / 25)).toBeLessThanOrEqual(1e-12);
      const error = inferred / 0.085 - 1;
      expect(Math.abs(error - (oracle - 21.25) / 21.25)).toBeLessThan(1e-11);
    }
  });
});

describe('titration driven by the base run in from the burette (physical lab)', () => {
  const driven = titrationModel.driven!;
  const inputs = inputsOf(SETUPS.standard);
  const state = new Float64Array(titrationModel.variables.length);

  it('is the stepped closed form at any volume, and never ends by itself', () => {
    expect(driven.variable).toBe('volume');
    for (const v of [0, 5, 24.99, equivalenceOf(SETUPS.standard), 25.5, 40]) {
      expect(driven.set(state, inputs, v)).toBe(false);
      expect(state[VOLUME]).toBe(v);
      expect(state[PH]).toBe(titrationPH(inputs, v));
    }
  });

  it('goes past the endpoint where the player overshoots: a larger reading, a higher pH', () => {
    const end = titrationModel.predict!(inputs).endpointVolume!;
    driven.set(state, inputs, end);
    const atEnd = state[PH]!;
    driven.set(state, inputs, end + 0.5);
    expect(state[PH]).toBeGreaterThan(atEnd + 1); // the steep part: half a mL past it
    const inferred = titrationModel.variables.indexOf('inferredAcidConcentration');
    expect(state[inferred]).toBeCloseTo((0.1 * (end + 0.5)) / 25, 12); // the reading's c_a
  });

  it('refuses a volume it does not cover', () => {
    for (const v of [-0.01, NaN, Infinity]) expect(() => driven.set(state, inputs, v)).toThrow();
  });
});
