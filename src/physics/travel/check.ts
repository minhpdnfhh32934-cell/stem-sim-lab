import { dopri5 } from '@/core/ode/dopri5';
import type { Travel } from './model';

/**
 * Independent check of T: the part at M, once the wave reaches it, moves like a harmonic
 * oscillator ü = −(2πf)²u started as the source started (u = 0, moving up at 2πfA). DOPRI5
 * integrates it and the period is the time between two upward zero crossings.
 */
export function particlePeriod(q: Travel): number {
  const w = 2 * Math.PI * q.f;
  const T = 1 / q.f;
  const r = dopri5(
    (_t, y, d) => {
      d[0] = y[1] ?? 0;
      d[1] = -w * w * (y[0] ?? 0);
    },
    [0, w * q.A],
    0,
    2.6 * T,
    {
      rtol: 1e-12,
      atol: 1e-15 * q.A * w,
      events: [{ id: 'up', direction: 1, g: (_t, y) => y[0] ?? 0 }],
    },
  );
  const ups = r.events.filter((e) => e.t > 0.5 * T);
  const [a, b] = ups;
  return a && b ? b.t - a.t : Number.NaN;
}

/** Lattice cells per wavelength of the check below. */
export const LATTICE_CELLS = 80;

/**
 * Relative gap allowed between λ and its lattice check: the lattice's own dispersion,
 * (kΔx)²/24 ≈ 2,6·10⁻⁴ at 80 cells per wavelength, plus reading the zero crossings.
 */
export const LATTICE_CHECK_TOL = 2e-3;

let unitRatio: number | undefined;

/**
 * Independent check of λ = v/f from the wave equation alone. A string of cells Δx = λ/80
 * (method of lines, u_tt = v²·u_xx) is shaken at x = 0 as the source is, u₀ = A·sin 2πft, and
 * DOPRI5 integrates it for 3,2 periods. The wavelength is read on the lattice as the distance
 * between zero crossings of u(x) (rising along +x) well behind the front. In units of λ and T the
 * lattice problem is the same for every wave, so it is solved once and scaled: λ_check =
 * (v/f)·(measured / 1).
 */
export function latticeWavelength(q: Travel): number {
  unitRatio ??= measureUnitLattice();
  return (q.v / q.f) * unitRatio;
}

function measureUnitLattice(): number {
  // v = 1, f = 1, λ = 1, A = 1: 4 wavelengths of string, the far end clamped (never reached).
  const N = 4 * LATTICE_CELLS;
  const dx = 1 / LATTICE_CELLS;
  const M = N - 1;
  const c2 = 1 / (dx * dx);
  const w = 2 * Math.PI;
  const rhs = (t: number, y: Float64Array, d: Float64Array) => {
    for (let i = 0; i < M; i++) {
      const left = i > 0 ? (y[i - 1] ?? 0) : Math.sin(w * t);
      const right = i < M - 1 ? (y[i + 1] ?? 0) : 0;
      d[i] = y[M + i] ?? 0;
      d[M + i] = c2 * (left - 2 * (y[i] ?? 0) + right);
    }
  };
  const y = dopri5(rhs, new Float64Array(2 * M), 0, 3.2, { rtol: 1e-9, atol: 1e-12 }).y;
  // u(x) at t = 3,2: phase 2π(3,2 − x); downward crossings in x where 3,2 − x is a whole number.
  const u = (i: number) => (i === 0 ? Math.sin(w * 3.2) : (y[i - 1] ?? 0));
  const crossings: number[] = [];
  for (let i = 0; i < 2.6 * LATTICE_CELLS; i++) {
    const a = u(i);
    const b = u(i + 1);
    // Going along +x the phase decreases, so u(x) rises where u(t) falls: an upward crossing in x.
    if (a < 0 && b >= 0) crossings.push((i + a / (a - b)) * dx);
  }
  const usable = crossings.filter((x) => x > 0.15 && x < 2.6);
  const first = usable[0];
  const last = usable.at(-1);
  if (first === undefined || last === undefined || usable.length < 2) return Number.NaN;
  return (last - first) / (usable.length - 1);
}
