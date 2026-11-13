import { describe, expect, it } from 'vitest';
import { ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { fitLine } from '../fit';
import { phModel, solutionPH } from './ph';
import { titrationPH } from './titration';

const TIME = phModel.variables.indexOf('immersionTime');
const READING = phModel.variables.indexOf('reading');
const POTENTIAL = phModel.variables.indexOf('potential');
const HYDROGEN = phModel.variables.indexOf('hydrogenIon');

const KW = 1e-14;
const TAU = 3;
const READ = 30;
/** The station's pairs: HCl/NaCl, ethanoic acid/ethanoate, NH₄⁺/NH₃, water/NaOH. */
const HCL = -6;
const ETHANOIC = 4.76;
const AMMONIUM = 9.25;
const NAOH = 20;
const PAIRS = [HCL, ETHANOIC, AMMONIUM, NAOH];
const FORMS = [0, 0.5, 1];
const DILUTIONS = [0.1, 0.01, 0.001, 0.0001];

const inputsOf = (change: Record<string, number> = {}) => ({
  pKa: ETHANOIC,
  baseFraction: 0,
  concentration: 0.1,
  kw: KW,
  temperature: 25,
  timeConstant: TAU,
  readTime: READ,
  startPH: 7,
  ...change,
});

const pHOf = (change: Record<string, number>) => phModel.predict!(inputsOf(change)).pH!;

/** Ka·C ≫ Kw: [H⁺] from h² + Ka·h − Ka·C = 0, the quadratic every textbook solves. */
const weakAcidPH = (pKa: number, c: number) => {
  const ka = 10 ** -pKa;
  return -Math.log10((-ka + Math.sqrt(ka * ka + 4 * ka * c)) / 2);
};
/** The same for a weak base, in [OH⁻] with Kb = Kw/Ka. */
const weakBasePH = (pKa: number, c: number) => 14 - weakAcidPH(14 - pKa, c);

/** The model alone, stepped by `dt` until it stops; `each` sees the state. */
function measure(inputs: Record<string, number>, dt: number, each?: (s: Float64Array) => void) {
  const state = new Float64Array(phModel.variables.length);
  phModel.init(inputs, state);
  let runTime = 0;
  let last = dt;
  for (let i = 0; i < 1e7 && !phModel.isComplete!(state, inputs); i++) {
    last = phModel.step(state, dt, inputs);
    runTime += last;
    each?.(state);
  }
  return { state, runTime, last };
}

describe('pH theory: the charge balance of one acid–base pair, solved exactly', () => {
  it('gives a strong acid and a strong base the closed form of the titration model', () => {
    for (const c of [0.1, 0.01, 1e-4, 1e-7, 1e-8]) {
      const acid = { acidConcentration: c, acidVolume: 1, baseConcentration: 1, kw: KW };
      // Excess base −C: no acid, 2C of base in an equal volume.
      const base = { acidConcentration: 0, acidVolume: 1, baseConcentration: 2 * c, kw: KW };
      expect(pHOf({ pKa: HCL, concentration: c })).toBeCloseTo(titrationPH(acid, 0), 6);
      expect(pHOf({ pKa: NAOH, baseFraction: 1, concentration: c })).toBeCloseTo(
        titrationPH(base, 1),
        6,
      );
    }
    expect(pHOf({ pKa: HCL, concentration: 0.1 })).toBeCloseTo(1, 6);
    expect(pHOf({ pKa: NAOH, baseFraction: 1, concentration: 0.01 })).toBeCloseTo(12, 6);
    // Water's own ions count: 1e-8 mol/L HCl is pH 6.98, not 8 (Harris, Quantitative Chemical
    // Analysis). By hand: [H⁺] = (C + √(C² + 4Kw))/2 = 1.0512e-7 mol/L.
    expect(pHOf({ pKa: HCL, concentration: 1e-8 })).toBeCloseTo(6.9783, 4);
  });

  it('solves a weak acid and a weak base from Ka, not from √(Ka·C)', () => {
    // The quadratics drop water's own ions, worth at most 3e-6 pH at 0.0001 mol/L.
    for (const c of [0.1, 0.01, 0.001, 1e-4]) {
      expect(pHOf({ concentration: c })).toBeCloseTo(weakAcidPH(ETHANOIC, c), 5);
      expect(pHOf({ pKa: AMMONIUM, baseFraction: 1, concentration: c })).toBeCloseTo(
        weakBasePH(AMMONIUM, c),
        5,
      );
    }
    // Textbook values at 0.1 mol/L and 25 °C: ethanoic acid 2.88, ammonia 11.12, sodium
    // ethanoate 8.88.
    expect(pHOf({ concentration: 0.1 })).toBeCloseTo(2.88, 2);
    expect(pHOf({ pKa: AMMONIUM, baseFraction: 1 })).toBeCloseTo(11.12, 2);
    expect(pHOf({ baseFraction: 1 })).toBeCloseTo(8.88, 2);
    // NH₄Cl, so weak that water's ions count: [H⁺] = √(Ka·C + Kw), which drops only the
    // dissociated part, Ka/[H⁺] = 7.5e-5 of C: 1.6e-5 pH.
    expect(pHOf({ pKa: AMMONIUM })).toBeCloseTo(-0.5 * Math.log10(10 ** -9.25 * 0.1 + KW), 4);
    // At 0.0001 mol/L water's ions are a sixth of [H⁺]: 6.59, where √(Ka·C) alone gives 6.625.
    expect(pHOf({ pKa: AMMONIUM, concentration: 1e-4 })).toBeCloseTo(6.59, 2);
    expect(-0.5 * Math.log10(10 ** -9.25 * 1e-4)).toBeCloseTo(6.625, 3);
  });

  it('puts a 1 : 1 buffer at pKa, corrected for the ions it makes', () => {
    // [H⁺] = Ka·[HA]/[A⁻] = Ka·(C/2 − [H⁺] + [OH⁻])/(C/2 + [H⁺] − [OH⁻]), iterated from Ka.
    const ka = 10 ** -ETHANOIC;
    let h = ka;
    for (let i = 0; i < 50; i++) h = (ka * (0.05 - h + KW / h)) / (0.05 + h - KW / h);
    expect(pHOf({ baseFraction: 0.5 })).toBeCloseTo(-Math.log10(h), 9);
    expect(pHOf({ baseFraction: 0.5 })).toBeCloseTo(4.7603, 4); // Henderson–Hasselbalch: 4.76
    expect(pHOf({ pKa: AMMONIUM, baseFraction: 0.5 })).toBeCloseTo(9.25, 3);
    // Diluted to 0.0001 mol/L its own ions count: h² + (C/2 + Ka)·h − Ka·C/2 = 0 gives 4.956
    // (dropping [OH⁻], worth 1e-5 pH).
    const c2 = 5e-5;
    const hDilute = (-(c2 + ka) + Math.sqrt((c2 + ka) ** 2 + 4 * ka * c2)) / 2;
    expect(pHOf({ baseFraction: 0.5, concentration: 1e-4 })).toBeCloseTo(-Math.log10(hDilute), 4);
    expect(-Math.log10(hDilute)).toBeCloseTo(4.956, 3);
  });

  it('makes the acid form of HCl’s and NaOH’s pairs neutral: NaCl and water', () => {
    for (const c of DILUTIONS) {
      expect(pHOf({ pKa: HCL, baseFraction: 1, concentration: c })).toBeCloseTo(7, 6);
      expect(pHOf({ pKa: NAOH, baseFraction: 0, concentration: c })).toBeCloseTo(7, 6);
    }
    // Neutral is pKw/2: 6.5 when Kw is 1e-13.
    expect(pHOf({ pKa: HCL, baseFraction: 1, kw: 1e-13 })).toBeCloseTo(6.5, 6);
  });

  it('finds the one root of the cubic h³ + (Ka + nC)h² − (Ka(1 − n)C + Kw)h − Kw·Ka', () => {
    for (const pKa of [...PAIRS, -10, 0, 7, 14, 30]) {
      for (const n of [...FORMS, 0.1, 0.9]) {
        for (const c of [1, ...DILUTIONS, 1e-9]) {
          const ka = 10 ** -pKa;
          const h = 10 ** -pHOf({ pKa, baseFraction: n, concentration: c });
          // The cubic is the charge balance times h·(Ka + h); its terms set the scale of a zero.
          const terms = [h ** 3, (ka + n * c) * h * h, (ka * (1 - n) * c + KW) * h, KW * ka];
          const residual = terms[0]! + terms[1]! - terms[2]! - terms[3]!;
          expect(Math.abs(residual)).toBeLessThanOrEqual(1e-12 * Math.max(...terms));
        }
      }
    }
  });

  it('gives α: 1.3 % of 0.1 mol/L ethanoic acid dissociated, 34 % at 0.0001 (Ostwald)', () => {
    const alpha = (c: number) => phModel.predict!(inputsOf({ concentration: c })).ionization!;
    expect(alpha(0.1)).toBeCloseTo((100 * 10 ** -weakAcidPH(ETHANOIC, 0.1)) / 0.1, 6);
    expect(alpha(0.1)).toBeCloseTo(1.31, 2);
    expect(alpha(1e-4)).toBeCloseTo(33.9, 1);
    const all = (change: Record<string, number>) => phModel.predict!(inputsOf(change)).ionization!;
    expect(all({ pKa: HCL })).toBeCloseTo(100, 4);
    expect(all({ pKa: NAOH, baseFraction: 1 })).toBeCloseTo(100, 4);
    expect(all({ pKa: HCL, baseFraction: 1 })).toBeLessThan(1e-9); // NaCl: no reaction
    // Sodium ethanoate's hydrolysis: [OH⁻]/C = 7.59e-5, 0.0076 %.
    expect(all({ baseFraction: 1 })).toBeCloseTo(0.0076, 4);
  });

  it('is the charge balance: α = 100·|[H⁺] − [OH⁻]|/C at the root, for every setting', () => {
    for (const pKa of PAIRS) {
      for (const baseFraction of FORMS) {
        for (const concentration of DILUTIONS) {
          const t = phModel.predict!(inputsOf({ pKa, baseFraction, concentration }));
          const fromIons = (100 * Math.abs(t.hydrogenIon! - t.hydroxideIon!)) / concentration;
          expect(Math.abs(fromIons - t.ionization!)).toBeLessThanOrEqual(
            1e-5 * t.ionization! + 1e-13,
          );
          expect(t.hydrogenIon! * t.hydroxideIon!).toBeCloseTo(KW, 25);
        }
      }
    }
  });

  it('gives the Nernst slope ln10·R·T/F: 59.16 mV per pH at 25 °C, 0 mV at pH 7', () => {
    // CODATA 2018: R = 8.314462618 J/(mol·K), F = 96485.33212 C/mol.
    const slope = (theta: number) => (Math.log(10) * 8.314462618 * (theta + 273.15)) / 96485.33212;
    const t = phModel.predict!(inputsOf({ pKa: HCL, concentration: 0.1 }));
    expect(t.nernstSlope).toBeCloseTo(59.16, 2);
    expect(t.nernstSlope).toBeCloseTo(1000 * slope(25), 6);
    expect(t.potential).toBeCloseTo(1000 * slope(25) * 6, 4); // pH 1: +355 mV
    expect(phModel.predict!(inputsOf({ temperature: 0 })).nernstSlope).toBeCloseTo(54.2, 1);
    expect(phModel.predict!(inputsOf({ pKa: HCL, baseFraction: 1 })).potential).toBeCloseTo(0, 4);
  });
});

describe('pH against lg C: the textbook lines the analysis draws', () => {
  /** Exact pH change per tenfold change of C, between c/10 and c. */
  const exactSlope = (change: Record<string, number>, c: number) =>
    pHOf({ ...change, concentration: c }) - pHOf({ ...change, concentration: c / 10 });

  it('gives slope −1, −½, 0, +½, +1 by kind, met by the exact pH where it applies', () => {
    const cases: [Record<string, number>, number, number, number][] = [
      // [pair and form, limit slope, intercept, C where the approximation holds]
      [{ pKa: HCL }, -1, 0, 0.1],
      [{ pKa: HCL, baseFraction: 0.5 }, -1, Math.log10(2), 0.1],
      [{ pKa: HCL, baseFraction: 1 }, 0, 7, 0.1],
      [{ pKa: ETHANOIC }, -0.5, ETHANOIC / 2, 1],
      [{ pKa: ETHANOIC, baseFraction: 0.5 }, 0, ETHANOIC, 1],
      [{ pKa: ETHANOIC, baseFraction: 1 }, 0.5, (14 + ETHANOIC) / 2, 1],
      [{ pKa: AMMONIUM }, -0.5, AMMONIUM / 2, 1],
      [{ pKa: AMMONIUM, baseFraction: 1 }, 0.5, (14 + AMMONIUM) / 2, 1],
      [{ pKa: NAOH }, 0, 7, 0.1],
      [{ pKa: NAOH, baseFraction: 0.5 }, 1, 14 - Math.log10(2), 0.1],
      [{ pKa: NAOH, baseFraction: 1 }, 1, 14, 0.1],
    ];
    for (const [change, slope, intercept, c] of cases) {
      const t = phModel.predict!(inputsOf({ ...change, concentration: c }));
      expect([t.limitSlope, t.limitIntercept! + 0]).toEqual([slope, expect.closeTo(intercept, 9)]);
      expect(exactSlope(change, c)).toBeCloseTo(slope, 2);
      expect(t.approximatePH).toBeCloseTo(t.pH!, 2);
    }
  });

  it('never depends on C, so every run of one pair and form shares its line', () => {
    for (const pKa of PAIRS) {
      for (const baseFraction of FORMS) {
        const lines = DILUTIONS.map((concentration) => {
          const t = phModel.predict!(inputsOf({ pKa, baseFraction, concentration }));
          return [t.limitSlope, t.limitIntercept];
        });
        for (const line of lines) expect(line).toEqual(lines[0]);
      }
    }
  });

  it('fits HCl’s dilutions on its line; ethanoic acid’s steepen as it dissociates more', () => {
    const fit = (change: Record<string, number>) => {
      const line = fitLine(
        DILUTIONS.map((c) => ({ x: Math.log10(c), y: pHOf({ ...change, concentration: c }) })),
      );
      if (line.status !== 'fitted') throw new Error('no line');
      return line;
    };
    const hcl = fit({ pKa: HCL });
    expect(hcl.slope).toBeCloseTo(-1, 5);
    expect(hcl.intercept).toBeCloseTo(0, 5);
    // From 2.88 at 0.1 mol/L to 4.47 at 0.0001: −0.53 per decade, not −½.
    const ethanoic = fit({ pKa: ETHANOIC });
    expect(ethanoic.slope).toBeLessThan(-0.51);
    expect(ethanoic.slope).toBeGreaterThan(-0.56);
    expect(pHOf({ concentration: 1e-4 })).toBeCloseTo(4.47, 2);
    // The ethanoate buffer moves 0.2 over three decades, all of it where its own ions count.
    const buffer = fit({ baseFraction: 0.5 }).slope;
    expect(buffer).toBeLessThan(0);
    expect(buffer).toBeGreaterThan(-0.1);
  });
});

describe('pH run: the electrode settles to the solution’s pH, then the meter is read', () => {
  it('follows pH + (pH₀ − pH)·e^(−t/τ) at every step', () => {
    const inputs = inputsOf({ pKa: HCL });
    const pH = phModel.predict!(inputs).pH!; // 1 + 4e-8: HCl's pKa is finite
    let checked = 0;
    measure(inputs, 0.01, (s) => {
      const t = s[TIME]!;
      expect(s[READING]!).toBeCloseTo(pH + (7 - pH) * Math.exp(-t / TAU), 12);
      expect(s[POTENTIAL]!).toBeCloseTo(59.1593 * (7 - s[READING]!), 2);
      expect(s[HYDROGEN]!).toBeCloseTo(10 ** -s[READING]!, 15);
      checked++;
    });
    expect(checked).toBe(3000);
  });

  it('has moved 1 − 1/e of the way at τ and 95 % at τ·ln 20', () => {
    const inputs = inputsOf({ pKa: NAOH, baseFraction: 1, readTime: TAU });
    const change = phModel.predict!(inputs).pH! - 7; // +6 − 4e-8
    const atTau = measure(inputs, 0.01).state[READING]!;
    expect(atTau).toBeCloseTo(7 + change * (1 - Math.exp(-1)), 12);
    const t95 = phModel.predict!(inputs).responseTime!;
    expect(t95).toBeCloseTo(8.99, 2);
    const at95 = measure(inputsOf({ pKa: NAOH, baseFraction: 1, readTime: t95 }), 0.01).state;
    expect(at95[READING]).toBeCloseTo(7 + change * 0.95, 12);
  });

  it('ends exactly at the reading time, whatever the step, on the predicted reading', () => {
    const inputs = inputsOf({ pKa: AMMONIUM, baseFraction: 1, concentration: 0.001 });
    const theory = phModel.predict!(inputs);
    for (const dt of [0.001, 0.02, 0.07, 0.3, 7]) {
      const { state, runTime, last } = measure(inputs, dt);
      expect(state[TIME]).toBe(READ);
      expect(runTime).toBeCloseTo(READ, 9);
      expect(last).toBeLessThanOrEqual(dt);
      expect(state[READING]).toBeCloseTo(theory.finalReading!, 10);
    }
    // After 10τ the reading is within 6·e^(−10) = 2.7e-4 pH of the solution's.
    expect(Math.abs(theory.finalReading! - theory.pH!)).toBeLessThan(2.8e-4);
    const { state } = measure(inputs, 0.02);
    expect(phModel.step(state, 0.02, inputs)).toBe(0); // nothing after the reading
  });

  it('does not move for a neutral sample, and is deterministic', () => {
    const { state } = measure(inputsOf({ pKa: HCL, baseFraction: 1 }), 0.02);
    expect(state[READING]).toBeCloseTo(7, 7);
    const a = measure(inputsOf(), 0.02).state;
    const b = measure(inputsOf(), 0.02).state;
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe('pH inputs: refused with a reason, never clamped', () => {
  it('refuses missing, out-of-range and non-finite inputs', () => {
    const state = new Float64Array(phModel.variables.length);
    const missing: Record<string, number> = inputsOf();
    delete missing.pKa;
    expect(() => phModel.init(missing, state)).toThrow(/"pKa" is missing/);
    expect(() => phModel.predict!(inputsOf({ concentration: 0 }))).toThrow(/above 0/);
    expect(() => phModel.predict!(inputsOf({ concentration: 2 }))).toThrow(/at most 1 mol\/L/);
    expect(() => phModel.init(inputsOf({ baseFraction: 1.5 }), state)).toThrow(/baseFraction/);
    expect(() => phModel.init(inputsOf({ pKa: NaN }), state)).toThrow(/pKa/);
    expect(() => phModel.init(inputsOf({ timeConstant: 0 }), state)).toThrow(/timeConstant/);
    expect(() => phModel.init(inputsOf({ kw: Infinity }), state)).toThrow(/kw/);
  });

  it('solves the domain’s corners to a finite pH inside 0–16', () => {
    for (const pKa of [-10, 30]) {
      for (const baseFraction of [0, 1]) {
        for (const concentration of [1, 1e-12]) {
          for (const kw of [1e-16, 1e-12]) {
            const pH = solutionPH({ pKa, baseFraction, concentration, kw });
            expect(pH).toBeGreaterThanOrEqual(-0.01);
            expect(pH).toBeLessThanOrEqual(16);
          }
        }
      }
    }
  });
});

describe('pH in the experiment runtime', () => {
  const definition = ExperimentDefinitionSchema.parse({
    id: 'ph-test',
    name: 'pH',
    category: 'chemistry',
    model: 'acid-base.ph-measurement',
    parameters: [
      { id: 'pKa', label: 'pKa', unit: '', default: ETHANOIC, min: HCL, max: NAOH },
      { id: 'baseFraction', label: 'n', unit: '', default: 0, min: 0, max: 1 },
      { id: 'concentration', label: 'C', unit: 'mol/L', default: 0.1, min: 1e-4, max: 0.1 },
    ],
    initialConditions: { kw: KW, temperature: 25, timeConstant: TAU, readTime: READ, startPH: 7 },
    simulation: { timeStep: 0.02, maxDuration: 35, sampleInterval: 0.1 },
    measurements: [{ id: 'reading', label: 'pH', unit: 'pH', variable: 'reading' }],
    results: [
      { id: 'ph', label: 'pH', unit: 'pH', variable: 'reading', reduce: 'final', theory: 'pH' },
    ],
  });

  it('ends by itself after the reading time at every pair, form and dilution', () => {
    for (const pKa of PAIRS) {
      for (const baseFraction of FORMS) {
        for (const concentration of DILUTIONS) {
          const r = new ExperimentRuntime('t', definition, phModel, {
            pKa,
            baseFraction,
            concentration,
          });
          r.runToCompletion();
          expect([r.status, r.endReason]).toEqual(['completed', 'model']);
          expect(r.time).toBeCloseTo(READ, 9);
          expect(r.results!.ph).toBeCloseTo(r.theory()!.finalReading!, 10);
          expect(Math.abs(r.results!.ph! - r.theory()!.pH!)).toBeLessThan(3e-4);
        }
      }
    }
  });
});
