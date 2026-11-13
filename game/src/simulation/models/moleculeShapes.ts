import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const TIME = 0;
const ANGLE = 1;
const DOMAINS = 2;
const LONE = 3;
const DIPOLE = 4;

export type Geometry =
  | 'linear'
  | 'trigonal-planar'
  | 'tetrahedral'
  | 'trigonal-pyramidal'
  | 'bent'
  | 'trigonal-bipyramidal'
  | 'octahedral';

export interface Molecule {
  readonly formula: string;
  readonly centre: string;
  readonly ligand: string;
  readonly bonds: number;
  readonly lonePairs: number;
  readonly geometry: Geometry;
  /** The measured bond angle (°) and dipole moment (D): see MOLECULES. */
  readonly angle: number;
  readonly dipole: number;
}

/**
 * The molecules the table shows, with measured gas-phase bond angles and dipole moments: angles
 * from NIST's CCCBDB experimental geometries (H₂O 104.48°, NH₃ 106.67°, SO₂ 119.33°; CH₄ 109.47°,
 * the regular tetrahedron's; BF₃ 120°, CO₂ and BeCl₂ 180°, PCl₅ 90° between its axial and
 * equatorial bonds, SF₆ 90°), dipoles from the CRC Handbook (H₂O 1.8546, NH₃ 1.4718, SO₂ 1.6331 D;
 * the symmetric ones 0). Bonds count σ bonds only: a double bond is one electron domain.
 */
export const MOLECULES: readonly Molecule[] = [
  {
    formula: 'BeCl₂',
    centre: 'Be',
    ligand: 'Cl',
    bonds: 2,
    lonePairs: 0,
    geometry: 'linear',
    angle: 180,
    dipole: 0,
  },
  {
    formula: 'CO₂',
    centre: 'C',
    ligand: 'O',
    bonds: 2,
    lonePairs: 0,
    geometry: 'linear',
    angle: 180,
    dipole: 0,
  },
  {
    formula: 'BF₃',
    centre: 'B',
    ligand: 'F',
    bonds: 3,
    lonePairs: 0,
    geometry: 'trigonal-planar',
    angle: 120,
    dipole: 0,
  },
  {
    formula: 'SO₂',
    centre: 'S',
    ligand: 'O',
    bonds: 2,
    lonePairs: 1,
    geometry: 'bent',
    angle: 119.33,
    dipole: 1.6331,
  },
  {
    formula: 'CH₄',
    centre: 'C',
    ligand: 'H',
    bonds: 4,
    lonePairs: 0,
    geometry: 'tetrahedral',
    angle: 109.47,
    dipole: 0,
  },
  {
    formula: 'NH₃',
    centre: 'N',
    ligand: 'H',
    bonds: 3,
    lonePairs: 1,
    geometry: 'trigonal-pyramidal',
    angle: 106.67,
    dipole: 1.4718,
  },
  {
    formula: 'H₂O',
    centre: 'O',
    ligand: 'H',
    bonds: 2,
    lonePairs: 2,
    geometry: 'bent',
    angle: 104.48,
    dipole: 1.8546,
  },
  {
    formula: 'PCl₅',
    centre: 'P',
    ligand: 'Cl',
    bonds: 5,
    lonePairs: 0,
    geometry: 'trigonal-bipyramidal',
    angle: 90,
    dipole: 0,
  },
  {
    formula: 'SF₆',
    centre: 'S',
    ligand: 'F',
    bonds: 6,
    lonePairs: 0,
    geometry: 'octahedral',
    angle: 90,
    dipole: 0,
  },
];

/** The angle (°) VSEPR gives for a number of electron domains spread as far apart as they can. */
export function idealAngle(domains: number): number {
  if (domains === 2) return 180;
  if (domains === 3) return 120;
  if (domains === 4) return (Math.acos(-1 / 3) * 180) / Math.PI; // 109.47°
  return 90; // 5 (axial to equatorial) and 6
}

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  [
    'molecule',
    (k) => Number.isInteger(k) && k >= 0 && k < MOLECULES.length,
    `a code from 0 to ${MOLECULES.length - 1}`,
  ],
  ['settleTime', (t) => t > 0 && t <= 30, 'above 0 and at most 30 s'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Molecule shapes input "${id}" is missing`);
    if (!accepts(value))
      throw new Error(`Molecule shapes input "${id}" must be ${rule}, got ${value}`);
  }
}

/**
 * The shapes of molecules — VSEPR theory — and their polarity: a teaching model. For the chosen
 * molecule (`molecule`) the electron domains around the central atom (bonding pairs, a multiple
 * bond counting once, and lone pairs) push apart: their count gives the arrangement and the ideal
 * angle (2 → 180°, 3 → 120°, 4 → 109.5°, 5 → 90° and 120°, 6 → 90°); lone pairs push harder,
 * squeezing the bonds (NH₃ 106.7°, H₂O 104.5°). The run shows the domains settling from the ideal
 * angle to the measured one over `settleTime` s — a picture of the repulsion, not a dynamics.
 * Polarity: a molecule whose bond dipoles do not cancel (lone pairs, an unsymmetrical shape) has a
 * dipole moment; the symmetric ones have none. Measured values: see `MOLECULES`.
 *
 * Variables: `time` (s), `angle` (°), `domains`, `lonePairs`, `dipole` (D).
 */
export const moleculeShapesModel: SimulationModel = {
  id: 'chemistry.molecule-shapes',
  inputs: ['molecule', 'settleTime'],
  variables: ['time', 'angle', 'domains', 'lonePairs', 'dipole'],
  predictions: ['angle', 'idealAngle', 'domains', 'lonePairs', 'dipole'],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    const m = MOLECULES[inputs.molecule ?? NaN];
    const domains = (m?.bonds ?? NaN) + (m?.lonePairs ?? NaN);
    state[ANGLE] = idealAngle(domains);
    state[DOMAINS] = domains;
    state[LONE] = m?.lonePairs ?? NaN;
    state[DIPOLE] = m?.dipole ?? NaN;
  },

  step(state, dt, inputs) {
    const end = inputs.settleTime ?? NaN;
    const time = state[TIME] ?? 0;
    if (!(time < end)) return 0;
    const h = Math.min(dt, end - time);
    const t = time + h;
    const m = MOLECULES[inputs.molecule ?? NaN];
    const from = idealAngle((m?.bonds ?? NaN) + (m?.lonePairs ?? NaN));
    const share = 1 - (1 - t / end) ** 2; // eases in
    state[TIME] = t;
    state[ANGLE] = from + ((m?.angle ?? NaN) - from) * share;
    return h;
  },

  isComplete: (state, inputs) => (state[TIME] ?? 0) >= (inputs.settleTime ?? NaN),

  predict(inputs) {
    refuseInvalid(inputs);
    const m = MOLECULES[inputs.molecule ?? NaN];
    const domains = (m?.bonds ?? NaN) + (m?.lonePairs ?? NaN);
    return {
      angle: m?.angle ?? NaN,
      idealAngle: idealAngle(domains),
      domains,
      lonePairs: m?.lonePairs ?? NaN,
      dipole: m?.dipole ?? NaN,
    };
  },
};
