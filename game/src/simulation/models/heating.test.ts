import { describe, expect, it } from 'vitest';
import { ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { BOILING, heatingModel, LIQUID, MELTING, SOLID } from './heating';

/** Water's constants, as the experiment sets them: J/(kg·K), J/kg and °C. */
const WATER = {
  iceHeatCapacity: 2100,
  fusionHeat: 334_000,
  waterHeatCapacity: 4180,
  vaporisationHeat: 2_257_000,
  meltingPoint: 0,
  boilingPoint: 100,
  boilOffFraction: 0.1,
};
type Inputs = typeof WATER & { power: number; mass: number; startTemperature: number };
const inputsOf = (change: Partial<Inputs> = {}): Inputs => ({
  power: 500,
  mass: 0.1,
  startTemperature: -10,
  ...WATER,
  ...change,
});

const slot = (id: string) => heatingModel.variables.indexOf(id);
const [T, ICE, WATER_MASS, VAPOUR, HEAT, STATE] = [
  'temperature',
  'iceFraction',
  'waterMass',
  'vapourMass',
  'heat',
  'state',
].map(slot) as [number, number, number, number, number, number];
const CLOCKS = ['iceWarmingTime', 'meltingTime', 'waterWarmingTime', 'boilingTime'].map(slot);

/** The model alone, stepped by `dt` until it is done; `each` sees the clock and the state. */
function heat(input: Inputs, dt: number, each?: (t: number, s: Float64Array) => void) {
  const state = new Float64Array(heatingModel.variables.length);
  heatingModel.init(input, state);
  let t = 0;
  each?.(t, state);
  while (!heatingModel.isComplete!(state, input)) {
    t += heatingModel.step(state, dt, input);
    each?.(t, state);
  }
  return { state, t };
}

/**
 * The heat in the beaker read back from its state alone, the other way round from the model:
 * what warmed the ice from T₀ to min(T, T_m), what melted the water there is, what warmed it
 * above T_m, and what turned the vapour into steam. Energy conservation: it must equal P·t.
 */
function heatHeld(s: Float64Array, i: Inputs): number {
  const t = s[T]!;
  const ice = i.mass * i.iceHeatCapacity * (Math.min(t, i.meltingPoint) - i.startTemperature);
  const melt = (1 - s[ICE]!) * i.mass * i.fusionHeat;
  const warm = s[ICE]! === 0 ? i.mass * i.waterHeatCapacity * (t - i.meltingPoint) : 0;
  return ice + melt + warm + s[VAPOUR]! * i.vaporisationHeat;
}

describe('heating theory: each stage lasts its heat over the power', () => {
  it('gives the stage times worked out by hand for 0.1 kg of ice at −10 °C and 500 W', () => {
    const theory = heatingModel.predict!(inputsOf());
    // Q₁ = 0.1·2100·10 = 2100 J; m·L_f = 33 400 J; 0.1·4180·100 = 41 800 J; 0.1·0.1·2 257 000 = 22 570 J.
    expect(theory.iceWarmingTime).toBeCloseTo(4.2, 12);
    expect(theory.meltingTime).toBeCloseTo(66.8, 12);
    expect(theory.waterWarmingTime).toBeCloseTo(83.6, 12);
    expect(theory.boilingTime).toBeCloseTo(45.14, 12);
    expect(theory.boilStartTime).toBeCloseTo(154.6, 12);
    expect(theory.totalTime).toBeCloseTo(199.74, 12);
    expect(theory.totalHeat).toBeCloseTo(99_870, 9);
    expect([theory.meltingPoint, theory.boilingPoint]).toEqual([0, 100]);
    expect(theory.vapourMass).toBeCloseTo(0.01, 15);
    expect(theory.waterMass).toBeCloseTo(0.09, 15);
    expect(theory.iceHeatingRate).toBeCloseTo(500 / 210, 12); // K/s: P/(m·c_ice)
    expect(theory.waterHeatingRate).toBeCloseTo(500 / 418, 12);
    expect(theory.meltingSlope).toBeCloseTo(668, 12); // s/kg: L_f/P
    expect(theory.warmingSlope).toBeCloseTo(836, 12); // s/kg: c_w·100 K/P
  });

  it('refuses inputs it cannot run, with the reason, in init and in predict alike', () => {
    const state = new Float64Array(heatingModel.variables.length);
    const missing: Record<string, number> = inputsOf();
    delete missing.fusionHeat;
    for (const [input, reason] of [
      [inputsOf({ power: 0 }), /"power" must be above 0/],
      [inputsOf({ mass: -0.1 }), /"mass" must be above 0/],
      [inputsOf({ mass: NaN }), /"mass"/],
      [inputsOf({ startTemperature: 5 }), /must start at or below its melting point/],
      [inputsOf({ startTemperature: -30.5 }), /"startTemperature" must be from −30/],
      [inputsOf({ boilingPoint: -10 }), /melting point 0 °C must be below boiling/],
      [inputsOf({ boilOffFraction: 1.5 }), /"boilOffFraction"/],
      [missing, /"fusionHeat" is missing/],
    ] as const) {
      expect(() => heatingModel.init(input, state)).toThrow(reason);
      expect(() => heatingModel.predict!(input)).toThrow(reason);
    }
  });
});

describe('heating run: the curve of ice on a hot plate', () => {
  it('holds the temperatures the stages give at the times worked out by hand', () => {
    const input = inputsOf();
    const seen = new Map<number, number[]>();
    // Times in the middle of each stage: 2.1 s, 4.2 + 33.4 s, 4.2 + 66.8 + 41.8 s, 154.6 + 22.57 s.
    const at = [2.1, 37.6, 112.8, 177.17];
    heat(input, 0.01, (t, s) => {
      for (const want of at) {
        if (Math.abs(t - want) < 5e-6) seen.set(want, [s[T]!, s[ICE]!, s[VAPOUR]!, s[STATE]!]);
      }
    });
    expect(seen.get(2.1)![0]).toBeCloseTo(-5, 9); // half-way from −10 °C to 0 °C
    expect(seen.get(2.1)![3]).toBe(SOLID);
    expect(seen.get(37.6)!.slice(0, 2)).toEqual([0, expect.closeTo(0.5, 9)]); // half melted
    expect(seen.get(37.6)![3]).toBe(MELTING);
    expect(seen.get(112.8)![0]).toBeCloseTo(50, 9); // half-way to boiling
    expect(seen.get(112.8)![3]).toBe(LIQUID);
    expect(seen.get(177.17)![0]).toBe(100);
    expect(seen.get(177.17)![2]).toBeCloseTo(0.005, 9); // half of the 0.01 kg boiled away
    expect(seen.get(177.17)![3]).toBe(BOILING);
  });

  it('conserves energy: the heat its state holds is P·t at every step, through every corner', () => {
    for (const input of [
      inputsOf(),
      inputsOf({ power: 100, mass: 0.2, startTemperature: -30 }),
      inputsOf({ power: 800, mass: 0.05, startTemperature: -1, boilOffFraction: 1 }),
    ]) {
      let count = 0;
      heat(input, 0.05, (t, s) => {
        expect(heatHeld(s, input)).toBeCloseTo(input.power * t, 6);
        expect(s[HEAT]).toBeCloseTo(input.power * t, 6);
        // Mass is conserved too: ice, water and vapour add up to what went in.
        expect(s[ICE]! * input.mass + s[WATER_MASS]! + s[VAPOUR]!).toBeCloseTo(input.mass, 12);
        count++;
      });
      expect(count).toBeGreaterThan(100);
    }
  });

  it('rises, then stays flat at exactly 0 °C while melting and 100 °C while boiling', () => {
    let [last, stage] = [-Infinity, SOLID];
    heat(inputsOf(), 0.01, (_t, s) => {
      expect(s[T]).toBeGreaterThanOrEqual(last);
      expect(s[STATE]).toBeGreaterThanOrEqual(stage); // 0 → 1 → 2 → 3, never back
      if (s[STATE] === MELTING) expect(s[T]).toBe(0);
      if (s[STATE] === BOILING) expect(s[T]).toBe(100);
      if (s[STATE] !== MELTING) expect([0, 1]).toContain(s[ICE]); // ice melts only at 0 °C
      [last, stage] = [s[T]!, s[STATE]!];
    });
    expect(stage).toBe(BOILING);
  });

  it('times each stage on its corners whatever the step: 0.5 s, 0.01 s and 0.003 s agree', () => {
    const input = inputsOf({ power: 450, mass: 0.13, startTemperature: -17 });
    const theory = heatingModel.predict!(input);
    for (const dt of [0.5, 0.01, 0.003]) {
      const { state, t } = heat(input, dt);
      // The stopwatches add up steps: ~1e-9 s of rounding over 76 000 steps of 3 ms.
      expect(state[CLOCKS[0]!]).toBeCloseTo(theory.iceWarmingTime!, 6);
      expect(state[CLOCKS[1]!]).toBeCloseTo(theory.meltingTime!, 6);
      expect(state[CLOCKS[2]!]).toBeCloseTo(theory.waterWarmingTime!, 6);
      expect(state[CLOCKS[3]!]).toBeCloseTo(theory.boilingTime!, 6);
      expect(state[slot('boilStartTime')]).toBeCloseTo(theory.boilStartTime!, 6);
      expect(t).toBeCloseTo(theory.totalTime!, 6);
      expect(state[T]).toBe(100);
      expect(state[VAPOUR]).toBeCloseTo(0.1 * 0.13, 12);
    }
  });

  it('is deterministic: the same inputs give bit-identical states', () => {
    const a = heat(inputsOf(), 0.01).state;
    const b = heat(inputsOf(), 0.01).state;
    expect([...a]).toEqual([...b]);
  });

  it('starting at 0 °C it melts at once; boiling nothing away it ends on reaching 100 °C', () => {
    const state = new Float64Array(heatingModel.variables.length);
    heatingModel.init(inputsOf({ startTemperature: 0 }), state);
    expect([state[T], state[ICE], state[STATE]]).toEqual([0, 1, MELTING]);
    expect(heat(inputsOf({ startTemperature: 0 }), 0.01).state[CLOCKS[0]!]).toBe(0);

    const dry = heat(inputsOf({ boilOffFraction: 0 }), 0.01);
    expect(dry.t).toBeCloseTo(154.6, 9);
    expect([dry.state[T], dry.state[STATE], dry.state[VAPOUR]]).toEqual([100, BOILING, 0]);
    expect(dry.state[CLOCKS[3]!]).toBe(0);

    const all = heat(inputsOf({ boilOffFraction: 1 }), 0.01).state;
    expect(all[WATER_MASS]).toBeCloseTo(0, 12);
    expect(all[VAPOUR]).toBeCloseTo(0.1, 12);
  });

  it('once done, a step adds nothing and takes no time', () => {
    const input = inputsOf();
    const { state } = heat(input, 0.01);
    const before = [...state];
    expect(heatingModel.step(state, 0.01, input)).toBe(0);
    expect([...state]).toEqual(before);
  });

  it('gives L_f back from melting time against mass at one power: slope L_f/P', () => {
    const melting = (mass: number) => heat(inputsOf({ power: 200, mass }), 0.01).state[CLOCKS[1]!]!;
    // The start temperature does not enter the plateau: −20 °C and −5 °C melt alike.
    expect(
      heat(inputsOf({ power: 200, startTemperature: -20 }), 0.01).state[CLOCKS[1]!],
    ).toBeCloseTo(melting(0.1), 9);
    const slope = (melting(0.2) - melting(0.05)) / 0.15;
    expect(slope).toBeCloseTo(334_000 / 200, 6);
    expect(slope * 200).toBeCloseTo(334_000, 3); // L_f = slope·P
  });
});

describe('heating in the runtime, as a station runs it', () => {
  /** A minimal definition of the experiment's own step, sampling and limit. */
  const definition = ExperimentDefinitionSchema.parse({
    id: 'heating-test',
    name: 'Heating curve',
    category: 'chemistry',
    model: 'thermal.heating-curve',
    parameters: [
      { id: 'power', label: 'P', unit: 'W', default: 500, min: 200, max: 800 },
      { id: 'mass', label: 'm', unit: 'kg', default: 0.1, min: 0.02, max: 0.1 },
      { id: 'startTemperature', label: 'T₀', unit: '°C', default: -10, min: -30, max: 0 },
    ],
    initialConditions: { ...WATER, boilOffFraction: 0.05 },
    simulation: { timeStep: 0.01, maxDuration: 600, sampleInterval: 0.5 },
    measurements: [{ id: 'temperature', label: 'T', unit: '°C', variable: 'temperature' }],
    results: [
      ['meltingTime', 's', 'meltingTime'],
      ['boilStartTime', 's', 'boilStartTime'],
      ['temperature', '°C', 'boilingPoint'],
      ['state', '', undefined],
    ].map(([id, unit, theory]) => ({ id, label: id, unit, variable: id, reduce: 'final', theory })),
  });

  it('ends by itself, with the theory, even at the slowest corner of the ranges', () => {
    for (const [power, mass, startTemperature] of [
      [500, 0.1, -10],
      // The slowest: (6300 + 33 400 + 41 800 + 11 285) J / 200 W = 463.925 s, inside the 600 s limit.
      [200, 0.1, -30],
      [800, 0.02, 0],
    ] as const) {
      const r = new ExperimentRuntime('test', definition, heatingModel, {
        power,
        mass,
        startTemperature,
      });
      r.runToCompletion();
      const theory = r.theory()!;
      expect(r.status).toBe('completed');
      expect(r.endReason).toBe('model');
      expect(r.time).toBeCloseTo(theory.totalTime!, 6);
      if (power === 200) expect(r.time).toBeCloseTo(463.925, 6);
      expect(r.results!.meltingTime).toBeCloseTo(theory.meltingTime!, 6);
      expect(r.results!.boilStartTime).toBeCloseTo(theory.boilStartTime!, 6);
      expect(r.results!.temperature).toBe(100);
      expect(r.results!.state).toBe(BOILING);
    }
  });
});
