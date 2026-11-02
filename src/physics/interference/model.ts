import { isWhole } from '../wave/model';

/**
 * Two point sources S₁, S₂ on an ideal water surface, in phase: each oscillates as a·cos(ωᵢt).
 * The wave reaches a point M at distance rᵢ with the same amplitude a (no damping, no spreading):
 *   uᵢ(M, t) = a·cos(ωᵢt − kᵢrᵢ),  kᵢ = 2π/λᵢ = ωᵢ/v,  u = u₁ + u₂.
 * Equal frequencies: u = 2a·cos(π(r₂ − r₁)/λ)·cos(ωt − π(r₁ + r₂)/λ), amplitude 2a|cos(π(r₂ − r₁)/λ)|:
 * maxima where r₂ − r₁ = kλ, minima where r₂ − r₁ = (k + ½)λ.
 * Different frequencies: the envelope 2a|cos(½[(ω₁ − ω₂)t − (k₁r₁ − k₂r₂)])| repeats with
 * f_beat = |f₁ − f₂|.
 * Sources: SGK Vật lí 11 (Giao thoa sóng); Halliday–Resnick–Walker ch. 17 (interference, beats).
 */
export interface Source {
  x: number;
  y: number;
  /** ω = 2πf (rad/s). */
  omega: number;
  /** k = 2π/λ (rad/m). */
  k: number;
}

/** Displacement at distance r from a source of amplitude a. */
export const waveAt = (s: Source, a: number, r: number, t: number) =>
  a * Math.cos(s.omega * t - s.k * r);

/** Amplitude at M for equal frequencies, path difference Δr = r₂ − r₁. */
export const amplitudeAt = (a: number, dr: number, lambda: number) =>
  2 * a * Math.abs(Math.cos((Math.PI * dr) / lambda));

/** Envelope 2a|cos(½[(ω₁ − ω₂)t − (k₁r₁ − k₂r₂)])| (constant 2a|cos(πΔr/λ)| for equal frequencies). */
export const envelopeAt = (s1: Source, s2: Source, a: number, r1: number, r2: number, t: number) =>
  2 * a * Math.abs(Math.cos(((s1.omega - s2.omega) * t - (s1.k * r1 - s2.k * r2)) / 2));

/** Whole numbers j ≥ 0 with j < x; x counts as whole within round-off only (`isWhole`). */
const below = (x: number) => (x <= 0 ? 0 : isWhole(x) ? Math.round(x) : Math.ceil(x));

/** Maxima strictly between the sources (sources excluded): whole k with |k| < d/λ. */
export const maximaBetween = (d: number, lambda: number) => 1 + 2 * below(d / lambda - 1);

/** Minima strictly between the sources: k + ½ with |k + ½| < d/λ. */
export const minimaBetween = (d: number, lambda: number) => 2 * below(d / lambda - 0.5);

/** Order of M: (r₂ − r₁)/λ — whole on a maximum, whole + ½ on a minimum. */
export const orderAt = (dr: number, lambda: number) => dr / lambda;

/** Beat frequency |f₁ − f₂|. */
export const beatFrequency = (f1: number, f2: number) => Math.abs(f1 - f2);
