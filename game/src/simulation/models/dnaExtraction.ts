import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

/**
 * What each step contributes to the DNA seen at the end (a share, 0–1): detergent breaks the cell
 * and nuclear membranes (without it little DNA leaves the cells); salt shields the DNA's negative
 * charges so the strands clump; a protease frees DNA from its proteins; ice-cold ethanol, which DNA
 * does not dissolve in, precipitates it — without ethanol nothing is seen. Illustrative shares: the
 * point is each step's role, not a yield.
 */
export const SHARES = { noDetergent: 0.1, noSalt: 0.4, noProtease: 0.75 } as const;

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['detergent', (v) => v === 0 || v === 1, '0 or 1'],
  ['salt', (v) => v === 0 || v === 1, '0 or 1'],
  ['protease', (v) => v === 0 || v === 1, '0 or 1'],
  ['ethanol', (v) => v === 0 || v === 1, '0 or 1'],
  ['stepTime', (t) => t > 0 && t <= 5, 'above 0 and at most 5 s'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`DNA extraction input "${id}" is missing`);
    if (!accepts(value))
      throw new Error(`DNA extraction input "${id}" must be ${rule}, got ${value}`);
  }
}

/** The DNA seen at the end, % of what the full method shows. */
export function seenPercent(inputs: Inputs): number {
  if (inputs.ethanol !== 1) return 0;
  return (
    100 *
    (inputs.detergent === 1 ? 1 : SHARES.noDetergent) *
    (inputs.salt === 1 ? 1 : SHARES.noSalt) *
    (inputs.protease === 1 ? 1 : SHARES.noProtease)
  );
}

/** The steps, in order: mash, lyse (detergent and salt), digest, filter, add ethanol, precipitate. */
export const STEPS = ['mash', 'lyse', 'digest', 'filter', 'ethanol', 'precipitate'] as const;

const TIME = 0;
const STEP = 1;
const DNA = 2;

/**
 * DNA extraction from strawberries: mash the fruit, lyse its cells with detergent and salt, digest
 * proteins with a protease, filter, then layer ice-cold ethanol on the filtrate: the DNA comes out
 * of solution at the boundary as white strands. Each switch (`detergent`, `salt`, `protease`,
 * `ethanol`) leaves its step out; the DNA seen is the product of the steps' shares (`SHARES`,
 * illustrative). One step every `stepTime` s; the DNA appears during the last.
 *
 * Variables: `time` (s), `step` (index into STEPS), `dna` (% of the full method's DNA seen so far).
 */
export const dnaExtractionModel: SimulationModel = {
  id: 'biology.dna-extraction',
  inputs: ['detergent', 'salt', 'protease', 'ethanol', 'stepTime'],
  variables: ['time', 'step', 'dna'],
  predictions: ['dna', 'seen'],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
  },

  step(state, dt, inputs) {
    const per = inputs.stepTime ?? NaN;
    const end = STEPS.length * per;
    const time = state[TIME] ?? 0;
    if (!(time < end)) return 0;
    const h = Math.min(dt, end - time);
    const t = time + h;
    state[TIME] = t;
    const step = Math.min(STEPS.length - 1, Math.floor(t / per + 1e-9));
    state[STEP] = step;
    const last = (STEPS.length - 1) * per;
    state[DNA] = t <= last ? 0 : seenPercent(inputs) * Math.min(1, (t - last) / per);
    return h;
  },

  isComplete: (state, inputs) =>
    (state[TIME] ?? 0) >= STEPS.length * (inputs.stepTime ?? NaN) - 1e-9,

  predict(inputs) {
    refuseInvalid(inputs);
    const dna = seenPercent(inputs);
    return { dna, seen: dna > 0 ? 1 : 0 };
  },
};
