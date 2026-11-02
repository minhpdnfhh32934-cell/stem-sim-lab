import type { SimulationEngine } from '@/core/sim/engine';
import { dopri5 } from '@/core/ode/dopri5';
import type { Params } from '../types';
import { beatFrequency, envelopeAt, waveAt, type Source } from './model';

/** State: [t, u₁(M), u₂(M), u(M), envelope at M]. */
export const IF = { t: 0, u1: 1, u2: 2, u: 3, env: 4 } as const;

/** Same frequency (a steady interference pattern) or two frequencies (beats). */
export const MODE = { same: 0, beats: 1 } as const;

/** The mode choice; anything else (e.g. from an old file) reads as "same frequency". */
export const modeOf = (p: Params) =>
  Math.round(p.mode ?? MODE.same) === MODE.beats ? MODE.beats : MODE.same;

/** Most wavelengths between the sources the picture and the scan handle. */
export const MAX_RATIO = 100;

export interface InterferenceInput {
  mode: number;
  /** Source separation S₁S₂ (m); S₁ = (−d/2, 0), S₂ = (d/2, 0). */
  d: number;
  /** Amplitude of each source (m). */
  a: number;
  f1: number;
  /** Equals f1 in the "same frequency" mode. */
  f2: number;
  v: number;
  /** v from λ·f₁ (λ typed) instead of typed. */
  fromLambda: boolean;
  lambda1: number;
  lambda2: number;
  /** Distances MS₁, MS₂ (m). */
  d1: number;
  d2: number;
  /** M on the side y ≥ 0, or null when no point is d₁ from S₁ and d₂ from S₂. */
  m: { x: number; y: number } | null;
}

/** Point at distance d₁ from S₁ = (−d/2, 0) and d₂ from S₂ = (d/2, 0), y ≥ 0; null if none. */
export function pointM(d: number, d1: number, d2: number): { x: number; y: number } | null {
  const tol = 1e-9 * Math.max(d, d1, d2);
  if (!(d > 0 && d1 > 0 && d2 > 0) || Math.abs(d1 - d2) > d + tol || d > d1 + d2 + tol) return null;
  const x = (d1 * d1 - d2 * d2) / (2 * d);
  return { x, y: Math.sqrt(Math.max(0, d1 * d1 - (x + d / 2) ** 2)) };
}

export function interferenceInput(p: Params): InterferenceInput {
  const mode = modeOf(p);
  const fromLambda = (p.waveFrom ?? 0) > 0.5;
  const f1 = p.f ?? 10;
  const f2 = mode === MODE.beats ? (p.f2 ?? 11) : f1;
  const v = fromLambda ? (p.lambda ?? 0.03) * f1 : (p.v ?? 0.3);
  const d = p.d ?? 0.1;
  const d1 = p.d1 ?? 0.09;
  const d2 = p.d2 ?? 0.12;
  return {
    mode,
    d,
    a: p.a ?? 2e-4,
    f1,
    f2,
    v,
    fromLambda,
    lambda1: v / f1,
    lambda2: v / f2,
    d1,
    d2,
    m: pointM(d, d1, d2),
  };
}

export function sourcesOf(q: InterferenceInput): [Source, Source] {
  const src = (x: number, f: number): Source => ({
    x,
    y: 0,
    omega: 2 * Math.PI * f,
    k: (2 * Math.PI * f) / q.v,
  });
  return [src(-q.d / 2, q.f1), src(q.d / 2, q.f2)];
}

const fMax = (q: InterferenceInput) => Math.max(q.f1, q.f2);
const hasFrequency = (q: InterferenceInput) => Number.isFinite(fMax(q)) && fMax(q) > 0;

/** Run shown by default: 20 periods, or 3 beat periods when that is longer. */
export function runEnd(q: InterferenceInput): number {
  if (!hasFrequency(q)) return 1;
  const fb = beatFrequency(q.f1, q.f2);
  return q.mode === MODE.beats && fb > 0 ? Math.max(20 / fMax(q), 3 / fb) : 20 / fMax(q);
}

/** Fixed step Δt ≤ T/200 of the faster source, so slow playback gets a new state every frame. */
export const stepOf = (q: InterferenceInput) =>
  hasFrequency(q) ? Math.min(1 / 240, 1 / (200 * fMax(q))) : 1 / 240;

/**
 * Both waves and their sum at M in closed form at t = i·Δt (no accumulation). Nothing moves in
 * the engine: a dragged source or M changes the parameters (`BodyDef.dragTo`), not the state.
 */
