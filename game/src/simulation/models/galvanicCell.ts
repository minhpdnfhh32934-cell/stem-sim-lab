import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const TIME = 0;
const READING = 1;
const EMF = 2;
const ANODE = 3;
const CATHODE = 4;

const R = 8.314462618;
const FARADAY = 96485.33212331;
const KELVIN = 273.15;

/** A metal in a solution of its ions: the standard reduction potential at 25 °C (V) and the charge n. */
export interface HalfCell {
  readonly metal: string;
  readonly ion: string;
  readonly e0: number;
  readonly n: number;
  /** Its colour, for views (the metal strip). */
  readonly rgb: number;
}

/**
 * The half-cells the station has, with E° at 25 °C from the standard tables (CRC Handbook,
 * "Electrochemical Series"): Mg²⁺/Mg −2.372, Zn²⁺/Zn −0.7618, Fe²⁺/Fe −0.447, Pb²⁺/Pb −0.1262,
 * Cu²⁺/Cu +0.3419, Ag⁺/Ag +0.7996 V.
 */
export const HALF_CELLS: readonly HalfCell[] = [
  { metal: 'Mg', ion: 'Mg²⁺', e0: -2.372, n: 2, rgb: 0xd8dcde },
  { metal: 'Zn', ion: 'Zn²⁺', e0: -0.7618, n: 2, rgb: 0xa9b0b6 },
  { metal: 'Fe', ion: 'Fe²⁺', e0: -0.447, n: 2, rgb: 0x6c7076 },
  { metal: 'Pb', ion: 'Pb²⁺', e0: -0.1262, n: 2, rgb: 0x7d8288 },
  { metal: 'Cu', ion: 'Cu²⁺', e0: 0.3419, n: 2, rgb: 0xc27a45 },
  { metal: 'Ag', ion: 'Ag⁺', e0: 0.7996, n: 1, rgb: 0xe4e6e8 },
];

/** The cells the station offers, by its `pair` code: [left half-cell, right half-cell]. */
export const PAIRS: readonly (readonly [number, number])[] = [
  [1, 4], // Zn | Cu: the Daniell cell
  [2, 4], // Fe | Cu
  [3, 4], // Pb | Cu
  [1, 5], // Zn | Ag
  [0, 4], // Mg | Cu
  [4, 5], // Cu | Ag
];

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  [
    'pair',
    (k) => Number.isInteger(k) && k >= 0 && k < PAIRS.length,
    `a code from 0 to ${PAIRS.length - 1}`,
  ],
  ['leftConcentration', (c) => c >= 1e-4 && c <= 1, 'from 0.0001 to 1 mol/L'],
  ['rightConcentration', (c) => c >= 1e-4 && c <= 1, 'from 0.0001 to 1 mol/L'],
  ['temperature', (t) => t >= 0 && t <= 60, 'from 0 to 60 °C'],
  ['timeConstant', (t) => t > 0 && t <= 10, 'above 0 and at most 10 s'],
  ['readTime', (t) => t > 0 && t <= 60, 'above 0 and at most 60 s'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Galvanic cell input "${id}" is missing`);
    if (!accepts(value))
      throw new Error(`Galvanic cell input "${id}" must be ${rule}, got ${value}`);
  }
}

/** A half-cell's electrode potential by the Nernst equation, E = E° + (RT/nF)·ln[Mⁿ⁺] (V). */
export function electrodePotential(cell: HalfCell, concentration: number, celsius: number): number {
  return cell.e0 + ((R * (celsius + KELVIN)) / (cell.n * FARADAY)) * Math.log(concentration);
}

/** The cell's two potentials (left, right) and its emf, right − left (V): positive when right is the cathode. */
function potentials(inputs: Inputs): [number, number, number] {
  const [l, r] = PAIRS[inputs.pair ?? NaN] ?? [NaN, NaN];
  const left = HALF_CELLS[l];
  const right = HALF_CELLS[r];
  if (!left || !right) return [NaN, NaN, NaN];
  const t = inputs.temperature ?? NaN;
  const eL = electrodePotential(left, inputs.leftConcentration ?? NaN, t);
  const eR = electrodePotential(right, inputs.rightConcentration ?? NaN, t);
  return [eL, eR, eR - eL];
}

/**
 * A galvanic cell of two half-cells joined by a salt bridge, read by a high-resistance voltmeter:
 * a simplified teaching model. Each metal stands in a solution of its own ions at its
 * concentration (mol/L, activities taken as concentrations); its electrode potential follows the
 * Nernst equation from E° at 25 °C (the temperature dependence of E° itself is left out: a few
 * mV between 0 and 60 °C). The voltmeter draws no current, so it reads the emf, E_right − E_left;
 * positive means the right-hand metal is the cathode (reduced) and the left-hand one dissolves.
 * The needle settles exponentially with τ (`timeConstant`, a stated teaching value); the run ends
 * at `readTime`.
 *
 * Variables: `time` (s), `reading` on the voltmeter (V), `emf` (V), `anodePotential` and
 * `cathodePotential` (V vs the standard hydrogen electrode; anode the left half-cell).
 */
export const galvanicCellModel: SimulationModel = {
  id: 'chemistry.galvanic-cell',
  inputs: [
    'pair',
    'leftConcentration',
    'rightConcentration',
    'temperature',
    'timeConstant',
    'readTime',
  ],
  variables: ['time', 'reading', 'emf', 'anodePotential', 'cathodePotential'],
  predictions: [
    'emf',
    'standardEmf',
    'anodePotential',
    'cathodePotential',
    'gibbsEnergy',
    'electrons',
  ],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    const [eL, eR, emf] = potentials(inputs);
    state[EMF] = emf;
    state[ANODE] = eL;
    state[CATHODE] = eR;
  },

  step(state, dt, inputs) {
    const end = inputs.readTime ?? NaN;
    const time = state[TIME] ?? 0;
    if (!(time < end)) return 0;
    const h = Math.min(dt, end - time);
    const t = time + h;
    state[TIME] = t;
    state[READING] = (state[EMF] ?? NaN) * (1 - Math.exp(-t / (inputs.timeConstant ?? NaN)));
    return h;
  },

  isComplete: (state, inputs) => (state[TIME] ?? 0) >= (inputs.readTime ?? NaN),

  /**
   * The theory: the emf (and the reading it settles to), the standard emf E°_right − E°_left,
   * both electrode potentials, the electrons transferred per formula of the cell reaction (the
   * least common multiple of the two charges) and ΔG = −z·F·E (kJ/mol).
   */
  predict(inputs) {
    refuseInvalid(inputs);
    const [l, r] = PAIRS[inputs.pair ?? NaN] ?? [NaN, NaN];
    const left = HALF_CELLS[l];
    const right = HALF_CELLS[r];
    const [eL, eR, emf] = potentials(inputs);
    const z = left && right ? (left.n === right.n ? left.n : left.n * right.n) : NaN;
    return {
      emf,
      standardEmf: (right?.e0 ?? NaN) - (left?.e0 ?? NaN),
      anodePotential: eL,
      cathodePotential: eR,
      electrons: z,
      gibbsEnergy: (-z * FARADAY * emf) / 1000,
    };
  },
};
