import { valenceElectrons, type Molecule } from '../data/molecules';

/**
 * Molecules and ions of "Quy tắc octet" (Bài 10). Structures come from data/molecules.json
 * (RDKit, one Lewis structure each); the exceptions (BeCl₂, BF₃, NO, PCl₅, SF₆) are found by
 * `octetCounts`, never listed by hand.
 */
export const OCTET_MOLECULES = [
  'h2',
  'f2',
  'cl2',
  'hcl',
  'h2o',
  'nh3',
  'ph3',
  'ch4',
  'ccl4',
  'o2',
  'n2',
  'co2',
  'c2h4',
  'c2h2',
  'hcn',
  'nh4',
  'oh',
  'becl2',
  'bf3',
  'no',
  'pcl5',
  'sf6',
] as const;

/** ok: 8 electrons (2 for H); deficient: fewer; expanded: more; odd: an unpaired electron. */
export type OctetVerdict = 'ok' | 'deficient' | 'expanded' | 'odd';

export interface AtomCount {
  index: number;
  el: string;
  /** Valence electrons = group number of the main-group element (SGK Bảng 10.1). */
  valence: number;
  /** Formal charge of the atom in the structure. */
  charge: number;
  /** Sum of the orders of the atom's bonds. */
  bondOrder: number;
  /** Electrons in the atom's bonds: 2 per shared pair. */
  shared: number;
  /** Electrons the atom keeps for itself: valence − charge − Σ bond orders. */
  nonbonding: number;
  lonePairs: number;
  unpaired: number;
  /** Electrons around the atom: shared + nonbonding. */
  total: number;
  /** 2 (duet, like He) for H, 8 otherwise. */
  target: 2 | 8;
  verdict: OctetVerdict;
}

/** Counts the electrons around every atom of the structure (Lewis bookkeeping). */
export function octetCounts(m: Molecule): AtomCount[] {
  return m.atoms.map((a, index) => {
    const valence = valenceElectrons(a.el);
    if (valence === null) throw new Error(`${m.id}: ${a.el} is not a main-group element`);
    const bondOrder = m.bonds
      .filter((b) => b.a === index || b.b === index)
      .reduce((s, b) => s + b.order, 0);
    const nonbonding = valence - a.charge - bondOrder;
    if (nonbonding < 0) throw new Error(`${m.id}: atom ${String(index)} has too many bonds`);
    const shared = 2 * bondOrder;
    const total = shared + nonbonding;
    const target = a.el === 'H' ? 2 : 8;
    const verdict: OctetVerdict =
      total % 2 === 1 ? 'odd' : total === target ? 'ok' : total < target ? 'deficient' : 'expanded';
    return {
      index,
      el: a.el,
      valence,
      charge: a.charge,
      bondOrder,
      shared,
      nonbonding,
      lonePairs: Math.floor(nonbonding / 2),
      unpaired: nonbonding % 2,
      total,
      target,
      verdict,
    };
  });
}

/** Total valence electrons of the species: Σ valence − net charge (an anion has more). */
export function valenceTotal(counts: readonly AtomCount[]): number {
  return counts.reduce((s, c) => s + c.valence - c.charge, 0);
}
