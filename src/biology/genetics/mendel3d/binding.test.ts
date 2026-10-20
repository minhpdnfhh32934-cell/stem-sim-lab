import { describe, expect, it } from 'vitest';
import {
  GenotypeError,
  cross,
  gametes,
  parseGenotype,
  phenotype,
  sampleOffspring,
  type Locus,
} from '../mendel';
import { mendelDraw } from '../mendelRun';
import { rng } from '../stats';
import { lociOf, type MendelState } from '../store';
import {
  FIELD_CAP,
  MENDEL_STEPS,
  MENDEL_TOTAL,
  STEP_SECONDS,
  fieldCapFor,
  fieldOf,
  fraction,
  fractionText,
  mendelModel3d,
  stepEnd,
  stepIndexAt,
  stepProgress,
} from './binding';
import { classLook, MENDEL_CLASS_TOKENS } from './look';
import { currentMendel } from './store';

const A: Locus = { letter: 'A', dominance: 'complete' };
const B: Locus = { letter: 'B', dominance: 'complete' };
const Ai: Locus = { letter: 'A', dominance: 'incomplete' };
const Bi: Locus = { letter: 'B', dominance: 'incomplete' };

const CROSSES: [string, string, Locus[]][] = [
  ['Aa', 'Aa', [A]],
  ['Aa', 'aa', [A]],
  ['AA', 'aa', [A]],
  ['Aa', 'Aa', [Ai]],
  ['AaBb', 'AaBb', [A, B]],
  ['AaBb', 'aabb', [A, B]],
  ['AABb', 'aaBb', [A, B]],
  ['AaBb', 'AaBb', [Ai, B]],
  ['AaBb', 'AaBb', [Ai, Bi]],
];

const mendel = (over: Partial<MendelState> = {}): MendelState => ({
  loci: 2,
  dominance: ['complete', 'complete'],
  p1: 'AaBb',
  p2: 'AaBb',
  n: 1000,
  seed: 7,
  ran: true,
  view3d: true,
  ...over,
});

describe('Mendel 3D model: every number from the lesson’s model', () => {
  it('gametes and their probabilities are gametes(); the board is cross().punnett', () => {
    for (const [p1, p2, loci] of CROSSES) {
      const m = mendelModel3d(p1, p2, loci);
      const c = cross(p1, p2, loci);
      expect(m.parents[0].gametes).toEqual(gametes(parseGenotype(p1, loci)));
      expect(m.parents[1].gametes).toEqual(gametes(parseGenotype(p2, loci)));
      expect(m.parents[0].pairs).toEqual(parseGenotype(p1, loci));
      expect(m.punnett).toEqual(c.punnett);
      expect(m.punnett.rows).toEqual(m.parents[0].gametes.map((g) => g.gamete));
      expect(m.punnett.cols).toEqual(m.parents[1].gametes.map((g) => g.gamete));
      // Each cell's probability is its two gametes' product; together they make 1.
      let total = 0;
      m.cellP.forEach((row, i) => {
        row.forEach((p, j) => {
          expect(p).toBe((m.parents[0].gametes[i]?.p ?? 0) * (m.parents[1].gametes[j]?.p ?? 0));
          total += p;
        });
      });
      expect(total).toBeCloseTo(1, 12);
    }
  });

  it('phenotype classes, their probabilities, cells and genotypes come from cross() and phenotype()', () => {
    for (const [p1, p2, loci] of CROSSES) {
      const m = mendelModel3d(p1, p2, loci);
      const c = cross(p1, p2, loci);
      const keys = [...c.phenotypes.keys()].sort();
      expect(m.classes.map((k) => k.key)).toEqual(keys);
      for (const cls of m.classes) {
        expect(cls.p).toBe(c.phenotypes.get(cls.key));
        expect(cls.genotypes.reduce((s, g) => s + g.p, 0)).toBeCloseTo(cls.p, 12);
        for (const g of cls.genotypes) {
          expect(phenotype(g.genotype, loci)).toBe(cls.key);
          expect(g.p).toBe(c.genotypes.get(g.genotype));
        }
        for (const cell of cls.cells) expect(m.cellClass[cell.row]?.[cell.col]).toBe(cls.index);
      }
      m.punnett.cells.forEach((row, i) => {
        row.forEach((cell, j) => {
          expect(m.classes[m.cellClass[i]?.[j] ?? -1]?.key).toBe(phenotype(cell, loci));
        });
      });
      expect(m.genotypes.map((g) => g.genotype)).toEqual([...c.genotypes.keys()].sort());
    }
  });

  it('the reduced ratios are the 2D page’s', () => {
    expect(mendelModel3d('AaBb', 'AaBb', [A, B]).ratioText).toBe('9 : 3 : 3 : 1');
    expect(mendelModel3d('Aa', 'Aa', [A]).ratioText).toBe('3 : 1');
    expect(mendelModel3d('Aa', 'aa', [A]).ratioText).toBe('1 : 1');
    // Incomplete dominance: AA, Aa and aa are three classes.
    const inc = mendelModel3d('Aa', 'Aa', [Ai]);
    expect(inc.classes.map((c) => c.key)).toEqual(['AA', 'Aa', 'aa']);
    expect(inc.ratioText).toBe('1 : 2 : 1');
    expect(mendelModel3d('Aa', 'Aa', [A]).genotypeRatioText).toBe('1 AA : 2 Aa : 1 aa');
    expect(mendelModel3d('AaBb', 'AaBb', [Ai, Bi]).classes).toHaveLength(9);
  });

  it('a genotype the model cannot read: its GenotypeError', () => {
    expect(() => mendelModel3d('AaBb', 'Aa', [A])).toThrow(GenotypeError);
    const read = currentMendel({
      p1: 'AaBb',
      p2: 'Aa',
      loci: 1,
      dominance: ['complete', 'complete'],
    });
    expect(read).toEqual({ ok: false, error: '"AaBb" needs 2 letters' });
    const ok = currentMendel({ p1: 'Aa', p2: 'Aa', loci: 1, dominance: ['complete', 'complete'] });
    expect(ok.ok && ok.model.ratioText).toBe('3 : 1');
  });

  it('probabilities as reduced fractions', () => {
    expect(fraction(9 / 16)).toEqual({ num: 9, den: 16 });
    expect(fraction(0.25)).toEqual({ num: 1, den: 4 });
    expect(fraction(2 / 16)).toEqual({ num: 1, den: 8 });
    expect(fraction(1)).toEqual({ num: 1, den: 1 });
    expect(fraction(0)).toEqual({ num: 0, den: 1 });
    expect(fractionText(27 / 64)).toBe('27/64');
    expect(fractionText(1)).toBe('1');
    expect(fractionText(1 / 4096, (n) => n.toLocaleString('vi-VN'))).toBe('1/4.096');
  });

  it('phenotype classes: the 2D table’s colours first, and no two classes look alike', () => {
    expect(MENDEL_CLASS_TOKENS.slice(0, 5)).toEqual([
      '--chart-1',
      '--chart-2',
      '--chart-3',
      '--chart-5',
      '--chart-6',
    ]);
    const looks = Array.from({ length: 9 }, (_, i) => classLook(i));
    expect(new Set(looks.map((l) => `${l.token}|${l.shape}`)).size).toBe(9);
    // The first seven also differ in colour alone and in shape alone.
    expect(new Set(looks.slice(0, 7).map((l) => l.token)).size).toBe(7);
    expect(new Set(looks.slice(0, 7).map((l) => l.shape)).size).toBe(7);
  });
});

