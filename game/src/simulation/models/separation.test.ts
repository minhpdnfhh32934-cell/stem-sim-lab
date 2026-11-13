import { describe, expect, it } from 'vitest';
import { ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { fitLine } from '../fit';
import { separationModel } from './separation';

const v = (id: string) => separationModel.variables.indexOf(id);
const TIME = v('labTime');
const TEMPERATURE = v('temperature');
const WATER = v('waterMass');
const DISSOLVED = v('dissolvedSalt');
const CRYSTALS = v('crystalMass');
const RESIDUE = v('residueMass');

const LAPSE = 20;
const POWER = 150;

const inputsOf = (change: Record<string, number> = {}) => ({
  saltMass: 3,
  waterVolume: 25,
  rinses: 1,
  sandMass: 5,
  rinseVolume: 5,
  retainedWater: 2.5,
  heaterPower: POWER,
  timeLapse: LAPSE,
  ...change,
});

const theory = (change: Record<string, number> = {}) => separationModel.predict!(inputsOf(change));

/*
 * Hand-worked reference values, from the data alone (not the model's code): water 0.9982 g/mL at
 * 20 °C; NaCl dissolves 0.359 g per g of water at 20 °C and 0.392 g/g at 100 °C; c = 4.18 J/(g·K),
 * L_v = 2257 J/g; ideal boiling-point elevation 2 × 0.513 K·kg/mol × b, M(NaCl) = 58.44 g/mol.
 *
 * Defaults: 3 g salt, 5 g sand, 25 mL water = 24.955 g, held 2.5 g, one 5 mL rinse = 4.991 g.
 * All dissolves (0.359 × 24.955 = 8.959 g ≥ 3 g). The held water keeps 3 × 2.5/24.955 = 0.300541 g;
 * the rinse leaves 0.300541 × 2.5/7.491 = 0.100301 g; recovered 2.899699 g. Filtrate water
 * 24.955 − 2.5 + 4.991 = 27.446 g; it boils at 100 + 17.55647 × 2.899699/27.446 = 101.85486 °C,
 * reached after 4.18 × 27.446 × 81.85486/150 = 62.6049 s; saturated when the water is down to
 * 2.899699/0.392 = 7.397191 g, at 62.6049 + 20.048809 × 2257/150 = 364.2727 s; dry at
 * 62.6049 + 27.446 × 2257/150 = 475.5757 s.
 */
const HAND = {
  lost: 0.1003006854,
  recovered: 2.8996993146,
  water: 27.446,
  boilTime: 62.604932,
  crystalTime: 364.272661,
  dryTime: 475.575746,
  saturatedBoilingPoint: 100 + 2 * 0.513 * ((0.392 * 1000) / 58.44), // 106.88214 °C
};

/** The model alone, stepped by `dt` run seconds until it stops; `each` sees the state. */
function heat(inputs: Record<string, number>, dt: number, each?: (s: Float64Array) => void) {
  const state = new Float64Array(separationModel.variables.length);
  separationModel.init(inputs, state);
  let runTime = 0;
  let last = dt;
  for (let i = 0; i < 1e7 && !separationModel.isComplete!(state, inputs); i++) {
    last = separationModel.step(state, dt, inputs);
    runTime += last;
    each?.(state);
  }
  return { state, runTime, last };
}

describe('separation theory: dissolving, filtering and rinsing as a mass balance', () => {
  it('matches the hand-worked defaults', () => {
    const t = theory();
    expect(t.undissolvedSalt).toBe(0);
    expect(t.saltLost).toBeCloseTo(HAND.lost, 7);
    expect(t.saltRecovered).toBeCloseTo(HAND.recovered, 7);
    expect(t.residueMass).toBeCloseTo(5 + HAND.lost, 7);
    expect(t.recovery).toBeCloseTo((100 * HAND.recovered) / 3, 5); // 96.657 %
    expect(t.saltPercent).toBeCloseTo((100 * HAND.recovered) / 8, 5); // 36.25 %, truly 37.5 %
  });

  it('dissolves 35.9 g per 100 g of water; the rest stays solid with the sand', () => {
    // 10 mL = 9.982 g of water dissolves 3.583538 g: 1.416462 g of 5 g stays solid, and the
    // held water is saturated, 0.359 × 2.5 = 0.8975 g.
    const none = theory({ saltMass: 5, waterVolume: 10, rinses: 0 });
    expect(none.undissolvedSalt).toBeCloseTo(1.416462, 9);
    expect(none.saltLost).toBeCloseTo(1.416462 + 0.8975, 9);
    expect(none.saltRecovered).toBeCloseTo(2.686038, 9);
    // One 5 mL rinse: 2.5 + 4.991 g of water can hold 2.689269 g, more than the 2.313962 g left,
    // so all of it dissolves; the held water keeps 2.313962 × 2.5/7.491 = 0.772247 g.
    const one = theory({ saltMass: 5, waterVolume: 10, rinses: 1 });
    expect(one.undissolvedSalt).toBeCloseTo(1.416462, 9); // in the first water
    expect(one.saltLost).toBeCloseTo(0.7722474, 7);
    expect(one.saltRecovered).toBeCloseTo(4.2277526, 7);
    // A rinse too small to dissolve it all: 0.5 mL = 0.4991 g with the 2.5 g held stays
    // saturated, so it carries away only 0.359 × 0.4991 = 0.1791769 g.
    const small = theory({ saltMass: 5, waterVolume: 10, rinses: 1, rinseVolume: 0.5 });
    expect(small.saltLost).toBeCloseTo(2.313962 - 0.1791769, 9);
  });

  it('leaves S·(m_held/m_w)·qⁿ with the sand while all dissolves: ideal dilution washing', () => {
    for (const waterVolume of [10, 25, 50]) {
      for (const rinses of [0, 1, 2, 3]) {
        const mw = 0.9982 * waterVolume;
        const q = 2.5 / (2.5 + 0.9982 * 5);
        const left = 2 * (2.5 / mw) * q ** rinses;
        const t = theory({ saltMass: 2, waterVolume, rinses });
        expect(t.saltLost).toBeCloseTo(left, 12);
        expect(t.saltRecovered! / 2).toBeCloseTo(t.recoveryFraction!, 12);
      }
    }
    // Rinses: 0, 1, 2, 3 at 25 mL recover 89.98, 96.66, 98.88, 99.63 % of the salt.
    const percents = [0, 1, 2, 3].map((rinses) => theory({ rinses }).recovery!);
    expect(percents.map((p) => Number(p.toFixed(2)))).toEqual([89.98, 96.66, 98.88, 99.63]);
  });

  it('recovers more with two small rinses than with one of the same total water', () => {
    const two = theory({ rinses: 2, rinseVolume: 5 });
    const one = theory({ rinses: 1, rinseVolume: 10 });
    // Left behind: q² = (2.5/7.491)² = 0.11138 against 2.5/12.482 = 0.20029 of the held salt.
    expect(two.saltLost! / one.saltLost!).toBeCloseTo(0.11138 / 0.20029, 3);
    expect(two.saltRecovered).toBeGreaterThan(one.saltRecovered!);
  });

  it('conserves mass at every dial preset: dried residue + recovered salt = the mixture', () => {
    for (const saltMass of [1, 2, 3, 5]) {
      for (const waterVolume of [10, 25, 50]) {
        for (const rinses of [0, 1, 2, 3]) {
          const t = theory({ saltMass, waterVolume, rinses });
          expect(t.residueMass! + t.saltRecovered!).toBeCloseTo(5 + saltMass, 12);
          expect(t.saltLost).toBeGreaterThan(0); // the held water always keeps some
          expect(t.saltRecovered).toBeGreaterThan(0);
        }
      }
    }
  });

  it('puts recovered salt against salt in the mixture on a line through 0 while all dissolves', () => {
    const points = [1, 2, 3, 5].map((s) => ({ x: s, y: theory({ saltMass: s }).saltRecovered! }));
    const fit = fitLine(points);
    if (fit.status !== 'fitted') throw new Error('no line');
    expect(fit.slope).toBeCloseTo(theory().recoveryFraction!, 12);
    expect(fit.intercept).toBeCloseTo(0, 12);
    // With too little water the 5 g point falls below that line: 4.2278 g, not 0.92 × 5 g.
    const short = theory({ saltMass: 5, waterVolume: 10 });
    expect(short.saltRecovered).toBeLessThan(5 * short.recoveryFraction! - 0.3);
    expect(theory({ saltMass: 3, waterVolume: 10 }).recoveryFraction).toBe(short.recoveryFraction);
  });
});

describe('separation theory: the heat that evaporates the filtrate', () => {
  it('times boiling, crystallising and dryness as hand-worked', () => {
    const t = theory();
    expect(t.boilTime).toBeCloseTo(HAND.boilTime, 4);
    expect(t.crystalTime).toBeCloseTo(HAND.crystalTime, 4);
    expect(t.dryTime).toBeCloseTo(HAND.dryTime, 4);
  });

  it('balances the heat: P·t_dry warms the water to its boiling point and boils it all', () => {
    for (const change of [{}, { saltMass: 5, waterVolume: 10, rinses: 0 }, { waterVolume: 50 }]) {
      const t = theory(change);
      const water = 0.9982 * (inputsOf(change).waterVolume + inputsOf(change).rinses * 5) - 2.5;
      const boils = 100 + ((2 * 0.513 * 1000) / 58.44) * (t.saltRecovered! / water);
      expect(POWER * t.dryTime!).toBeCloseTo(4.18 * water * (boils - 20) + 2257 * water, 6);
      expect(POWER * t.boilTime!).toBeCloseTo(4.18 * water * (boils - 20), 6);
    }
  });
});

describe('separation run: warm, boil down, crystallise, dry', () => {
  it('warms at P/(c·m_w), then loses water at P/L_v, and crystallises once saturated', () => {
    let checked = 0;
    const { state } = heat(inputsOf(), 0.02, (s) => {
      const t = s[TIME]!;
      if (t <= HAND.boilTime) {
        expect(s[TEMPERATURE]).toBeCloseTo(20 + (POWER * t) / (4.18 * HAND.water), 9);
        expect(s[WATER]).toBeCloseTo(HAND.water, 12);
      } else {
        expect(s[WATER]).toBeCloseTo(
          Math.max(0, HAND.water - (POWER * (t - HAND.boilTime)) / 2257),
          4,
        );
      }
      if (t < HAND.crystalTime - 1e-3) {
        expect(s[CRYSTALS]).toBe(0);
        expect(s[DISSOLVED]).toBeCloseTo(HAND.recovered, 7);
      } else if (t > HAND.crystalTime + 1e-3) {
        expect(s[DISSOLVED]).toBeCloseTo(0.392 * s[WATER]!, 9); // saturated at 100 °C
        expect(s[TEMPERATURE]).toBeCloseTo(HAND.saturatedBoilingPoint, 9);
        checked++;
      }
      expect(s[DISSOLVED]! + s[CRYSTALS]!).toBeCloseTo(HAND.recovered, 9);
    });
    expect(checked).toBeGreaterThan(200);
    expect([state[WATER], state[DISSOLVED]]).toEqual([0, 0]);
    expect(state[CRYSTALS]).toBeCloseTo(HAND.recovered, 9);
    expect(state[RESIDUE]).toBeCloseTo(5 + HAND.lost, 7);
  });

  it('never gains water or loses crystals, and boils above 100 °C as the brine thickens', () => {
    let water = Infinity;
    let crystals = 0;
    let temperature = -Infinity;
    heat(inputsOf({ saltMass: 5, waterVolume: 50, rinses: 3 }), 0.05, (s) => {
      expect(s[WATER]!).toBeLessThanOrEqual(water);
      expect(s[CRYSTALS]!).toBeGreaterThanOrEqual(crystals);
      expect(s[TEMPERATURE]!).toBeGreaterThanOrEqual(temperature);
      [water, crystals, temperature] = [s[WATER]!, s[CRYSTALS]!, s[TEMPERATURE]!];
    });
    expect(temperature).toBeCloseTo(HAND.saturatedBoilingPoint, 9);
  });

  it('ends dry exactly at t_dry, whatever the step, with the theory’s result', () => {
    const inputs = inputsOf({ saltMass: 2, waterVolume: 50, rinses: 2 });
    const t = separationModel.predict!(inputs);
    const finals = [0.001, 0.02, 0.07, 0.3, 7].map((dt) => {
      const { state, runTime, last } = heat(inputs, dt);
      expect(state[TIME]).toBe(t.dryTime);
      expect(runTime).toBeCloseTo(t.dryTime! / LAPSE, 9);
      expect(last).toBeLessThanOrEqual(dt);
      expect(state[WATER]).toBe(0);
      return state[CRYSTALS]!;
    });
    for (const m of finals) expect(m).toBeCloseTo(t.saltRecovered!, 12);
    const { state } = heat(inputs, 0.02);
    expect(separationModel.step(state, 0.02, inputs)).toBe(0); // nothing after dryness
  });

  it('is deterministic: two runs give the same bits', () => {
    const a = heat(inputsOf(), 0.02).state;
    const b = heat(inputsOf(), 0.02).state;
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe('separation inputs: refused with a reason, never clamped', () => {
  it('refuses missing, out-of-range, fractional and non-finite inputs', () => {
    const state = new Float64Array(separationModel.variables.length);
    const missing: Record<string, number> = inputsOf();
    delete missing.saltMass;
    expect(() => separationModel.init(missing, state)).toThrow(/"saltMass" is missing/);
    expect(() => theory({ saltMass: 0 })).toThrow(/"saltMass" must be above 0/);
    expect(() => theory({ rinses: 1.5 })).toThrow(/"rinses" must be a whole number/);
    expect(() => theory({ heaterPower: NaN })).toThrow(/heaterPower/);
    expect(() => separationModel.init(inputsOf({ waterVolume: Infinity }), state)).toThrow(
      /waterVolume/,
    );
  });

  it('refuses less water than the wet residue holds: no filtrate would pass', () => {
    expect(() => theory({ waterVolume: 2.5 })).toThrow(/holds 2.5 g.*2\.50 g.*no filtrate/);
    expect(theory({ waterVolume: 2.6 }).saltRecovered).toBeGreaterThan(0);
  });
});

describe('separation in the experiment runtime', () => {
  const definition = ExperimentDefinitionSchema.parse({
    id: 'separation-test',
    name: 'Separation',
    category: 'chemistry',
    model: 'chemistry.separation',
    parameters: [
      { id: 'saltMass', label: 'S', unit: 'g', default: 3, min: 1, max: 5 },
      { id: 'waterVolume', label: 'V', unit: 'mL', default: 25, min: 10, max: 50 },
      { id: 'rinses', label: 'n', unit: '', default: 1, min: 0, max: 3 },
    ],
    initialConditions: {
      sandMass: 5,
      rinseVolume: 5,
      retainedWater: 2.5,
      heaterPower: POWER,
      timeLapse: LAPSE,
    },
    simulation: { timeStep: 0.02, maxDuration: 60, sampleInterval: 0.1 },
    measurements: [{ id: 'water', label: 'm', unit: 'g', variable: 'waterMass' }],
    results: [
      {
        id: 'salt',
        label: 'm',
        unit: 'g',
        variable: 'crystalMass',
        reduce: 'final',
        theory: 'saltRecovered',
      },
    ],
  });

  it('ends by itself inside maxDuration at every extreme of the dials', () => {
    for (const saltMass of [1, 5]) {
      for (const waterVolume of [10, 50]) {
        for (const rinses of [0, 3]) {
          const r = new ExperimentRuntime('t', definition, separationModel, {
            saltMass,
            waterVolume,
            rinses,
          });
          r.runToCompletion();
          expect([r.status, r.endReason]).toEqual(['completed', 'model']);
          expect(r.time).toBeCloseTo(r.theory()!.dryTime! / LAPSE, 9); // 6 to 54 s
          expect(r.time).toBeLessThan(55);
          expect(r.results!.salt).toBeCloseTo(r.theory()!.saltRecovered!, 10);
        }
      }
    }
  });
});
