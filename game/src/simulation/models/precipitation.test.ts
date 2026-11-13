import { describe, expect, it } from 'vitest';
import { ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { fitLine } from '../fit';
import {
  PRECIPITATES,
  REACTIONS,
  REAGENTS,
  SAMPLES,
  precipitationModel as model,
} from './precipitation';

const V = model.variables.indexOf('volumeAdded');
const SAT = model.variables.indexOf('saturation');
const PRODUCT = model.variables.indexOf('product');
const N = model.variables.indexOf('precipitateAmount');
const MASS = model.variables.indexOf('precipitateMass');
const PERCENT = model.variables.indexOf('precipitatedPercent');

// Codes, by name, as the definition's presets give them.
const NACL = 0;
const KBR = 1;
const KI = 2;
const NA2SO4 = 3;
const CUSO4 = 4;
const FECL3 = 5;
const WATER = 6;
const AGNO3 = 0;
const BANO3 = 1;
const NAOH = 2;

/** The station's settings: 0.02 mol/L samples, 10 mL of 0.05 mol/L reagent at 0.5 mL/s. */
const inputsOf = (change: Record<string, number> = {}) => ({
  sample: NACL,
  reagent: AGNO3,
  sampleVolume: 5,
  sampleConcentration: 0.02,
  reagentConcentration: 0.05,
  reagentVolume: 10,
  flowRate: 0.5,
  ...change,
});

/** The model alone, stepped by `dt` until it stops; `each` sees the state. */
function run(inputs: Record<string, number>, dt: number, each?: (s: Float64Array) => void) {
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  let time = 0;
  for (let i = 0; i < 1e6 && !model.isComplete!(state, inputs); i++) {
    time += model.step(state, dt, inputs);
    each?.(state);
  }
  return { state, time };
}

/** The equilibrium after `volume` mL, read through the run itself (one step to that volume). */
function at(inputs: Record<string, number>, volume: number) {
  const state = new Float64Array(model.variables.length);
  const i = { ...inputs, reagentVolume: volume, flowRate: 5 };
  model.init(i, state);
  model.step(state, volume / 5, i);
  return state;
}

/** Hand values (IUPAC 2021 abridged standard atomic weights, g/mol). */
const ATOMIC = { Ag: 107.87, Cl: 35.45, Br: 79.904, I: 126.9, Ba: 137.33, S: 32.06, O: 15.999 };
const W = { ...ATOMIC, H: 1.008, Cu: 63.546, Fe: 55.845 };

describe('precipitation registry: a finite, checked set of reactions', () => {
  it('forms exactly the salts school qualitative analysis expects, and nothing else', () => {
    // Hand table: [sample][reagent] with silver nitrate, barium nitrate, sodium hydroxide.
    const expected: Record<string, (string | null)[]> = {
      NaCl: ['AgCl', null, null],
      KBr: ['AgBr', null, null],
      KI: ['AgI', null, null],
      Na2SO4: ['Ag2SO4', 'BaSO4', null],
      CuSO4: ['Ag2SO4', 'BaSO4', 'Cu(OH)2'],
      FeCl3: ['AgCl', null, 'Fe(OH)3'],
      H2O: [null, null, null],
    };
    const table = Object.fromEntries(
      SAMPLES.map((s, i) => [
        s.formula,
        REAGENTS.map((_, j) => PRECIPITATES[REACTIONS[i]![j]!]?.formula ?? null),
      ]),
    );
    expect(table).toEqual(expected);
    expect(REAGENTS.map((r) => r.formula)).toEqual(['AgNO3', 'Ba(NO3)2', 'NaOH']);
  });

  it('gives each precipitate its taught colour, cited Ksp and formula mass', () => {
    const rows = PRECIPITATES.map((p) => [p.formula, p.colour, p.ksp]);
    expect(rows).toEqual([
      ['AgCl', 'white', 1.77e-10],
      ['AgBr', 'cream', 5.35e-13],
      ['AgI', 'yellow', 8.52e-17],
      ['BaSO4', 'white', 1.08e-10],
      ['Ag2SO4', 'white', 1.2e-5],
      ['Cu(OH)2', 'pale blue', 2.2e-20],
      ['Fe(OH)3', 'red-brown', 2.79e-39],
    ]);
    const masses: Record<string, number> = {
      AgCl: W.Ag + W.Cl,
      AgBr: W.Ag + W.Br,
      AgI: W.Ag + W.I,
      BaSO4: W.Ba + W.S + 4 * W.O,
      Ag2SO4: 2 * W.Ag + W.S + 4 * W.O,
      'Cu(OH)2': W.Cu + 2 * (W.O + W.H),
      'Fe(OH)3': W.Fe + 3 * (W.O + W.H),
    };
    for (const p of PRECIPITATES) expect(p.molarMass).toBeCloseTo(masses[p.formula]!, 1);
  });

  it('is electrically neutral: salts, samples and reagents', () => {
    const charge: Record<string, number> = {
      'Na+': 1,
      'K+': 1,
      'Ag+': 1,
      'Ba2+': 2,
      'Cu2+': 2,
      'Fe3+': 3,
      'Cl-': -1,
      'Br-': -1,
      'I-': -1,
      'NO3-': -1,
      'OH-': -1,
      'SO4 2-': -2,
    };
    for (const p of PRECIPITATES) expect(p.a * charge[p.cation]! + p.b * charge[p.anion]!).toBe(0);
    for (const s of [...SAMPLES, ...REAGENTS]) {
      const total = Object.entries(s.ions).reduce((sum, [ion, k]) => sum + k * charge[ion]!, 0);
      expect([s.formula, total]).toEqual([s.formula, 0]);
    }
  });

  it('colours: white salts near white, the coloured ones by their hue', () => {
    const rgb = (formula: string) => {
      const c = PRECIPITATES.find((p) => p.formula === formula)!.rgb;
      return [(c >> 16) & 255, (c >> 8) & 255, c & 255] as const;
    };
    for (const f of ['AgCl', 'BaSO4', 'Ag2SO4']) expect(Math.min(...rgb(f))).toBeGreaterThan(230);
    const [cr, cg, cb] = rgb('AgBr'); // cream: pale, a little yellow
    expect(Math.min(cr, cg)).toBeGreaterThan(220);
    expect(cb).toBeLessThan(cg);
    const [ir, ig, ib] = rgb('AgI'); // yellow
    expect(Math.min(ir, ig) - ib).toBeGreaterThan(80);
    const [ur, , ub] = rgb('Cu(OH)2'); // pale blue
    expect(ub - ur).toBeGreaterThan(50);
    const [fr, fg, fb] = rgb('Fe(OH)3'); // red-brown: dark, red over green over blue
    expect(fr > fg && fg > fb && fr < 200).toBe(true);
  });
});

describe('precipitation theory against hand-worked equilibria', () => {
  it('silver chloride: the closed form of a 1:1 salt, in excess silver', () => {
    // A = 0.02·5/15, B = 0.05·10/15 mol/L; (A − ξ)(B − ξ) = Ksp, ξ the smaller root.
    const [a, b, k] = [0.1 / 15, 0.5 / 15, 1.77e-10];
    const xi = (a + b - Math.sqrt((a - b) ** 2 + 4 * k)) / 2;
    const t = model.predict!(inputsOf());
    expect(t.amount).toBeCloseTo(xi * 15, 15); // mmol
    expect(t.amount! / 0.1).toBeCloseTo(1, 5); // all but ~1e-6 of the chloride
    expect(t.mass).toBeCloseTo((0.1 * (W.Ag + W.Cl)) / 1000, 6); // 0.014332 g
    expect(t.precipitatedPercent).toBeCloseTo((100 * xi) / a, 9);
    expect([t.product, t.saturation]).toEqual([1, 1]);
    // What stays dissolved: [Cl⁻] = Ksp/[Ag⁺] with [Ag⁺] = (0.5 − 0.1)/15.
    const left = (0.1 - t.amount!) / 15;
    expect(left / (k / (0.4 / 15))).toBeCloseTo(1, 2);
  });

  it('silver chloride where Ksp matters: dilute solutions precipitate only in part', () => {
    const inputs = inputsOf({ sampleConcentration: 4e-5, reagentConcentration: 4e-5 });
    const [a, b, k] = [(4e-5 * 5) / 15, (4e-5 * 10) / 15, 1.77e-10];
    const xi = (a + b - Math.sqrt((a - b) ** 2 + 4 * k)) / 2;
    const t = model.predict!(inputs);
    expect(t.precipitatedPercent).toBeCloseTo((100 * xi) / a, 9);
    expect(t.precipitatedPercent).toBeCloseTo(38.4, 1);
    // Q of the dissolved ions is Ksp exactly.
    const [ag, cl] = [b - t.amount! / 15, a - t.amount! / 15];
    expect((ag * cl) / k).toBeCloseTo(1, 9);
    // Half as concentrated, Q = A·B < Ksp: nothing forms (the test's detection limit).
    const dilute = model.predict!(
      inputsOf({ sampleConcentration: 2e-5, reagentConcentration: 2e-5 }),
    );
    expect(dilute.saturation).toBeCloseTo((((2e-5 * 5) / 15) * ((2e-5 * 10) / 15)) / k, 12);
    expect([dilute.product, dilute.amount, dilute.mass, dilute.precipitatedPercent]).toEqual([
      0, 0, 0, 0,
    ]);
  });

  it('silver sulfate (2:1): partial precipitation at 0.1 mol/L solved by an independent bisection', () => {
    const inputs = inputsOf({
      sample: NA2SO4,
      sampleConcentration: 0.1,
      reagentConcentration: 0.1,
    });
    // (A − ξ)(B − 2ξ)² = Ksp in plain concentrations, bisected on ξ.
    const [a, b, k] = [0.5 / 15, 1 / 15, 1.2e-5];
    let [lo, hi] = [0, a];
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if ((a - mid) * (b - 2 * mid) ** 2 > k) lo = mid;
      else hi = mid;
    }
    const t = model.predict!(inputs);
    expect(t.product).toBe(5);
    expect(t.amount! / 15).toBeCloseTo(lo, 12);
    const [ag, so4] = [b - (2 * t.amount!) / 15, a - t.amount! / 15];
    expect((ag * ag * so4) / k).toBeCloseTo(1, 9);
    expect(t.mass! / ((t.amount! * (2 * W.Ag + W.S + 4 * W.O)) / 1000)).toBeCloseTo(1, 4);
  });

  it('silver sulfate never forms at the station: Q ≤ (4/27)·c_r²·c_s < Ksp', () => {
    // Q = c_r²·c_s·f²(1 − f) with f = V/(V_s + V), largest at f = 2/3 (V = 2·V_s).
    const most = ((4 / 27) * 0.05 ** 2 * 0.02) / 1.2e-5;
    expect(most).toBeCloseTo(0.6173, 4);
    for (const sample of [NA2SO4, CUSO4]) {
      for (const sampleVolume of [1, 2, 3, 4, 5]) {
        let largest = 0;
        run(inputsOf({ sample, sampleVolume }), 0.01, (s) => {
          expect([s[PRODUCT], s[N]]).toEqual([0, 0]);
          largest = Math.max(largest, s[SAT]!);
        });
        expect(largest).toBeLessThanOrEqual(most + 1e-12);
        expect(largest).toBeGreaterThan(most * 0.999); // the run passes V = 2·V_s
      }
    }
  });

  it('copper(II) hydroxide (1:2): two OH⁻ per Cu²⁺, all the copper once OH⁻ is in excess', () => {
    const inputs = inputsOf({ sample: CUSO4, reagent: NAOH });
    const t = model.predict!(inputs);
    expect(t.equivalenceVolume).toBeCloseTo(4, 12); // 2 × 0.1 mmol / 0.05 mol/L
    expect(t.amount).toBeCloseTo(0.1, 12);
    expect(t.mass).toBeCloseTo((0.1 * (W.Cu + 2 * (W.O + W.H))) / 1000, 6);
    const k = 2.2e-20;
    // Before equivalence OH⁻ limits: n = (c_r·V − [OH⁻]·V_t)/2, with what Ksp leaves dissolved,
    // [OH⁻] = √(Ksp/[Cu²⁺]), found by fixed-point iteration from n = c_r·V/2.
    for (const v of [0.5, 1, 2, 3.5]) {
      const vt = 5 + v;
      let n = (0.05 * v) / 2;
      for (let i = 0; i < 5; i++) n = (0.05 * v - Math.sqrt(k / ((0.1 - n) / vt)) * vt) / 2;
      const s = at(inputs, v);
      expect(s[N]! / n).toBeCloseTo(1, 12);
      expect(s[N]! / ((0.05 * v) / 2)).toBeLessThan(1); // below the ideal, by ~1e-7
      expect(s[PERCENT]).toBeCloseTo((100 * n) / 0.1, 9);
      expect([s[PRODUCT], s[SAT]]).toEqual([6, 1]);
    }
    // After it all but [Cu²⁺] = Ksp/[OH⁻]² of the copper, [OH⁻] = (c_r·V − 0.2 mmol)/V_t.
    for (const v of [4.5, 6, 10]) {
      const vt = 5 + v;
      const left = (k / ((0.05 * v - 0.2) / vt) ** 2) * vt; // mmol
      expect(0.1 - at(inputs, v)[N]!).toBeCloseTo(left, 15);
    }
  });

  it('iron(III) chloride: three chlorides for silver, three hydroxides for iron', () => {
    const silver = model.predict!(inputsOf({ sample: FECL3 }));
    expect(silver.product).toBe(1);
    expect(silver.equivalenceVolume).toBeCloseTo(6, 12); // 3 × 0.1 mmol of Cl⁻
    // All but Ksp/[Ag⁺] of the chloride: the stable small root of (A − ξ)(B − ξ) = Ksp.
    const [ca, ag] = [0.3 / 15, 0.5 / 15];
    const left = (2 * 1.77e-10) / (ag - ca + Math.sqrt((ag - ca) ** 2 + 4 * 1.77e-10));
    expect(0.3 - silver.amount!).toBeCloseTo(left * 15, 15);
    expect(silver.amountSlope).toBeCloseTo(0.06, 15); // 3·c_s
    const hydroxide = model.predict!(inputsOf({ sample: FECL3, reagent: NAOH }));
    expect(hydroxide.product).toBe(7);
    expect(hydroxide.equivalenceVolume).toBeCloseTo(6, 12);
    expect(hydroxide.amount).toBeCloseTo(0.1, 12);
    expect(hydroxide.mass).toBeCloseTo((0.1 * (W.Fe + 3 * (W.O + W.H))) / 1000, 6);
    // 3 mL: 0.15 mmol OH⁻ for 0.1 mmol Fe³⁺, less [OH⁻] = ∛(Ksp/[Fe³⁺]) ≈ 7.6e-13 mol/L of 8 mL.
    const oh = Math.cbrt(2.79e-39 / (0.05 / 8));
    expect(at(inputsOf({ sample: FECL3, reagent: NAOH }), 3)[N]).toBeCloseTo(
      (0.15 - oh * 8) / 3,
      15,
    );
  });

  it('halides and sulfate: one to one, the knee at c_s·V_s/c_r', () => {
    for (const [sample, reagent, code, molar, k] of [
      [NACL, AGNO3, 1, W.Ag + W.Cl, 1.77e-10],
      [KBR, AGNO3, 2, W.Ag + W.Br, 5.35e-13],
      [KI, AGNO3, 3, W.Ag + W.I, 8.52e-17],
      [NA2SO4, BANO3, 4, W.Ba + W.S + 4 * W.O, 1.08e-10],
      [CUSO4, BANO3, 4, W.Ba + W.S + 4 * W.O, 1.08e-10],
    ] as const) {
      const t = model.predict!(inputsOf({ sample, reagent, sampleVolume: 3 }));
      expect([t.product, t.saturation]).toEqual([code, 1]);
      expect(t.equivalenceVolume).toBeCloseTo((0.02 * 3) / 0.05, 12); // 1.2 mL
      // In excess reagent, what stays dissolved of the sample's ion is Ksp/[R]: the stable
      // small root of (A − ξ)(B − ξ) = Ksp, A − ξ = 2·Ksp/((B − A) + √((B − A)² + 4·Ksp)).
      const [a, b] = [0.06 / 13, 0.5 / 13];
      const left = (2 * k) / (b - a + Math.sqrt((b - a) ** 2 + 4 * k));
      expect(t.amount).toBeCloseTo((a - left) * 13, 15);
      expect(100 - t.precipitatedPercent!).toBeCloseTo((100 * left) / a, 12);
      expect(t.mass! / ((0.06 * molar) / 1000)).toBeCloseTo(1, 4);
    }
  });

  it('forms nothing where no salt can, the blank included: Ω = 0', () => {
    for (const [sample, reagent] of [
      [NACL, BANO3],
      [NACL, NAOH],
      [KBR, BANO3],
      [KI, NAOH],
      [NA2SO4, NAOH],
      [FECL3, BANO3],
      [CUSO4, AGNO3],
      [WATER, AGNO3],
      [WATER, BANO3],
      [WATER, NAOH],
    ] as const) {
      const t = model.predict!(inputsOf({ sample, reagent }));
      expect([t.product, t.amount, t.mass, t.precipitatedPercent]).toEqual([0, 0, 0, 0]);
      expect([t.amountSlope, t.amountIntercept]).toEqual([0, 0]);
    }
    expect(model.predict!(inputsOf({ sample: NACL, reagent: BANO3 })).saturation).toBe(0);
    expect(model.predict!(inputsOf({ sample: WATER })).equivalenceVolume).toBe(0);
    // Silver sulfate has a salt, so Q/Ksp is its own, below 1.
    const sulfate = model.predict!(inputsOf({ sample: CUSO4 }));
    expect(sulfate.saturation).toBeCloseTo(((0.5 / 15) ** 2 * (0.1 / 15)) / 1.2e-5, 12);
    expect(sulfate.equivalenceVolume).toBeCloseTo(4, 12); // stoichiometric, never reached
  });
});

