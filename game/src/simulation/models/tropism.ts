import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

/**
 * The conditions of the classic coleoptile experiments (Darwin 1880; Boysen-Jensen 1913) and
 * gravitropism: 0 intact, 1 tip under an opaque cap, 2 base under an opaque sleeve, 3 tip cut off —
 * lit from one side; 4 laid on its side in the dark.
 */
export const CONDITIONS = [
  'intact',
  'tip-covered',
  'base-covered',
  'tip-removed',
  'on-its-side',
] as const;

/** Whether the shoot bends: only if its tip is there and sees the stimulus. */
export const bends = (condition: number) => condition === 0 || condition === 2 || condition === 4;

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  [
    'condition',
    (c) => Number.isInteger(c) && c >= 0 && c < CONDITIONS.length,
    `a code from 0 to ${CONDITIONS.length - 1}`,
  ],
  ['light', (l) => l === -1 || l === 0 || l === 1, '−1 (left), 0 (above) or 1 (right)'],
  ['bendAngle', (a) => a > 0 && a <= 90, 'above 0 and at most 90°'],
  ['bendTime', (t) => t > 0 && t <= 86400, 'above 0 and at most 86400 s'],
  ['duration', (t) => t > 0 && t <= 172800, 'above 0 and at most 172800 s'],
  ['speed', (s) => s > 0 && s <= 20000, 'above 0 and at most 20000 (s per s)'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Tropism input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Tropism input "${id}" must be ${rule}, got ${value}`);
  }
}

/**
 * The final bend (°, + towards the right, + upwards on its side): towards a side light, none
 * under light from above; on its side, a full `bendAngle` up against gravity.
 */
export function finalAngle(inputs: Inputs): number {
  const c = inputs.condition ?? NaN;
  if (!bends(c)) return 0;
  const a = inputs.bendAngle ?? NaN;
  if (c === 4) return 90; // the shoot turns to grow straight up
  return a * (inputs.light ?? 0);
}

const TIME = 0;
const ELAPSED = 1;
const ANGLE = 2;
const AUXIN = 3;

function at(state: Float64Array, inputs: Inputs, t: number): void {
  const end = finalAngle(inputs);
  state[ELAPSED] = t;
  state[ANGLE] = end * (1 - Math.exp(-t / (inputs.bendTime ?? NaN)));
  // Auxin's lean to the shaded (or lower) side while the stimulus acts on a tip: −1…1.
  const c = inputs.condition ?? NaN;
  state[AUXIN] = c === 4 ? 1 : bends(c) ? -(inputs.light ?? 0) : 0; // to the shaded side
}

/**
 * Tropisms — coleoptiles bending to light and against gravity: oat seedlings lit from one side
 * (`light`) for `duration` s, intact or with the tip covered, the base covered or the tip removed,
 * or laid on their side in the dark (`condition`). Only a tip that sees the light bends the shoot:
 * auxin made in the tip moves to the shaded side and makes it grow faster, so the shoot bends
 * towards the light — `bendAngle` approached with the time constant `bendTime`. On its side,
 * auxin gathers on the lower side and the shoot turns up. Which conditions bend is the experiments'
 * result; the angle and its speed are illustrative.
 *
 * Variables: `time` (s), `elapsed` (s of growth), `angle` (° from upright, + towards the right or
 * upwards), `auxin` (its lean: −1 left … 1 right, or 1 to the lower side on its side).
 */
export const tropismModel: SimulationModel = {
  id: 'biology.tropism',
  inputs: ['condition', 'light', 'bendAngle', 'bendTime', 'duration', 'speed'],
  variables: ['time', 'elapsed', 'angle', 'auxin'],
  predictions: ['angle', 'bends'],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    at(state, inputs, 0);
  },

  step(state, dt, inputs) {
    const per = inputs.speed ?? NaN;
    const end = (inputs.duration ?? NaN) / per;
    const time = state[TIME] ?? 0;
    if (!(time < end)) return 0;
    const h = Math.min(dt, end - time);
    state[TIME] = time + h;
    at(state, inputs, (time + h) * per);
    return h;
  },

  isComplete: (state, inputs) =>
    (state[TIME] ?? 0) >= (inputs.duration ?? NaN) / (inputs.speed ?? NaN) - 1e-9,

  predict(inputs) {
    refuseInvalid(inputs);
    const end = finalAngle(inputs);
    return {
      angle: end * (1 - Math.exp(-(inputs.duration ?? NaN) / (inputs.bendTime ?? NaN))),
      bends: end !== 0 ? 1 : 0,
    };
  },
};
