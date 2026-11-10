import { create } from 'zustand';
import { orbitalById } from './hydrogen';

export type OrbitalMode = 'psi' | 'density';

export const useOrbitalStore = create<{ n: number; orbital: string; mode: OrbitalMode }>()(() => ({
  n: 2,
  orbital: 'pz',
  mode: 'psi',
}));

export const MAX_ORBITAL_N = 6;

/** n one step up or down, keeping l < n (the orbital falls back to s, as the tray's own n field). */
export function stepN(n: number, orbital: string, by: number): { n: number; orbital: string } {
  const nn = Math.min(MAX_ORBITAL_N, Math.max(1, n + by));
  return { n: nn, orbital: orbitalById(orbital).l < nn ? orbital : 's' };
}
