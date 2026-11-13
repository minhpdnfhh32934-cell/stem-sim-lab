import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const LAB_TIME = 0;
const GAS = 1;
const RATE = 2;

/** The seeds in the respirometer, by their `seeds` code. */
export const SEEDS = {
  /** Germinating peas: they respire the starch of their cotyledons. */
  peas: 0,
  /** Germinating sunflower seeds: they respire the oil their seeds store. */
  sunflower: 1,
  /** Peas boiled and cooled: dead, the control. */
  boiled: 2,
} as const;

/** The CO₂ absorber under the seeds, by its `absorber` code. */
export const ABSORBER = { water: 0, potassiumHydroxide: 1 } as const;

/**
 * The model's constants. The respiratory quotients come from the equations of respiration; the
 * rate and its temperature coefficient are illustrative.
 */
export const RESPIRATION = {
  /**
   * O₂ taken up at 20 °C per gram of germinating seed (mL/(g·h)): SPEC GAP — illustrative, of the
   * size school respirometers show (tenths of a mL per gram per hour), not measured for one
   * species. The same for both living seeds, so that their respiratory quotients alone tell them
   * apart; real rates differ with the species, the seeds' age and how long they have soaked.
   */
  rateAt20: 0.25,
  /** Q₁₀: the rate doubles for every 10 °C warmer (a common textbook value; illustrative). */
  q10: 2,
  /**
   * RQ = CO₂ given out / O₂ taken up, by `seeds` code. Carbohydrate: C₆H₁₂O₆ + 6 O₂ → 6 CO₂ +
   * 6 H₂O, RQ = 1 exactly. Fat: about 0.7 (tripalmitin, 2 C₅₁H₉₈O₆ + 145 O₂ → 102 CO₂ + 98 H₂O,
   * 102/145 = 0.703). The boiled seeds respire nothing (their RQ never matters).
   */
  quotients: [1, 0.7, 1],
} as const;

/**
 * What the model accepts, as [input, accepts, rule]; anything else is refused with its reason,
 * never clamped (each check fails for NaN and ±∞). Q₁₀ describes the rate only from about 5 to
 * 35 °C: warmer, the seeds' enzymes begin to denature and the rate falls, which this model does
 * not describe.
 */
const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['seeds', (s) => s === 0 || s === 1 || s === 2, '0 (peas), 1 (sunflower) or 2 (boiled peas)'],
  ['absorber', (a) => a === 0 || a === 1, '0 (water) or 1 (potassium hydroxide)'],
  [
    'temperature',
    (t) => t >= 5 && t <= 35,
    'from 5 to 35 °C (warmer, the seeds’ enzymes denature: not modelled)',
  ],
  ['seedMass', (m) => m > 0 && m <= 100, 'above 0 and at most 100 g'],
  ['pipetteVolume', (v) => v > 0 && v <= 10, 'above 0 and at most 10 mL'],
  ['duration', (t) => t > 0 && t <= 86400, 'above 0 and at most 86 400 s'],
  ['timeLapse', (k) => k >= 1 && k <= 1e4, 'from 1 to 1e4'],
];

/** O₂ taken up by all the seeds (mL/h): m·r₂₀·Q₁₀^((T − 20)/10) if they live, else 0. */
function oxygenRate(inputs: Inputs): number {
  if (inputs.seeds === SEEDS.boiled) return 0;
  const { rateAt20, q10 } = RESPIRATION;
  return (inputs.seedMass ?? NaN) * rateAt20 * q10 ** (((inputs.temperature ?? NaN) - 20) / 10);
}

/** RQ of the seeds respiring. */
const quotientOf = (inputs: Inputs) => RESPIRATION.quotients[inputs.seeds ?? NaN] ?? NaN;

/** The gas the tube loses (mL/h): the O₂ over the absorber, the O₂ less the CO₂ over water. */
function lossRate(inputs: Inputs): number {
  const oxygen = oxygenRate(inputs);
  return inputs.absorber === ABSORBER.potassiumHydroxide
    ? oxygen
    : oxygen * (1 - quotientOf(inputs));
}

