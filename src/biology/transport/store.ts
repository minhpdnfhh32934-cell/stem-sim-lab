import { create } from 'zustand';

export interface TransportState {
  mode: 'diffusion' | 'osmosis';
  run: number;
  // Diffusion (particles are illustrative; the chart uses Fick's law).
  pores: number;
  particles: number;
  c1: number;
  c2: number;
  v1: number;
  v2: number;
  pa: number;
  // Osmosis.
  c0: number;
  i: number;
  tC: number;
  h0: number;
}

export const useTransport = create<TransportState>()(() => ({
  mode: 'diffusion',
  run: 0,
  pores: 4,
  particles: 160,
  c1: 10,
  c2: 0,
  v1: 1,
  v2: 1,
  pa: 0.2,
  c0: 1,
  i: 1,
  tC: 25,
  h0: 0.2,
}));
