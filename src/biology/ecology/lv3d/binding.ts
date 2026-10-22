/**
 * Numbers of the predator–prey 3D habitat (pure, tested), all from the lesson's model
 * (`ecology.ts`: the Lotka–Volterra trajectory computed by DOPRI5 in ln x, ln y, the same 801
 * samples as the 2D charts):
 *
 * - the moment shown at time t is the computed sample nearest t (`sampleAt`), never an
 *   interpolation: x, y, dx/dt = αx − βxy, dy/dt = δxy − γy, the rates per individual α − βy and
 *   δx − γ, and V = δx − γ ln x + βy − α ln y at that sample;
 * - how many figures the picture draws: one figure per `per` individuals for both species, a
 *   "nice" step (`drawScale` of the run's largest x plus its largest y), the same for the whole
 *   run; prey drawn = round(x / per), predators drawn = round(y / per) (the chip says "làm tròn");
 * - the two columns share one scale (top = 1.08 × the largest of the peaks, x* and y*, like the
 *   2D chart's one axis), with rings at x* = γ/δ and y* = α/β; each arrow's length is its rate
 *   over `rateRef`, the largest |dx/dt| or |dy/dt| among the run's computed samples;
 * - the phase-plane board: (x / xMax, y / yMax) with the 2D phase plot's axes (1.1 × the larger
 *   of the peak and the equilibrium value).
 *
 * Where a figure stands, its shape, the plants, the board's look and the motion are illustration.
 */
import { SERIES_VARS } from '@/ui/charts/uplot';
import { drawScale } from '../../view3d/sampling';
import { lvEquilibrium, lvInvariantLog, type LvParams } from '../ecology';

export { figureCap } from '../logistic3d/binding';

/**
 * Below this share of its full length a rate arrow is not drawn (too short to read as an arrow;
 * the plaque under the column still gives the rate). The arrows' scale itself is `rateRef`.
 */
export const ARROW_MIN = 0.12;

/** Prey: the 2D time chart's first series. Predators: its series colour 4 (`color: 3`). */
export const PREY_TOKEN = SERIES_VARS[0] ?? '--chart-1';
export const PREDATOR_TOKEN = SERIES_VARS[3] ?? '--chart-4';

/** The computed trajectory (ecology.ts `lotkaVolterra`). */
export interface LvTrajectory {
  t: readonly number[];
  x: readonly number[];
  y: readonly number[];
  u: readonly number[];
  v: readonly number[];
}

export interface LvModel3D {
  p: LvParams;
  traj: LvTrajectory;
  tEnd: number;
  /** Largest x and y among the computed samples. */
  peak: { prey: number; predators: number };
  /** Equilibrium (γ/δ, α/β) and the small-oscillation period 2π/√(αγ). */
  eq: { x: number; y: number; period: number };
  /** Individuals one figure stands for (both species, every moment of the run). */
  per: number;
  /** Most figures each species draws: round(peak / per). */
  slots: { prey: number; predators: number };
  /** The columns' full scale: 1.08 × max(peaks, x*, y*). */
  top: number;
  /** Largest |dx/dt| or |dy/dt| among the computed samples: an arrow's full length. */
  rateRef: number;
  /** The phase board's axes: 1.1 × max(peak, equilibrium value), as in the 2D phase plot. */
  xMax: number;
  yMax: number;
  /** V at t = 0 and the largest relative change of V along the run (as the chip). */
  V0: number;
  drift: number;
}

export interface LvMoment {
  /** Index of the computed sample shown. */
  k: number;
  /** The sample's time, x and y. */
  t: number;
  x: number;
  y: number;
  shown: { prey: number; predators: number };
  dxdt: number;
  dydt: number;
  /** α − βy and δx − γ: growth rate per prey and per predator. */
  preyRate: number;
  predatorRate: number;
  /** V at this sample. */
  V: number;
  /** x / top, y / top: the columns' filled shares. */
  fill: { prey: number; predators: number };
  /** dx/dt / rateRef, dy/dt / rateRef, in [−1, 1]. */
  arrow: { prey: number; predators: number };
  /** (x / xMax, y / yMax): the moment's point on the phase board. */
  plot: [number, number];
}

const dxdt = (p: LvParams, x: number, y: number) => p.alpha * x - p.beta * x * y;
const dydt = (p: LvParams, x: number, y: number) => p.delta * x * y - p.gamma * y;

export function lvModel3d(
  input: { p: LvParams; traj: LvTrajectory; tEnd: number; drift: number },
  cap: number,
): LvModel3D {
  const { p, traj, tEnd } = input;
  const peak = { prey: Math.max(0, ...traj.x), predators: Math.max(0, ...traj.y) };
  const eq = lvEquilibrium(p);
  const per = drawScale(peak.prey + peak.predators, cap);
  let rateRef = 0;
  traj.x.forEach((x, i) => {
    const y = traj.y[i] ?? 0;
    rateRef = Math.max(rateRef, Math.abs(dxdt(p, x, y)), Math.abs(dydt(p, x, y)));
  });
  return {
    p,
    traj,
    tEnd,
    peak,
    eq,
    per,
    slots: { prey: Math.round(peak.prey / per), predators: Math.round(peak.predators / per) },
    top: 1.08 * Math.max(peak.prey, peak.predators, eq.x, eq.y),
    rateRef,
    xMax: 1.1 * Math.max(peak.prey, eq.x),
    yMax: 1.1 * Math.max(peak.predators, eq.y),
    V0: lvInvariantLog(p, traj.u[0] ?? 0, traj.v[0] ?? 0),
    drift: input.drift,
  };
}

