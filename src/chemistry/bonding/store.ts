import { create } from 'zustand';
import { COVALENT_MOLECULES } from './covalent';
import { ANIONS, CATIONS } from './ionic';
import { OCTET_MOLECULES } from './octet';

export type TempUnit = 'C' | 'K';

/** Inputs of the four "Liên kết hoá học" topics (Bài 10–13). */
export interface BondingState {
  octet: string;
  covalent: string;
  metal: string;
  nonmetal: string;
  unit: TempUnit;
}

export const useBondingStore = create<BondingState>(() => ({
  octet: 'h2o',
  covalent: 'c2h4',
  metal: 'Na',
  nonmetal: 'Cl',
  unit: 'C',
}));

const VALID: { [K in keyof BondingState]: readonly string[] } = {
  octet: OCTET_MOLECULES,
  covalent: COVALENT_MOLECULES,
  metal: CATIONS.map((i) => i.element),
  nonmetal: ANIONS.map((i) => i.element),
  unit: ['C', 'K'],
};

/** Restores saved inputs; a value outside the lists (an old or broken file) is ignored. */
export function applyBonding(patch: Partial<BondingState>): void {
  const ok = Object.fromEntries(
    Object.entries(patch).filter(([k, v]) => VALID[k as keyof BondingState].includes(v)),
  );
  useBondingStore.setState(ok);
}
