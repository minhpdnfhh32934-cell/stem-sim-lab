import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

/** The cubes' sides, in cm (the classic 1, 2 and 3 cm). */
export const CUBES = [1, 2, 3] as const;
/** erf⁻¹(½): the colour edge, where the acid has reached half its outside concentration. */
export const ERFINV_HALF = 0.4769362762044699;

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['soakTime', (t) => t > 0 && t <= 3600, 'above 0 and at most 3600 s'],
  ['diffusivity', (d) => d > 0 && d <= 1e-8, 'above 0 and at most 1e-8 m²/s'],
  ['speed', (s) => s > 0 && s <= 1000, 'above 0 and at most 1000 (s of soaking per s)'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Agar diffusion input "${id}" is missing`);
    if (!accepts(value))
      throw new Error(`Agar diffusion input "${id}" must be ${rule}, got ${value}`);
  }
}

/** The colour edge's depth (mm) after t s: 2·erf⁻¹(½)·√(Dt), from each face of a large block. */
export const depthMm = (diffusivity: number, seconds: number) =>
  2 * ERFINV_HALF * Math.sqrt(diffusivity * seconds) * 1000;

/** The share (%) of a cube of side L cm reached to `depth` mm from every face: 1 − ((L − 2x)/L)³. */
export function changedPercent(sideCm: number, depth: number): number {
  const inner = Math.max(0, sideCm * 10 - 2 * depth) / (sideCm * 10);
  return 100 * (1 - inner ** 3);
}

const TIME = 0;
const SOAKED = 1;
const DEPTH = 2;
const SMALL = 3;
const MEDIUM = 4;
const LARGE = 5;

function at(state: Float64Array, inputs: Inputs, soaked: number): void {
  const depth = depthMm(inputs.diffusivity ?? NaN, soaked);
  state[SOAKED] = soaked;
  state[DEPTH] = depth;
  state[SMALL] = changedPercent(CUBES[0], depth);
  state[MEDIUM] = changedPercent(CUBES[1], depth);
  state[LARGE] = changedPercent(CUBES[2], depth);
}

/**
 * Diffusion into agar cubes — surface area to volume: three cubes of agar (1, 2 and 3 cm) coloured
 * by an indicator soak in acid for `soakTime` s (run at `speed` s of soaking per s). The acid diffuses in from every face; where it has
 * reached half its outside concentration the indicator changes colour. From each face that edge is
 * 2·erf⁻¹(½)·√(Dt) deep (the error-function profile of diffusion into a large block, with
 * `diffusivity` D), the same for every cube — so the small cube, with the most surface for its
 * volume (SA:V = 6/L), changes the largest share. The corners' extra reach is neglected.
 *
 * Variables: `time` (s), `soaked` (s of soaking), `depth` (mm), `small`, `medium`, `large` (% of each cube
 * changed).
 */
export const agarDiffusionModel: SimulationModel = {
  id: 'biology.agar-diffusion',
  inputs: ['soakTime', 'diffusivity', 'speed'],
  variables: ['time', 'soaked', 'depth', 'small', 'medium', 'large'],
  predictions: ['depth', 'small', 'medium', 'large'],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
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
    const depth = depthMm(inputs.diffusivity ?? NaN, inputs.soakTime ?? NaN);
    return {
      depth,
      small: changedPercent(CUBES[0], depth),
      medium: changedPercent(CUBES[1], depth),
      large: changedPercent(CUBES[2], depth),
    };
  },
};
