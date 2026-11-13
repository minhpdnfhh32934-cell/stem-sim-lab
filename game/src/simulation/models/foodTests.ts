import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const ELAPSED = 0;
const DEVELOPMENT = 1;
const COLOUR = 2;
const POSITIVE = 3;

/** The tests, by their `test` code. */
export const TESTS = { iodine: 0, benedict: 1, biuret: 2, sudan: 3 } as const;

/**
 * What a test shows, by its `colour` code: 0 no change (the reagent keeps its own colour), 1
 * blue-black, 2 a brick-red precipitate, 3 violet, 4 a red-stained oily layer on top.
 */
export const COLOURS = { none: 0, blueBlack: 1, brickRed: 2, violet: 3, redLayer: 4 } as const;

/** What a sample holds: one substance, or none (distilled water). */
type Substance = 'starch' | 'glucose' | 'sucrose' | 'protein' | 'lipid' | 'none';

/**
 * The unknown samples A–F (`sample` codes 0–5), each a solution or suspension of one pure
 * substance in distilled water: egg albumen (protein), glucose, soluble starch, distilled water
 * alone, vegetable oil (lipid, shaken with water) and sucrose. Which is which is the student's to
 * find; nothing shown to them names it.
 */
export const SAMPLES: readonly Substance[] = [
  'protein',
  'glucose',
  'starch',
  'none',
  'lipid',
  'sucrose',
];

/**
 * The textbook rules of the four tests (KNTT Sinh học 10, the practical "recognising some
 * biological molecules"; Benedict 1909, J. Biol. Chem. 5, 485). Iodine in potassium iodide
 * (yellow-brown) turns blue-black with starch, its iodine held in the starch helix. Benedict's
 * reagent (blue, Cu²⁺ in alkaline citrate) gives a brick-red precipitate of Cu₂O with a reducing
 * sugar, but only when heated in a boiling water bath; sucrose is not a reducing sugar and leaves
 * it blue. The biuret reagent (blue, Cu²⁺ in sodium hydroxide) turns violet with a protein's
 * peptide bonds. Sudan III (a red dye) dissolves in fat: a lipid floats as a red-stained layer.
 * A test that finds nothing leaves the reagent its own colour.
 */
function colourOf(substance: Substance, test: number, heated: boolean): number {
  if (test === TESTS.iodine) return substance === 'starch' ? COLOURS.blueBlack : COLOURS.none;
  if (test === TESTS.benedict) {
    return substance === 'glucose' && heated ? COLOURS.brickRed : COLOURS.none;
  }
  if (test === TESTS.biuret) return substance === 'protein' ? COLOURS.violet : COLOURS.none;
  return substance === 'lipid' ? COLOURS.redLayer : COLOURS.none;
}

/**
 * What the model accepts, as [input, accepts, rule]; anything else is refused with its reason,
 * never clamped (each check fails for NaN and ±∞).
 */
const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['sample', (s) => Number.isInteger(s) && s >= 0 && s <= 5, '0 to 5 (sample A to F)'],
  [
    'test',
    (t) => Number.isInteger(t) && t >= 0 && t <= 3,
    '0 (iodine), 1 (Benedict), 2 (biuret) or 3 (Sudan III)',
  ],
  ['heated', (h) => h === 0 || h === 1, '0 (at room temperature) or 1 (in a boiling water bath)'],
  ['developTime', (t) => t > 0 && t <= 3600, 'above 0 and at most 3600 s'],
  ['timeLapse', (k) => k >= 1 && k <= 1e4, 'from 1 to 1e4'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Food test input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Food test input "${id}" must be ${rule}, got ${value}`);
  }
}

const outcome = (inputs: Inputs) =>
  colourOf(SAMPLES[inputs.sample ?? NaN] ?? 'none', inputs.test ?? NaN, inputs.heated === 1);

/**
 * Tests for biological molecules on unknown samples: a qualitative teaching model of what each
 * reagent shows, not of the chemistry's rates. A few drops of a sample (A–F: `SAMPLES`) are
 * tested in a tube with one reagent (`test`), in a boiling water bath or not (`heated`); the
 * outcome follows the rules of `colourOf`. Every sample is a pure substance in distilled water,
 * strong enough to give the full colour: real foods hold several (milk: lactose, protein and fat)
 * and Benedict's colour runs green, yellow, orange to brick red with the sugar's concentration,
 * which this model leaves out (no source fixes the thresholds for these samples).
 *
 * Time: the colour develops linearly from the reagent's own colour (`development` 0) to the
 * outcome (1) over `developTime` lab seconds — an illustrative time (in a lab iodine shows at
 * once, Benedict's after 2–5 min in the bath, biuret within a few minutes) — shown at `timeLapse`
 * lab seconds per run second; the run ends when it is complete, the last step taking only the
 * time it needs.
 *
 * Variables: `elapsed` (lab s), `development` (0–1), `colour` the outcome's code (`COLOURS`,
 * fixed from the start: what the tube is turning to) and `positive` 1 if the test found its
 * molecule, else 0.
 */
export const foodTestsModel: SimulationModel = {
  id: 'biology.food-tests',
  inputs: ['sample', 'test', 'heated', 'developTime', 'timeLapse'],
  variables: ['elapsed', 'development', 'colour', 'positive'],
  predictions: ['colour', 'positive'],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    const colour = outcome(inputs);
    state[COLOUR] = colour;
    state[POSITIVE] = colour === COLOURS.none ? 0 : 1;
  },

  step(state, dt, inputs) {
    const total = inputs.developTime ?? NaN;
    const lapse = inputs.timeLapse ?? NaN;
    const time = state[ELAPSED] ?? 0;
    if (!(time < total)) return 0; // fully developed
    const reached = time + lapse * dt >= total;
    const next = reached ? total : time + lapse * dt;
    state[ELAPSED] = next;
    state[DEVELOPMENT] = next / total;
    return reached ? (total - time) / lapse : dt;
  },

  isComplete: (state, inputs) => (state[ELAPSED] ?? 0) >= (inputs.developTime ?? NaN),

  /** The theory: the outcome's colour code and whether the test is positive. */
  predict(inputs) {
    refuseInvalid(inputs);
    const colour = outcome(inputs);
    return { colour, positive: colour === COLOURS.none ? 0 : 1 };
  },
};