describe('the four illustrative steps', () => {
  it('a step’s button shows it complete; the strip follows the clock', () => {
    expect(MENDEL_STEPS).toEqual(['meiosis', 'gametes', 'fertilisation', 'offspring']);
    expect(MENDEL_TOTAL).toBe(4 * STEP_SECONDS);
    expect(stepIndexAt(0)).toBe(0);
    MENDEL_STEPS.forEach((_, k) => {
      expect(stepIndexAt(stepEnd(k))).toBe(k);
      expect(stepProgress(stepEnd(k), k)).toBe(1);
      if (k < 3) expect(stepIndexAt(stepEnd(k) + 0.01)).toBe(k + 1);
    });
    expect(stepIndexAt(MENDEL_TOTAL + 5)).toBe(3);
    expect(stepEnd(9)).toBe(MENDEL_TOTAL);
    expect(stepProgress(STEP_SECONDS * 1.5, 1)).toBeCloseTo(0.5, 12);
  });
});

describe('the random offspring field', () => {
  it('counts are the 2D table’s: sampleOffspring(p1, p2, loci, n, rng(seed)) in class order', () => {
    for (const seed of [1, 2, 3, 42]) {
      const st = mendel({ seed });
      const draw = mendelDraw(st);
      const m = mendelModel3d(st.p1, st.p2, lociOf(st));
      const direct = sampleOffspring(st.p1, st.p2, lociOf(st), st.n, rng(seed));
      expect(draw?.obs).toEqual(m.classes.map((c) => direct.get(c.key) ?? 0));
      const f = fieldOf(m, draw);
      expect(f?.counts).toEqual(draw?.obs);
      expect(f?.n).toBe(1000);
    }
    expect(mendelDraw(mendel({ ran: false }))).toBeNull();
    expect(fieldOf(mendelModel3d('AaBb', 'AaBb', [A, B]), null)).toBeNull();
    // A draw of another cross is not shown.
    const other = mendelDraw(mendel({ loci: 1, p1: 'Aa', p2: 'Aa' }));
    expect(fieldOf(mendelModel3d('AaBb', 'AaBb', [A, B]), other)).toBeNull();
  });

  it('more offspring than figures: one figure per k (1, 2, 5 × 10ⁿ), classes add up', () => {
    const m = mendelModel3d('AaBb', 'AaBb', [A, B]);
    const cases: [number, number, number][] = [
      [16, 1, 16],
      [100, 1, 100],
      [1000, 5, 200],
      [10000, 50, 200],
    ];
    for (const [n, per, total] of cases) {
      const f = fieldOf(m, mendelDraw(mendel({ n, seed: 5 })));
      expect(f?.per, `n = ${String(n)}`).toBe(per);
      expect(f?.figures.reduce((s, v) => s + v, 0)).toBe(total);
      expect((f?.figures.reduce((s, v) => s + v, 0) ?? 0) <= FIELD_CAP).toBe(true);
      // Each class: its count / k, rounded down or up (largest remainders).
      f?.figures.forEach((fig, i) => {
        const q = (f.counts[i] ?? 0) / per;
        expect(fig).toBeGreaterThanOrEqual(Math.floor(q));
        expect(fig).toBeLessThanOrEqual(Math.ceil(q));
      });
    }
    expect(fieldCapFor(600)).toBe(FIELD_CAP);
    expect(fieldCapFor(150)).toBe(150);
  });
});
