/**
 * Numbers of the ecology 3D views (pure, tested): how many individuals the habitat shows at a
 * moment, read from the lesson's own model (the exact logistic solution, the Lotka–Volterra
 * trajectory). When more individuals exist than the quality tier draws, one figure stands for
 * a fixed number of them for the whole run (the view says how many).
 */
import { representative } from '../view3d/numbers';
import { logistic, type LvParams } from './ecology';
import type { LogisticState } from './store';

export interface PopulationMoment {
  /** The model's value at t (continuous). */
  value: number;
  /** Figures drawn: round(value / per), at most the capacity. */
  shown: number;
}

/** Largest N the logistic curve reaches on [0, tEnd] (it is monotone: an end point). */
export function logisticPeak(st: LogisticState): number {
  return Math.max(st.N0, logistic(st.N0, st.r, st.K, st.tEnd));
}

/** Individuals per figure, the same for every moment of the run. */
export function figuresFor(peak: number, maxFigures: number): { per: number; capacity: number } {
  const { per } = representative(peak, maxFigures);
  return { per, capacity: Math.max(1, Math.round(peak / per)) };
}

export function logisticMoment(st: LogisticState, t: number, per: number): PopulationMoment {
  const value = logistic(st.N0, st.r, st.K, Math.max(0, Math.min(st.tEnd, t)));
  return { value, shown: Math.max(0, Math.round(value / per)) };
}

export interface LvTrajectory {
  t: number[];
  x: number[];
  y: number[];
}

/**
 * The trajectory sample at time t (the nearest computed point: every number shown is one the
 * model computed, never an interpolation).
 */
export function lvSampleAt(traj: LvTrajectory, t: number): number {
  const n = traj.t.length;
  if (n === 0) return 0;
  const t0 = traj.t[0] ?? 0;
  const t1 = traj.t[n - 1] ?? t0;
  if (t1 <= t0) return 0;
  const k = Math.round(((Math.max(t0, Math.min(t1, t)) - t0) / (t1 - t0)) * (n - 1));
  return Math.max(0, Math.min(n - 1, k));
}

export function lvPeaks(traj: LvTrajectory): { prey: number; predators: number } {
  return { prey: Math.max(0, ...traj.x), predators: Math.max(0, ...traj.y) };
}

export function lvMoment(
  traj: LvTrajectory,
  k: number,
  per: { prey: number; predators: number },
): { t: number; prey: PopulationMoment; predators: PopulationMoment } {
  const x = traj.x[k] ?? 0;
  const y = traj.y[k] ?? 0;
  return {
    t: traj.t[k] ?? 0,
    prey: { value: x, shown: Math.max(0, Math.round(x / per.prey)) },
    predators: { value: y, shown: Math.max(0, Math.round(y / per.predators)) },
  };
}

export type { LvParams };