/**
 * Real seconds the whole time span plays in: 0.8 s per time unit (about 4 s per cycle at the
 * lesson's defaults), between 12 and 45 s. Only the speed of the picture, not a model value.
 */
export const playSeconds = (tEnd: number): number => Math.min(45, Math.max(12, tEnd * 0.8));

/** The computed sample nearest t (clamped to the run). */
export function sampleAt(traj: Pick<LvTrajectory, 't'>, time: number): number {
  const n = traj.t.length;
  if (n === 0) return 0;
  const t0 = traj.t[0] ?? 0;
  const t1 = traj.t[n - 1] ?? t0;
  if (!(t1 > t0)) return 0;
  const t = Number.isFinite(time) ? Math.max(t0, Math.min(t1, time)) : t0;
  return Math.max(0, Math.min(n - 1, Math.round(((t - t0) / (t1 - t0)) * (n - 1))));
}

/** The moment of the computed sample `k` (clamped to the run). */
export function momentOf(model: LvModel3D, k: number): LvMoment {
  const { p, traj } = model;
  const i = Math.max(0, Math.min(traj.t.length - 1, Math.round(k)));
  const x = traj.x[i] ?? 0;
  const y = traj.y[i] ?? 0;
  const ax = dxdt(p, x, y);
  const ay = dydt(p, x, y);
  const top = model.top > 0 ? model.top : 1;
  const ref = model.rateRef;
  return {
    k: i,
    t: traj.t[i] ?? 0,
    x,
    y,
    shown: {
      prey: Math.max(0, Math.min(model.slots.prey, Math.round(x / model.per))),
      predators: Math.max(0, Math.min(model.slots.predators, Math.round(y / model.per))),
    },
    dxdt: ax,
    dydt: ay,
    preyRate: p.alpha - p.beta * y,
    predatorRate: p.delta * x - p.gamma,
    V: lvInvariantLog(p, traj.u[i] ?? 0, traj.v[i] ?? 0),
    fill: { prey: x / top, predators: y / top },
    arrow: { prey: ref > 0 ? ax / ref : 0, predators: ref > 0 ? ay / ref : 0 },
    plot: [model.xMax > 0 ? x / model.xMax : 0, model.yMax > 0 ? y / model.yMax : 0],
  };
}

/** The moment shown at time t: the computed sample nearest t. */
export function momentAt(model: LvModel3D, time: number): LvMoment {
  return momentOf(model, sampleAt(model.traj, time));
}

/**
 * The x(t) and y(t) curves under the time slider, on the columns' scale: computed samples only
 * (every `step`-th, the last always), u = t / tEnd, v = value / top.
 */
export function curvePoints(
  model: LvModel3D,
  most = 240,
): { prey: [number, number][]; predators: [number, number][] } {
  const n = model.traj.t.length;
  const step = Math.max(1, Math.ceil(n / Math.max(2, most)));
  const prey: [number, number][] = [];
  const predators: [number, number][] = [];
  const span = model.tEnd > 0 ? model.tEnd : 1;
  const top = model.top > 0 ? model.top : 1;
  for (let i = 0; i < n; i += step) push(i);
  if ((n - 1) % step !== 0 && n > 0) push(n - 1);
  function push(i: number) {
    const u = (model.traj.t[i] ?? 0) / span;
    prey.push([u, (model.traj.x[i] ?? 0) / top]);
    predators.push([u, (model.traj.y[i] ?? 0) / top]);
  }
  return { prey, predators };
}

/** Every computed (x, y) on the phase board's axes (the orbit drawn on the board). */
export function orbitPoints(model: LvModel3D): [number, number][] {
  return model.traj.x.map((x, i) => [
    model.xMax > 0 ? x / model.xMax : 0,
    model.yMax > 0 ? (model.traj.y[i] ?? 0) / model.yMax : 0,
  ]);
}

/** Selection of the 3D view: an animal of either species (its slot), the columns or the board. */
export type LvSelection =
  | { kind: 'prey'; slot: number }
  | { kind: 'predator'; slot: number }
  | { kind: 'columns' }
  | { kind: 'board' };

export function selectionId(s: LvSelection | null): string | null {
  if (!s) return null;
  return s.kind === 'prey' || s.kind === 'predator' ? `${s.kind}:${String(s.slot)}` : s.kind;
}

export function parseSelection(id: string | null): LvSelection | null {
  if (id === 'columns' || id === 'board') return { kind: id };
  const m = id ? /^(prey|predator):(\d+)$/.exec(id) : null;
  if (!m) return null;
  return { kind: m[1] === 'prey' ? 'prey' : 'predator', slot: Number(m[2]) };
}
