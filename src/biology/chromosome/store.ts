import { create } from 'zustand';
import {
  BOOK_ALLOPOLYPLOID,
  HUMAN_2N,
  NUMBER_TYPES,
  STRUCTURES,
  type NumberType,
  type Structure,
} from './model';

export const CHROMOSOME_TABS = ['structure', 'number', 'down'] as const;
export type ChromosomeTab = (typeof CHROMOSOME_TABS)[number];

export interface ChromosomeState {
  tab: ChromosomeTab;
  structure: Structure;
  twoN: number;
  numberType: NumberType;
  aTwoN: number;
  bTwoN: number;
}

/** Opens on a deletion (Hình 12.1) and on humans, 2n = 46, for the counts (tr. 65). */
export const useChromosome = create<ChromosomeState>()(() => ({
  tab: 'structure',
  structure: 'deletion',
  twoN: HUMAN_2N,
  numberType: 'trisomy',
  aTwoN: BOOK_ALLOPOLYPLOID.a_2n,
  bTwoN: BOOK_ALLOPOLYPLOID.b_2n,
}));

/** A 2n: an even whole number from 2 to 200. */
const even = (v: unknown, keep: number): number =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.min(200, Math.max(2, 2 * Math.round(v / 2)))
    : keep;

export function restoreChromosome(patch: Partial<Record<keyof ChromosomeState, unknown>>): void {
  const s = useChromosome.getState();
  useChromosome.setState({
    tab: CHROMOSOME_TABS.includes(patch.tab as ChromosomeTab)
      ? (patch.tab as ChromosomeTab)
      : s.tab,
    structure: STRUCTURES.includes(patch.structure as Structure)
      ? (patch.structure as Structure)
      : s.structure,
    twoN: even(patch.twoN, s.twoN),
    numberType: NUMBER_TYPES.includes(patch.numberType as NumberType)
      ? (patch.numberType as NumberType)
      : s.numberType,
    aTwoN: even(patch.aTwoN, s.aTwoN),
    bTwoN: even(patch.bTwoN, s.bTwoN),
  });
}
