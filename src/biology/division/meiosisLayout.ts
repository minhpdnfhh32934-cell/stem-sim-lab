/**
 * Where the meiosis 3D view puts cells and chromosomes at a stage (pure, tested). What there is —
 * how many cells, which chromosomes (single or double, maternal and paternal segments after
 * crossing over), which pole each goes to — is the stage of the lesson's model
 * (`runDivision('meiosis')`); positions follow the stage's textbook arrangement and are
 * illustration (as in the 2D picture).
 */
import type { Chromosome, StageState } from './division';
import { scatterLayout } from './layout2d';

export type V3 = [number, number, number];

/** Cell radius (world units). */
export const CELL_R = 3.2;
/** Lengths of the chromosome pairs (pair index mod 4), as in the 2D picture. */
const LEN = [0.36, 0.28, 0.22, 0.18].map((f) => f * 2.4 * CELL_R);
/** Chromatid radius and the distance between two sister chromatids. */
export const CHROMATID_R = 0.13;
const SISTER_GAP = 0.3;

export interface PlacedChromosome {
  chromosome: Chromosome;
  /** Centre (the centromere). The chromosome lies along y. */
  center: V3;
  length: number;
  /** Cell index. */
  cell: number;
  /** Pole the chromosome is attached to (−1 left, +1 right, 0 both, null none). */
  pole: -1 | 0 | 1 | null;
}

export interface MeiosisLayout {
  cells: V3[];
  chromosomes: PlacedChromosome[];
  /** Interphase: chromatin threads instead of condensed chromosomes. */
  condensed: boolean;
  /** Spindle drawn (metaphase, anaphase). */
  spindle: boolean;
}

export const lengthOf = (c: Chromosome): number => LEN[c.pair % LEN.length] ?? LEN[0] ?? 2;

/** Width of a chromosome (one or two chromatids). */
export const widthOf = (c: Chromosome): number =>
  c.chromatids.length === 2 ? SISTER_GAP + 2 * CHROMATID_R : 2 * CHROMATID_R;

/** Cell centres: in a row, CELL_R apart plus a gap. */
export function cellCentres(n: number): V3[] {
  const step = 2 * CELL_R + 1.4;
  return Array.from({ length: n }, (_, k): V3 => [(k - (n - 1) / 2) * step, 0, 0]);
}

/**
 * Slots on a plate in the y–z plane (a metaphase plate, or the set at a pole): two columns in
 * depth, rows along y; `fit` shrinks the chromosomes so that two rows never overlap.
 */
function plate(n: number, maxLen: number, dz: number): { pts: [number, number][]; fit: number } {
  const cols = n <= 1 ? 1 : 2;
  const rows = Math.max(1, Math.ceil(n / cols));
  const dy = (1.45 * CELL_R) / rows;
  const fit = Math.min(1, (dy * 0.86) / Math.max(1e-6, maxLen));
  const pts = Array.from({ length: n }, (_, k): [number, number] => {
    const r = Math.floor(k / cols);
    const c = k % cols;
    return [(r - (rows - 1) / 2) * dy, (c - (cols - 1) / 2) * dz];
  });
  return { pts, fit };
}

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