/** Everything a run's inputs fix (refused if invalid): the gas rates and what the drop shows. */
function rates(inputs: Inputs) {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Seed respiration input "${id}" is missing`);
    if (!accepts(value)) {
      throw new Error(`Seed respiration input "${id}" must be ${rule}, got ${value}`);
    }
  }
  const oxygen = oxygenRate(inputs);
  const loss = lossRate(inputs);
  const gas = (loss * (inputs.duration ?? NaN)) / 3600;
  const scale = inputs.pipetteVolume ?? NaN;
  if (!(gas <= scale)) {
    throw new Error(
      `Seed respiration: the drop would move ${gas.toFixed(2)} mL, past the end of the ` +
        `${scale} mL pipette; choose a cooler bath`,
    );
  }
  return {
    oxygen,
    carbonDioxide: quotientOf(inputs) * oxygen,
    gas,
    perGram: loss / (inputs.seedMass ?? NaN),
  };
}

/**
 * Respiration of germinating seeds in a respirometer: a simplified teaching model of what the
 * drop in its pipette shows, not a model of one species to lab precision. Units as a biology lab
 * uses them: gas in mL (at the bath's temperature and the room's pressure), seed mass in g,
 * temperature in °C, time in s, rates in mL/(g·h).
 *
 * Seeds of mass m lie on gauze over a CO₂ absorber in a stoppered tube in a water bath; a
 * graduated pipette from the bung holds a coloured drop. The seeds take up O₂ at
 * r = m·r₂₀·Q₁₀^((T − 20)/10) (constants: `RESPIRATION`) and give out CO₂ at RQ·r. With potassium
 * hydroxide the CO₂ is absorbed as it is given out, so the gas in the tube shrinks by the O₂
 * alone; over water it shrinks by r·(1 − RQ) — not at all for carbohydrate (RQ 1), by about 30 %
 * of the O₂ for fat (RQ 0.7). The drop moves towards the seeds by the volume lost: two runs, with
 * and without the absorber, give RQ = 1 − V_water/V_KOH. Boiled seeds are dead and take up
 * nothing: the control. Assumed: the seeds have settled in the bath before the timing (a real
 * protocol waits 5–10 min), so the rate is steady; the absorber takes up the CO₂ as fast as it
 * comes; the bath holds the temperature and a control tube of glass beads (a thermobarometer)
 * cancels any change of the room's pressure, so only respiration moves the drop; no microbes
 * respire on the boiled seeds.
 *
 * Time is compressed: `duration` lab seconds of timing are shown at `timeLapse` lab seconds per
 * run second; `labTime` is the timing the run represents. The volume comes in closed form from
 * the elapsed time, never by summing steps, and the last step stops on the measuring time and
 * returns the run time it took. A run whose drop would pass the end of the pipette
 * (`pipetteVolume`) is refused.
 *
 * Variables: `labTime` (s), `gasTakenUp` V, the drop's movement (mL), and `uptakeRate` from it,
 * V·3600/(m·t) (mL/(g·h); 0 before any time has passed).
 */
export const seedRespirationModel: SimulationModel = {
  id: 'biology.seed-respiration',
  inputs: [
    'seeds',
    'absorber',
    'temperature',
    'seedMass',
    'pipetteVolume',
    'duration',
    'timeLapse',
  ],
  variables: ['labTime', 'gasTakenUp', 'uptakeRate'],
  predictions: ['gasTakenUp', 'uptakeRate', 'oxygenRate', 'carbonDioxideRate'],

  init(inputs, state) {
    rates(inputs);
    state.fill(0);
  },

  step(state, dt, inputs) {
    const duration = inputs.duration ?? NaN;
    const lapse = inputs.timeLapse ?? NaN;
    const time = state[LAB_TIME] ?? 0;
    if (!(time < duration)) return 0; // the timing is over
    const reached = time + lapse * dt >= duration;
    const next = reached ? duration : time + lapse * dt;
    const gas = (lossRate(inputs) * next) / 3600;
    state[LAB_TIME] = next;
    state[GAS] = gas;
    state[RATE] = (gas * 3600) / ((inputs.seedMass ?? NaN) * next);
    return reached ? (duration - time) / lapse : dt;
  },

  isComplete: (state, inputs) => (state[LAB_TIME] ?? 0) >= (inputs.duration ?? NaN),

  /**
   * The theory: V after the whole measuring time and the rate per gram it gives; and the O₂ taken
   * up and the CO₂ given out by all the seeds (mL/h), whatever the absorber.
   */
  predict(inputs) {
    const r = rates(inputs);
    return {
      gasTakenUp: r.gas,
      uptakeRate: r.perGram,
      oxygenRate: r.oxygen,
      carbonDioxideRate: r.carbonDioxide,
    };
  },
};
