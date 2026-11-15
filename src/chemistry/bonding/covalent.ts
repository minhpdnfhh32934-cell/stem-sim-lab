import { bondPolarity, deltaEn, type BondPolarity, type Molecule } from '../data/molecules';

/** Sample molecules of "Liên kết cộng hóa trị" (Bài 12), structures from data/molecules.json. */
export const COVALENT_MOLECULES = [
  'h2',
  'cl2',
  'hcl',
  'hf',
  'h2o',
  'nh3',
  'ch4',
  'o2',
  'n2',
  'co2',
  'c2h4',
  'c2h2',
  'hcn',
  'c2h5oh',
  'ch3cooh',
] as const;

export interface BondRow {
  index: number;
  a: number;
  b: number;
  order: number;
  /** SGK Bài 12: a single bond is σ; a double bond 1 σ + 1 π; a triple bond 1 σ + 2 π. */
  sigma: number;
  pi: number;
  deltaEn: number | null;
  type: BondPolarity | null;
  /**
   * |Δχ| ≥ 1,7 (the table's "ion") inside a molecule held by a shared pair: one of the
   * exceptions the book's footnote names (HF).
   */
  thresholdException: boolean;
}

export function covalentBonds(m: Molecule): BondRow[] {
  return m.bonds.map((b, index) => {
    const d = deltaEn(m, b);
    const type = d === null ? null : bondPolarity(d);
    return {
      index,
      a: b.a,
      b: b.b,
      order: b.order,
      sigma: 1,
      pi: b.order - 1,
      deltaEn: d,
      type,
      thresholdException: type === 'ionic',
    };
  });
}

export function sigmaPiTotals(rows: readonly BondRow[]): { sigma: number; pi: number } {
  return rows.reduce((s, r) => ({ sigma: s.sigma + r.sigma, pi: s.pi + r.pi }), {
    sigma: 0,
    pi: 0,
  });
}
