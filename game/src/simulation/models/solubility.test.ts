import { describe, expect, it } from 'vitest';
import { ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { fitLine } from '../fit';
import { solubilityModel } from './solubility';

const TIME = solubilityModel.variables.indexOf('labTime');
const DISSOLVED = solubilityModel.variables.indexOf('dissolved');
const UNDISSOLVED = solubilityModel.variables.indexOf('undissolved');
const CONCENTRATION = solubilityModel.variables.indexOf('concentration');
const SATURATION = solubilityModel.variables.indexOf('saturation');

const KNO3 = 0;
const NACL = 1;
const KCL = 2;
const TAU = 60;
const STIR = 900;
const LAPSE = 30;
const WATER = 50;

const inputsOf = (change: Record<string, number> = {}) => ({
  solute: KNO3,
  temperature: 20,
  soluteMass: 20,
  waterMass: WATER,
  timeConstant: TAU,
  stirTime: STIR,
  timeLapse: LAPSE,
  ...change,
});

const predict = (change: Record<string, number> = {}) => solubilityModel.predict!(inputsOf(change));

/**
 * Solubility in g per 100 g of water from a mass percent w as the CRC Handbook prints it (91st
 * ed., "Aqueous Solubility of Inorganic Compounds at Various Temperatures"), by its own relation
 * r = 100·w₂/(1 − w₂). The percents below are copied from the printed table, not from the model.
 */
const perHundredGrams = (percent: number) => (100 * percent) / (100 - percent);

/** The model alone, stepped by `dt` run seconds until it stops; `each` sees the state. */
function stir(inputs: Record<string, number>, dt: number, each?: (s: Float64Array) => void) {
  const state = new Float64Array(solubilityModel.variables.length);
  solubilityModel.init(inputs, state);
  let runTime = 0;
  let steps = 0;
  while (!solubilityModel.isComplete!(state, inputs) && steps++ < 1e7) {
    runTime += solubilityModel.step(state, dt, inputs);
    each?.(state);
  }
  return { state, runTime };
}

/**
 * The Noyes–Whitney law integrated independently, by classical RK4 on the mass dissolved:
 * dd/dt = (m_sat − d)/τ while solid remains, stopped where d would pass the mass added.
 */
function rk4Dissolved(mSat: number, mass: number, seconds: number, h = 0.25) {
  const rate = (d: number) => (mSat - d) / TAU;
  let d = 0;
  for (let t = 0; t < seconds - 1e-9; t += h) {
    const k1 = rate(d);
    const k2 = rate(d + (h / 2) * k1);
    const k3 = rate(d + (h / 2) * k2);
    const k4 = rate(d + h * k3);
    d = Math.min(mass, d + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4));
  }
  return d;
}

describe('solubility reference data: the CRC table, converted and interpolated', () => {
  it('converts the printed mass percents to g per 100 g of water at the table’s columns', () => {
    // [solute, °C, printed mass percent]
    const printed: [number, number, number][] = [
      [KNO3, 0, 12.0],
      [KNO3, 20, 24.2],
      [KNO3, 40, 38.6],
      [KNO3, 60, 52.2],
      [KNO3, 80, 63.0],
      [KNO3, 100, 70.8],
      [NACL, 20, 26.41],
      [NACL, 25, 26.45],
      [NACL, 80, 27.5],
      [KCL, 20, 25.39],
      [KCL, 50, 30.04],
      [KCL, 80, 33.86],
    ];
    for (const [solute, temperature, percent] of printed) {
      expect(predict({ solute, temperature }).solubility).toBeCloseTo(perHundredGrams(percent), 12);
    }
    // Worked by hand: 2420/75.8 and 6300/37.
    expect(predict({ temperature: 20 }).solubility).toBeCloseTo(31.9261, 4);
    expect(predict({ temperature: 80 }).solubility).toBeCloseTo(170.2703, 4);
  });

  it('agrees with the saturated NaCl molality at 25 °C, about 6.15 mol/kg', () => {
    const molarMass = 22.98977 + 35.453; // g/mol
    const molality = (10 * predict({ solute: NACL, temperature: 25 }).solubility!) / molarMass;
    expect(Math.abs(molality - 6.15)).toBeLessThan(0.02);
  });

  it('interpolates the mass percent linearly between columns', () => {
    // 65 °C: halfway between 52.2 % (60 °C) and 58.0 % (70 °C); 22.5 °C between 20 and 25 °C.
    expect(predict({ temperature: 65 }).solubility).toBeCloseTo(perHundredGrams(55.1), 10);
    expect(predict({ temperature: 22.5 }).solubility).toBeCloseTo(perHundredGrams(25.95), 10);
    expect(predict({ solute: KCL, temperature: 33 }).solubility).toBeCloseTo(
      perHundredGrams(27.04 + 0.3 * (28.59 - 27.04)),
      10,
    );
  });

  it('rises steeply for KNO₃, gently for KCl and barely for NaCl', () => {
    const ratio = (solute: number) =>
      predict({ solute, temperature: 80 }).solubility! /
      predict({ solute, temperature: 20 }).solubility!;
    expect(ratio(KNO3)).toBeCloseTo(170.2703 / 31.9261, 3); // × 5.33
    expect(ratio(KCL)).toBeCloseTo(51.1944 / 34.0303, 3); // × 1.50
    expect(ratio(NACL)).toBeCloseTo(37.931 / 35.888, 3); // × 1.06
    for (const solute of [KNO3, NACL, KCL]) {
      let previous = 0;
      for (let t = 0; t <= 100; t += 5) {
        const s = predict({ solute, temperature: t }).solubility!;
        expect(s).toBeGreaterThan(previous);
        previous = s;
      }
    }
  });
});

