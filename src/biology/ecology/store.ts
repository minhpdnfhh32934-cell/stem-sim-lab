import { create } from 'zustand';

export interface LogisticState {
  N0: number;
  r: number;
  K: number;
  tEnd: number;
}

export const useLogistic = create<LogisticState>()(() => ({ N0: 10, r: 0.5, K: 1000, tEnd: 30 }));

export interface LvState {
  alpha: number;
  beta: number;
  delta: number;
  gamma: number;
  x0: number;
  y0: number;
  tEnd: number;
}

export const useLv = create<LvState>()(() => ({
  alpha: 1,
  beta: 0.1,
  delta: 0.075,
  gamma: 1.5,
  x0: 10,
  y0: 5,
  tEnd: 30,
}));
