import { describe, expect, it } from 'vitest';
import { ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { COLOURS, foodTestsModel, SAMPLES, TESTS } from './foodTests';

const slot = (variable: string) => foodTestsModel.variables.indexOf(variable);
const T = 120;
const LAPSE = 12;

const inputsOf = (change: Record<string, number> = {}) => ({
  sample: 0,
  test: TESTS.iodine,
  heated: 1,
  developTime: T,
  timeLapse: LAPSE,
  ...change,
});

/** The model alone, stepped by `dt` until it stops; `each` sees the state after each step. */
function develop(inputs: Record<string, number>, dt: number, each?: (s: Float64Array) => void) {
  const state = new Float64Array(foodTestsModel.variables.length);
  foodTestsModel.init(inputs, state);
  let runTime = 0;
  for (let i = 0; i < 1e7 && !foodTestsModel.isComplete!(state, inputs); i++) {
    runTime += foodTestsModel.step(state, dt, inputs);
    each?.(state);
  }
  return { state, runTime };
}

describe('food tests: the textbook’s table', () => {
  // What each test shows on each pure substance, written out from the textbook rules (independent
  // of the model's own): iodine, Benedict's heated, Benedict's cold, biuret, Sudan III.
  const { none, blueBlack, brickRed, violet, redLayer } = COLOURS;
  const table: Record<string, [number, number, number, number, number]> = {
    starch: [blueBlack, none, none, none, none],
    glucose: [none, brickRed, none, none, none],
    sucrose: [none, none, none, none, none], // not a reducing sugar
    protein: [none, none, none, violet, none],
    lipid: [none, none, none, none, redLayer],
    none: [none, none, none, none, none], // the control
  };

  it('gives every sample, test and bath the colour of the table', () => {
    SAMPLES.forEach((substance, sample) => {
      const [iodine, hot, cold, biuret, sudan] = table[substance]!;
      const colour = (test: number, heated: number) =>
        foodTestsModel.predict!(inputsOf({ sample, test, heated })).colour;
      expect(colour(TESTS.iodine, 1)).toBe(iodine);
      expect(colour(TESTS.iodine, 0)).toBe(iodine);
      expect(colour(TESTS.benedict, 1)).toBe(hot);
      expect(colour(TESTS.benedict, 0)).toBe(cold);
      expect(colour(TESTS.biuret, 0)).toBe(biuret);
      expect(colour(TESTS.sudan, 0)).toBe(sudan);
    });
  });

  it('holds six different substances, one of them the water control, each found by one test alone', () => {
    expect(new Set(SAMPLES).size).toBe(6);
    const positives = SAMPLES.map((_, sample) =>
      [TESTS.iodine, TESTS.benedict, TESTS.biuret, TESTS.sudan].filter(
        (test) => foodTestsModel.predict!(inputsOf({ sample, test })).positive === 1,
      ),
    );
    expect(positives.map((p) => p.length).sort()).toEqual([0, 0, 1, 1, 1, 1]); // water, sucrose
  });
});

describe('food tests run: the colour develops, then the run ends', () => {
  it('develops linearly from the reagent’s colour to the outcome, the outcome fixed from the start', () => {
    const inputs = inputsOf({ sample: SAMPLES.indexOf('glucose'), test: TESTS.benedict });
    const state = new Float64Array(foodTestsModel.variables.length);
    foodTestsModel.init(inputs, state);
    expect([state[slot('development')], state[slot('colour')], state[slot('positive')]]).toEqual([
      0,
      COLOURS.brickRed,
      1,
    ]);
    develop(inputs, 0.02, (s) => {
      expect(s[slot('development')]).toBeCloseTo(s[slot('elapsed')]! / T, 12);
      expect(Array.from(s).every(Number.isFinite)).toBe(true);
    });
  });

  it('ends fully developed at the same time whatever the step', () => {
    for (const dt of [0.001, 0.02, 0.3, 7, 50]) {
      const { state, runTime } = develop(inputsOf(), dt);
      expect(state[slot('development')]).toBe(1);
      expect(runTime).toBeCloseTo(T / LAPSE, 9);
    }
    const { state } = develop(inputsOf(), 0.02);
    expect(foodTestsModel.step(state, 0.02, inputsOf())).toBe(0);
  });
});

describe('food tests inputs: refused with a reason, never clamped', () => {
  it('refuses missing, unknown and non-finite inputs', () => {
    const state = new Float64Array(foodTestsModel.variables.length);
    const missing: Record<string, number> = inputsOf();
    delete missing.test;
    expect(() => foodTestsModel.init(missing, state)).toThrow(/"test" is missing/);
    for (const sample of [-1, 6, 1.5, NaN]) {
      expect(() => foodTestsModel.predict!(inputsOf({ sample }))).toThrow(/"sample"/);
    }
    expect(() => foodTestsModel.predict!(inputsOf({ test: 4 }))).toThrow(/"test"/);
    expect(() => foodTestsModel.predict!(inputsOf({ heated: 0.5 }))).toThrow(/"heated"/);
    expect(() => foodTestsModel.init(inputsOf({ developTime: 0 }), state)).toThrow(/developTime/);
  });
});

describe('food tests in the experiment runtime', () => {
  const definition = ExperimentDefinitionSchema.parse({
    id: 'food-tests-test',
    name: 'Food tests',
    category: 'biology',
    model: 'biology.food-tests',
    parameters: [
      { id: 'sample', label: 'S', unit: '', default: 0, min: 0, max: 5 },
      { id: 'test', label: 'T', unit: '', default: 0, min: 0, max: 3 },
      { id: 'heated', label: 'H', unit: '', default: 1, min: 0, max: 1 },
    ],
    initialConditions: { developTime: T, timeLapse: LAPSE },
    simulation: { timeStep: 0.02, maxDuration: 12, sampleInterval: 0.1 },
    measurements: [{ id: 'd', label: 'd', unit: '', variable: 'development' }],
    results: [
      { id: 'c', label: 'c', unit: '', variable: 'colour', reduce: 'final', theory: 'colour' },
    ],
  });

  it('ends by itself, its colour its theory, for every sample and test', () => {
    for (let sample = 0; sample < 6; sample++) {
      for (let test = 0; test < 4; test++) {
        const r = new ExperimentRuntime('t', definition, foodTestsModel, { sample, test });
        r.runToCompletion();
        expect([r.status, r.endReason]).toEqual(['completed', 'model']);
        expect(r.results!.c).toBe(r.theory()!.colour);
      }
    }
  });
});
