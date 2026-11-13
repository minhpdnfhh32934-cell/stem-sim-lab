import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const VOLUME = 0;
const FORMED = 1;
const LEFT = 2;
const PRODUCT = 3;

/**
 * The halogens, most reactive first, with the standard reduction potential X₂/X⁻ at 25 °C (V;
 * CRC Handbook: Cl₂ 1.35827, Br₂(aq) 1.0873, I₂ 0.5355) and their colours as school chemistry
 * teaches them: in water and in a hydrocarbon solvent (cyclohexane) on top.
 */
export const HALOGENS = [
  { halogen: 'Cl₂', halide: 'Cl⁻', salt: 'KCl', e0: 1.35827, water: 0xe8ecb0, organic: 0xeef0c8 },
  { halogen: 'Br₂', halide: 'Br⁻', salt: 'KBr', e0: 1.0873, water: 0xe8a040, organic: 0xd2551e },
  { halogen: 'I₂', halide: 'I⁻', salt: 'KI', e0: 0.5355, water: 0x8a4a1a, organic: 0x8a3fa0 },
] as const;

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['halogen', (k) => Number.isInteger(k) && k >= 0 && k < 3, 'a code from 0 to 2 (Cl₂, Br₂, I₂)'],
  ['halide', (k) => Number.isInteger(k) && k >= 0 && k < 3, 'a code from 0 to 2 (KCl, KBr, KI)'],
  ['halogenConcentration', (c) => c > 0 && c <= 0.1, 'above 0 and at most 0.1 mol/L'],
  ['halideConcentration', (c) => c > 0 && c <= 1, 'above 0 and at most 1 mol/L'],
  ['sampleVolume', (v) => v > 0 && v <= 20, 'above 0 and at most 20 mL'],
  ['reagentVolume', (v) => v > 0 && v <= 20, 'above 0 and at most 20 mL'],
  ['flowRate', (q) => q > 0 && q <= 5, 'above 0 and at most 5 mL/s'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Halogens input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Halogens input "${id}" must be ${rule}, got ${value}`);
  }
}

/** The cell potential E°(X₂/X⁻) − E°(Y₂/Y⁻) of X₂ + 2Y⁻ → 2X⁻ + Y₂ (V): it goes when positive. */
export function displacementPotential(halogen: number, halide: number): number {
  return (HALOGENS[halogen]?.e0 ?? NaN) - (HALOGENS[halide]?.e0 ?? NaN);
}

/** Fills the state at `volume` mL of halogen water added. */
function derive(state: Float64Array, volume: number, inputs: Inputs): void {
  const x = inputs.halogen ?? NaN;
  const y = inputs.halide ?? NaN;
  const added = (inputs.halogenConcentration ?? NaN) * volume; // mmol of X₂
  const halide = (inputs.halideConcentration ?? NaN) * (inputs.sampleVolume ?? NaN); // mmol of Y⁻
  const goes = displacementPotential(x, y) > 0;
  // X₂ + 2Y⁻ → 2X⁻ + Y₂, complete (K = 10^(2E°/0.0592) ≥ 10⁹): limited by X₂ or by Y⁻/2.
  const formed = goes ? Math.min(added, halide / 2) : 0;
  state[VOLUME] = volume;
  state[FORMED] = formed;
  state[LEFT] = added - formed;
  state[PRODUCT] = formed > 0 ? y : -1;
}

/**
 * Displacement reactions of the halogens: a simplified teaching model of their reactivity. A
 * solution of potassium halide (`halide`: KCl, KBr, KI; `halideConcentration` mol/L,
 * `sampleVolume` mL) has a halogen's aqueous solution (`halogen`: Cl₂, Br₂, I₂ water,
 * `halogenConcentration`) run in at `flowRate` mL/s up to `reagentVolume`. A more reactive
 * halogen (higher E°) displaces a less reactive one from its salt, X₂ + 2Y⁻ → 2X⁻ + Y₂, at once
 * and completely (its equilibrium constant is 10⁹ or more); a less reactive one does nothing. The
 * tube's colour shows the free halogens; a layer of cyclohexane on top shows them more clearly
 * (bromine orange-red, iodine violet). Left out: I₃⁻ (iodine with excess iodide, brown), the
 * halogen's slow reaction with water, and its escape as a gas.
 *
 * Variables: `volumeAdded` (mL), `formed` Y₂ (mmol), `halogenLeft` X₂ not used (mmol),
 * `product` (the halogen formed, 0 Cl₂ 1 Br₂ 2 I₂; −1 none).
 */
export const halogensModel: SimulationModel = {
  id: 'chemistry.halogens',
  inputs: [
    'halogen',
    'halide',
    'halogenConcentration',
    'halideConcentration',
    'sampleVolume',
    'reagentVolume',
    'flowRate',
  ],
  variables: ['volumeAdded', 'formed', 'halogenLeft', 'product'],
  predictions: ['product', 'formed', 'halogenLeft', 'potential'],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    derive(state, 0, inputs);
  },

  step(state, dt, inputs) {
    const end = inputs.reagentVolume ?? NaN;
    const flow = inputs.flowRate ?? NaN;
    const volume = state[VOLUME] ?? 0;
    if (!(volume < end)) return 0;
    const reached = volume + flow * dt >= end;
    derive(state, reached ? end : volume + flow * dt, inputs);
    return reached ? (end - volume) / flow : dt;
  },

  isComplete: (state, inputs) => (state[VOLUME] ?? 0) >= (inputs.reagentVolume ?? NaN),

  predict(inputs) {
    refuseInvalid(inputs);
    const state = new Float64Array(4);
    derive(state, inputs.reagentVolume ?? NaN, inputs);
    return {
      product: state[PRODUCT] ?? NaN,
      formed: state[FORMED] ?? NaN,
      halogenLeft: state[LEFT] ?? NaN,
      potential: displacementPotential(inputs.halogen ?? NaN, inputs.halide ?? NaN),
    };
  },
};
