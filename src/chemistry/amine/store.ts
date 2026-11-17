import { create } from 'zustand';
import { AMINO_ACIDS, amineIsomers } from './model';

/* ───────── Amine (Bài 8) ───────── */

export const AMINE_TABS = ['names', 'properties'] as const;
export type AmineTab = (typeof AMINE_TABS)[number];

export interface AmineState {
  tab: AmineTab;
  /** Carbons of CnH2n+3N (1–4) and the chosen isomer (its groups joined by commas). */
  n: number;
  pick: string;
}

const keyOf = (groups: readonly string[]) => groups.join(',');

/** Opens on the isomers of C3H9N (question 2, tr. 36), on propylamine. */
export const useAmineStore = create<AmineState>()(() => ({ tab: 'names', n: 3, pick: 'propyl' }));

export function setAmine(patch: Partial<Record<keyof AmineState, unknown>>): void {
  const s = useAmineStore.getState();
  const n =
    typeof patch.n === 'number' && Number.isFinite(patch.n)
      ? Math.min(4, Math.max(1, Math.round(patch.n)))
      : s.n;
  const keys = amineIsomers(n).map((a) => keyOf(a.groups));
  const wanted = typeof patch.pick === 'string' ? patch.pick : s.pick;
  useAmineStore.setState({
    tab: AMINE_TABS.includes(patch.tab as AmineTab) ? (patch.tab as AmineTab) : s.tab,
    n,
    pick: keys.includes(wanted) ? wanted : (keys[0] ?? s.pick),
  });
}

export const isomerKey = keyOf;

/* ───────── Amino acids and peptides (Bài 9) ───────── */

export const AA_TABS = ['aminoAcids', 'peptide'] as const;
export type AaTab = (typeof AA_TABS)[number];
/** Residues the peptide builder offers: Bảng 9.1, and Tyr as in the book's example (no formula). */
export const RESIDUES = [...AMINO_ACIDS.map((a) => a.id), 'Tyr'] as const;
export const MAX_RESIDUES = 6;

export interface AminoAcidState {
  tab: AaTab;
  aa: string;
  pH: number;
  sequence: string[];
}

/** Opens on glycine at pH 6 and the tripeptide Val-Gly-Ala of Hình 9.2. */
export const useAminoAcidStore = create<AminoAcidState>()(() => ({
  tab: 'aminoAcids',
  aa: 'Gly',
  pH: 6,
  sequence: ['Val', 'Gly', 'Ala'],
}));

export function setAminoAcid(patch: Partial<Record<keyof AminoAcidState, unknown>>): void {
  const s = useAminoAcidStore.getState();
  const residues = RESIDUES as readonly string[];
  const seq = Array.isArray(patch.sequence)
    ? patch.sequence
        .filter((x): x is string => typeof x === 'string' && residues.includes(x))
        .slice(0, MAX_RESIDUES)
    : s.sequence;
  useAminoAcidStore.setState({
    tab: AA_TABS.includes(patch.tab as AaTab) ? (patch.tab as AaTab) : s.tab,
    aa: AMINO_ACIDS.some((a) => a.id === patch.aa) ? (patch.aa as string) : s.aa,
    pH:
      typeof patch.pH === 'number' && Number.isFinite(patch.pH)
        ? Math.min(14, Math.max(0, patch.pH))
        : s.pH,
    sequence: seq,
  });
}
