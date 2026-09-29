import { C, constant } from '@/core/constants';

/**
 * Hydrogen atom, non-relativistic (Schrödinger / Bohr energies). Exact for the model:
 * fine structure, Lamb shift and hyperfine structure are neglected (relative effects
 * ~10⁻⁵ on transition energies).
 */

const mp = constant('mp').value;
const Rinf = constant('Rinf').value; // m⁻¹
const RinfhcEv = constant('RinfhcEv').value; // eV

/** Reduced-mass factor 1/(1 + mₑ/mₚ) for ¹H. */
export const REDUCED_MASS_FACTOR = 1 / (1 + C.me / mp);
/** Rydberg constant for ¹H (m⁻¹). */
export const R_H = Rinf * REDUCED_MASS_FACTOR;

/** Energy of level n (eV), E_n = −R_H h c / n². */
export function levelEnergyEv(n: number): number {
  return (-RinfhcEv * REDUCED_MASS_FACTOR) / (n * n);
}

/** Vacuum wavelength (m) of the photon for nUpper → nLower. */
export function transitionWavelength(nLower: number, nUpper: number): number {
  if (!(nUpper > nLower && nLower >= 1)) throw new RangeError('need nUpper > nLower ≥ 1');
  return 1 / (R_H * (1 / (nLower * nLower) - 1 / (nUpper * nUpper)));
}

/** Photon energy (eV) for nUpper → nLower. */
export function transitionEnergyEv(nLower: number, nUpper: number): number {
  return levelEnergyEv(nUpper) - levelEnergyEv(nLower);
}

export const SERIES = [
  { nLower: 1, name: { vi: 'Lyman (tử ngoại)', en: 'Lyman (ultraviolet)' } },
  { nLower: 2, name: { vi: 'Balmer (khả kiến)', en: 'Balmer (visible)' } },
  { nLower: 3, name: { vi: 'Paschen (hồng ngoại)', en: 'Paschen (infrared)' } },
] as const;

function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

/** Generalized Laguerre polynomial L_k^α(x) by the three-term recurrence. */
export function laguerre(k: number, alpha: number, x: number): number {
  if (k === 0) return 1;
  let prev = 1;
  let curr = 1 + alpha - x;
  for (let i = 1; i < k; i++) {
    const next = ((2 * i + 1 + alpha - x) * curr - (i + alpha) * prev) / (i + 1);
    prev = curr;
    curr = next;
  }
  return curr;
}

/**
 * Radial function R_nl(r) with r in units of the Bohr radius a₀ (infinite nuclear mass).
 * ∫₀^∞ R² r² dr = 1.
 */
export function radial(n: number, l: number, r: number): number {
  const rho = (2 * r) / n;
  const norm = Math.sqrt((2 / n) ** 3 * (factorial(n - l - 1) / (2 * n * factorial(n + l))));
  return norm * Math.exp(-rho / 2) * rho ** l * laguerre(n - l - 1, 2 * l + 1, rho);
}

/** Radial probability density P(r) = r² R_nl(r)² (per a₀). */
export function radialProbability(n: number, l: number, r: number): number {
  const R = radial(n, l, r);
  return r * r * R * R;
}

/** ⟨r⟩ for state n, l (units of a₀): (3n² − l(l+1)) / 2. */
export const meanRadius = (n: number, l: number) => (3 * n * n - l * (l + 1)) / 2;

export interface RealOrbital {
  id: string;
  l: number;
  /** Label such as "2p_z" (subscript part only). */
  label: string;
  /** Real spherical harmonic from Cartesian direction (x, y, z)/r. */
  angular: (x: number, y: number, z: number) => number;
  /** Plane where the orbital's lobes are best seen. */
  plane: 'xz' | 'xy' | 'yz';
}

const PI = Math.PI;
const s = Math.sqrt;