describe('precipitation analysis: amount against sample volume', () => {
  it('gives a line of slope k_S·c_s/s through the origin, below it only by what Ksp leaves', () => {
    for (const [sample, reagent, slope] of [
      [NACL, AGNO3, 0.02],
      [KI, AGNO3, 0.02],
      [NA2SO4, BANO3, 0.02],
      [CUSO4, NAOH, 0.02],
      [FECL3, AGNO3, 0.06],
      [FECL3, NAOH, 0.02],
      [NACL, NAOH, 0],
      [CUSO4, AGNO3, 0],
    ] as const) {
      const theory = [1, 2, 3, 4, 5].map((v) =>
        model.predict!(inputsOf({ sample, reagent, sampleVolume: v })),
      );
      for (const t of theory) {
        expect([t.amountSlope, t.amountIntercept]).toEqual([slope, 0]);
      }
      const fit = fitLine(theory.map((t, i) => ({ x: i + 1, y: t.amount! })));
      if (fit.status !== 'fitted') throw new Error('no line');
      expect(fit.slope).toBeCloseTo(slope, 7);
      expect(fit.intercept).toBeCloseTo(0, 7);
    }
  });

  it('switches to the reagent-limited line, slope 0, when the reagent runs short', () => {
    // 2 mL of 0.05 mol/L NaOH for 5 mL of 0.02 mol/L CuSO4: OH⁻ limits, n = 0.1/2 mmol.
    const t = model.predict!(inputsOf({ sample: CUSO4, reagent: NAOH, reagentVolume: 2 }));
    expect([t.amountSlope, t.amountIntercept]).toEqual([0, 0.05]);
    expect(t.amount).toBeCloseTo(0.05, 7); // less [OH⁻] = √(Ksp/[Cu²⁺]) ≈ 1.8e-9 mol/L of 7 mL
    expect(t.precipitatedPercent).toBeCloseTo(50, 4);
  });
});

