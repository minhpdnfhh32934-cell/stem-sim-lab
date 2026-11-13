import type { SimulationModel } from '../SimulationModel';
import { seedBits } from './genetics';

type Inputs = Readonly<Record<string, number>>;

const ELAPSED = 0;
const CAUGHT = 1;
const RECAPTURED = 2;
const UNMARKED = 3;
const MARKED_SHARE = 4;
const LINCOLN_PETERSEN = 5;
const CHAPMAN = 6;
const CHAPMAN_ERROR = 7;
const LAST_MARKED = 8;

const whole = (n: number) => Number.isInteger(n);

/**
 * What the model accepts, as [input, accepts, rule]; anything else is refused with its reason,
 * never clamped (each check fails for NaN and ±∞). The marked and the caught are checked against
 * the population in `refuseInvalid`.
 */
const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['populationSize', (n) => whole(n) && n >= 2 && n <= 1e5, 'a whole number from 2 to 1e5'],
  ['marked', (m) => whole(m) && m >= 1, 'a whole number from 1'],
  ['caught', (c) => whole(c) && c >= 1, 'a whole number from 1'],
  ['sample', (s) => whole(s) && s >= 0 && s <= 0xffffffff, 'a whole number from 0 to 4294967295'],
  ['drawTime', (t) => t > 0 && t <= 1e4, 'above 0 and at most 1e4 s'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Mark–recapture input "${id}" is missing`);
    if (!accepts(value)) {
      throw new Error(`Mark–recapture input "${id}" must be ${rule}, got ${value}`);
    }
  }
  // The population's size is never named in a refusal: the student works it out.
  const n = inputs.populationSize ?? NaN;
  if (!((inputs.marked ?? NaN) < n)) {
    throw new Error('Mark–recapture: there are not that many beans to mark; mark fewer');
  }
  if (!((inputs.caught ?? NaN) <= n)) {
    throw new Error('Mark–recapture: there are not that many beans to catch; catch fewer');
  }
}

/** The Lincoln–Petersen estimate M·n/R, or 0 while no marked bean has been caught again. */
export const lincolnPetersen = (marked: number, caught: number, recaptured: number) =>
  recaptured > 0 ? (marked * caught) / recaptured : 0;

/** Chapman's estimate (M + 1)(n + 1)/(R + 1) − 1: finite even with no recapture. */
export const chapman = (marked: number, caught: number, recaptured: number) =>
  ((marked + 1) * (caught + 1)) / (recaptured + 1) - 1;

/**
 * The standard error of Chapman's estimate, √[(M + 1)(n + 1)(M − R)(n − R)/((R + 1)²(R + 2))]
 * (Seber 1970, Biometrika 57, 313; Seber 1982, "The Estimation of Animal Abundance", §3.1.1).
 */
export const chapmanError = (marked: number, caught: number, recaptured: number) =>
  Math.sqrt(
    ((marked + 1) * (caught + 1) * (marked - recaptured) * (caught - recaptured)) /
      ((recaptured + 1) ** 2 * (recaptured + 2)),
  );

/** Values that follow from the counts so far. */
function derive(state: Float64Array, inputs: Inputs): void {
  const marked = inputs.marked ?? NaN;
  const n = state[CAUGHT] ?? 0;
  const r = state[RECAPTURED] ?? 0;
  state[UNMARKED] = n - r;
  state[MARKED_SHARE] = n > 0 ? (100 * r) / n : 0;
  state[LINCOLN_PETERSEN] = lincolnPetersen(marked, n, r);
  state[CHAPMAN] = chapman(marked, n, r);
  state[CHAPMAN_ERROR] = chapmanError(marked, n, r);
}

/**
 * Catches bean k (from 1): marked with probability (marked left in the jar)/(beans left in the
 * jar), on the fraction of 2³² that seed k's bits are: drawing without replacement, one bean at a
 * time.
 */
function catchBean(state: Float64Array, k: number, inputs: Inputs): void {
  const left = (inputs.populationSize ?? NaN) - (k - 1);
  const markedLeft = (inputs.marked ?? NaN) - (state[RECAPTURED] ?? 0);
  const marked = seedBits(inputs.sample ?? NaN, k) < (markedLeft / left) * 2 ** 32;
  if (marked) state[RECAPTURED] = (state[RECAPTURED] ?? 0) + 1;
  state[LAST_MARKED] = marked ? 1 : 0;
}

/**
 * Estimating a population by mark and recapture, done as a classroom simulation: a jar of beans
 * stands for a closed population (`populationSize` N, a hidden input the student never sees).
 * M of them (`marked`) were marked and mixed back in; now a catch of C (`caught`) is drawn
 * without looking, one bean at a time, and the marked ones among them are counted, R. As the
 * marked share of the catch estimates the marked share of the population, R/C ≈ M/N, the
 * Lincoln–Petersen estimate is N̂ = M·C/R (Petersen 1896; Lincoln 1930, U.S. Dept. Agric. Circ.
 * 118). It has no value while R = 0 (shown as 0) and runs high in small samples; Chapman's
 * N̂_C = (M + 1)(C + 1)/(R + 1) − 1 (Chapman 1951, Univ. Calif. Publ. Stat. 1, 131) is exactly
 * unbiased when M + C ≥ N and nearly so otherwise; its standard error is Seber's (`chapmanError`).
 * Assumed, as in the field: the population is closed (no birth, death or migration between the
 * two catches), marks are not lost, marked and unmarked are as likely to be caught, and the
 * marked have mixed evenly — the jar is shaken, so here they hold exactly.
 *
 * Drawing: bean k is marked with probability (M − R so far)/(N − (k − 1)), decided by the fair
 * 32 bits of seed k of a seeded generator (`seedBits`, the genetics model's), never Math.random:
 * R then follows the hypergeometric distribution exactly, one sample (`sample`) gives the same
 * beans every time, and its first n beans are the same whatever C. The sample is a run input,
 * so it is recorded with the run.
 *
 * Time only paces the count: bean k is drawn at (k − 1)·T/C run seconds (T `drawTime`), so the
 * first at once, all C before T; the run ends at T exactly, the last step taking only the time it
 * needs. The step size changes when a bean appears, never which beans the sample has.
 *
 * Variables: `elapsed` (s of drawing), `caught` n so far, `recaptured` R (marked among them),
 * `unmarked` n − R, `markedShare` 100·R/n (%; 0 before the first bean), `lincolnPetersen` M·n/R
 * (0 while R = 0), `chapman` N̂_C and `chapmanError` its standard error, and `lastMarked` 1 or 0
 * for the latest bean (−1 before the first). Every value is finite from the start.
 */
export const markRecaptureModel: SimulationModel = {
  id: 'biology.mark-recapture',
  inputs: ['populationSize', 'marked', 'caught', 'sample', 'drawTime'],
  variables: [
    'elapsed',
    'caught',
    'recaptured',
    'unmarked',
    'markedShare',
    'lincolnPetersen',
    'chapman',
    'chapmanError',
    'lastMarked',
  ],
  predictions: ['expectedRecaptured', 'recapturedVariance'],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    state[LAST_MARKED] = -1;
    derive(state, inputs);
  },

  step(state, dt, inputs) {
    const total = inputs.drawTime ?? NaN;
    const c = inputs.caught ?? NaN;
    const elapsed = state[ELAPSED] ?? 0;
    if (!(elapsed < total)) return 0; // the catch is in
    const reached = elapsed + dt >= total;
    const now = reached ? total : elapsed + dt;
    // Bean k is drawn at (k − 1)·T/C: the first at once, every one by T.
    const due = Math.min(c, Math.floor((now * c) / total) + 1);
    for (let k = (state[CAUGHT] ?? 0) + 1; k <= due; k++) catchBean(state, k, inputs);
    state[CAUGHT] = Math.max(state[CAUGHT] ?? 0, due);
    state[ELAPSED] = now;
    derive(state, inputs);
    return reached ? total - elapsed : dt;
  },

  isComplete: (state, inputs) => (state[ELAPSED] ?? 0) >= (inputs.drawTime ?? NaN),

  /**
   * The hypergeometric mean and variance of R: C·M/N and C·(M/N)·(1 − M/N)·(N − C)/(N − 1). Built
   * on the hidden N, so never shown to the student (a hidden input withholds all theory).
   */
  predict(inputs) {
    refuseInvalid(inputs);
    const n = inputs.populationSize ?? NaN;
    const m = inputs.marked ?? NaN;
    const c = inputs.caught ?? NaN;
    const p = m / n;
    return {
      expectedRecaptured: c * p,
      recapturedVariance: (c * p * (1 - p) * (n - c)) / (n - 1),
    };
  },
};
