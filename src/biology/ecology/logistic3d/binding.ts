/**
 * Numbers of the logistic-growth 3D habitat (pure, tested), all from the lesson's model
 * (`ecology.ts`: the exact solution N(t) = K / (1 + (K/N₀ − 1)e^(−rt)), dN/dt = rN(1 − N/K)):
 *
 * - the moment shown at time t of the lesson's span [0, tEnd]: N(t), N/K, dN/dt, the growth rate
 *   per individual r(1 − N/K);
 * - how many figures the picture draws for it: one figure per `per` individuals, a "nice" step
 *   (`drawScale` of the larger of the run's peak and K, so the fence's K figures fit as well)
 *   shared by the whole run, so the figures always mean the same number; drawn = round(N(t) / per)
 *   (the chip says "làm tròn");
 * - the gauge column: filled to N / top, marks at K and K/2; the growth arrow's length is
 *   |dN/dt| over the largest |dN/dt| of the run (rK/4 when N₀ ≤ K);
 * - the food patches (illustration of the share of the carrying capacity already used): of
 *   `patches` patches, round(patches · min(1, N/K)) are drawn grazed.
 *
 * Where a figure stands, its shape, the fence, the plants and the motion are illustration.
 */
import { SERIES_VARS } from '@/ui/charts/uplot';
import { INSTANCE_SHARE } from '@/ui/three/quality3d';
import { drawScale } from '../../view3d/sampling';
import { logistic, logisticInflection } from '../ecology';
import type { LogisticState } from '../store';

/**
 * Most figures drawn: the 3D quality table's instance share of the tier's particle budget, never
 * more than the meadow shows legibly with room between the animals (the default K = 1 000 draws
 * as 200 figures of 5 at N = K).
 */
export const LEGIBLE_FIGURES = 200;
export function figureCap(maxParticles: number): number {
  return Math.min(LEGIBLE_FIGURES, Math.max(60, Math.round(maxParticles * INSTANCE_SHARE)));
}

/** The population's colour: the 2D chart's N(t) series (series 1). */
export const POPULATION_TOKEN = SERIES_VARS[0] ?? '--chart-1';
/** The carrying capacity's colour: the 2D chart's K line (series colour 2). */
export const CAPACITY_TOKEN = SERIES_VARS[2] ?? '--chart-3';

export interface LogisticModel3D {
  N0: number;
  r: number;
  K: number;
  tEnd: number;
  /** Largest N of the run on [0, tEnd] (N(t) is monotone: an end point). */
  peak: number;
  /** Individuals one figure stands for (the same at every moment; fits max(peak, K)). */
  per: number;
  /** Most figures any moment draws: round(peak / per). */
  slots: number;
  /** Figures at N = K: round(K / per) (the fence holds this many slots). */
  kSlots: number;
  /** The gauge's full scale: 1.08 × max(K, peak). */
  top: number;
  /** Time of the inflection N = K/2, or NaN when the run starts at or above K/2. */
  tStar: number;
  /** rK/4: the largest growth rate the logistic model allows for N between 0 and K. */
  maxRate: number;
  /** The largest |dN/dt| of the run: the growth arrow's full length. */
  arrowRef: number;
}

export interface LogisticMoment {
  /** Time shown (clamped to the run). */
  t: number;
  /** The model's N(t) (continuous). */
  N: number;
  /** Figures drawn: round(N / per). */
  shown: number;
  /** N / top: the gauge column's filled share. */
  fill: number;
  /** N / K. */
  ratio: number;
  /** dN/dt = rN(1 − N/K) (negative when N > K). */
  dNdt: number;
  /** Growth rate per individual r(1 − N/K) = (dN/dt) / N. */
  perCapita: number;
  /** dN/dt / arrowRef, in [−1, 1]: the growth arrow (up when positive). */
  arrow: number;
}

/** dN/dt of the logistic model at N. */
export const growthRate = (r: number, K: number, N: number): number => r * N * (1 - N / K);

export function logisticModel3d(
  st: Pick<LogisticState, 'N0' | 'r' | 'K' | 'tEnd'>,
  cap: number,
): LogisticModel3D {
  const { N0, r, K, tEnd } = st;
  const end = logistic(N0, r, K, tEnd);
  const peak = Math.max(N0, end);
  // One scale for the run and the fence: K figures fit too, even when the run stays far below K.
  const per = drawScale(Math.max(peak, K), cap);
  const maxRate = (r * K) / 4;
  return {
    N0,
    r,
    K,
    tEnd,
    peak,
    per,
    slots: Math.round(peak / per),
    kSlots: Math.round(K / per),
    top: 1.08 * Math.max(K, peak),
    tStar: logisticInflection(N0, r, K),
    maxRate,
    // Below K, |dN/dt| never exceeds rK/4 (the parabola's top); above K it is largest at N₀.
    arrowRef: Math.max(maxRate, Math.abs(growthRate(r, K, N0))),
  };
}

export function momentAt(model: LogisticModel3D, time: number): LogisticMoment {
  const t = Math.max(0, Math.min(model.tEnd, Number.isFinite(time) ? time : 0));
  const N = logistic(model.N0, model.r, model.K, t);
  const dNdt = growthRate(model.r, model.K, N);
  return {
    t,
    N,
    shown: Math.max(0, Math.min(model.slots, Math.round(N / model.per))),
    fill: model.top > 0 ? N / model.top : 0,
    ratio: N / model.K,
    dNdt,
    perCapita: model.r * (1 - N / model.K),
    arrow: model.arrowRef > 0 ? dNdt / model.arrowRef : 0,
  };
}

/**
 * The N(t) curve under the time slider: `samples` + 1 points (u = t / tEnd, v = N(t) / top, both
 * in [0, 1]) on the gauge column's scale, so the slider's curve and the column agree.
 */
export function curvePoints(model: LogisticModel3D, samples = 120): [number, number][] {
  const n = Math.max(1, Math.floor(samples));
  return Array.from({ length: n + 1 }, (_, i) => {
    const u = i / n;
    const N = logistic(model.N0, model.r, model.K, u * model.tEnd);
    return [u, model.top > 0 ? N / model.top : 0];
  });
}

/** Whether the inflection t* lies on the lesson's time span (the "Tới t*" button). */
export function tStarInRun(model: LogisticModel3D): boolean {
  return Number.isFinite(model.tStar) && model.tStar >= 0 && model.tStar <= model.tEnd;
}

/** Food patches drawn grazed: round(patches · min(1, N/K)) (illustration of N/K). */
export function grazedPatches(patches: number, ratio: number): number {
  const n = Math.max(0, Math.floor(patches));
  return Math.max(0, Math.min(n, Math.round(n * Math.min(1, Math.max(0, ratio)))));
}

/** Selection of the 3D view: a figure (its slot), the gauge column or a food patch. */
export type LogiSelection = { kind: 'figure'; slot: number } | { kind: 'gauge' } | { kind: 'food' };

export function selectionId(s: LogiSelection | null): string | null {
  if (!s) return null;
  return s.kind === 'figure' ? `figure:${String(s.slot)}` : s.kind;
}

export function parseSelection(id: string | null): LogiSelection | null {
  if (id === 'gauge' || id === 'food') return { kind: id };
  const m = id ? /^figure:(\d+)$/.exec(id) : null;
  return m ? { kind: 'figure', slot: Number(m[1]) } : null;
}
