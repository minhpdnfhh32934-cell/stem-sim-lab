import { describe, expect, it } from 'vitest';
import {
  REAL_ORBITALS,
  levelEnergyEv,
  meanRadius,
  psi,
  radial,
  radialProbability,
  transitionWavelength,
} from './hydrogen';

/** Simpson's rule on [a, b] with n (even) intervals. */
function simpson(f: (x: number) => number, a: number, b: number, n = 4000): number {
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
  return (s * h) / 3;
}

/** ∫ f dΩ over the unit sphere (Gauss-like product rule, fine grid). */
function sphere(f: (x: number, y: number, z: number) => number, n = 240): number {
  let sum = 0;
  const dth = Math.PI / n;
  const dph = (2 * Math.PI) / (2 * n);
  for (let i = 0; i < n; i++) {
    const th = (i + 0.5) * dth;
    const st = Math.sin(th);
    for (let j = 0; j < 2 * n; j++) {
      const ph = (j + 0.5) * dph;
      sum += f(st * Math.cos(ph), st * Math.sin(ph), Math.cos(th)) * st * dth * dph;
    }
  }
  return sum;
}

describe('hydrogen atom (analytic wavefunctions)', () => {
  it('radial functions are normalized: ∫ R² r² dr = 1', () => {
    for (const [n, l] of [
      [1, 0],
      [2, 0],
      [2, 1],
      [3, 2],
      [4, 3],
      [5, 1],
    ] as const) {
      expect(simpson((r) => radialProbability(n, l, r), 0, 60 * n, 20000)).toBeCloseTo(1, 9);
    }
  });

  it('⟨r⟩ = (3n² − l(l+1))/2 a₀', () => {
    for (const [n, l] of [
      [1, 0],
      [2, 1],
      [3, 0],
      [3, 2],
    ] as const) {
      const m = simpson((r) => r * radialProbability(n, l, r), 0, 80 * n);
      expect(m).toBeCloseTo(meanRadius(n, l), 6);
    }
  });

  it('R₁₀ = 2e^(−r) and R₂₁ = r e^(−r/2)/(2√6)', () => {
    for (const r of [0, 0.3, 1, 2.5]) {
      expect(radial(1, 0, r)).toBeCloseTo(2 * Math.exp(-r), 12);
      expect(radial(2, 1, r)).toBeCloseTo((r * Math.exp(-r / 2)) / (2 * Math.sqrt(6)), 12);
    }
  });

  it('radial nodes: n − l − 1 sign changes', () => {
    for (const [n, l] of [
      [3, 0],
      [4, 1],
      [4, 3],
      [5, 2],
    ] as const) {
      let changes = 0;
      let prev = radial(n, l, 1e-3);
      for (let r = 0.01; r < 60 * n; r += 0.01) {
        const v = radial(n, l, r);
        if (Math.sign(v) !== Math.sign(prev) && v !== 0) changes++;
        prev = v;
      }
      expect(changes).toBe(n - l - 1);
    }
  });

  it('real spherical harmonics are orthonormal on the sphere', () => {
    for (const a of REAL_ORBITALS) {
      expect(sphere((x, y, z) => a.angular(x, y, z) ** 2)).toBeCloseTo(1, 4);
    }
    for (let i = 0; i < REAL_ORBITALS.length; i++) {
      for (let j = i + 1; j < REAL_ORBITALS.length; j++) {
        const a = REAL_ORBITALS[i]!;
        const b = REAL_ORBITALS[j]!;
        expect(Math.abs(sphere((x, y, z) => a.angular(x, y, z) * b.angular(x, y, z)))).toBeLessThan(
          1e-4,
        );
      }
    }
  });

  it('ψ has the expected symmetry (p_z odd in z, d_xy vanishes on the axes)', () => {
    const pz = REAL_ORBITALS.find((o) => o.id === 'pz')!;
    const dxy = REAL_ORBITALS.find((o) => o.id === 'dxy')!;
    expect(psi(2, pz, 0.3, 0.2, 1)).toBeCloseTo(-psi(2, pz, 0.3, 0.2, -1), 14);
    expect(psi(3, dxy, 2, 0, 0)).toBe(0);
  });

  it('energy levels and the Balmer Hα line (vacuum, reduced mass)', () => {
    expect(levelEnergyEv(1)).toBeCloseTo(-13.598, 3);
    expect(levelEnergyEv(2)).toBeCloseTo(-13.598 / 4, 3);
    // Hα (3→2) vacuum wavelength ≈ 656.47 nm; Lyman-α ≈ 121.57 nm.
    expect(transitionWavelength(2, 3) * 1e9).toBeCloseTo(656.47, 1);
    expect(transitionWavelength(1, 2) * 1e9).toBeCloseTo(121.57, 1);
  });
});
