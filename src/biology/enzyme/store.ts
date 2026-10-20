import { create } from 'zustand';
import type { Inhibition } from './enzyme';

export interface EnzymeState {
  vmax: number;
  km: number;
  kind: Inhibition;
  inhibitor: number;
  ki: number;
  s0: number;
  view: 'rate' | 'time';
  /** Shows the 3D view (saved in .stemsim files, like mitosis and Mendel). */
  view3d: boolean;
}

export const useEnzyme = create<EnzymeState>()(() => ({
  vmax: 10,
  km: 2,
  kind: 'competitive',
  inhibitor: 2,
  ki: 1,
  s0: 10,
  view: 'rate',
  view3d: true,
}));
