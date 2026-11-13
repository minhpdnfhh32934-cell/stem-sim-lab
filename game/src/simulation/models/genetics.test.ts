import { describe, expect, it } from 'vitest';
import { ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { fitLine } from '../fit';
import { chiSquareTail, geneticsModel, offspringGenotype, seedBits } from './genetics';

const slot = (variable: string) => geneticsModel.variables.indexOf(variable);
const CLASSES = ['yellowRound', 'yellowWrinkled', 'greenRound', 'greenWrinkled'].map(slot);
const COUNTED = slot('counted');
const ELAPSED = slot('elapsed');

const T = 10;
const CODES = [0, 1, 2, 10, 11, 12, 20, 21, 22];

const inputsOf = (change: Record<string, number> = {}) => ({
  parent1: 11,
  parent2: 11,
  offspring: 556,
  sample: 1,
  countTime: T,
  ...change,
});

/** The model alone, stepped by `dt` until it stops; `each` sees the state after each step. */
function count(inputs: Record<string, number>, dt: number, each?: (s: Float64Array) => void) {
  const state = new Float64Array(geneticsModel.variables.length);
  geneticsModel.init(inputs, state);
  let runTime = 0;
  for (let i = 0; i < 1e7 && !geneticsModel.isComplete!(state, inputs); i++) {
    runTime += geneticsModel.step(state, dt, inputs);
    each?.(state);
  }
  return { state, runTime };
}

/** A genotype code as letters, built independently of the model: 11 → "YyRr", 2 → "yyRR". */
const letters = (code: number) =>
  ['yy', 'Yy', 'YY'][Math.floor(code / 10)]! + ['rr', 'Rr', 'RR'][code % 10]!;

/** The 4 gametes of a parent, one per (Y-gene allele, R-gene allele) pair: equally likely. */
const gametes = (g: string) => [g[0]! + g[2]!, g[0]! + g[3]!, g[1]! + g[2]!, g[1]! + g[3]!];

/** The 16 cells of the Punnett square, each as a genotype code (dominant alleles counted). */
function punnett(parent1: number, parent2: number): number[] {
  const cells: number[] = [];
  for (const a of gametes(letters(parent1))) {
    for (const b of gametes(letters(parent2))) {
      const child = a + b;
      cells.push(10 * (child.split('Y').length - 1) + (child.split('R').length - 1));
    }
  }
  return cells;
}

/** Phenotype class of a genotype code: 0 yellow round, 1 yellow wrinkled, 2 green round, 3 green wrinkled. */
const phenotype = (code: number) => (code >= 10 ? 0 : 2) + (code % 10 > 0 ? 0 : 1);

/**
 * Q(a, x), the regularised upper incomplete gamma, by its power series (every term positive):
 * P(a, x) = x^a·e^(−x)·Σ x^n/Γ(a + n + 1); Q(χ² | ν) = Q(ν/2, χ²/2). Independent of the model's
 * closed forms and of its erfc.
 */
function gammaQ(a: number, x: number): number {
  const gammaA1 = new Map([
    [0.5, Math.sqrt(Math.PI) / 2],
    [1, 1],
    [1.5, (3 * Math.sqrt(Math.PI)) / 4],
  ]).get(a)!;
  let term = 1 / gammaA1;
  let sum = term;
  for (let n = 1; n < 5000 && term > 1e-18 * sum; n++) {
    term *= x / (a + n);
    sum += term;
  }
  return 1 - x ** a * Math.exp(-x) * sum;
}

/** Pearson's χ² of counts against probabilities, over the classes that can occur. */
function pearson(observed: number[], probabilities: number[]) {
  const n = observed.reduce((s, o) => s + o, 0);
  let chi = 0;
  let classes = 0;
  observed.forEach((o, i) => {
    const p = probabilities[i]!;
    if (p === 0) return;
    chi += (o - n * p) ** 2 / (n * p);
    classes++;
  });
  return { chi, df: classes - 1 };
}

describe('genetics theory: Mendel’s laws from the Punnett square', () => {
  it('gives every class the share of its Punnett cells, for all 81 crosses', () => {
    for (const parent1 of CODES) {
      for (const parent2 of CODES) {
        const share = [0, 0, 0, 0];
        for (const cell of punnett(parent1, parent2)) share[phenotype(cell)]! += 1 / 16;
        const t = geneticsModel.predict!(inputsOf({ parent1, parent2 }));
        expect([
          t.probabilityYellowRound,
          t.probabilityYellowWrinkled,
          t.probabilityGreenRound,
          t.probabilityGreenWrinkled,
        ]).toEqual(share);
        expect(t.probabilityYellow).toBe(share[0]! + share[1]!);
        expect(t.probabilityRound).toBe(share[0]! + share[2]!);
        expect(t.degreesOfFreedom).toBe(share.filter((p) => p > 0).length - 1);
      }
    }
  });

  it('maps the 16 bit patterns onto the 16 cells of the Punnett square', () => {
    for (const parent1 of CODES) {
      for (const parent2 of CODES) {
        const fromBits = Array.from({ length: 16 }, (_, bits) =>
          offspringGenotype(parent1, parent2, bits),
        );
        expect(fromBits.sort((a, b) => a - b)).toEqual(
          punnett(parent1, parent2).sort((a, b) => a - b),
        );
      }
    }
  });

  it('gives Mendel’s ratios: 9:3:3:1, the test cross 1:1:1:1, 3:1, and a uniform F1', () => {
    const ratio = (parent1: number, parent2: number) => {
      const t = geneticsModel.predict!(inputsOf({ parent1, parent2, offspring: 16 }));
      return [
        t.expectedYellowRound,
        t.expectedYellowWrinkled,
        t.expectedGreenRound,
        t.expectedGreenWrinkled,
      ];
    };
    expect(ratio(11, 11)).toEqual([9, 3, 3, 1]); // F1 selfed: YyRr × YyRr
    expect(ratio(11, 0)).toEqual([4, 4, 4, 4]); // test cross: YyRr × yyrr
    expect(ratio(12, 12)).toEqual([12, 0, 4, 0]); // one gene: Yy × Yy, 3:1
    expect(ratio(12, 2)).toEqual([8, 0, 8, 0]); // Yy × yy, 1:1
    expect(ratio(22, 0)).toEqual([16, 0, 0, 0]); // P: YYRR × yyrr, all YyRr
    expect(ratio(20, 2)).toEqual([16, 0, 0, 0]); // P: YYrr × yyRR, all YyRr too
    // The F2 genotypes come 1:2:1:2:4:2:1:2:1 (YYRR, YYRr, YYrr, YyRR, … yyrr).
    const genotypes = Array.from({ length: 16 }, (_, b) => offspringGenotype(11, 11, b));
    const tally = [22, 21, 20, 12, 11, 10, 2, 1, 0].map(
      (g) => genotypes.filter((x) => x === g).length,
    );
    expect(tally).toEqual([1, 2, 1, 2, 4, 2, 1, 2, 1]);
  });

  it('multiplies the traits (independent assortment): P(yellow round) = P(yellow)·P(round)', () => {
    const t = geneticsModel.predict!(inputsOf({ parent1: 11, parent2: 10 }));
    expect([t.probabilityYellow, t.probabilityRound]).toEqual([0.75, 0.5]);
    expect(t.probabilityYellowRound).toBe(0.375);
    expect(t.expectedYellow).toBe(417); // 556 × 3/4
    expect(t.smallestExpected).toBe(556 / 8);
  });
});

describe('genetics χ² test: the tail probability Q(χ² | ν)', () => {
  it('matches the incomplete gamma series to 3e-7 for ν = 1, 2, 3', () => {
    for (const df of [1, 2, 3]) {
      for (const x of [0, 0.01, 0.1, 0.47, 1, 2, 3.84, 5, 7.8, 10, 15, 20, 30]) {
        expect(Math.abs(chiSquareTail(x, df) - gammaQ(df / 2, x / 2))).toBeLessThan(3e-7);
      }
    }
  });

  it('gives 0.05 and 0.01 at the tabulated critical values (NIST/SEMATECH 1.3.6.7.4)', () => {
    expect(chiSquareTail(3.841458820694124, 1)).toBeCloseTo(0.05, 6);
    expect(chiSquareTail(5.991464547107979, 2)).toBeCloseTo(0.05, 12); // −2 ln 0.05
    expect(chiSquareTail(7.814727903251178, 3)).toBeCloseTo(0.05, 6);
    expect(chiSquareTail(6.6348966010212145, 1)).toBeCloseTo(0.01, 6);
    expect(chiSquareTail(11.344866730144373, 3)).toBeCloseTo(0.01, 6);
    expect(chiSquareTail(2, 1)).toBeCloseTo(0.157299207050285, 6); // erfc(1)
    expect(chiSquareTail(0, 3)).toBeCloseTo(1, 6);
    expect(chiSquareTail(0, 0)).toBe(1);
    expect(chiSquareTail(NaN, 3)).toBeNaN();
  });

  it('finds Mendel’s own dihybrid F2 (315 : 101 : 108 : 32) consistent with 9:3:3:1', () => {
    const { chi, df } = pearson([315, 101, 108, 32], [9 / 16, 3 / 16, 3 / 16, 1 / 16]);
    expect(chi).toBeCloseTo(0.470024, 6); // the χ² textbooks quote, 0.47
    expect(df).toBe(3);
    const p = chiSquareTail(chi, df);
    // Between the table's 0.584 (p = 0.90) and 0.352 (p = 0.95) for ν = 3.
    expect(p).toBeGreaterThan(0.9);
    expect(p).toBeLessThan(0.95);
    expect(p).toBeCloseTo(gammaQ(1.5, chi / 2), 6);
    // And his seed colours, 6022 yellow : 2001 green, against 3:1: χ² ≈ 0.015, p ≈ 0.90.
    const colour = pearson([6022, 2001], [0.75, 0.25]);
    expect(colour.chi).toBeCloseTo(0.014998, 5);
    expect(chiSquareTail(colour.chi, 1)).toBeCloseTo(gammaQ(0.5, colour.chi / 2), 6);
  });
});

describe('genetics sampling: a seeded generator, fair and reproducible', () => {
  it('gives the 16 meiosis patterns equally often (χ² over 64 184 seeds)', () => {
    const tally = new Array<number>(16).fill(0);
    for (let sample = 1; sample <= 8; sample++) {
      for (let k = 1; k <= 8023; k++) tally[seedBits(sample, k) & 15]! += 1;
    }
    const total = 8 * 8023;
    const { chi } = pearson(tally, new Array<number>(16).fill(1 / 16));
    expect(tally.reduce((s, v) => s + v, 0)).toBe(total);
    expect(chi).toBeLessThan(37.7); // χ² for ν = 15 at p = 0.001
  });

  it('is the same seed k whatever N, the step or the frame', () => {
    expect(seedBits(3, 80)).toBe(seedBits(3, 80));
    expect(seedBits(3, 80)).not.toBe(seedBits(4, 80));
    let at80: number[] | null = null;
    count(inputsOf({ sample: 3 }), 0.001, (s) => {
      if (s[COUNTED] === 80 && !at80) at80 = CLASSES.map((c) => s[c]!);
    });
    const { state } = count(inputsOf({ sample: 3, offspring: 80 }), 0.02);
    expect(CLASSES.map((c) => state[c]!)).toEqual(at80);
  });

  it('scatters about N·p within 4σ, over 8 samples of 8023 seeds', () => {
    const p = [9 / 16, 3 / 16, 3 / 16, 1 / 16];
    for (let sample = 1; sample <= 8; sample++) {
      const { state } = count(inputsOf({ sample, offspring: 8023 }), T);
      CLASSES.forEach((c, i) => {
        const mean = 8023 * p[i]!;
        expect(Math.abs(state[c]! - mean)).toBeLessThan(4 * Math.sqrt(mean * (1 - p[i]!)));
      });
    }
  });

  it('rejects the true ratio at p ≤ 0.05 in about 1 sample in 20', () => {
    let rejected = 0;
    for (let sample = 1; sample <= 400; sample++) {
      const { state } = count(inputsOf({ parent1: 11, parent2: 0, sample }), T);
      if (state[slot('pValue')]! <= 0.05) rejected++;
    }
    expect(rejected).toBeGreaterThan(7); // binomial(400, 0.05): 20 ± 4.4
    expect(rejected).toBeLessThan(34);
  });
});

describe('genetics run: seeds counted one by one, then stopped at T', () => {
  it('counts the first seed at once, every value finite before it (no seed: −1)', () => {
    const inputs = inputsOf({ offspring: 16 });
    const state = new Float64Array(geneticsModel.variables.length);
    geneticsModel.init(inputs, state);
    expect(state[COUNTED]).toBe(0);
    expect(
      ['yellowProportion', 'roundProportion', 'chiSquare', 'pValue', 'lastGenotype'].map(
        (v) => state[slot(v)],
      ),
    ).toEqual([0, 0, 0, 1, -1]);
    geneticsModel.step(state, 0.02, inputs);
    expect(state[COUNTED]).toBe(1);
    expect(Array.from(state).every(Number.isFinite)).toBe(true);
  });

  it('ends at T with the same counts whatever the step', () => {
    const inputs = inputsOf({ offspring: 8023, sample: 5 });
    const finals = [0.001, 0.02, 0.07, 0.3, 7, 20].map((dt) => {
      const { state, runTime } = count(inputs, dt);
      expect(state[ELAPSED]).toBe(T);
      expect(runTime).toBeCloseTo(T, 9);
      return Array.from(state);
    });
    for (const f of finals) expect(f).toEqual(finals[0]);
    const { state } = count(inputs, 0.02);
    expect(geneticsModel.step(state, 0.02, inputs)).toBe(0); // nothing after T
  });

  it('keeps its totals, proportions and χ² true to its own counts', () => {
    const crosses: [number, number][] = [
      [11, 11],
      [11, 0],
      [12, 12],
      [21, 10],
    ];
    for (const [parent1, parent2] of crosses) {
      const inputs = inputsOf({ parent1, parent2, sample: 7 });
      const t = geneticsModel.predict!(inputs);
      count(inputs, 0.05, (s) => {
        const o = CLASSES.map((c) => s[c]!);
        const n = s[COUNTED]!;
        expect(o.reduce((a, b) => a + b, 0)).toBe(n);
        expect(s[slot('yellow')]).toBe(o[0]! + o[1]!);
        expect(s[slot('round')]).toBe(o[0]! + o[2]!);
        expect(s[slot('yellowProportion')]).toBe((o[0]! + o[1]!) / n);
        const { chi, df } = pearson(o, [
          t.probabilityYellowRound!,
          t.probabilityYellowWrinkled!,
          t.probabilityGreenRound!,
          t.probabilityGreenWrinkled!,
        ]);
        expect(s[slot('chiSquare')]).toBeCloseTo(chi, 9);
        expect(s[slot('degreesOfFreedom')]).toBe(df);
        expect(s[slot('pValue')]).toBe(chiSquareTail(s[slot('chiSquare')]!, df));
        expect(s[slot('smallestExpected')]).toBe((n * t.smallestExpected!) / 556);
      });
    }
  });

  it('ends with all N seeds, the last one’s genotype shown', () => {
    const inputs = inputsOf({ parent1: 21, parent2: 1, sample: 2 });
    const { state } = count(inputs, 0.02);
    expect(state[COUNTED]).toBe(556);
    expect(state[slot('lastGenotype')]).toBe(offspringGenotype(21, 1, seedBits(2, 556)));
  });

  it('gives a uniform F1 with χ² 0, ν 0 and p 1', () => {
    const { state } = count(inputsOf({ parent1: 22, parent2: 0 }), 0.02);
    expect(CLASSES.map((c) => state[c])).toEqual([556, 0, 0, 0]);
    expect([
      state[slot('chiSquare')],
      state[slot('degreesOfFreedom')],
      state[slot('pValue')],
    ]).toEqual([0, 0, 1]);
  });

  it('is deterministic, and another sample gives other counts', () => {
    const a = count(inputsOf(), 0.02).state;
    const b = count(inputsOf(), 0.02).state;
    expect(Array.from(a)).toEqual(Array.from(b));
    const c = count(inputsOf({ sample: 2 }), 0.02).state;
    expect(CLASSES.map((s) => c[s])).not.toEqual(CLASSES.map((s) => a[s]));
  });
});

describe('genetics inputs: refused with a reason, never clamped', () => {
  it('refuses missing, impossible and non-finite inputs', () => {
    const state = new Float64Array(geneticsModel.variables.length);
    const missing: Record<string, number> = inputsOf();
    delete missing.sample;
    expect(() => geneticsModel.init(missing, state)).toThrow(/"sample" is missing/);
    for (const parent1 of [-1, 3, 13, 23, 1.5, NaN]) {
      expect(() => geneticsModel.predict!(inputsOf({ parent1 }))).toThrow(
        /"parent1" must be a genotype/,
      );
    }
    expect(() => geneticsModel.predict!(inputsOf({ parent2: 9 }))).toThrow(/"parent2"/);
    for (const offspring of [0, 2.5, 2e6, Infinity]) {
      expect(() => geneticsModel.init(inputsOf({ offspring }), state)).toThrow(/"offspring"/);
    }
    for (const sample of [-1, 0.5, 2 ** 32]) {
      expect(() => geneticsModel.init(inputsOf({ sample }), state)).toThrow(/"sample"/);
    }
    expect(() => geneticsModel.init(inputsOf({ countTime: 0 }), state)).toThrow(/"countTime"/);
  });

  it('accepts the extremes: one seed, sample 0 and 2³² − 1', () => {
    for (const change of [{ offspring: 1 }, { sample: 0 }, { sample: 2 ** 32 - 1 }]) {
      const { state } = count(inputsOf(change), 0.02);
      expect(Array.from(state).every(Number.isFinite)).toBe(true);
    }
  });
});

describe('genetics in the experiment runtime', () => {
  const definition = ExperimentDefinitionSchema.parse({
    id: 'genetics-test',
    name: 'Genetics',
    category: 'biology',
    model: 'biology.genetics',
    parameters: [
      { id: 'parent1', label: 'P1', unit: '', default: 11, min: 0, max: 22 },
      { id: 'parent2', label: 'P2', unit: '', default: 11, min: 0, max: 22 },
      { id: 'offspring', label: 'N', unit: '', default: 556, min: 1, max: 10000 },
      { id: 'sample', label: 'S', unit: '', default: 1, min: 1, max: 8 },
    ],
    initialConditions: { countTime: T },
    simulation: { timeStep: 0.02, maxDuration: 12, sampleInterval: 0.05 },
    measurements: [{ id: 'counted', label: 'n', unit: '', variable: 'counted' }],
    results: [
      {
        id: 'yellow',
        label: 'Yellow',
        unit: '',
        variable: 'yellow',
        reduce: 'final',
        theory: 'expectedYellow',
      },
    ],
  });

  it('ends by itself at T, and runs over N recover P(yellow) as their slope', () => {
    const points: { x: number; y: number }[] = [];
    for (const offspring of [16, 80, 556, 8023]) {
      for (const sample of [1, 2, 3, 4]) {
        const r = new ExperimentRuntime('t', definition, geneticsModel, { offspring, sample });
        r.runToCompletion();
        expect([r.status, r.endReason]).toEqual(['completed', 'model']);
        expect(r.time).toBeCloseTo(T, 9);
        expect(r.theory()!.expectedYellow).toBe(0.75 * offspring);
        points.push({ x: offspring, y: r.results!.yellow! });
      }
    }
    const fit = fitLine(points);
    if (fit.status !== 'fitted') throw new Error('no line');
    expect(Math.abs(fit.slope - 0.75)).toBeLessThan(4 * fit.slopeError!);
  });
});
