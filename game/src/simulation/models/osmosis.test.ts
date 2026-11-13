import { describe, expect, it } from 'vitest';
import { ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { fitLine } from '../fit';
import { osmosisModel } from './osmosis';

const MASS = osmosisModel.variables.indexOf('mass');
const PERCENT = osmosisModel.variables.indexOf('percentChange');
const TIME = osmosisModel.variables.indexOf('labTime');
const DIFFERENCE = osmosisModel.variables.indexOf('potentialDifference');
const DIRECTION = osmosisModel.variables.indexOf('direction');

const TAU = 2700;
const SOAK = 14400;
const LAPSE = 240;
const E = 5000;
const C_ISO = 0.25;

const inputsOf = (change: Record<string, number> = {}) => ({
  concentration: 0.4,
  temperature: 20,
  initialMass: 3,
  isotonicConcentration: C_ISO,
  tissueModulus: E,
  timeConstant: TAU,
  soakTime: SOAK,
  timeLapse: LAPSE,
  ...change,
});

/** R·T at 20 °C, by hand: 8.314462618 J/(mol·K) × 293.15 K. */
const RT20 = 2437.3847164667;

/** The model alone, stepped by `dt` run seconds until it stops; `each` sees the state. */
function soak(inputs: Record<string, number>, dt: number, each?: (s: Float64Array) => void) {
  const state = new Float64Array(osmosisModel.variables.length);
  osmosisModel.init(inputs, state);
  let runTime = 0;
  let last = dt;
  for (let i = 0; i < 1e7 && !osmosisModel.isComplete!(state, inputs); i++) {
    last = osmosisModel.step(state, dt, inputs);
    runTime += last;
    each?.(state);
  }
  return { state, runTime, last };
}

/**
 * The flow law integrated independently, by classical RK4 on the mass itself: water enters at a
 * rate proportional to Ψ_solution − Ψ_tissue, dm/dt = m₀/(E·τ)·(Ψ_solution − Ψ_tissue(m)), with
 * Ψ_solution = −C·R·T and Ψ_tissue(m) = −C_iso·R·T + E·(m − m₀)/m₀.
 */
function rk4Mass(c: number, m0: number, rt: number, seconds: number, h = 1) {
  const rate = (m: number) => (m0 / (E * TAU)) * (-c * rt - (-C_ISO * rt + (E * (m - m0)) / m0));
  let m = m0;
  for (let t = 0; t < seconds - 1e-9; t += h) {
    const k1 = rate(m);
    const k2 = rate(m + (h / 2) * k1);
    const k3 = rate(m + (h / 2) * k2);
    const k4 = rate(m + h * k3);
    m += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
  }
  return m;
}

describe('osmosis theory: van ’t Hoff potentials and the equilibrium they set', () => {
  it('gives Ψ = −i·C·R·T in kPa with C in mol/L, i = 1 for sucrose', () => {
    const t = osmosisModel.predict!(inputsOf({ concentration: 0.5 }));
    expect(t.solutionPotential).toBeCloseTo(-0.5 * RT20, 6); // ≈ −1218.7 kPa
    expect(t.tissuePotential).toBeCloseTo(-0.25 * RT20, 6); // ≈ −609.3 kPa
    expect(t.potentialDifference).toBeCloseTo(-0.25 * RT20, 6);
    expect(t.direction).toBe(-1);
  });

  it('gains water below C_iso, loses it above, and neither at C_iso exactly', () => {
    const water = osmosisModel.predict!(inputsOf({ concentration: 0 }));
    expect(water.direction).toBe(1);
    expect(Object.is(water.solutionPotential, 0)).toBe(true); // pure water: 0 kPa, never −0
    expect(osmosisModel.predict!(inputsOf({ concentration: 1 })).direction).toBe(-1);
    const iso = osmosisModel.predict!(inputsOf({ concentration: C_ISO }));
    expect([iso.direction, iso.equilibriumPercent, iso.finalPercent]).toEqual([0, 0, 0]);
  });

  it('tends to 100·ΔΨ₀/E and reaches 1 − e^(−t_soak/τ) of it after the soak', () => {
    const t = osmosisModel.predict!(inputsOf({ concentration: 0 }));
    expect(t.equilibriumPercent).toBeCloseTo((100 * 0.25 * RT20) / E, 9); // ≈ +12.19 %
    const reach = 1 - Math.exp(-16 / 3); // 4 h over 45 min
    expect(t.finalPercent).toBeCloseTo(t.equilibriumPercent! * reach, 12);
    expect(reach).toBeCloseTo(0.99517, 5);
    expect(t.finalMass).toBeCloseTo(3 * (1 + t.finalPercent! / 100), 12);
  });

  it('puts the line of Δm/m₀ against C through 0 % at C_iso, its slope scaling with T in K', () => {
    const at = (c: number, temperature = 20) =>
      osmosisModel.predict!(inputsOf({ concentration: c, temperature }));
    const points = [0, 0.2, 0.4, 0.6, 1].map((c) => ({ x: c, y: at(c).finalPercent! }));
    const fit = fitLine(points);
    if (fit.status !== 'fitted') throw new Error('no line');
    expect(fit.slope).toBeCloseTo(at(0).percentSlope!, 9);
    expect(fit.intercept).toBeCloseTo(at(0).percentIntercept!, 9);
    expect(-fit.intercept / fit.slope).toBeCloseTo(C_ISO, 12); // the isotonic point
    expect(fit.slope).toBeCloseTo((-100 * RT20 * (1 - Math.exp(-16 / 3))) / E, 9);
    expect(at(0, 30).percentSlope! / at(0, 10).percentSlope!).toBeCloseTo(303.15 / 283.15, 12);
    // Not on the mass: the percent change is the same for any cylinder.
    expect(osmosisModel.predict!(inputsOf({ initialMass: 5.7 })).finalPercent).toBe(
      at(0.4).finalPercent,
    );
  });

  it('steepens the line with the soak time as 1 − e^(−t_soak/τ), C_iso unchanged', () => {
    const at = (soakTime: number) => osmosisModel.predict!(inputsOf({ soakTime }));
    // 30 min against 4 h, both over τ = 45 min.
    const ratio = (1 - Math.exp(-2 / 3)) / (1 - Math.exp(-16 / 3));
    expect(at(1800).percentSlope! / at(14400).percentSlope!).toBeCloseTo(ratio, 12);
    expect(ratio).toBeCloseTo(0.48894, 5);
    expect(-at(1800).percentIntercept! / at(1800).percentSlope!).toBeCloseTo(C_ISO, 12);
  });
});

describe('osmosis run: the flow law stepped exactly, then stopped at the end of the soak', () => {
  it('follows an independent RK4 integration of dm/dt ∝ ΔΨ at every time', () => {
    let checked = 0;
    for (const c of [0, 0.15, 0.6, 1]) {
      const inputs = inputsOf({ concentration: c });
      soak(inputs, 0.5, (s) => {
        const t = s[TIME]!;
        if (t % 3600 !== 0) return;
        expect(s[MASS]!).toBeCloseTo(rk4Mass(c, 3, RT20, t), 9);
        checked++;
      });
    }
    expect(checked).toBe(16); // 1, 2, 3 and 4 h for each concentration
  });

  it('is 1 − 1/e of the way to equilibrium at t = τ', () => {
    const inputs = inputsOf({ concentration: 0, timeLapse: 1, soakTime: TAU });
    const { state } = soak(inputs, 1);
    const ueq = (0.25 * RT20) / E;
    expect(state[PERCENT]!).toBeCloseTo(100 * ueq * (1 - Math.exp(-1)), 9);
  });

  it('lets water flow down ΔΨ only: ΔΨ keeps its sign and shrinks as e^(−t/τ)', () => {
    const inputs = inputsOf({ concentration: 0.8 });
    const start = osmosisModel.predict!(inputs).potentialDifference!;
    soak(inputs, 0.1, (s) => {
      expect(s[DIFFERENCE]!).toBeCloseTo(start * Math.exp(-s[TIME]! / TAU), 6);
      expect(s[DIRECTION]).toBe(-1);
    });
  });

  it('ends exactly at the soak, whatever the step, with the theory’s result', () => {
    const inputs = inputsOf({ concentration: 0.7 });
    const theory = osmosisModel.predict!(inputs);
    const finals = [0.001, 0.02, 0.07, 0.3, 7].map((dt) => {
      const { state, runTime, last } = soak(inputs, dt);
      expect(state[TIME]).toBe(SOAK);
      expect(runTime).toBeCloseTo(SOAK / LAPSE, 9); // 60 run seconds
      expect(last).toBeLessThanOrEqual(dt);
      return state[PERCENT]!;
    });
    for (const p of finals) expect(p).toBeCloseTo(theory.finalPercent!, 10);
    const { state } = soak(inputs, 0.02);
    expect(osmosisModel.step(state, 0.02, inputs)).toBe(0); // nothing after the soak
  });

  it('is deterministic: two runs give the same bits', () => {
    const a = soak(inputsOf(), 0.02).state;
    const b = soak(inputsOf(), 0.02).state;
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('does not change at C_iso', () => {
    const { state } = soak(inputsOf({ concentration: C_ISO }), 0.02);
    expect([state[MASS], state[PERCENT], state[DIFFERENCE], state[DIRECTION]]).toEqual([
      3, 0, 0, 0,
    ]);
  });
});

describe('osmosis inputs: refused with a reason, never clamped', () => {
  it('refuses missing, out-of-range and non-finite inputs', () => {
    const state = new Float64Array(osmosisModel.variables.length);
    const missing: Record<string, number> = inputsOf();
    delete missing.concentration;
    expect(() => osmosisModel.init(missing, state)).toThrow(/"concentration" is missing/);
    expect(() => osmosisModel.predict!(inputsOf({ concentration: -0.1 }))).toThrow(/0 to 1.5/);
    expect(() => osmosisModel.init(inputsOf({ temperature: NaN }), state)).toThrow(/temperature/);
    expect(() => osmosisModel.init(inputsOf({ initialMass: 0 }), state)).toThrow(/initialMass/);
  });

  it('refuses a run that would lose more than the water the cylinder holds', () => {
    expect(() =>
      osmosisModel.predict!(inputsOf({ concentration: 1.5, tissueModulus: 100 })),
    ).toThrow(/more than the water it holds/);
  });

  it('refuses a run that would more than double the cylinder', () => {
    // u_eq = R·T·C_iso/E = 2437.38 × 1.5 / 100 ≈ 36.6, a +3656 % gain.
    expect(() =>
      osmosisModel.predict!(
        inputsOf({ concentration: 0, isotonicConcentration: 1.5, tissueModulus: 100 }),
      ),
    ).toThrow(/gain 3656 %.*cell walls/);
    // Just under doubling (u_eq = 0.99) still runs: E = R·T·C_iso/0.99.
    const e = (RT20 * 1.5) / 0.99;
    const ok = inputsOf({ concentration: 0, isotonicConcentration: 1.5, tissueModulus: e });
    expect(osmosisModel.predict!(ok).equilibriumPercent).toBeCloseTo(99, 9);
  });
});

describe('osmosis in the experiment runtime', () => {
  const definition = ExperimentDefinitionSchema.parse({
    id: 'osmosis-test',
    name: 'Osmosis',
    category: 'biology',
    model: 'biology.osmosis',
    parameters: [
      { id: 'concentration', label: 'C', unit: 'mol/L', default: 0.4, min: 0, max: 1 },
      { id: 'soakTime', label: 't', unit: 's', default: SOAK, min: 1800, max: 14400 },
      { id: 'initialMass', label: 'm₀', unit: 'g', default: 3, min: 1, max: 6 },
    ],
    initialConditions: {
      temperature: 20,
      isotonicConcentration: C_ISO,
      tissueModulus: E,
      timeConstant: TAU,
      timeLapse: LAPSE,
    },
    simulation: { timeStep: 0.02, maxDuration: 65, sampleInterval: 0.1 },
    measurements: [{ id: 'mass', label: 'm', unit: 'g', variable: 'mass' }],
    results: [
      {
        id: 'p',
        label: 'p',
        unit: '%',
        variable: 'percentChange',
        reduce: 'final',
        theory: 'finalPercent',
      },
    ],
  });

  it('ends by itself after t_soak/240 run seconds, inside every dial’s range', () => {
    for (const concentration of [0, 0.25, 1]) {
      for (const soakTime of [1800, 14400]) {
        const r = new ExperimentRuntime('t', definition, osmosisModel, {
          concentration,
          soakTime,
          initialMass: 6,
        });
        r.runToCompletion();
        expect([r.status, r.endReason]).toEqual(['completed', 'model']);
        expect(r.time).toBeCloseTo(soakTime / LAPSE, 9); // 7.5 s or 60 s
        expect(r.results!.p).toBeCloseTo(r.theory()!.finalPercent!, 10);
      }
    }
  });
});
