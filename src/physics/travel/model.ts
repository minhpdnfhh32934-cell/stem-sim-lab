import type { Params } from '../types';

/**
 * A sinusoidal wave sent along Ox by a source O that starts at t = 0 moving up (SGK Vật lí 11
 * KNTT Bài 8, Hình 8.2, tr. 33): the source moves as u_O = A·sin 2πft, and a point at distance x
 * repeats that motion x/v later, so u(x, t) = A·sin 2πf(t − x/v) once the wave has reached it
 * (t ≥ x/v) and 0 before. In a transverse wave u is across Ox, in a longitudinal wave along Ox
 * (Bài 9). The medium's parts only oscillate about their places: the wave carries energy, not
 * matter (Bài 9, mục III).
 */
export const KIND = { transverse: 0, longitudinal: 1 } as const;

export interface Travel {
  /** 0 transverse (sóng ngang), 1 longitudinal (sóng dọc). */
  kind: number;
  /** Amplitude A (m). */
  A: number;
  /** Frequency f of the source (Hz). */
  f: number;
  /** Wave speed v (m/s). */
  v: number;
  /** Distance OM of the watched point M from the source (m). */
  xM: number;
}

/**
 * Defaults from the textbook's question 1, tr. 35: a boat makes 24 oscillations in 40 s
 * (f = 0,6 Hz), the wave is 12 cm high, and a crest reaches the bank 10 m away after 5 s
 * (v = 2 m/s); M is the bank.
 */
export const TRAVEL_DEFAULTS = { kind: KIND.transverse, A: 0.12, f: 0.6, v: 2, xM: 10 } as const;

export function travelInput(p: Params): Travel {
  const kind = Math.round(p.kind ?? KIND.transverse) === KIND.longitudinal ? 1 : 0;
  return {
    kind,
    A: p.A ?? TRAVEL_DEFAULTS.A,
    f: p.f ?? TRAVEL_DEFAULTS.f,
    v: p.v ?? TRAVEL_DEFAULTS.v,
    xM: p.xM ?? TRAVEL_DEFAULTS.xM,
  };
}

/** T = 1/f (Bài 8, mục III). */
export const period = (q: Travel) => 1 / q.f;
/** λ = vT = v/f (Bài 8, mục III). */
export const wavelength = (q: Travel) => q.v / q.f;
/** The wave reaches x at t = x/v. */
export const arrival = (q: Travel, x: number) => x / q.v;
/** How far the wave has gone at t (the front). */
export const front = (q: Travel, t: number) => q.v * Math.max(0, t);
/** M lags behind O by Δφ = 2πx/λ (Bài 8, mục II: M at λ/4 lags by π/2). */
export const phaseLag = (q: Travel, x: number) => (2 * Math.PI * x) / wavelength(q);

/** Displacement of the part at x at time t: A·sin 2πf(t − x/v), 0 before the wave arrives. */
export function displacement(q: Travel, x: number, t: number): number {
  const tau = t - x / q.v;
  return tau >= 0 ? q.A * Math.sin(2 * Math.PI * q.f * tau) : 0;
}

/** Velocity of the part at x: 2πfA·cos 2πf(t − x/v) after the wave arrives, 0 before. */
export function partVelocity(q: Travel, x: number, t: number): number {
  const tau = t - x / q.v;
  return tau >= 0 ? 2 * Math.PI * q.f * q.A * Math.cos(2 * Math.PI * q.f * tau) : 0;
}

/** The inputs make a wave: A, f, v positive and M on the positive side of O. */
export const isValid = (q: Travel) =>
  [q.A, q.f, q.v].every((x) => Number.isFinite(x) && x > 0) && Number.isFinite(q.xM) && q.xM >= 0;
