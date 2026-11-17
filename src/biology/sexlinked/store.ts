import { create } from 'zustand';
import { FATHERS, MOTHERS, type Father, type Mother } from './model';

export interface SexLinkedState {
  mother: Mother;
  father: Father;
}

/** Opens on Morgan's forward cross: a red-eyed female × a white-eyed male (Hình 10.2a). */
export const useSexLinked = create<SexLinkedState>()(() => ({ mother: 'AA', father: 'a' }));

export function restoreSexLinked(patch: Partial<Record<keyof SexLinkedState, unknown>>): void {
  const s = useSexLinked.getState();
  useSexLinked.setState({
    mother: MOTHERS.includes(patch.mother as Mother) ? (patch.mother as Mother) : s.mother,
    father: FATHERS.includes(patch.father as Father) ? (patch.father as Father) : s.father,
  });
}
