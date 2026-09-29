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
}

export const useEnzyme = create<EnzymeState>()(() => ({
  vmax: 10,
  km: 2,
  kind: 'competitive',
  inhibitor: 2,
  ki: 1,
  s0: 10,
  view: 'rate',
}));