export function meiosisLayout(s: StageState): MeiosisLayout {
  const cells = cellCentres(s.cells.length);
  const out: PlacedChromosome[] = [];
  const condensed = s.stage !== 'g1' && s.stage !== 'g2';
  const isMeta = s.stage === 'metaphase1' || s.stage === 'metaphase2';
  const spindle = isMeta || s.poles !== undefined;
  s.cells.forEach((cell, k) => {
    const [cx, cy, cz] = cells[k] ?? [0, 0, 0];
    const poles = s.poles?.[k];
    const maxLen = Math.max(...cell.chromosomes.map(lengthOf), 0.5);
    if (poles) {
      // Anaphase: each set moves to its pole.
      poles.forEach((list, side) => {
        const { pts, fit } = plate(list.length, maxLen, 1.1);
        list.forEach((c, i) => {
          const [y, z] = pts[i] ?? [0, 0];
          const sign = side === 0 ? -1 : 1;
          out.push({
            chromosome: c,
            center: [cx + sign * CELL_R * 0.52, cy + y, cz + z],
            length: lengthOf(c) * fit,
            cell: k,
            pole: sign,
          });
        });
      });
      return;
    }
    if (s.stage === 'metaphase1') {
      // Homologous pairs on the equator, one homologue on each side (orientation of the model).
      const pairs = [...new Set(cell.chromosomes.map((c) => c.pair))];
      const { pts, fit } = plate(pairs.length, maxLen, 1.6);
      pairs.forEach((p, i) => {
        const [y, z] = pts[i] ?? [0, 0];
        const m = cell.chromosomes.find((c) => c.pair === p && c.origin === 'M');
        const pa = cell.chromosomes.find((c) => c.pair === p && c.origin === 'P');
        const mFirst = s.orientation?.[p] ?? true;
        for (const [c, side] of [
          [m, mFirst ? -1 : 1],
          [pa, mFirst ? 1 : -1],
        ] as [Chromosome | undefined, -1 | 1][]) {
          if (!c) continue;
          out.push({
            chromosome: c,
            center: [cx + side * 0.42, cy + y, cz + z],
            length: lengthOf(c) * fit,
            cell: k,
            pole: side,
          });
        }
      });
      return;
    }
    if (isMeta) {
      // Metaphase II: double chromosomes in one row on the equator, attached to both poles.
      const { pts, fit } = plate(cell.chromosomes.length, maxLen, 1.1);
      cell.chromosomes.forEach((c, i) => {
        const [y, z] = pts[i] ?? [0, 0];
        out.push({
          chromosome: c,
          center: [cx, cy + y, cz + z],
          length: lengthOf(c) * fit,
          cell: k,
          pole: 0,
        });
      });
      return;
    }
    if (s.stage === 'prophase1') {
      // Synapsis: the homologues of a pair side by side (tetrads), one slot per pair.
      const pairs = [...new Set(cell.chromosomes.map((c) => c.pair))];
      const item = 2 * Math.max(...cell.chromosomes.map(widthOf), 0.3) + 0.4;
      const lay = scatterLayout(
        pairs.length,
        cx,
        cy,
        CELL_R * 0.55,
        CELL_R * 0.55,
        item * 1.3,
        maxLen * 1.1,
        rng(7 + k),
      );
      pairs.forEach((p, i) => {
        const slot = lay.slots[i] ?? { x: cx, y: cy };
        const pair = cell.chromosomes.filter((c) => c.pair === p);
        pair.forEach((c, j) => {
          out.push({
            chromosome: c,
            center: [slot.x + (j - (pair.length - 1) / 2) * (widthOf(c) + 0.12), slot.y, cz],
            length: lengthOf(c) * lay.fit,
            cell: k,
            pole: null,
          });
        });
      });
      return;
    }
    // Interphase, telophase, prophase II: one slot per chromosome inside the cell.
    const n = cell.chromosomes.length;
    const width = Math.max(...cell.chromosomes.map(widthOf), 0.3);
    const lay = scatterLayout(
      n,
      cx,
      cy,
      CELL_R * 0.55,
      CELL_R * 0.55,
      width * 1.8,
      maxLen * 1.1,
      rng(31 + k * 17),
    );
    cell.chromosomes.forEach((c, i) => {
      const slot = lay.slots[i] ?? { x: cx, y: cy };
      out.push({
        chromosome: c,
        center: [slot.x, slot.y, cz + (i % 2 ? 0.35 : -0.35)],
        length: lengthOf(c) * lay.fit,
        cell: k,
        pole: null,
      });
    });
  });
  return { cells, chromosomes: out, condensed, spindle };
}
