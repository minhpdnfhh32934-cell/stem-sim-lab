import { elementByZ } from '@/chemistry/data/elements';
import { C } from '@/core/constants';
import { N_A } from '../gas/model';
import { FISSION_MEV, PARTICLES, RADIUS_R0 } from './data';

/**
 * Bài 21–22: R = 1,2·10⁻¹⁵·A^(1/3) m (21.1), the mass defect Δm = Zm_p + (A − Z)m_n − m_X (22.2),
 * E_lk = Δm·c² (22.4), E_lkr = E_lk/A (22.1), conservation of A and Z in a reaction, the energy of
 * fission. Masses in amu use the book's m_p, m_n and amu; c and e (for J ↔ MeV) are CODATA, since
 * the book prints neither in this chapter.
 */

/** R = r₀·A^(1/3) (m). */
export const radius = (A: number) => RADIUS_R0 * Math.cbrt(A);

/** Δm (amu) of a nucleus of Z protons and A nucleons whose mass is m (amu). */
export const massDefect = (Z: number, A: number, m: number) =>
  Z * PARTICLES.proton_amu + (A - Z) * PARTICLES.neutron_amu - m;

/** 1 MeV in joules (CODATA e). */
export const MEV_J = C.e * 1e6;
/** The energy of 1 amu: amu·c² in MeV (the book's amu, CODATA c and e). */
export const AMU_MEV = (PARTICLES.amu_kg * C.c * C.c) / MEV_J;

/** E_lk (MeV) and E_lk/A (MeV per nucleon). */
export function binding(Z: number, A: number, m: number) {
  const dm = massDefect(Z, A, m);
  const E = dm * AMU_MEV;
  return { dm, E, perNucleon: E / A };
}

/* ───────── Reactions ───────── */

/** A particle in a reaction: A nucleons, charge Z (in e). */
export interface Particle {
  A: number;
  Z: number;
  /** How many of it (3 neutrons …). */
  count?: number;
}
export interface Reaction {
  id: string;
  left: readonly Particle[];
  right: readonly Particle[];
}

const sum = (ps: readonly Particle[], k: 'A' | 'Z') =>
  ps.reduce((a, p) => a + p[k] * (p.count ?? 1), 0);

/** Totals of A and Z on each side. */
export function totals(r: Reaction) {
  return {
    leftA: sum(r.left, 'A'),
    rightA: sum(r.right, 'A'),
    leftZ: sum(r.left, 'Z'),
    rightZ: sum(r.right, 'Z'),
  };
}
export const balanced = (r: Reaction) => {
  const t = totals(r);
  return t.leftA === t.rightA && t.leftZ === t.rightZ;
};

/** The one unknown product that conserves A and Z. */
export function missing(left: readonly Particle[], rightKnown: readonly Particle[]): Particle {
  return { A: sum(left, 'A') - sum(rightKnown, 'A'), Z: sum(left, 'Z') - sum(rightKnown, 'Z') };
}

/** The element's symbol for a charge Z (n for a neutron, e for an electron …). */
export function symbolOf(p: Particle): string {
  if (p.Z === 0 && p.A === 1) return 'n';
  if (p.Z === -1 && p.A === 0) return 'e';
  if (p.Z === 1 && p.A === 0) return 'e';
  return elementByZ(p.Z)?.symbol ?? '?';
}

const n: Particle = { A: 1, Z: 0 };
/** The reactions the book writes (tr. 96, 97, 100, 102). */
export const BOOK_REACTIONS: readonly Reaction[] = [
  {
    id: 'rutherford',
    left: [
      { A: 4, Z: 2 },
      { A: 14, Z: 7 },
    ],
    right: [
      { A: 17, Z: 8 },
      { A: 1, Z: 1 },
    ],
  },
  {
    id: 'uranium-alpha',
    left: [{ A: 238, Z: 92 }],
    right: [
      { A: 234, Z: 90 },
      { A: 4, Z: 2 },
    ],
  },
  {
    id: 'fission',
    left: [n, { A: 235, Z: 92 }],
    right: [
      { A: 95, Z: 39 },
      { A: 138, Z: 53 },
      { ...n, count: 3 },
    ],
  },
  {
    id: 'fusion',
    left: [
      { A: 2, Z: 1 },
      { A: 2, Z: 1 },
    ],
    right: [{ A: 3, Z: 2 }, n],
  },
];

/* ───────── Fission energy ───────── */

/** Energy (J) from the full fission of `kg` of a nuclide of molar mass `molarG` g/mol. */
export function fissionEnergy(kg: number, molarG = 235, mevEach = FISSION_MEV) {
  const nuclei = ((kg * 1000) / molarG) * N_A;
  return { nuclei, mev: nuclei * mevEach, joules: nuclei * mevEach * MEV_J };
}
