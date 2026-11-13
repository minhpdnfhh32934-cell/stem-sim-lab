import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const TIME = 0;
const PLACED = 1;
const SHELLS = 2; // K, L, M, N: slots 2–5
const VALENCE = 6;
const UNPAIRED = 7;
const PERIOD = 8;
const GROUP = 9;

/** The subshells in the order they fill (Aufbau, the n + l rule), up to Z = 36: n, l, capacity. */
export const SUBSHELLS = [
  { label: '1s', n: 1, l: 0 },
  { label: '2s', n: 2, l: 0 },
  { label: '2p', n: 2, l: 1 },
  { label: '3s', n: 3, l: 0 },
  { label: '3p', n: 3, l: 1 },
  { label: '4s', n: 4, l: 0 },
  { label: '3d', n: 3, l: 2 },
  { label: '4p', n: 4, l: 1 },
] as const;
const capacity = (l: number) => 2 * (2 * l + 1);

/**
 * The ground-state configurations that break the filling order up to Z = 36: chromium
 * [Ar] 3d⁵ 4s¹ and copper [Ar] 3d¹⁰ 4s¹ (a half-filled or filled d subshell is lower in energy).
 */
const EXCEPTIONS: Readonly<Record<number, readonly number[]>> = {
  24: [2, 2, 6, 2, 6, 1, 5, 0],
  29: [2, 2, 6, 2, 6, 1, 10, 0],
};

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['atomicNumber', (z) => Number.isInteger(z) && z >= 1 && z <= 36, 'a whole number from 1 to 36'],
  ['electronTime', (t) => t > 0 && t <= 5, 'above 0 and at most 5 s'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Atomic structure input "${id}" is missing`);
    if (!accepts(value))
      throw new Error(`Atomic structure input "${id}" must be ${rule}, got ${value}`);
  }
}

/** Electrons in each subshell (SUBSHELLS' order) once `placed` have gone in by the filling order. */
export function filling(placed: number, z: number): number[] {
  if (placed >= z && EXCEPTIONS[z]) return [...(EXCEPTIONS[z] ?? [])];
  let left = placed;
  return SUBSHELLS.map(({ l }) => {
    const n = Math.min(left, capacity(l));
    left -= n;
    return n;
  });
}

/** Electrons per shell K, L, M, N from a subshell filling. */
export function shells(fill: readonly number[]): number[] {
  const out = [0, 0, 0, 0];
  SUBSHELLS.forEach(({ n }, i) => (out[n - 1] = (out[n - 1] ?? 0) + (fill[i] ?? 0)));
  return out;
}

/** Unpaired electrons by Hund's rule: in each subshell, single in each orbital before pairing. */
export function unpaired(fill: readonly number[]): number {
  return SUBSHELLS.reduce((sum, { l }, i) => {
    const e = fill[i] ?? 0;
    const orbitals = 2 * l + 1;
    return sum + (e <= orbitals ? e : 2 * orbitals - e);
  }, 0);
}

/** The period (the highest n occupied) and the IUPAC group (1–18) of a neutral atom's ground state. */
export function position(z: number): { period: number; group: number } {
  const fill = filling(z, z);
  const period = Math.max(...SUBSHELLS.filter((_, i) => (fill[i] ?? 0) > 0).map((s) => s.n));
  const s = fill[SUBSHELLS.findIndex((x) => x.n === period && x.l === 0)] ?? 0;
  const p = fill[SUBSHELLS.findIndex((x) => x.n === period && x.l === 1)] ?? 0;
  const d = fill[SUBSHELLS.findIndex((x) => x.n === period - 1 && x.l === 2)] ?? 0;
  if (z === 2) return { period: 1, group: 18 }; // helium: s², a noble gas
  if (p > 0) return { period, group: 10 + s + p }; // p block: groups 13–18
  if (d > 0 && period >= 4) return { period, group: s + d };
  return { period, group: s };
}

function derive(state: Float64Array, placed: number, z: number): void {
  const fill = filling(placed, z);
  const k = shells(fill);
  state[PLACED] = placed;
  for (let i = 0; i < 4; i++) state[SHELLS + i] = k[i] ?? 0;
  const outer = k.reduce((last, count, i) => (count > 0 ? i : last), 0);
  state[VALENCE] = k[outer] ?? 0;
  state[UNPAIRED] = unpaired(fill);
  // Where the atom stands in the table, once all its electrons are in.
  const where = placed >= z ? position(z) : null;
  state[PERIOD] = where?.period ?? 0;
  state[GROUP] = where?.group ?? 0;
}

/**
 * Electrons in an atom — shells, subshells and the periodic table: a teaching model of the
 * ground state of a neutral atom of `atomicNumber` Z (1–36). The run puts its Z electrons in one
 * by one, every `electronTime` s, in the order the subshells fill (1s 2s 2p 3s 3p 4s 3d 4p: the
 * n + l rule), each subshell holding 2(2l + 1); chromium and copper end in their measured ground
 * states, [Ar] 3d⁵ 4s¹ and [Ar] 3d¹⁰ 4s¹. Read off: electrons in each shell K, L, M, N (Bohr's
 * picture), the outer shell's count, unpaired electrons (Hund's rule), and the atom's period and
 * group. Not modelled: energies, orbital shapes (see the orbitals table), ions.
 *
 * Variables: `time` (s), `electrons` placed, `shellK`…`shellN`, `outerElectrons`, `unpaired`,
 * `period` and `group` (0 until every electron is in).
 */
export const atomicStructureModel: SimulationModel = {
  id: 'chemistry.atomic-structure',
  inputs: ['atomicNumber', 'electronTime'],
  variables: [
    'time',
    'electrons',
    'shellK',
    'shellL',
    'shellM',
    'shellN',
    'outerElectrons',
    'unpaired',
    'period',
    'group',
  ],
  predictions: [
    'shellK',
    'shellL',
    'shellM',
    'shellN',
    'outerElectrons',
    'unpaired',
    'period',
    'group',
  ],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
  },

  step(state, dt, inputs) {
    const z = inputs.atomicNumber ?? NaN;
    const per = inputs.electronTime ?? NaN;
    const end = z * per;
    const time = state[TIME] ?? 0;
    if (!(time < end)) return 0;
    const h = Math.min(dt, end - time);
    const t = time + h;
    state[TIME] = t;
    derive(state, Math.min(z, Math.floor(t / per + 1e-9)), z);
    return h;
  },

  isComplete: (state, inputs) => (state[PLACED] ?? 0) >= (inputs.atomicNumber ?? NaN),

  predict(inputs) {
    refuseInvalid(inputs);
    const z = inputs.atomicNumber ?? NaN;
    const state = new Float64Array(10);
    derive(state, z, z);
    const { period, group } = position(z);
    return {
      shellK: state[SHELLS] ?? NaN,
      shellL: state[SHELLS + 1] ?? NaN,
      shellM: state[SHELLS + 2] ?? NaN,
      shellN: state[SHELLS + 3] ?? NaN,
      outerElectrons: state[VALENCE] ?? NaN,
      unpaired: state[UNPAIRED] ?? NaN,
      period,
      group,
    };
  },
};
