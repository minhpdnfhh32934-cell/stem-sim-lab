import type { SimulationModel } from '../SimulationModel';
import { GAS_CONSTANT } from './osmosis';

type Inputs = Readonly<Record<string, number>>;

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['concentration', (c) => c >= 0 && c <= 1.5, 'from 0 to 1.5 mol/L'],
  ['cellSap', (c) => c > 0 && c <= 1.5, 'above 0 and at most 1.5 mol/L'],
  ['nonOsmotic', (b) => b >= 0 && b < 1, 'from 0 to below 1'],
  ['temperature', (t) => t >= 0 && t <= 40, 'from 0 to 40 °C'],
  ['halfTime', (t) => t > 0 && t <= 600, 'above 0 and at most 600 s'],
  ['soakTime', (t) => t > 0 && t <= 3600, 'above 0 and at most 3600 s'],
  ['speed', (s) => s > 0 && s <= 1000, 'above 0 and at most 1000 (s of soaking per s)'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Plasmolysis input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Plasmolysis input "${id}" must be ${rule}, got ${value}`);
  }
}

/**
 * The protoplast's settled volume (share of its turgid volume) in a solution of c mol/L, by the
 * Boyle–van 't Hoff relation V = b + (1 − b)·c_sap/c while the solution is stronger than the sap;
 * in a weaker one the wall holds it at its full volume.
 */
export function settledVolume(inputs: Inputs): number {
  const c = inputs.concentration ?? NaN;
  const sap = inputs.cellSap ?? NaN;
  const b = inputs.nonOsmotic ?? NaN;
  return c <= sap ? 1 : b + ((1 - b) * sap) / c;
}

/** A solution's solute potential, Ψs = −cRT (MPa), c in mol/L, for a solute that does not ionise. */
export const solutePotential = (c: number, celsius: number) =>
  -(c * 1000 * GAS_CONSTANT * (celsius + 273.15)) / 1e6;

const TIME = 0;
const SOAKED = 1;
const VOLUME = 2;
const PSI = 3;

function at(state: Float64Array, inputs: Inputs, soaked: number): void {
  const end = settledVolume(inputs);
  const k = Math.LN2 / (inputs.halfTime ?? NaN);
  state[SOAKED] = soaked;
  state[VOLUME] = 100 * (end + (1 - end) * Math.exp(-k * soaked));
  state[PSI] = solutePotential(inputs.concentration ?? NaN, inputs.temperature ?? NaN);
}

/**
 * Plasmolysis of onion epidermis cells: a cell whose sap is `cellSap` mol/L (osmotic equivalent)
 * soaks in sucrose of `concentration` mol/L for `soakTime` s. In a stronger solution water leaves
 * the vacuole by osmosis and the protoplast shrinks from the wall towards the Boyle–van 't Hoff
 * volume b + (1 − b)·c_sap/c (`nonOsmotic` b: the share that is not water), approaching it with a
 * half-time `halfTime`; in a weaker one the wall keeps the cell turgid. The solution's solute
 * potential is −cRT. The sap's strength, b and the half-time are illustrative (onion cells vary).
 *
 * Variables: `time` (s), `soaked` (s of soaking), `volume` (% of the turgid protoplast), `psi`
 * (the solution's solute potential, MPa).
 */
export const plasmolysisModel: SimulationModel = {
  id: 'biology.plasmolysis',
  inputs: [
    'concentration',
    'cellSap',
    'nonOsmotic',
    'temperature',
    'halfTime',
    'soakTime',
    'speed',
  ],
  variables: ['time', 'soaked', 'volume', 'psi'],
  predictions: ['volume', 'psi', 'settled'],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    at(state, inputs, 0);
  },

  step(state, dt, inputs) {
    const per = inputs.speed ?? NaN;
    const end = (inputs.soakTime ?? NaN) / per;
    const time = state[TIME] ?? 0;
    if (!(time < end)) return 0;
    const h = Math.min(dt, end - time);
    state[TIME] = time + h;
    at(state, inputs, (time + h) * per);
    return h;
  },

  isComplete: (state, inputs) =>
    (state[TIME] ?? 0) >= (inputs.soakTime ?? NaN) / (inputs.speed ?? NaN) - 1e-9,

  predict(inputs) {
    refuseInvalid(inputs);
    const end = settledVolume(inputs);
    const k = Math.LN2 / (inputs.halfTime ?? NaN);
    return {
      volume: 100 * (end + (1 - end) * Math.exp(-k * (inputs.soakTime ?? NaN))),
      psi: solutePotential(inputs.concentration ?? NaN, inputs.temperature ?? NaN),
      settled: 100 * end,
    };
  },
};
