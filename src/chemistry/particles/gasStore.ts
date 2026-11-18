import { create } from 'zustand';
import { C } from '@/core/constants';
import { prefersReducedMotion } from '@/ui/three/availability';
import { molarMass } from '../formula';
import { Gas2D, TYPE_A, TYPE_B, TYPE_C, TYPE_D } from './gas';

export const GASES = ['He', 'N2', 'O2', 'CO2'] as const;
export type GasId = (typeof GASES)[number];

export type GasMode = 'maxwell' | 'collision';

export interface GasState {
  mode: GasMode;
  gas: GasId;
  /** Temperature (K). */
  T: number;
  n: number;
  start: 'maxwell' | 'equal';
  /** Activation energy (kJ/mol). */
  eaKJ: number;
  reversible: boolean;
  running: boolean;
  /** "Theo dõi một hạt" (#195): one particle of the model drawn with its recent path. */
  follow: boolean;
  /** Bumps whenever the simulation is rebuilt or sampled (UI refresh). */
  version: number;
}

export const useGasStore = create<GasState>()(() => ({
  mode: 'maxwell',
  gas: 'N2',
  T: 300,
  n: 300,
  start: 'equal',
  eaKJ: 5,
  reversible: false,
  // With reduced motion the lesson opens paused (#205 C3).
  running: !prefersReducedMotion(),
  follow: false,
  version: 0,
}));

/** σ = √(RT/M) in m/s: the speed unit that maps reduced speeds to real ones. */
export function sigmaReal(gas: GasId, T: number): number {
  return Math.sqrt((C.R * T) / (molarMass(gas) / 1000));
}

/** Eₐ/(RT) — the activation energy in the simulation's k_BT units. */
export function eaReduced(eaKJ: number, T: number): number {
  return (eaKJ * 1000) / (C.R * T);
}

export interface GasHistory {
  t: number[];
  counts: [number[], number[], number[], number[]];
  /** Recent speeds (reduced units) for the histogram. */
  speeds: number[];
}

/** The particle "Theo dõi một hạt" follows (its index in the model). */
export const FOLLOWED = 0;
/**
 * Length of the drawn path, in reduced time: 12 τ is about 2 s on screen (the stage plays 6 τ per
 * second). Kept in model time, so a pause does not shorten it.
 */
export const TRAIL_TAU = 12;

/** Where the followed particle was, read from the model at time `t` (reduced units). */
export interface TrailPoint {
  x: number;
  y: number;
  t: number;
}

/** The running gas lives outside React state (updated every frame). */
export const gasRuntime: { gas: Gas2D | null; history: GasHistory; trail: TrailPoint[] } = {
  gas: null,
  history: { t: [], counts: [[], [], [], []], speeds: [] },
  trail: [],
};

/** Adds the followed particle's current place to its path and drops what is older than TRAIL_TAU. */
export function recordTrail(): void {
  const g = gasRuntime.gas;
  if (!g || FOLLOWED >= g.n) return;
  const trail = gasRuntime.trail;
  trail.push({ x: g.x[FOLLOWED] ?? 0, y: g.y[FOLLOWED] ?? 0, t: g.time });
  let old = 0;
  while (old < trail.length && g.time - (trail[old]?.t ?? g.time) > TRAIL_TAU) old++;
  if (old > 0) trail.splice(0, old);
}

export function resetGas(): void {
  const s = useGasStore.getState();
  const box = Math.sqrt(s.n) * (s.mode === 'collision' ? 1.9 : 2.2);
  gasRuntime.gas = new Gas2D({
    n: s.n,
    box,
    seed: 17,
    start: s.mode === 'maxwell' ? s.start : 'maxwell',
    fractionB: s.mode === 'collision' ? 0.5 : 0,
    ea: s.mode === 'collision' ? eaReduced(s.eaKJ, s.T) : null,
    reversible: s.reversible,
  });
  gasRuntime.history = { t: [], counts: [[], [], [], []], speeds: [] };
  gasRuntime.trail = [];
  sample();
  useGasStore.setState((st) => ({ version: st.version + 1 }));
}

/** Records counts and speeds (called a few times per simulated time unit). */
export function sample(): void {
  const g = gasRuntime.gas;
  if (!g) return;
  const h = gasRuntime.history;
  h.t.push(g.time);
  [TYPE_A, TYPE_B, TYPE_C, TYPE_D].forEach((type, k) => {
    h.counts[k as 0 | 1 | 2 | 3].push(g.count(type));
  });
  for (let i = 0; i < g.n; i++) h.speeds.push(g.speed(i));
  // Keep the last ~20 snapshots of speeds for a smooth histogram.
  const keep = g.n * 20;
  if (h.speeds.length > keep) h.speeds.splice(0, h.speeds.length - keep);
  if (h.t.length > 2000) {
    h.t.splice(0, h.t.length - 2000);
    for (const c of h.counts) c.splice(0, c.length - 2000);
  }
}
