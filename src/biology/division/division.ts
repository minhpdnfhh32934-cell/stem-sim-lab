/**
 * Mitosis and meiosis as explicit chromosome bookkeeping. Every stage is built from the
 * previous one by the textbook rules (replication in S, homologues pair and may cross over
 * in prophase I, homologues separate in anaphase I, sister chromatids separate in anaphase
 * of mitosis and meiosis II), so the counts shown are COUNTED from the model, not typed in.
 */

export type Origin = 'M' | 'P'; // maternal / paternal
export interface Segment {
  from: number;
  to: number;
  origin: Origin;
}
/** One DNA molecule: coloured segments along its length (0…1). */
export type Chromatid = Segment[];
export interface Chromosome {
  pair: number;
  origin: Origin;
  /** 1 chromatid = single (NST đơn), 2 = double (NST kép). */
  chromatids: Chromatid[];
}
export interface Cell {
  chromosomes: Chromosome[];
}

export type Division = 'mitosis' | 'meiosis';

export type StageId =
  | 'g1'
  | 'g2'
  | 'prophase'
  | 'metaphase'
  | 'anaphase'
  | 'telophase'
  | 'prophase1'
  | 'metaphase1'
  | 'anaphase1'
  | 'telophase1'
  | 'prophase2'
  | 'metaphase2'
  | 'anaphase2'
  | 'telophase2';

export const STAGES: Record<Division, StageId[]> = {
  mitosis: ['g1', 'g2', 'prophase', 'metaphase', 'anaphase', 'telophase'],
  meiosis: [
    'g1',
    'g2',
    'prophase1',
    'metaphase1',
    'anaphase1',
    'telophase1',
    'prophase2',
    'metaphase2',
    'anaphase2',
    'telophase2',
  ],
};

export interface StageState {
  stage: StageId;
  cells: Cell[];
  /** In anaphase the chromosomes are still in one cell but moving to two poles. */
  poles?: [Chromosome[], Chromosome[]][];
  /** Pairs (by index) that crossed over in prophase I, with the break point. */
  crossovers?: { pair: number; point: number }[];
  /** Metaphase I: for each pair, true = maternal homologue faces the first pole. */
  orientation?: boolean[];
}

const whole = (origin: Origin): Chromatid => [{ from: 0, to: 1, origin }];
const cloneChromatid = (c: Chromatid): Chromatid => c.map((s) => ({ ...s }));

/** Diploid G1 cell with n homologous pairs (one maternal and one paternal of each). */
export function diploidCell(n: number): Cell {
  const chromosomes: Chromosome[] = [];
  for (let p = 0; p < n; p++) {
    chromosomes.push({ pair: p, origin: 'M', chromatids: [whole('M')] });
    chromosomes.push({ pair: p, origin: 'P', chromatids: [whole('P')] });
  }
  return { chromosomes };
}

/** S phase: every chromosome becomes double (two identical sister chromatids). */
function replicate(cell: Cell): Cell {
  return {
    chromosomes: cell.chromosomes.map((c) => ({
      ...c,
      chromatids: [cloneChromatid(c.chromatids[0] ?? []), cloneChromatid(c.chromatids[0] ?? [])],
    })),
  };
}

/** Swaps the distal parts (beyond `point`) of two chromatids (non-sister, one crossover). */
function crossOver(a: Chromatid, b: Chromatid, point: number): [Chromatid, Chromatid] {
  const cut = (c: Chromatid, lo: number, hi: number): Chromatid =>
    c
      .filter((s) => s.to > lo && s.from < hi)
      .map((s) => ({ from: Math.max(lo, s.from), to: Math.min(hi, s.to), origin: s.origin }));
  return [
    [...cut(a, 0, point), ...cut(b, point, 1)],
    [...cut(b, 0, point), ...cut(a, point, 1)],
  ];
}

/** Separates sister chromatids: each double chromosome → two single ones. */
function splitSisters(chromosomes: Chromosome[]): [Chromosome[], Chromosome[]] {
  const left: Chromosome[] = [];
  const right: Chromosome[] = [];
  for (const c of chromosomes) {
    left.push({ ...c, chromatids: [cloneChromatid(c.chromatids[0] ?? [])] });
    right.push({ ...c, chromatids: [cloneChromatid(c.chromatids[1] ?? c.chromatids[0] ?? [])] });
  }
  return [left, right];
}

export interface MeiosisOptions {
  /** Pairs that cross over in prophase I and where (0…1 along the chromosome). */
  crossovers?: { pair: number; point: number }[];
  /** For each pair, true = maternal homologue goes to the first pole in anaphase I. */
  orientation?: boolean[];
}

