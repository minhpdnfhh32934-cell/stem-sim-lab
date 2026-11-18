/**
 * What the nuclear 3D views draw (pure, no three.js; tested against the models).
 *
 * - A nucleus of Bảng 21.1: A nucleons, exactly Z of them protons, in a ball of the model's radius
 *   R = r₀·A^(1/3) (21.1). The nucleons all have the same size, so a bigger A gives a bigger ball
 *   of the same density — what R ∝ A^(1/3) says. Where each nucleon sits is illustration.
 * - A sample of SAMPLE nuclei decaying: in the law, round(SAMPLE·2^(−t/T)) are left at t; in the
 *   random illustration, the counts of the 2D picture's own `randomDecay` run (same seed). Which
 *   ones have decayed is illustration; how many is the model's.
 */
import { randomDecay, remaining, seeded } from './decayModel';
import { radius } from './nucleusModel';

export type Vec3 = [number, number, number];

/** Share of the ball the nucleons fill (random close packing). */
const PACKING = 0.64;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

export interface Nucleus3D {
  /** Radius (m) of the model and of one drawn nucleon. */
  R: number;
  r: number;
  /** Nucleon centres (m) and which are protons (exactly Z). */
  at: Vec3[];
  proton: boolean[];
}

export function nucleus3d(Z: number, A: number): Nucleus3D {
  const R = radius(A);
  const r = R * Math.cbrt(PACKING / A);
  const reach = Math.max(0, R - r);
  const at = Array.from({ length: A }, (_, i): Vec3 => {
    // Points spread evenly through the ball: radius by volume, direction on a golden spiral.
    const rho = A === 1 ? 0 : reach * Math.cbrt((i + 0.5) / A);
    const y = 1 - (2 * (i + 0.5)) / A;
    const s = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = i * GOLDEN;
    return [rho * s * Math.cos(phi), rho * y, rho * s * Math.sin(phi)];
  });
  // Exactly Z protons, mixed through the nucleus: a seeded shuffle (Fisher–Yates), the same
  // picture every time.
  const order = shuffled(A, 11);
  const proton = at.map(() => false);
  for (const i of order.slice(0, Z)) proton[i] = true;
  return { R, r, at, proton };
}

/** Nuclei in the decaying sample (the 2D random picture's N₀). */
export const SAMPLE = 200;
/** Steps of the random run over 5 half-lives (the 2D picture's). */
export const STEPS = 50;

/** Nuclei left at t in the law N = N₀·2^(−t/T), rounded to whole nuclei. */
export const lawLeft = (t: number, T: number) => Math.round(SAMPLE * remaining(t, T));

/** The 2D picture's random run: nuclei left after each of STEPS steps over 5 half-lives. */
export const randomRun = (T: number, seed: number) =>
  randomDecay(SAMPLE, T, (5 * T) / STEPS, STEPS, seed);

/** The order in which the sample's nuclei are drawn as decayed (illustration). */
export const decayOrder = (seed: number) => shuffled(SAMPLE, 31 + seed);

/** 0 … n − 1 in a seeded random order (Fisher–Yates with the lesson's mulberry32). */
function shuffled(n: number, seed: number): number[] {
  const rnd = seeded(seed);
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j] ?? 0, a[i] ?? 0];
  }
  return a;
}