describe('solubility theory: what dissolves, what is left, and the line through the residues', () => {
  it('dissolves everything below m_sat = S·m_w/100 and leaves the rest above it', () => {
    const s = perHundredGrams(24.2); // KNO₃ at 20 °C
    const mSat = (s * WATER) / 100; // 15.963 g
    const reach = 1 - Math.exp(-STIR / TAU);
    const under = predict({ soluteMass: 10 });
    expect(under.saturationMass).toBeCloseTo(mSat, 12);
    expect([under.finalDissolved, under.finalResidue]).toEqual([10, 0]);
    expect(under.finalConcentration).toBeCloseTo(20, 12); // 10 g in 50 g of water
    expect(under.finalSaturation).toBeCloseTo((100 * 20) / s, 12);
    const over = predict({ soluteMass: 40 });
    expect(over.finalDissolved).toBeCloseTo(mSat * reach, 12);
    expect(over.finalResidue).toBeCloseTo(40 - mSat * reach, 12);
    expect(over.finalResidue! - (40 - mSat)).toBeLessThan(1e-5); // e^(−15) of m_sat: unweighable
    expect(over.finalConcentration).toBeCloseTo(s * reach, 12);
  });

  it('puts the residues of saturated runs on a line of slope 1 that crosses 0 g at m_sat', () => {
    for (const [solute, temperature] of [
      [KNO3, 60],
      [NACL, 20],
      [KCL, 80],
    ] as const) {
      const at = (soluteMass: number) => predict({ solute, temperature, soluteMass });
      const points = [60, 80, 100, 120].map((m) => ({ x: m, y: at(m).finalResidue! }));
      const fit = fitLine(points);
      if (fit.status !== 'fitted') throw new Error('no line');
      expect(fit.slope).toBeCloseTo(at(60).residueSlope!, 9);
      expect(fit.intercept).toBeCloseTo(at(60).residueIntercept!, 9);
      expect(-fit.intercept / fit.slope).toBeCloseTo(at(60).saturationMass!, 4);
    }
  });
});