export class InterferenceEngine implements SimulationEngine<Params> {
  readonly id = 'phys.interference';
  readonly stateSize = 5;
  dt = 1 / 240;
  private t0 = 0;
  private steps = 0;
  private q: InterferenceInput = interferenceInput({});
  private s: [Source, Source] = sourcesOf(this.q);
  private tEnd = 1;

  reset(p: Params): void {
    this.q = interferenceInput(p);
    this.s = sourcesOf(this.q);
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
    const { a, d1, d2 } = this.q;
    const [s1, s2] = this.s;
    out[IF.t] = t;
    out[IF.u1] = waveAt(s1, a, d1, t);
    out[IF.u2] = waveAt(s2, a, d2, t);
    out[IF.u] = (out[IF.u1] ?? 0) + (out[IF.u2] ?? 0);
    out[IF.env] = envelopeAt(s1, s2, a, d1, d2, t);
  }

  writeState(_s: Float64Array, t: number): void {
    this.t0 = t;
    this.steps = 0;
  }

  finished(): boolean {
    return this.time() >= this.tEnd;
  }
}

/** Amplitude of a·cos(ωt − kr₁) + a·cos(ωt − kr₂) as the length of the sum of two phasors. */
export const phasorAmplitude = (a: number, k: number, r1: number, r2: number) =>
  a * Math.hypot(Math.cos(k * r1) + Math.cos(k * r2), Math.sin(k * r1) + Math.sin(k * r2));

/**
 * Independent count of the maxima and minima strictly between the sources: the squared phasor
 * amplitude is sampled along S₁S₂ (≥ 400 points per λ, and ever closer to each source), and its
 * interior peaks and dips are counted.
 * shortcut: a peak closer than ~10⁻⁷λ to a source is missed (d/λ within ~10⁻⁷ of a whole or
 * half-whole number without being one); upgrade to an exact bracket if such inputs matter.
 */
export function scanSegment(d: number, lambda: number): { maxima: number; minima: number } {
  const k = (2 * Math.PI) / lambda;
  const h = Math.min(lambda, d) / 400;
  const s: number[] = [];
  for (let j = 14; j >= 1; j--) s.push(h * 2 ** -j);
  const n = Math.floor(d / h - 0.5);
  for (let i = 1; i <= n; i++) s.push(i * h);
  for (let j = 1; j <= 14; j++) s.push(d - h * 2 ** -j);
  // A turn from rising to falling is a peak, falling to rising a dip. Steps within round-off
  // (A ≤ 4: ~10⁻¹⁵; real neighbouring samples differ by more than 10⁻¹²) keep the direction.
  const tol = 1e-13;
  let dir = 0;
  let maxima = 0;
  let minima = 0;
  let prev = phasorAmplitude(1, k, s[0] ?? 0, d - (s[0] ?? 0)) ** 2;
  for (const x of s) {
    const A = phasorAmplitude(1, k, x, d - x) ** 2;
    if (Math.abs(A - prev) <= tol) continue;
    const nd = A > prev ? 1 : -1;
    if (dir === 1 && nd === -1) maxima++;
    if (dir === -1 && nd === 1) minima++;
    dir = nd;
    prev = A;
  }
  return { maxima, minima };
}

/**
 * Beat period measured on a sampled displacement u(i·Δt): the carrier peaks of |u| (each refined
 * by a parabola through three samples) trace the envelope; the envelope's maxima (above half the
 * highest peak, refined by a parabola through three peaks) are one beat period apart.
 * NaN when fewer than two envelope maxima are found.
 */