/** Real spherical harmonics for l = 0…3 (standard chemistry orientation). */
export const REAL_ORBITALS: RealOrbital[] = [
  { id: 's', l: 0, label: 's', plane: 'xz', angular: () => 1 / (2 * s(PI)) },
  { id: 'pz', l: 1, label: 'p_z', plane: 'xz', angular: (_x, _y, z) => s(3 / (4 * PI)) * z },
  { id: 'px', l: 1, label: 'p_x', plane: 'xz', angular: (x) => s(3 / (4 * PI)) * x },
  { id: 'py', l: 1, label: 'p_y', plane: 'yz', angular: (_x, y) => s(3 / (4 * PI)) * y },
  {
    id: 'dz2',
    l: 2,
    label: 'd_{z^2}',
    plane: 'xz',
    angular: (x, y, z) => 0.25 * s(5 / PI) * (3 * z * z - (x * x + y * y + z * z)),
  },
  {
    id: 'dxz',
    l: 2,
    label: 'd_{xz}',
    plane: 'xz',
    angular: (x, _y, z) => 0.5 * s(15 / PI) * x * z,
  },
  {
    id: 'dyz',
    l: 2,
    label: 'd_{yz}',
    plane: 'yz',
    angular: (_x, y, z) => 0.5 * s(15 / PI) * y * z,
  },
  { id: 'dxy', l: 2, label: 'd_{xy}', plane: 'xy', angular: (x, y) => 0.5 * s(15 / PI) * x * y },
  {
    id: 'dx2y2',
    l: 2,
    label: 'd_{x^2-y^2}',
    plane: 'xy',
    angular: (x, y) => 0.25 * s(15 / PI) * (x * x - y * y),
  },
  {
    id: 'fz3',
    l: 3,
    label: 'f_{z^3}',
    plane: 'xz',
    angular: (x, y, z) => 0.25 * s(7 / PI) * z * (5 * z * z - 3 * (x * x + y * y + z * z)),
  },
  {
    id: 'fxz2',
    l: 3,
    label: 'f_{xz^2}',
    plane: 'xz',
    angular: (x, y, z) => 0.125 * s(42 / PI) * x * (5 * z * z - (x * x + y * y + z * z)),
  },
  {
    id: 'fyz2',
    l: 3,
    label: 'f_{yz^2}',
    plane: 'yz',
    angular: (x, y, z) => 0.125 * s(42 / PI) * y * (5 * z * z - (x * x + y * y + z * z)),
  },
  {
    id: 'fxyz',
    l: 3,
    label: 'f_{xyz}',
    plane: 'xy',
    angular: (x, y, z) => 0.5 * s(105 / PI) * x * y * z,
  },
  {
    id: 'fzx2y2',
    l: 3,
    label: 'f_{z(x^2-y^2)}',
    plane: 'xz',
    angular: (x, y, z) => 0.25 * s(105 / PI) * z * (x * x - y * y),
  },
  {
    id: 'fx3',
    l: 3,
    label: 'f_{x(x^2-3y^2)}',
    plane: 'xy',
    angular: (x, y) => 0.125 * s(70 / PI) * x * (x * x - 3 * y * y),
  },
  {
    id: 'fy3',
    l: 3,
    label: 'f_{y(3x^2-y^2)}',
    plane: 'xy',
    angular: (x, y) => 0.125 * s(70 / PI) * y * (3 * x * x - y * y),
  },
];

/**
 * ψ_n,l,orbital(x, y, z) in a₀^(−3/2). The angular functions above take unit-vector
 * components, so they are evaluated at (x, y, z)/r.
 */
export function psi(n: number, orbital: RealOrbital, x: number, y: number, z: number): number {
  const r = Math.hypot(x, y, z);
  if (r === 0) return orbital.l === 0 ? radial(n, 0, 0) * orbital.angular(0, 0, 0) : 0;
  return radial(n, orbital.l, r) * orbital.angular(x / r, y / r, z / r);
}

/**
 * Radius (a₀) containing the given fraction of the radial probability — used to frame
 * the view (e.g. 99 %).
 */
export function radiusContaining(n: number, l: number, fraction: number): number {
  const dr = 0.01 * n;
  let acc = 0;
  let r = 0;
  while (acc < fraction && r < 200 * n) {
    acc += radialProbability(n, l, r + dr / 2) * dr;
    r += dr;
  }
  return r;
}

const S_ORBITAL: RealOrbital = {
  id: 's',
  l: 0,
  label: 's',
  plane: 'xz',
  angular: () => 1 / (2 * s(PI)),
};

/** Orbital by id (falls back to s). */
export function orbitalById(id: string): RealOrbital {
  return REAL_ORBITALS.find((o) => o.id === id) ?? S_ORBITAL;
}
