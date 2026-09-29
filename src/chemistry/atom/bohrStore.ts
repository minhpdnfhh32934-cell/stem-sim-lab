import { create } from 'zustand';

/** Selected hydrogen transition (nUpper → nLower) in the Bohr module. */
export const useBohrStore = create<{ nLower: number; nUpper: number }>()(() => ({
  nLower: 2,
  nUpper: 3,
}));

export const MAX_N = 7;
