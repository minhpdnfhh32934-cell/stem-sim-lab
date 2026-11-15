import type { Source } from '@/core/data/dataset';
import { constant } from '@/core/constants';
import { elementByZ, superscript, type ElementData } from '../data/elements';
import { naturalNuclide, type Isotope } from '../data/isotopes';

/**
 * Slider ranges of "Thành phần của nguyên tử" (HH10 Bài 1).
 * - Z 1–36: the first four periods (H to Kr). Every one of them has a covalent radius and
 *   natural isotopes in the data (composition.test.ts checks both).
 * - N 0–50: covers every natural nuclide of those elements (the most neutrons: ⁸⁶Kr, N = 50;
 *   checked by the test); other (Z, N) pairs are allowed and said to be outside the data.
 * - Electrons Z − 3 … Z + 3 (never below 0): a slider range, not a chemistry rule. ±3 covers
 *   the ions met most often (Na⁺, Mg²⁺, Al³⁺, Cl⁻, O²⁻, N³⁻); a wider range would mostly show
 *   ions that do not form.
 */
export const Z_MIN = 1;
export const Z_MAX = 36;
export const N_MAX = 50;
export const CHARGE_MAX = 3;

export function electronRange(z: number): [min: number, max: number] {
  return [Math.max(0, z - CHARGE_MAX), z + CHARGE_MAX];
}

/**
 * Empirical nuclear radius constant r₀ of R = r₀·A^(1/3) (DATA_REVIEW HH10-ATOM-2): the usual
 * value from electron scattering; it is a rough size (quoted values run 1.2–1.5 fm, and light
 * nuclei follow the rule poorly), so the size ratio is an order of magnitude, card `approx`.
 */
export const R0_FM = 1.2;
export const KRANE: Source = {
  id: 'krane-nuclear',
  citation:
    'K. S. Krane — Introductory Nuclear Physics, Wiley 1988, chương 3 (bán kính hạt nhân R = R₀A^(1/3), R₀ ≈ 1,2 fm)',
};

/** CODATA 2022 particle masses (kg) and the atomic mass constant 1 u (data/constants.json). */
export const MASS = {
  proton: constant('mp').value,
  neutron: constant('mn').value,
  electron: constant('me').value,
  u: constant('mu').value,
} as const;

export type ParticleKind = 'proton' | 'neutron' | 'electron';
export const PARTICLES: readonly ParticleKind[] = ['proton', 'neutron', 'electron'];

export interface ParticleMass {
  count: number;
  /** One particle, kg and u. */
  eachKg: number;
  eachU: number;
  /** All particles of this kind, kg and u. */
  totalKg: number;
  totalU: number;
}

export interface Composition {
  z: number;
  n: number;
  electrons: number;
  element: ElementData;
  /** Mass number A = Z + N. */
  a: number;
  /** Charge in units of e: Z − electrons (> 0 cation, < 0 anion). */
  charge: number;
  masses: Record<ParticleKind, ParticleMass>;
  totalKg: number;
  totalU: number;
  /** Share of the mass in the nucleus, 0…1. */
  nucleusShare: number;
  /** The natural nuclide (Z, A) when it is in data/isotopes.json. */
  nuclide: Isotope | undefined;
  /**
   * Mass defect of the neutral atom, u: Z·(mₚ + mₑ) + N·mₙ − real atomic mass. Null when the
   * nuclide is not in the data. Always the neutral atom: the measured mass is the atom's.
   */
  massDefectU: number | null;
  /** Nuclear radius R = r₀·A^(1/3), fm. */
  nucleusRadiusFm: number;
  /** Covalent radius of the element, pm (data/elements.json), or null when it has none. */
  atomRadiusPm: number | null;
  /** Atom radius / nuclear radius (same for diameters), or null without a covalent radius. */
  sizeRatio: number | null;
}

/** Everything the lesson shows for Z protons, N neutrons and `electrons` electrons. */
export function composition(z: number, n: number, electrons: number): Composition {
  const element = elementByZ(z);
  if (!element || n < 0 || electrons < 0) throw new Error(`no atom for Z=${z}, N=${n}`);
  const a = z + n;
  const mass = (kind: ParticleKind, count: number): ParticleMass => ({
    count,
    eachKg: MASS[kind],
    eachU: MASS[kind] / MASS.u,
    totalKg: count * MASS[kind],
    totalU: (count * MASS[kind]) / MASS.u,
  });
  const masses = {
    proton: mass('proton', z),
    neutron: mass('neutron', n),
    electron: mass('electron', electrons),
  };
  const totalKg = masses.proton.totalKg + masses.neutron.totalKg + masses.electron.totalKg;
  const nuclide = naturalNuclide(z, a);
  const neutralU = (z * (MASS.proton + MASS.electron) + n * MASS.neutron) / MASS.u;
  const nucleusRadiusFm = R0_FM * Math.cbrt(a);
  const atomRadiusPm = element.covalent_radius_pm;
  return {
    z,
    n,
    electrons,
    element,
    a,
    charge: z - electrons,
    masses,
    totalKg,
    totalU: totalKg / MASS.u,
    nucleusShare: (masses.proton.totalKg + masses.neutron.totalKg) / totalKg,
    nuclide,
    massDefectU: nuclide ? neutralU - nuclide.mass_u : null,
    nucleusRadiusFm,
    atomRadiusPm,
    // 1 pm = 1000 fm.
    sizeRatio: atomRadiusPm === null ? null : (atomRadiusPm * 1000) / nucleusRadiusFm,
  };
}

/** "⁺", "²⁺", "⁻", "³⁻" or "" (neutral): the charge as ion notation writes it. */
export function chargeSuffix(charge: number): string {
  if (charge === 0) return '';
  const size = Math.abs(charge);
  return `${size === 1 ? '' : superscript(size)}${charge > 0 ? '⁺' : '⁻'}`;
}

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const subscript = (n: number) =>
  String(n)
    .split('')
    .map((d) => SUB[Number(d)] ?? d)
    .join('');

/** Nuclide (or ion) notation ᴬ_Z X with its charge, e.g. "²³₁₁Na⁺", "³⁵₁₇Cl⁻". */
export function notation(c: Pick<Composition, 'a' | 'z' | 'charge' | 'element'>): string {
  return `${superscript(c.a)}${subscript(c.z)}${c.element.symbol}${chargeSuffix(c.charge)}`;
}

export type AtomKind = 'neutral' | 'cation' | 'anion';
export const atomKind = (charge: number): AtomKind =>
  charge === 0 ? 'neutral' : charge > 0 ? 'cation' : 'anion';