describe('precipitation run: reagent added at a steady rate, equilibrium at every volume', () => {
  it('follows the equilibrium at each volume, rising to the knee and flat after it', () => {
    const inputs = inputsOf({ sample: CUSO4, reagent: NAOH });
    let checked = 0;
    run(inputs, 0.02, (s) => {
      const v = s[V]!;
      // Ksp leaves at most ~2e-5 of the limiting ion dissolved (most at the knee).
      const ideal = Math.min((0.05 * v) / 2, 0.1);
      expect(s[N]! / ideal).toBeCloseTo(1, 4);
      expect(s[N]!).toBeLessThan(ideal);
      expect(s[MASS]).toBeCloseTo((s[N]! * 97.56) / 1000, 15);
      checked++;
    });
    expect(checked).toBeGreaterThanOrEqual(1000); // 10 mL at 0.5 mL/s in 0.02 s steps
  });

  it('ends exactly at the reagent volume, whatever the step, with the theory’s values', () => {
    const inputs = inputsOf({ sample: FECL3, reagent: NAOH, sampleVolume: 4 });
    const theory = model.predict!(inputs);
    for (const dt of [0.001, 0.02, 0.07, 0.3, 30]) {
      const { state, time } = run(inputs, dt);
      expect(state[V]).toBe(10);
      expect(time).toBeCloseTo(20, 9);
      expect([state[PRODUCT], state[N], state[MASS], state[PERCENT], state[SAT]]).toEqual([
        theory.product,
        theory.amount,
        theory.mass,
        theory.precipitatedPercent,
        theory.saturation,
      ]);
      expect(model.step(state, dt, inputs)).toBe(0);
    }
  });

  it('starts clear: no reagent, no precipitate; the first drop precipitates the insoluble salts', () => {
    const state = new Float64Array(model.variables.length);
    model.init(inputsOf({ sample: KI }), state);
    expect(Array.from(state)).toEqual([0, 0, 0, 0, 0, 0]);
    // 0.05 mL (one drop): Q ≈ 1e-6 ≫ 8.5e-17 for AgI.
    const drop = at(inputsOf({ sample: KI }), 0.05);
    expect([drop[PRODUCT], drop[SAT]]).toEqual([3, 1]);
    expect(drop[N]! / 0.0025).toBeCloseTo(1, 9);
  });

  it('is deterministic: two runs give the same bits', () => {
    const a = run(inputsOf({ sample: CUSO4, reagent: NAOH }), 0.02).state;
    const b = run(inputsOf({ sample: CUSO4, reagent: NAOH }), 0.02).state;
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe('precipitation inputs: refused with a reason, never clamped', () => {
  it('refuses missing, unknown and out-of-range inputs', () => {
    const state = new Float64Array(model.variables.length);
    const missing: Record<string, number> = inputsOf();
    delete missing.reagent;
    expect(() => model.init(missing, state)).toThrow(/"reagent" is missing/);
    expect(() => model.predict!(inputsOf({ sample: 7 }))).toThrow(/code from 0 to 6/);
    expect(() => model.predict!(inputsOf({ sample: 1.5 }))).toThrow(/"sample"/);
    expect(() => model.predict!(inputsOf({ reagent: -1 }))).toThrow(/AgNO3, Ba\(NO3\)2, NaOH/);
    expect(() => model.init(inputsOf({ sampleConcentration: 0.2 }), state)).toThrow(/0.1 mol/);
    expect(() => model.init(inputsOf({ reagentConcentration: 0 }), state)).toThrow(/above 0/);
    expect(() => model.init(inputsOf({ sampleVolume: NaN }), state)).toThrow(/sampleVolume/);
    expect(() => model.init(inputsOf({ reagentVolume: 31 }), state)).toThrow(/30 mL/);
    expect(() => model.init(inputsOf({ flowRate: 0 }), state)).toThrow(/flowRate/);
  });
});

describe('precipitation in the experiment runtime', () => {
  const definition = ExperimentDefinitionSchema.parse({
    id: 'precipitation-test',
    name: 'Precipitation',
    category: 'chemistry',
    model: 'chemistry.precipitation',
    parameters: [
      { id: 'sample', label: 'Sample', unit: '', default: 0, min: 0, max: 6 },
      { id: 'reagent', label: 'Reagent', unit: '', default: 0, min: 0, max: 2 },
      { id: 'sampleVolume', label: 'V_s', unit: 'mL', default: 5, min: 1, max: 5 },
    ],
    initialConditions: {
      sampleConcentration: 0.02,
      reagentConcentration: 0.05,
      reagentVolume: 10,
      flowRate: 0.5,
    },
    simulation: { timeStep: 0.02, maxDuration: 25, sampleInterval: 0.1 },
    measurements: [{ id: 'n', label: 'n', unit: 'mmol', variable: 'precipitateAmount' }],
    results: [
      {
        id: 'm',
        label: 'm',
        unit: 'g',
        variable: 'precipitateMass',
        reduce: 'final',
        theory: 'mass',
      },
    ],
  });

  it('ends by itself after 20 s for every pair, its result the theory’s', () => {
    for (let sample = 0; sample < SAMPLES.length; sample++) {
      for (let reagent = 0; reagent < REAGENTS.length; reagent++) {
        const r = new ExperimentRuntime('t', definition, model, { sample, reagent });
        r.runToCompletion();
        expect([r.status, r.endReason]).toEqual(['completed', 'model']);
        expect(r.time).toBeCloseTo(20, 9);
        expect(r.results!.m).toBe(r.theory()!.mass);
      }
    }
  });
});