export function measureBeatPeriod(u: ArrayLike<number>, dt: number): number {
  const pt: number[] = [];
  const pa: number[] = [];
  for (let i = 1; i < u.length - 1; i++) {
    const [y0, y1, y2] = [Math.abs(u[i - 1] ?? 0), Math.abs(u[i] ?? 0), Math.abs(u[i + 1] ?? 0)];
    if (!(y1 >= y0 && y1 > y2)) continue;
    const den = y0 - 2 * y1 + y2;
    const sh = den < 0 ? (0.5 * (y0 - y2)) / den : 0;
    pt.push((i + sh) * dt);
    pa.push(y1 - 0.25 * (y0 - y2) * sh);
  }
  const top = Math.max(0, ...pa);
  const tops: number[] = [];
  for (let j = 1; j < pa.length - 1; j++) {
    const [x0, x1, x2] = [pt[j - 1] ?? 0, pt[j] ?? 0, pt[j + 1] ?? 0];
    const [y0, y1, y2] = [pa[j - 1] ?? 0, pa[j] ?? 0, pa[j + 1] ?? 0];
    if (!(y1 >= y0 && y1 > y2 && y1 > top / 2)) continue;
    const num = (x1 - x0) ** 2 * (y1 - y2) - (x1 - x2) ** 2 * (y1 - y0);
    const den = (x1 - x0) * (y1 - y2) - (x1 - x2) * (y1 - y0);
    tops.push(den !== 0 ? x1 - (0.5 * num) / den : x1);
  }
  const first = tops[0];
  const last = tops[tops.length - 1];
  return first !== undefined && last !== undefined && tops.length >= 2
    ? (last - first) / (tops.length - 1)
    : Number.NaN;
}

/** Most samples `measuredBeatPeriod` takes (beyond it the solution shows no check). */
const MAX_SAMPLES = 200_000;

/** Beat period measured on the engine's own displacement at M over 3.5 beat periods. */
export function measuredBeatPeriod(p: Params): number {
  const q = interferenceInput(p);
  const fb = beatFrequency(q.f1, q.f2);
  if (!(fb > 0) || !hasFrequency(q)) return Number.NaN;
  const e = new InterferenceEngine();
  e.reset({ ...p, tEnd: 3.5 / fb });
  const n = Math.ceil(3.5 / fb / e.dt);
  if (n > MAX_SAMPLES) return Number.NaN;
  const u = new Float64Array(n);
  const s = new Float64Array(e.stateSize);
  for (let i = 0; i < n; i++) {
    e.readState(s);
    u[i] = s[IF.u] ?? 0;
    e.step();
  }
  return measureBeatPeriod(u, e.dt);
}

/** ½(1 − cos πs) on 0 ≤ s ≤ 1: a switch-on with zero slope at both ends. */
const ramp = (s: number) => (s <= 0 ? 0 : s >= 1 ? 1 : 0.5 * (1 - Math.cos(Math.PI * s)));

/**
 * Independent check of one source's wave with DOPRI5: the wave equation u_tt = v²·u_rr along a
 * ray, on cells of λ/`perWavelength` (method of lines), driven at r = 0 by a·sin(ωt) switched on
 * smoothly over two periods, starting at rest; the far end is beyond the front. Returns u at the
 * distances `rs` (linear interpolation) at each time. Once the switch-on has passed
 * (t − r/v ≥ 2T) the exact solution is a·sin(ω(t − r/v)), the model's wave delayed by T/4; the
 * lattice converges to it with error O(Δx²).
 */
export function rayLattice(
  src: { a: number; f: number; v: number },
  perWavelength: number,
  rs: readonly number[],
  times: readonly number[],
): Float64Array[] {
  const lambda = src.v / src.f;
  const omega = 2 * Math.PI * src.f;
  const dx = lambda / perWavelength;
  const tEnd = Math.max(0, ...times);
  const N = Math.ceil((src.v * tEnd + 2 * lambda) / dx);
  const M = N - 1;
  const drive = (t: number) => src.a * Math.sin(omega * t) * ramp((t * src.f) / 2);
  const c2 = (src.v / dx) ** 2;
  const rhs = (t: number, y: Float64Array, d: Float64Array) => {
    for (let i = 0; i < M; i++) {
      const left = i > 0 ? (y[i - 1] ?? 0) : drive(t);
      const right = i < M - 1 ? (y[i + 1] ?? 0) : 0;
      d[i] = y[M + i] ?? 0;
      d[M + i] = c2 * (left - 2 * (y[i] ?? 0) + right);
    }
  };
  const out: Float64Array[] = [];
  let y: Float64Array = new Float64Array(2 * M);
  let t = 0;
  for (const ti of times) {
    if (ti > t) {
      y = dopri5(rhs, y, t, ti, { rtol: 1e-10, atol: 1e-13 * src.a }).y;
      t = ti;
    }
    const node = (j: number) => (j === 0 ? drive(t) : (y[j - 1] ?? 0));
    out.push(
      Float64Array.from(rs, (r) => {
        const j = Math.floor(r / dx);
        const w = r / dx - j;
        return (1 - w) * node(j) + w * node(j + 1);
      }),
    );
  }
  return out;
}
