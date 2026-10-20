/**
 * Numbers of the 3D view of "Di truyền Mendel" (pure, tested against the lesson's model).
 * Everything the picture shows comes from `mendel.ts`: each parent's homologous pairs
 * (`parseGenotype`: one pair per locus — the genes assort independently, no linkage), its
 * gametes with their exact probabilities (`gametes`), the Punnett square, genotypes and
 * phenotypes (`cross`), the reduced ratio (`ratio`) and the random offspring of a draw
 * (`mendelDraw` → `sampleOffspring`, the 2D table's numbers). The clock of the four steps only
 * orders the illustrative motion; it never changes a number.
 */
import { apportion, drawScale } from '../../view3d/sampling';
import { cross, gametes, parseGenotype, phenotype, ratio, type Locus } from '../mendel';
import type { MendelDraw } from '../mendelRun';

/** 0 = the mother ♀ (p1, the board's rows), 1 = the father ♂ (p2, its columns). */
export type ParentId = 0 | 1;
export const PARENTS: readonly ParentId[] = [0, 1];

export interface GameteInfo {
  /** One allele per locus, e.g. "Ab". */
  gamete: string;
  /** Exact probability (a multiple of 1/2ᵏ). */
  p: number;
}

export interface ParentModel {
  /** The genotype as the store holds it (the panel's choice). */
  typed: string;
  /** One homologous pair per locus, dominant allele first (`parseGenotype`). */
  pairs: [string, string][];
  /** The pairs written as one genotype, e.g. "AaBb". */
  genotype: string;
  gametes: GameteInfo[];
  /** Phenotype key of the parent (`phenotype`), e.g. "A_ B_". */
  phenotype: string;
}

export interface PhenotypeClass {
  index: number;
  /** Phenotype key, e.g. "A_ bb" (the 2D page's words). */
  key: string;
  /** Exact probability. */
  p: number;
  /** This class's term of the reduced ratio (e.g. 9 of 9 : 3 : 3 : 1). */
  ratio: number;
  /** Genotypes of the class with their exact probabilities (sorted). */
  genotypes: { genotype: string; p: number }[];
  /** Board cells of the class, row by row. */
  cells: { row: number; col: number }[];
}

export interface MendelModel3D {
  loci: Locus[];
  parents: readonly [ParentModel, ParentModel];
  /** `cross().punnett`: rows = the mother's gametes, columns = the father's. */
  punnett: { rows: string[]; cols: string[]; cells: string[][] };
  /** Probability of each cell: its row gamete's × its column gamete's. */
  cellP: number[][];
  /** Phenotype class (index into `classes`) of each cell. */
  cellClass: number[][];
  /** Phenotype classes in the 2D page's order (keys sorted). */
  classes: PhenotypeClass[];
  /** Genotypes (sorted) with their exact probabilities and reduced ratio terms. */
  genotypes: { genotype: string; p: number; ratio: number }[];
  /** "9 : 3 : 3 : 1" — the 2D page's reduced phenotype ratio. */
  ratioText: string;
  /** "1 AABB : 2 AABb : …" — the 2D page's genotype ratio. */
  genotypeRatioText: string;
}

function parentOf(typed: string, loci: Locus[]): ParentModel {
  const pairs = parseGenotype(typed, loci);
  const genotype = pairs.map(([a, b]) => a + b).join('');
  return {
    typed,
    pairs,
    genotype,
    gametes: gametes(pairs),
    phenotype: phenotype(genotype, loci),
  };
}

/** The 3D model of a cross; throws the model's `GenotypeError` for a genotype it cannot read. */
export function mendelModel3d(p1: string, p2: string, loci: Locus[]): MendelModel3D {
  const c = cross(p1, p2, loci);
  const parents = [parentOf(p1, loci), parentOf(p2, loci)] as const;
  const keys = [...c.phenotypes.keys()].sort();
  const classRatio = ratio(keys.map((k) => c.phenotypes.get(k) ?? 0));
  const classes: PhenotypeClass[] = keys.map((key, index) => ({
    index,
    key,
    p: c.phenotypes.get(key) ?? 0,
    ratio: classRatio[index] ?? 0,
    genotypes: [],
    cells: [],
  }));
  const genKeys = [...c.genotypes.keys()].sort();
  const genRatio = ratio(genKeys.map((k) => c.genotypes.get(k) ?? 0));
  for (const g of genKeys) {
    const cls = classes[keys.indexOf(phenotype(g, loci))];
    cls?.genotypes.push({ genotype: g, p: c.genotypes.get(g) ?? 0 });
  }
  const rowP = parents[0].gametes.map((g) => g.p);
  const colP = parents[1].gametes.map((g) => g.p);
  const cellP = c.punnett.cells.map((row, i) => row.map((_, j) => (rowP[i] ?? 0) * (colP[j] ?? 0)));
  const cellClass = c.punnett.cells.map((row, i) =>
    row.map((cell, j) => {
      const k = keys.indexOf(phenotype(cell, loci));
      classes[k]?.cells.push({ row: i, col: j });
      return k;
    }),
  );
  return {
    loci,
    parents,
    punnett: c.punnett,
    cellP,
    cellClass,
    classes,
    genotypes: genKeys.map((genotype, i) => ({
      genotype,
      p: c.genotypes.get(genotype) ?? 0,
      ratio: genRatio[i] ?? 0,
    })),
    ratioText: classRatio.join(' : '),
    genotypeRatioText: genKeys.map((k, i) => `${String(genRatio[i] ?? 0)} ${k}`).join(' : '),
  };
}

