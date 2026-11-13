import { describe, expect, it } from 'vitest';
import { ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { seedRespirationModel } from './seedRespiration';

const TIME = seedRespirationModel.variables.indexOf('labTime');
const GAS = seedRespirationModel.variables.indexOf('gasTakenUp');
const RATE = seedRespirationModel.variables.indexOf('uptakeRate');

const DURATION = 600;
const LAPSE = 60;
const [PEAS, SUNFLOWER, BOILED] = [0, 1, 2];
const [WATER, KOH] = [0, 1];

const inputsOf = (change: Record<string, number> = {}) => ({
  seeds: PEAS,
  absorber: KOH,
  temperature: 20,
  seedMass: 10,
  pipetteVolume: 1,
  duration: DURATION,
  timeLapse: LAPSE,
  ...change,
});

const predict = (change: Record<string, number> = {}) =>
  seedRespirationModel.predict!(inputsOf(change));

/** The model alone, stepped by `dt` run seconds until it stops; `each` sees the state. */
function time(inputs: Record<string, number>, dt: number, each?: (s: Float64Array) => void) {
  const state = new Float64Array(seedRespirationModel.variables.length);
  seedRespirationModel.init(inputs, state);
  let runTime = 0;
  let last = dt;
  for (let i = 0; i < 1e7 && !seedRespirationModel.isComplete!(state, inputs); i++) {
    last = seedRespirationModel.step(state, dt, inputs);
    runTime += last;
    each?.(state);
  }
  return { state, runTime, last };
}

describe('seed respiration theory: worked by hand', () => {
  it('gives 10 g of germinating peas at 20 °C over KOH 2.5 mL of O₂ an hour: 0.4167 mL in 10 min', () => {
    const t = predict();
    expect(t.oxygenRate).toBeCloseTo(2.5, 12); // 10 g × 0.25 mL/(g·h)
    expect(t.carbonDioxideRate).toBeCloseTo(2.5, 12); // RQ 1
    expect(t.gasTakenUp).toBeCloseTo(2.5 / 6, 12);
    expect(t.uptakeRate).toBeCloseTo(0.25, 12);
  });

  it('doubles the rate for every 10 °C (Q₁₀ = 2): ×√2 at 25 °C, ×2 at 30 °C, ×½ at 10 °C', () => {
    const v20 = predict().gasTakenUp!;
    expect(predict({ temperature: 25 }).gasTakenUp! / v20).toBeCloseTo(Math.SQRT2, 12);
    expect(predict({ temperature: 30 }).gasTakenUp! / v20).toBeCloseTo(2, 12);
    expect(predict({ temperature: 10 }).gasTakenUp! / v20).toBeCloseTo(0.5, 12);
    expect(predict({ temperature: 30 }).gasTakenUp).toBeCloseTo(5 / 6, 12);
  });

  it('keeps the drop still over water for starch (RQ 1) and moves it 30 % as far for oil (RQ 0.7)', () => {
    expect(predict({ absorber: WATER }).gasTakenUp).toBe(0);
    const koh = predict({ seeds: SUNFLOWER }).gasTakenUp!;
    const water = predict({ seeds: SUNFLOWER, absorber: WATER }).gasTakenUp!;
    expect(water).toBeCloseTo(0.125, 12); // 0.4167 mL × (1 − 0.7)
    // The two runs give the RQ back: 1 − V_water/V_KOH.
    expect(1 - water / koh).toBeCloseTo(0.7, 12);
    expect(predict({ seeds: SUNFLOWER }).carbonDioxideRate).toBeCloseTo(1.75, 12);
  });

  it('gives the boiled seeds (the control) nothing, with or without the absorber', () => {
    for (const absorber of [WATER, KOH]) {
      for (const temperature of [5, 20, 35]) {
        const t = predict({ seeds: BOILED, absorber, temperature });
        expect([t.gasTakenUp, t.uptakeRate, t.oxygenRate, t.carbonDioxideRate]).toEqual([
          0, 0, 0, 0,
        ]);
      }
    }
  });

  it('scales V with the seeds’ mass and the time, the rate per gram with neither', () => {
    const base = predict();
    const big = predict({ seedMass: 20, duration: 300 });
    expect(big.gasTakenUp).toBeCloseTo(base.gasTakenUp!, 12);
    expect(big.uptakeRate).toBeCloseTo(base.uptakeRate!, 12);
    expect(predict({ seedMass: 5 }).gasTakenUp! / base.gasTakenUp!).toBeCloseTo(0.5, 12);
  });
});

describe('seed respiration run: the drop timed, then stopped at the end of the measuring time', () => {
  it('moves the drop at a steady speed: V ∝ t, and the rate from the drop equals the theory', () => {
    const inputs = inputsOf({ seeds: SUNFLOWER, temperature: 25 });
    const theory = seedRespirationModel.predict!(inputs);
    let checked = 0;
    time(inputs, 0.02, (s) => {
      expect(s[GAS]!).toBeCloseTo((theory.gasTakenUp! * s[TIME]!) / DURATION, 12);
      expect(Math.abs(s[RATE]! / theory.uptakeRate! - 1)).toBeLessThan(1e-12);
      checked++;
    });
    // 10 run seconds in 0.02 s steps, plus at most one sliver the sums of 1.2 s leave.
    expect(checked === 500 || checked === 501).toBe(true);
  });

  it('starts with the drop at the zero mark and no rate', () => {
    const state = new Float64Array(seedRespirationModel.variables.length);
    seedRespirationModel.init(inputsOf(), state);
    expect(Array.from(state)).toEqual([0, 0, 0]);
  });

  it('ends exactly at the measuring time, whatever the step, with the theory’s result', () => {
    const inputs = inputsOf({ temperature: 30 });
    const theory = seedRespirationModel.predict!(inputs);
    for (const dt of [0.001, 0.02, 0.07, 0.3, 7, 100]) {
      const { state, runTime, last } = time(inputs, dt);
      expect(state[TIME]).toBe(DURATION);
      expect(runTime).toBeCloseTo(DURATION / LAPSE, 9); // 10 run seconds
      expect(last).toBeLessThanOrEqual(dt);
      expect(state[GAS]!).toBeCloseTo(theory.gasTakenUp!, 12);
    }
    const { state } = time(inputs, 0.02);
    expect(seedRespirationModel.step(state, 0.02, inputs)).toBe(0); // nothing after the timing
  });

  it('keeps every value finite, the boiled seeds’ drop at zero', () => {
    const { state } = time(inputsOf({ seeds: BOILED }), 0.02, (s) =>
      expect(Array.from(s).every(Number.isFinite)).toBe(true),
    );
    expect([state[GAS], state[RATE]]).toEqual([0, 0]);
  });

  it('is deterministic: two runs give the same bits', () => {
    const a = time(inputsOf(), 0.02).state;
    const b = time(inputsOf(), 0.02).state;
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe('seed respiration inputs: refused with a reason, never clamped', () => {
  it('refuses missing, out-of-range and non-finite inputs', () => {
    const state = new Float64Array(seedRespirationModel.variables.length);
    const missing: Record<string, number> = inputsOf();
    delete missing.absorber;
    expect(() => seedRespirationModel.init(missing, state)).toThrow(/"absorber" is missing/);
    expect(() => predict({ seeds: 3 })).toThrow(/"seeds"/);
    expect(() => predict({ seeds: 0.5 })).toThrow(/"seeds"/);
    expect(() => predict({ absorber: 2 })).toThrow(/"absorber"/);
    expect(() => predict({ seedMass: 0 })).toThrow(/"seedMass"/);
    expect(() => seedRespirationModel.init(inputsOf({ temperature: NaN }), state)).toThrow(
      /temperature/,
    );
  });

  it('refuses a bath past 35 °C, where the enzymes denature, and below 5 °C', () => {
    expect(() => predict({ temperature: 36 })).toThrow(/denature/);
    expect(() => predict({ temperature: 4 })).toThrow(/from 5 to 35 °C/);
  });

  it('refuses a run whose drop would pass the end of the pipette', () => {
    // 35 °C: 10 g × 0.25 × 2^1.5 = 7.07 mL/h, 1.18 mL in 10 min, past a 1 mL pipette.
    expect(() => predict({ temperature: 35 })).toThrow(/1\.18 mL, past the end/);
    expect(predict({ temperature: 35, absorber: WATER, seeds: SUNFLOWER }).gasTakenUp).toBeCloseTo(
      0.3 * 1.1785113,
      6,
    );
  });
});

describe('seed respiration in the experiment runtime', () => {
  const definition = ExperimentDefinitionSchema.parse({
    id: 'seed-respiration-test',
    name: 'Seed respiration',
    category: 'biology',
    model: 'biology.seed-respiration',
    parameters: [
      { id: 'seeds', label: 'S', unit: '', default: 0, min: 0, max: 2 },
      { id: 'absorber', label: 'A', unit: '', default: 1, min: 0, max: 1 },
      { id: 'temperature', label: 'T', unit: '°C', default: 20, min: 15, max: 30 },
    ],
    initialConditions: { seedMass: 10, pipetteVolume: 1, duration: DURATION, timeLapse: LAPSE },
    simulation: { timeStep: 0.02, maxDuration: 15, sampleInterval: 0.1 },
    measurements: [{ id: 'gas', label: 'V', unit: 'mL', variable: 'gasTakenUp' }],
    results: [
      {
        id: 'v',
        label: 'V',
        unit: 'mL',
        variable: 'gasTakenUp',
        reduce: 'final',
        theory: 'gasTakenUp',
      },
    ],
  });

  it('ends by itself after 600/60 = 10 run seconds at every corner of the dials', () => {
    for (const seeds of [PEAS, SUNFLOWER, BOILED]) {
      for (const absorber of [WATER, KOH]) {
        for (const temperature of [15, 30]) {
          const r = new ExperimentRuntime('t', definition, seedRespirationModel, {
            seeds,
            absorber,
            temperature,
          });
          r.runToCompletion();
          expect([r.status, r.endReason]).toEqual(['completed', 'model']);
          expect(r.time).toBeCloseTo(DURATION / LAPSE, 9);
          expect(r.results!.v).toBeCloseTo(r.theory()!.gasTakenUp!, 12);
        }
      }
    }
  });
});
