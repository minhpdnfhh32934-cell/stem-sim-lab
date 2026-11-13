import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const TIME = 0;
const CHARGE = 1;
const ELECTRONS = 2;
const CATHODE = 3;
const ANODE = 4;

const FARADAY = 96485.33212331; // C/mol, exact in the 2019 SI
/** Copper: molar mass (g/mol, IUPAC 2013 standard atomic weight 63.546) and the ion's charge. */
const COPPER = { molarMass: 63.546, charge: 2 };

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['current', (i) => i > 0 && i <= 5, 'above 0 and at most 5 A'],
  ['duration', (t) => t > 0 && t <= 7200, 'above 0 and at most 7200 s'],
  ['timeLapse', (k) => k >= 1 && k <= 1000, 'from 1 to 1000'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Electrolysis input "${id}" is missing`);
    if (!accepts(value))
      throw new Error(`Electrolysis input "${id}" must be ${rule}, got ${value}`);
  }
}

/** Copper moved (g) by `charge` coulombs: m = Q·M/(z·F) (Faraday's laws). */
export const copperMass = (charge: number) =>
  (charge * COPPER.molarMass) / (COPPER.charge * FARADAY);

/**
 * Electrolysis of copper(II) sulfate solution between copper electrodes — Faraday's laws: a
 * simplified teaching model. A constant `current` I flows for `duration` s (lab time; the run
 * shows it `timeLapse` times faster). At the cathode Cu²⁺ + 2e⁻ → Cu plates out; at the copper
 * anode Cu → Cu²⁺ + 2e⁻ dissolves the same mass, so the solution's colour stays the same. Every
 * electron goes into these reactions (100 % current efficiency: no hydrogen or oxygen given off,
 * a stated simplification), so the cathode gains m = I·t·M/(2F) and the anode loses as much.
 * Exact at every step.
 *
 * Variables: `time` (lab s), `charge` Q = I·t (C), `electrons` (mmol), `cathodeGain` and
 * `anodeLoss` (g).
 */
export const electrolysisModel: SimulationModel = {
  id: 'chemistry.electrolysis',
  inputs: ['current', 'duration', 'timeLapse'],
  variables: ['time', 'charge', 'electrons', 'cathodeGain', 'anodeLoss'],
  predictions: ['charge', 'electrons', 'mass', 'copperAmount', 'massPerCoulomb'],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
  },

  step(state, dt, inputs) {
    const end = inputs.duration ?? NaN;
    const time = state[TIME] ?? 0;
    if (!(time < end)) return 0;
    const k = inputs.timeLapse ?? NaN;
    const lab = Math.min(dt * k, end - time);
    const t = time + lab;
    const q = (inputs.current ?? NaN) * t;
    state[TIME] = t;
    state[CHARGE] = q;
    state[ELECTRONS] = (q / FARADAY) * 1000;
    state[CATHODE] = copperMass(q);
    state[ANODE] = copperMass(q);
    return lab / k;
  },

  isComplete: (state, inputs) => (state[TIME] ?? 0) >= (inputs.duration ?? NaN),

  /** Q = I·t, the electrons Q/F, the copper Q/(2F) and its mass, and the mass per coulomb M/(2F). */
  predict(inputs) {
    refuseInvalid(inputs);
    const q = (inputs.current ?? NaN) * (inputs.duration ?? NaN);
    return {
      charge: q,
      electrons: (q / FARADAY) * 1000,
      copperAmount: (q / (COPPER.charge * FARADAY)) * 1000,
      mass: copperMass(q),
      massPerCoulomb: copperMass(1),
    };
  },
};