/** Probability of a genotype in the cross (0 when it never occurs). */
export function genotypeP(model: MendelModel3D, genotype: string): number {
  return model.genotypes.find((g) => g.genotype === genotype)?.p ?? 0;
}

/**
 * An exact probability of this model as a reduced fraction. Every probability here is a
 * multiple of 1/2ᵐ (gametes of 1–3 independent loci), so the smallest power-of-two denominator
 * is already reduced.
 */
export function fraction(p: number): { num: number; den: number } {
  const x = Math.max(0, Math.min(1, p));
  for (let den = 1; den <= 1 << 20; den *= 2) {
    const num = Math.round(x * den);
    if (Math.abs(num - x * den) < 1e-9 * den) return { num, den };
  }
  // Not a dyadic fraction (never for this model): the nearest 1/2²⁰.
  return { num: Math.round(x * (1 << 20)), den: 1 << 20 };
}

/** "9/16", "1/4", "1" (`fmt` writes whole numbers for the learner's locale). */
export function fractionText(p: number, fmt: (n: number) => string = String): string {
  const { num, den } = fraction(p);
  return den === 1 ? fmt(num) : `${fmt(num)}/${fmt(den)}`;
}

/* ─────────────────────────── The four steps (illustration) ─────────────────────────── */

export const MENDEL_STEPS = ['meiosis', 'gametes', 'fertilisation', 'offspring'] as const;
export type MendelStep = (typeof MENDEL_STEPS)[number];

/** Seconds each step's motion takes at speed 1 (illustration: it orders the motion only). */
export const STEP_SECONDS = 2.5;
export const MENDEL_TOTAL = MENDEL_STEPS.length * STEP_SECONDS;

/** The step shown at time t: a step's window ends at the moment its motion is complete. */
export function stepIndexAt(t: number): number {
  const k = Math.ceil(t / STEP_SECONDS - 1e-9) - 1;
  return Math.max(0, Math.min(MENDEL_STEPS.length - 1, k));
}

/** The moment step k is complete (what its button shows). */
export function stepEnd(k: number): number {
  const i = Math.max(0, Math.min(MENDEL_STEPS.length - 1, Math.round(k)));
  return (i + 1) * STEP_SECONDS;
}

/** How far step k's motion is at time t (0 … 1). */
export function stepProgress(t: number, k: number): number {
  return Math.max(0, Math.min(1, t / STEP_SECONDS - k));
}

/* ─────────────────────────── The random offspring ─────────────────────────── */

/**
 * Most offspring figures the field draws. The same on every tier (counts never depend on the
 * machine) and within the Medium tier's instance budget.
 */
export const FIELD_CAP = 400;

/** Figures the field may draw with a tier's instance budget (never more than FIELD_CAP). */
export function fieldCapFor(maxInstances: number): number {
  return Math.max(1, Math.min(FIELD_CAP, Math.floor(maxInstances)));
}

export interface Field3D {
  /** Offspring drawn (the store's n). */
  n: number;
  /** One figure per `per` offspring (1, 2, 5 × 10ᵐ). */
  per: number;
  /** Observed offspring of each class (the model's class order): the 2D table's O column. */
  counts: number[];
  /** Figures drawn of each class (largest remainders: they add up to round(n / per)). */
  figures: number[];
}

/**
 * The offspring field of a draw: the draw's counts in the model's class order, scaled to at
 * most `cap` figures. Null when there is no draw or it belongs to another cross.
 */
export function fieldOf(
  model: MendelModel3D,
  draw: MendelDraw | null,
  cap = FIELD_CAP,
): Field3D | null {
  if (!draw) return null;
  if (draw.keys.length !== model.classes.length) return null;
  if (draw.keys.some((k, i) => model.classes[i]?.key !== k)) return null;
  const per = drawScale(draw.n, cap);
  return { n: draw.n, per, counts: [...draw.obs], figures: apportion(draw.obs, per) };
}
