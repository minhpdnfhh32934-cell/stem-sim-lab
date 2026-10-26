import type { SimulationEngine } from '@/core/sim/engine';
import { dopri5 } from '@/core/ode/dopri5';
import type { Params } from '../types';
import {
  harmonicFrequency,
  harmonicRatio,
  incident,
  isWhole,
  reflected,
  speedForHarmonic,
  standing,
  waveSpeed,
  type Wave,
} from './model';

/** State: [phase ωt (unwrapped), y₁(x_P), y₂(x_P), y(x_P)]. */
export const SW = { phi: 0, y1: 1, y2: 2, y: 3 } as const;

/** What the problem asks for (the first choice of the scene). */
export const MODE = { frequency: 0, speed: 1, harmonic: 2 } as const;

/** The mode choice; anything else (e.g. from an old file) reads as "find f". */
export function modeOf(p: Params): number {
  const m = Math.round(p.mode ?? MODE.frequency);
  return m === MODE.speed || m === MODE.harmonic ? m : MODE.frequency;
}

/** Most loops the picture and the lattice check handle (the n slider's maximum). */
export const MAX_LOOPS = 20;

export interface StandingInput {
  mode: number;
  L: number;
  /** Amplitude of each component wave (m); antinodes swing with 2A. */
  A: number;
  xP: number;
  /** v from T and μ (modes "→ f" and "→ n" only). */
  fromTension: boolean;
  tension: number;
  muL: number;
  /** Number of half wavelengths m = 2Lf/v (equals n when the string resonates). */
  m: number;
  /** Harmonic number, or null when no whole number of half wavelengths fits. */
  n: number | null;
  f: number;
  v: number;
}

export function standingInput(p: Params): StandingInput {
  const mode = modeOf(p);
  const L = p.L ?? 1.2;
  const fromTension = mode !== MODE.speed && (p.vFrom ?? 0) > 0.5;
  const tension = p.tension ?? 2;
  const muL = p.muL ?? 0.005;
  const given = fromTension ? waveSpeed(tension, muL) : (p.v ?? 20);
  const pn = p.n ?? 3;
  // n given by the learner: a whole n ≥ 1 is required (validate() says so), never rounded.
  const nGiven = isWhole(pn) && Math.round(pn) >= 1 ? Math.round(pn) : null;
  const base = { mode, L, A: p.A ?? 0.005, xP: p.xP ?? 0.2, fromTension, tension, muL };
  if (mode === MODE.speed) {
    const f = p.f ?? 25;
    return { ...base, f, v: speedForHarmonic(pn, f, L), m: pn, n: nGiven };
  }
  if (mode === MODE.harmonic) {
    const f = p.f ?? 25;
    const m = harmonicRatio(L, f, given);
    return { ...base, f, v: given, m, n: isWhole(m) && Math.round(m) >= 1 ? Math.round(m) : null };
  }
  return { ...base, f: harmonicFrequency(pn, given, L), v: given, m: pn, n: nGiven };
}

/** The two travelling waves of mode n (k = nπ/L exactly, so x = L is a node), or null. */
export function waveOf(q: StandingInput): Wave | null {
  if (q.n === null || !hasFrequency(q) || !(q.L > 0)) return null;
  return { A: q.A, k: (q.n * Math.PI) / q.L, omega: 2 * Math.PI * q.f };
}

const hasFrequency = (q: StandingInput) => Number.isFinite(q.f) && q.f > 0;

/** Run length shown by default: 20 periods. */
export const runEnd = (q: StandingInput) => (hasFrequency(q) ? 20 / q.f : 1);

/** Fixed step Δt ≤ T/200, so slow playback still gets a new state on every frame. */
export const stepOf = (q: StandingInput) =>
  hasFrequency(q) ? Math.min(1 / 240, 1 / (200 * q.f)) : 1 / 240;

/**
 * Standing wave evaluated in closed form at t = i·Δt (no accumulation, no truncation error).
 * Nothing is draggable.
 */
export class StandingWaveEngine implements SimulationEngine<Params> {
  readonly id = 'phys.standingWave';
  readonly stateSize = 4;
  dt = 1 / 240;
  private t0 = 0;
  private steps = 0;
  private q: StandingInput = standingInput({});
  private w: Wave | null = null;
  private tEnd = 1;

  reset(p: Params): void {
    this.q = standingInput(p);
    this.w = waveOf(this.q);
    this.dt = stepOf(this.q);
    this.t0 = 0;
    this.steps = 0;
    this.tEnd = p.tEnd ?? runEnd(this.q);
  }

  step(): void {
    this.steps++;
  }

  time(): number {
    return this.t0 + this.steps * this.dt;
  }

  readState(out: Float64Array): void {
    const t = this.time();
    const w = this.w;
    const x = this.q.xP;
    out[SW.phi] = w ? w.omega * t : 0;
    out[SW.y1] = w ? incident(w, x, t) : 0;
    out[SW.y2] = w ? reflected(w, x, t) : 0;
    out[SW.y] = w ? standing(w, x, t) : 0;
  }

