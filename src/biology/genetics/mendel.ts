/**
 * Mendelian crosses for 1–3 independently assorting loci (no linkage), each with complete or
 * incomplete dominance. Probabilities are exact fractions over 4^k.
 */

export type Dominance = 'complete' | 'incomplete';

export interface Locus {
  /** Upper-case letter of the dominant allele, e.g. "A". */
  letter: string;
  dominance: Dominance;
}

export class GenotypeError extends Error {
  override name = 'GenotypeError';
}

/** "AaBb" → [['A','a'], ['B','b']] checked against the loci. */
export function parseGenotype(g: string, loci: Locus[]): [string, string][] {
  const s = g.replace(/\s/g, '');
  if (s.length !== 2 * loci.length)
    throw new GenotypeError(`"${g}" needs ${2 * loci.length} letters`);
  return loci.map((l, i) => {
    const a = s[2 * i] ?? '';
    const b = s[2 * i + 1] ?? '';
    for (const x of [a, b]) {
      if (x.toUpperCase() !== l.letter.toUpperCase())
        throw new GenotypeError(`"${x}" is not an allele of ${l.letter}`);
    }
    // Dominant allele first ("aA" → "Aa").
    return a === a.toUpperCase() ? [a, b] : [b, a];
  });
}

/** All gametes of a genotype with their probabilities (independent assortment). */
export function gametes(genotype: [string, string][]): { gamete: string; p: number }[] {
  let out = [{ gamete: '', p: 1 }];
  for (const [a, b] of genotype) {
    const next: { gamete: string; p: number }[] = [];
    for (const g of out) {
      if (a === b) next.push({ gamete: g.gamete + a, p: g.p });
      else next.push({ gamete: g.gamete + a, p: g.p / 2 }, { gamete: g.gamete + b, p: g.p / 2 });
    }
    out = next;
  }
  return out;
}

const normalizePair = (x: string, y: string) => (x === x.toUpperCase() ? x + y : y + x);

/** Offspring genotype from two gametes, e.g. "AB" + "ab" → "AaBb". */
export function combine(g1: string, g2: string): string {
  let s = '';
  for (let i = 0; i < g1.length; i++) s += normalizePair(g1[i] ?? '', g2[i] ?? '');
  return s;
}

/** Phenotype key per locus: dominant "A_", recessive "aa", or "Aa" for incomplete dominance. */
export function phenotype(genotype: string, loci: Locus[]): string {
  return loci
    .map((l, i) => {
      const pair = genotype.slice(2 * i, 2 * i + 2);
      const upper = pair.replace(/[a-z]/g, '').length;
      if (l.dominance === 'incomplete') return pair;
      return upper > 0 ? `${l.letter.toUpperCase()}_` : pair;
    })
    .join(' ');
}

export interface Cross {
  punnett: { rows: string[]; cols: string[]; cells: string[][] };
  genotypes: Map<string, number>;
  phenotypes: Map<string, number>;
}

/** Punnett square and exact genotype/phenotype probabilities. */
export function cross(p1: string, p2: string, loci: Locus[]): Cross {
  const g1 = gametes(parseGenotype(p1, loci));
  const g2 = gametes(parseGenotype(p2, loci));
  const genotypes = new Map<string, number>();
  const phenotypes = new Map<string, number>();
  const cells = g1.map((a) =>
    g2.map((b) => {
      const child = combine(a.gamete, b.gamete);
      const p = a.p * b.p;
      genotypes.set(child, (genotypes.get(child) ?? 0) + p);
      const ph = phenotype(child, loci);
      phenotypes.set(ph, (phenotypes.get(ph) ?? 0) + p);
      return child;
    }),
  );
  return {
    punnett: { rows: g1.map((g) => g.gamete), cols: g2.map((g) => g.gamete), cells },
    genotypes,
    phenotypes,
  };
}

/** Smallest integer ratio of a probability map, e.g. 0.75/0.25 → "3 : 1". */
export function ratio(probs: number[]): number[] {
  const den = 4 ** 3 * 4; // all probabilities are multiples of 1/4^k, k ≤ 3
  const ints = probs.map((p) => Math.round(p * den));
  const g = ints.reduce((a, b) => {
    let x = a;
    let y = b;
    while (y) [x, y] = [y, x % y];
    return x;
  }, 0);
  return ints.map((x) => x / (g || 1));
}

/** Monte Carlo offspring: random gamete from each parent (seeded). */
export function sampleOffspring(
  p1: string,
  p2: string,
  loci: Locus[],
  n: number,
  rand: () => number,
): Map<string, number> {
  const g1 = gametes(parseGenotype(p1, loci));
  const g2 = gametes(parseGenotype(p2, loci));
  const pick = (gs: { gamete: string; p: number }[]) => {
    let r = rand();
    for (const g of gs) {
      r -= g.p;
      if (r < 0) return g.gamete;
    }
    return gs[gs.length - 1]?.gamete ?? '';
  };
  const counts = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const ph = phenotype(combine(pick(g1), pick(g2)), loci);
    counts.set(ph, (counts.get(ph) ?? 0) + 1);
  }
  return counts;
}
