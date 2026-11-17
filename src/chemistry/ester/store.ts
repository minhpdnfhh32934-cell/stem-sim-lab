import { create } from 'zustand';
import { ACYLS, ALKYLS, FATTY_ACIDS } from './model';

export const TABS = ['names', 'reactions', 'fats'] as const;
export type Tab = (typeof TABS)[number];

export interface EsterState {
  tab: Tab;
  /** Names tab: an acid and an alcohol, and the n of CnH2nO2 whose isomers are listed. */
  acyl: string;
  alkyl: string;
  n: number;
  /** Reactions tab: esterification masses (g). */
  acidG: number;
  alcoholG: number;
  esterG: number;
  /** Fats tab: the three fatty acids and the mass of fat (g). */
  fa1: string;
  fa2: string;
  fa3: string;
  fatG: number;
}

/** Opens on ethyl acetate; the reactions tab on question 7, tr. 9 (isoamyl acetate). */
export const useEsterStore = create<EsterState>()(() => ({
  tab: 'names',
  acyl: 'acetic',
  alkyl: 'ethyl',
  n: 4,
  acidG: 16.2,
  alcoholG: 15.2,
  esterG: 14.16,
  fa1: 'stearic',
  fa2: 'stearic',
  fa3: 'stearic',
  fatG: 100,
}));

const num = (v: unknown, lo: number, hi: number, old: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : old;
const pick = <T extends string>(v: unknown, all: readonly T[], old: T): T =>
  all.includes(v as T) ? (v as T) : old;

export function setEster(patch: Partial<Record<keyof EsterState, unknown>>): void {
  const s = useEsterStore.getState();
  const acids = FATTY_ACIDS.map((a) => a.id);
  useEsterStore.setState({
    tab: pick(patch.tab, TABS, s.tab),
    acyl: pick(
      patch.acyl,
      ACYLS.map((a) => a.id),
      s.acyl,
    ),
    alkyl: pick(
      patch.alkyl,
      ALKYLS.map((a) => a.id),
      s.alkyl,
    ),
    n: Math.round(num(patch.n, 2, 5, s.n)),
    acidG: num(patch.acidG, 1e-6, 1e9, s.acidG),
    alcoholG: num(patch.alcoholG, 1e-6, 1e9, s.alcoholG),
    esterG: num(patch.esterG, 0, 1e9, s.esterG),
    fa1: pick(patch.fa1, acids, s.fa1),
    fa2: pick(patch.fa2, acids, s.fa2),
    fa3: pick(patch.fa3, acids, s.fa3),
    fatG: num(patch.fatG, 1e-6, 1e9, s.fatG),
  });
}

/** Question 7, tr. 9: acetic acid and isoamyl alcohol. */
export function loadQuestion7(): void {
  setEster({
    tab: 'reactions',
    acyl: 'acetic',
    alkyl: 'isoamyl',
    acidG: 16.2,
    alcoholG: 15.2,
    esterG: 14.16,
  });
}
