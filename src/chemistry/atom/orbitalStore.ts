import { create } from 'zustand';

export type OrbitalMode = 'psi' | 'density';

export const useOrbitalStore = create<{ n: number; orbital: string; mode: OrbitalMode }>()(() => ({
  n: 2,
  orbital: 'pz',
  mode: 'psi',
}));

export const MAX_ORBITAL_N = 6;
