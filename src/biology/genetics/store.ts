import { create } from 'zustand';
import type { Dominance } from './mendel';

export interface MendelState {
  loci: 1 | 2;
  dominance: [Dominance, Dominance];
  p1: string;
  p2: string;
  n: number;
  seed: number;
  ran: boolean;
}

export const useMendel = create<MendelState>()(() => ({
  loci: 2,
  dominance: ['complete', 'complete'],
  p1: 'AaBb',
  p2: 'AaBb',
  n: 1000,
  seed: 1,
  ran: false,
}));

export const LETTERS = ['A', 'B'];

export interface HwState {
  AA: number;
  Aa: number;
  aa: number;
  N: number;
  seed: number;
  sample: { AA: number; Aa: number; aa: number } | null;
}
export const useHw = create<HwState>()(() => ({
  AA: 360,
  Aa: 480,
  aa: 160,
  N: 1000,
  seed: 1,
  sample: null,
}));

export interface DriftState {
  N: number;
  p0: number;
  generations: number;
  runs: number;
  seed: number;
}
export const useDrift = create<DriftState>()(() => ({
  N: 50,
  p0: 0.5,
  generations: 150,
  runs: 20,
  seed: 1,
}));