/** All stages of one division, starting from a diploid cell with n pairs (2n chromosomes). */
export function runDivision(kind: Division, n: number, opts: MeiosisOptions = {}): StageState[] {
  const g1 = diploidCell(n);
  const g2 = replicate(g1);
  const out: StageState[] = [
    { stage: 'g1', cells: [g1] },
    { stage: 'g2', cells: [g2] },
  ];
  if (kind === 'mitosis') {
    out.push({ stage: 'prophase', cells: [g2] }, { stage: 'metaphase', cells: [g2] });
    const [a, b] = splitSisters(g2.chromosomes);
    out.push({ stage: 'anaphase', cells: [{ chromosomes: [...a, ...b] }], poles: [[a, b]] });
    out.push({ stage: 'telophase', cells: [{ chromosomes: a }, { chromosomes: b }] });
    return out;
  }
  // Prophase I: synapsis and crossing over between non-sister chromatids.
  const crossovers = (opts.crossovers ?? []).filter((c) => c.pair >= 0 && c.pair < n);
  const p1: Cell = {
    chromosomes: g2.chromosomes.map((c) => ({
      ...c,
      chromatids: c.chromatids.map(cloneChromatid),
    })),
  };
  for (const x of crossovers) {
    const m = p1.chromosomes.find((c) => c.pair === x.pair && c.origin === 'M');
    const p = p1.chromosomes.find((c) => c.pair === x.pair && c.origin === 'P');
    if (!m || !p || !m.chromatids[1] || !p.chromatids[0]) continue;
    // Inner chromatids exchange (M's second with P's first).
    const [a, b] = crossOver(m.chromatids[1], p.chromatids[0], x.point);
    m.chromatids[1] = a;
    p.chromatids[0] = b;
  }
  const orientation = Array.from({ length: n }, (_, pair) => opts.orientation?.[pair] ?? true);
  out.push(
    { stage: 'prophase1', cells: [p1], crossovers },
    { stage: 'metaphase1', cells: [p1], crossovers, orientation },
  );
  // Anaphase I: homologues (still double) go to opposite poles.
  const pole1: Chromosome[] = [];
  const pole2: Chromosome[] = [];
  for (let pair = 0; pair < n; pair++) {
    const m = p1.chromosomes.find((c) => c.pair === pair && c.origin === 'M');
    const p = p1.chromosomes.find((c) => c.pair === pair && c.origin === 'P');
    if (!m || !p) continue;
    const mFirst = orientation[pair] ?? true;
    pole1.push(mFirst ? m : p);
    pole2.push(mFirst ? p : m);
  }
  out.push({
    stage: 'anaphase1',
    cells: [{ chromosomes: [...pole1, ...pole2] }],
    poles: [[pole1, pole2]],
  });
  const d1: Cell = { chromosomes: pole1 };
  const d2: Cell = { chromosomes: pole2 };
  out.push(
    { stage: 'telophase1', cells: [d1, d2] },
    { stage: 'prophase2', cells: [d1, d2] },
    { stage: 'metaphase2', cells: [d1, d2] },
  );
  const [a1, b1] = splitSisters(d1.chromosomes);
  const [a2, b2] = splitSisters(d2.chromosomes);
  out.push({
    stage: 'anaphase2',
    cells: [{ chromosomes: [...a1, ...b1] }, { chromosomes: [...a2, ...b2] }],
    poles: [
      [a1, b1],
      [a2, b2],
    ],
  });
  out.push({
    stage: 'telophase2',
    cells: [{ chromosomes: a1 }, { chromosomes: b1 }, { chromosomes: a2 }, { chromosomes: b2 }],
  });
  return out;
}

export interface Counts {
  cells: number;
  /** Per cell. */
  chromosomes: number;
  state: 'single' | 'double';
  chromatids: number;
  centromeres: number;
  dnaMolecules: number;
}

/** Counts per cell, read from the model (first cell; all cells of a stage are alike). */
export function countsOf(s: StageState): Counts {
  const cell = s.cells[0] ?? { chromosomes: [] };
  const double = cell.chromosomes.some((c) => c.chromatids.length === 2);
  const chromatids = cell.chromosomes.reduce(
    (acc, c) => acc + (c.chromatids.length === 2 ? 2 : 0),
    0,
  );
  const dna = cell.chromosomes.reduce((acc, c) => acc + c.chromatids.length, 0);
  return {
    cells: s.cells.length,
    chromosomes: cell.chromosomes.length,
    state: double ? 'double' : 'single',
    chromatids,
    centromeres: cell.chromosomes.length,
    dnaMolecules: dna,
  };
}

/** Distinct gametes (as strings of pair origins/segments) — used to show recombination. */
export function gameteSignature(cell: Cell): string {
  return [...cell.chromosomes]
    .sort((a, b) => a.pair - b.pair)
    .map((c) => (c.chromatids[0] ?? []).map((s) => `${s.origin}${s.from.toFixed(2)}`).join(''))
    .join('|');
}