describe('solubility run: Noyes–Whitney stepped exactly, ending when dissolved or stirred', () => {
  it('follows an independent RK4 integration of dd/dt = (m_sat − d)/τ', () => {
    let checked = 0;
    for (const [solute, temperature, soluteMass] of [
      [KNO3, 20, 40],
      [KNO3, 80, 60],
      [NACL, 50, 10],
      [KCL, 30, 30],
    ] as const) {
      const inputs = inputsOf({ solute, temperature, soluteMass });
      const mSat = solubilityModel.predict!(inputs).saturationMass!;
      stir(inputs, 0.5, (s) => {
        const t = s[TIME]!;
        if (t % 30 !== 0) return;
        expect(s[DISSOLVED]!).toBeCloseTo(rk4Dissolved(mSat, soluteMass, t), 6);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(40);
  });

  it('is 1 − 1/e of the way to saturation at t = τ', () => {
    const inputs = inputsOf({ soluteMass: 100, stirTime: TAU, timeLapse: 1 });
    const { state } = stir(inputs, 1);
    expect(state[DISSOLVED]!).toBeCloseTo(
      (perHundredGrams(24.2) * WATER * (1 - Math.exp(-1))) / 100,
      9,
    );
  });

  it('dissolves the last crystal at t_all = −τ·ln(1 − m/m_sat), whatever the step', () => {
    const inputs = inputsOf({ solute: NACL, temperature: 20, soluteMass: 10 });
    const mSat = (perHundredGrams(26.41) * WATER) / 100;
    const tAll = -TAU * Math.log(1 - 10 / mSat); // ≈ 48.9 s
    for (const dt of [0.001, 0.02, 0.07, 1.3, 50]) {
      const { state, runTime } = stir(inputs, dt);
      expect(state[TIME]!).toBeCloseTo(tAll, 9);
      expect(runTime).toBeCloseTo(tAll / LAPSE, 9);
      expect([state[DISSOLVED], state[UNDISSOLVED]]).toEqual([10, 0]);
      expect(Object.is(state[UNDISSOLVED], 0)).toBe(true);
      expect(state[CONCENTRATION]).toBeCloseTo(20, 12);
    }
  });

  it('stops exactly at the end of the stirring with solid left, as the theory says', () => {
    const inputs = inputsOf({ solute: KCL, temperature: 70, soluteMass: 80 });
    const theory = solubilityModel.predict!(inputs);
    for (const dt of [0.001, 0.02, 0.07, 0.3, 7]) {
      const { state, runTime } = stir(inputs, dt);
      expect(state[TIME]).toBe(STIR);
      expect(runTime).toBeCloseTo(STIR / LAPSE, 9); // 30 run seconds
      expect(state[UNDISSOLVED]!).toBeCloseTo(theory.finalResidue!, 10);
      expect(state[SATURATION]!).toBeCloseTo(theory.finalSaturation!, 10);
    }
    const { state } = stir(inputs, 0.02);
    expect(solubilityModel.step(state, 0.02, inputs)).toBe(0); // nothing after the stirring
  });

  it('never makes the solution more than saturated', () => {
    stir(inputsOf({ temperature: 40, soluteMass: 120 }), 0.02, (s) => {
      expect(s[SATURATION]!).toBeLessThanOrEqual(100);
      expect(s[UNDISSOLVED]!).toBeGreaterThan(0);
    });
  });

  it('is deterministic: two runs give the same bits', () => {
    const a = stir(inputsOf({ soluteMass: 30 }), 0.02).state;
    const b = stir(inputsOf({ soluteMass: 30 }), 0.02).state;
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe('solubility inputs: refused with a reason, never clamped', () => {
  it('refuses missing, out-of-range and non-finite inputs', () => {
    const state = new Float64Array(solubilityModel.variables.length);
    const missing: Record<string, number> = inputsOf();
    delete missing.solute;
    expect(() => solubilityModel.init(missing, state)).toThrow(/"solute" is missing/);
    expect(() => predict({ solute: 3 })).toThrow(/KNO₃.*NaCl.*KCl/);
    expect(() => predict({ solute: 0.5 })).toThrow(/solute/);
    expect(() => predict({ temperature: 101 })).toThrow(/0 to 100 °C/);
    expect(() => predict({ temperature: -1 })).toThrow(/0 to 100 °C/);
    expect(() => solubilityModel.init(inputsOf({ temperature: NaN }), state)).toThrow(
      /temperature/,
    );
    expect(() => predict({ soluteMass: 0 })).toThrow(/soluteMass/);
    expect(() => predict({ waterMass: Infinity })).toThrow(/waterMass/);
    expect(() => predict({ timeLapse: 0.5 })).toThrow(/timeLapse/);
  });
});

describe('solubility in the experiment runtime', () => {
  const definition = ExperimentDefinitionSchema.parse({
    id: 'solubility-test',
    name: 'Solubility',
    category: 'chemistry',
    model: 'chemistry.solubility',
    parameters: [
      { id: 'solute', label: 'Solute', unit: '', default: 0, min: 0, max: 2 },
      { id: 'temperature', label: 'T', unit: '°C', default: 20, min: 20, max: 80 },
      { id: 'soluteMass', label: 'm', unit: 'g', default: 20, min: 10, max: 120 },
    ],
    initialConditions: {
      waterMass: WATER,
      timeConstant: TAU,
      stirTime: STIR,
      timeLapse: LAPSE,
    },
    simulation: { timeStep: 0.02, maxDuration: 32, sampleInterval: 0.1 },
    measurements: [{ id: 'c', label: 'c', unit: 'g/100 g', variable: 'concentration' }],
    results: [
      {
        id: 'residue',
        label: 'residue',
        unit: 'g',
        variable: 'undissolved',
        reduce: 'final',
        theory: 'finalResidue',
      },
    ],
  });

  it('ends by itself, inside every dial’s range, with the theory’s residue', () => {
    for (const solute of [KNO3, NACL, KCL]) {
      for (const temperature of [20, 50, 80]) {
        for (const soluteMass of [10, 40, 120]) {
          const r = new ExperimentRuntime('t', definition, solubilityModel, {
            solute,
            temperature,
            soluteMass,
          });
          r.runToCompletion();
          expect([r.status, r.endReason]).toEqual(['completed', 'model']);
          expect(r.time).toBeLessThanOrEqual(STIR / LAPSE + 1e-9);
          expect(r.results!.residue).toBeCloseTo(r.theory()!.finalResidue!, 9);
        }
      }
    }
  });
});