  writeState(_s: Float64Array, t: number): void {
    this.t0 = t;
    this.steps = 0;
  }

  finished(): boolean {
    return this.time() >= this.tEnd;
  }
}

/**
 * Independent check: the wave equation y_tt = v²·y_xx on N equal cells with both ends fixed
 * (method of lines), integrated with DOPRI5 from the engine's initial state of mode n:
 * y_i(0) = 0, ẏ_i(0) = 2Aω·sin(k·x_i). Returns y at x_i = i·L/N (i = 0 … N) at each time.
 * The lattice knows only v, L and the clamped ends; its mode frequency
 * ω_N = (2v/Δx)·sin(kΔx/2) tends to ω = v·k as Δx → 0 (error O(Δx²)).
 */
export function latticeAt(
  q: { L: number; v: number; n: number; A: number },
  N: number,
  times: readonly number[],
): Float64Array[] {
  const dx = q.L / N;
  const k = (q.n * Math.PI) / q.L;
  const omega = q.v * k;
  const M = N - 1;
  const y0 = new Float64Array(2 * M);
  for (let i = 1; i < N; i++) y0[M + i - 1] = 2 * q.A * omega * Math.sin(k * i * dx);
  const rhs = latticeRhs(M, (q.v / dx) ** 2);
  const out: Float64Array[] = [];
  let y: Float64Array = y0;
  let t = 0;
  for (const ti of times) {
    if (ti > t) {
      y = dopri5(rhs, y, t, ti, { rtol: 1e-11, atol: 1e-14 * q.A }).y;
      t = ti;
    }
    const row = new Float64Array(N + 1);
    for (let i = 1; i < N; i++) row[i] = y[i - 1] ?? 0;
    out.push(row);
  }
  return out;
}

/**
 * Frequency of mode n measured on the N-cell lattice with DOPRI5: the period is the time
 * between two falling zero crossings of the modal amplitude Σ y_i·sin(k·x_i); the lattice
 * dispersion ω_N = (2v/Δx)·sin(kΔx/2) is then inverted for k, giving f = v·k/(2π).
 */
export function latticeFrequency(L: number, v: number, n: number, N = 200): number {
  const dx = L / N;
  const omegaN = latticeOmega(L, v, n, N);
  return (v * (2 / dx) * Math.asin((omegaN * dx) / (2 * v))) / (2 * Math.PI);
}

/** Angular frequency ω_N of mode n measured on the N-cell lattice (no dispersion inverted). */
export function latticeOmega(L: number, v: number, n: number, N = 200): number {
  const dx = L / N;
  const k = (n * Math.PI) / L;
  const M = N - 1;
  const shape = Float64Array.from({ length: M }, (_, i) => Math.sin(k * (i + 1) * dx));
  const y0 = new Float64Array(2 * M);
  for (let i = 0; i < M; i++) y0[M + i] = shape[i] ?? 0;
  const T = (2 * L) / (n * v);
  const r = dopri5(latticeRhs(M, (v / dx) ** 2), y0, 0, 1.6 * T, {
    rtol: 1e-10,
    atol: 1e-13,
    events: [
      {
        id: 'mode',
        direction: -1,
        g: (_t, y) => {
          let a = 0;
          for (let i = 0; i < M; i++) a += (y[i] ?? 0) * (shape[i] ?? 0);
          return a;
        },
      },
    ],
  });
  const [a, b] = r.events;
  return a && b ? (2 * Math.PI) / (b.t - a.t) : Number.NaN;
}

const unitLattice = new Map<number, number>();

/**
 * `latticeFrequency` for the solution's check, measured once per n: in units of L and L/v the
 * lattice equation is the same for every string, so f = (v/L)·f(L = 1, v = 1) exactly.
 */
export function checkedFrequency(L: number, v: number, n: number): number {
  // A mode needs a whole n ≥ 1 (else DOPRI5 would search a million steps for crossings).
  if (!(n >= 1) || !Number.isInteger(n)) return Number.NaN;
  let f1 = unitLattice.get(n);
  if (f1 === undefined) {
    f1 = latticeFrequency(1, 1, n);
    if (unitLattice.size >= 64) unitLattice.clear();
    unitLattice.set(n, f1);
  }
  return (v / L) * f1;
}

/** y = [u₁ … u_M, u̇₁ … u̇_M]; ü_i = (v/Δx)²·(u_{i−1} − 2u_i + u_{i+1}), u₀ = u_N = 0. */
function latticeRhs(M: number, c2: number) {
  return (_t: number, y: Float64Array, d: Float64Array) => {
    for (let i = 0; i < M; i++) {
      const left = i > 0 ? (y[i - 1] ?? 0) : 0;
      const right = i < M - 1 ? (y[i + 1] ?? 0) : 0;
      d[i] = y[M + i] ?? 0;
      d[M + i] = c2 * (left - 2 * (y[i] ?? 0) + right);
    }
  };
}
