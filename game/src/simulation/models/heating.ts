import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const TEMPERATURE = 0;
const ICE_FRACTION = 1;
const WATER_MASS = 2;
const VAPOUR_MASS = 3;
const HEAT = 4;
const STATE = 5;
/** The first of the stages' stopwatches, in stage order: ice, melting, water, boiling (6 to 9). */
const ICE_WARMING_TIME = 6;
const BOIL_START_TIME = 10;

/** The numeric `state` of the beaker's contents: the stage the heating curve is in. */
export const SOLID = 0;
export const MELTING = 1;
export const LIQUID = 2;
export const BOILING = 3;

/**
 * What the model accepts, as [input, accepts, rule]; anything else is refused with its reason,
 * never clamped (each check fails for NaN and ±∞). The constant heat capacities hold near the
 * stages they describe only: c_ice falls from 2.10 kJ/(kg·K) at 0 °C to about 1.89 at −30 °C and
 * 1.81 at −40 °C (IAPWS R10-06, ice Ih), so ice starts no colder than −30 °C, where a constant
 * 2100 J/(kg·K) still makes the ice-warming stage about 5 % too long. The upper limits only keep
 * the arithmetic finite.
 */
const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['power', (p) => p > 0 && p <= 1e5, 'above 0 and at most 1e5 W'],
  ['mass', (m) => m > 0 && m <= 100, 'above 0 and at most 100 kg'],
  ['startTemperature', (t) => t >= -30 && t <= 100, 'from −30 to 100 °C'],
  ['iceHeatCapacity', (c) => c > 0 && c <= 1e5, 'above 0 and at most 1e5 J/(kg·K)'],
  ['fusionHeat', (l) => l > 0 && l <= 1e8, 'above 0 and at most 1e8 J/kg'],
  ['waterHeatCapacity', (c) => c > 0 && c <= 1e5, 'above 0 and at most 1e5 J/(kg·K)'],
  ['vaporisationHeat', (l) => l > 0 && l <= 1e8, 'above 0 and at most 1e8 J/kg'],
  ['meltingPoint', (t) => t >= -50 && t <= 100, 'from −50 to 100 °C'],
  ['boilingPoint', (t) => t >= -50 && t <= 200, 'from −50 to 200 °C'],
  ['boilOffFraction', (f) => f >= 0 && f <= 1, 'from 0 to 1'],
];

/** An input, or NaN when missing — never a plausible default: init and predict refuse it first. */
const get = (inputs: Inputs, id: string) => inputs[id] ?? NaN;

/** Refuses inputs the model cannot run, with the reason, before anything is computed from them. */
function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Heating input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Heating input "${id}" must be ${rule}, got ${value}`);
  }
  const [t0, tm, tb] = [
    get(inputs, 'startTemperature'),
    get(inputs, 'meltingPoint'),
    get(inputs, 'boilingPoint'),
  ];
  if (!(tm < tb)) throw new Error(`Heating: melting point ${tm} °C must be below boiling ${tb} °C`);
  if (!(t0 <= tm)) {
    throw new Error(
      `Heating: the ice must start at or below its melting point ${tm} °C, not ${t0}`,
    );
  }
}

/**
 * The heat (J) supplied by the end of stage `stage`: Q₁ = m·c_ice·(T_m − T₀) warms the ice to its
 * melting point, Q₂ = Q₁ + m·L_f melts it, Q₃ = Q₂ + m·c_w·(T_b − T_m) warms the water to its
 * boiling point, Q₄ = Q₃ + f·m·L_v boils the fraction f away. A switch, so stepping allocates
 * nothing.
 */
function heatAtEndOf(stage: number, inputs: Inputs): number {
  const m = inputs.mass ?? NaN;
  const tm = inputs.meltingPoint ?? NaN;
  const q1 = m * (inputs.iceHeatCapacity ?? NaN) * (tm - (inputs.startTemperature ?? NaN));
  if (stage === SOLID) return q1;
  const q2 = q1 + m * (inputs.fusionHeat ?? NaN);
  if (stage === MELTING) return q2;
  const q3 = q2 + m * (inputs.waterHeatCapacity ?? NaN) * ((inputs.boilingPoint ?? NaN) - tm);
  if (stage === LIQUID) return q3;
  return q3 + (inputs.boilOffFraction ?? NaN) * m * (inputs.vaporisationHeat ?? NaN);
}

/**
 * The stage at heat Q: the first whose end lies beyond Q, so a stage of no length (ice put in at
 * its melting point, nothing to boil off) is skipped, and at a corner the next stage has begun.
 * Once all is supplied, the last: boiling.
 */
function stageAt(heat: number, inputs: Inputs): number {
  for (let stage = SOLID; stage < BOILING; stage++) {
    if (heat < heatAtEndOf(stage, inputs)) return stage;
  }
  return BOILING;
}

/** The contents at heat Q, in closed form, stage by stage (the stopwatches are left alone). */
function derive(state: Float64Array, inputs: Inputs): void {
  const q = state[HEAT] ?? 0;
  const m = inputs.mass ?? NaN;
  const stage = stageAt(q, inputs);
  state[STATE] = stage;
  state[ICE_FRACTION] = stage === SOLID ? 1 : 0;
  state[WATER_MASS] = stage === SOLID ? 0 : m;
  state[VAPOUR_MASS] = 0;
  if (stage === SOLID) {
    state[TEMPERATURE] =
      (inputs.startTemperature ?? NaN) + q / (m * (inputs.iceHeatCapacity ?? NaN));
  } else if (stage === MELTING) {
    const melted = (q - heatAtEndOf(SOLID, inputs)) / (m * (inputs.fusionHeat ?? NaN));
    state[TEMPERATURE] = inputs.meltingPoint ?? NaN;
    state[ICE_FRACTION] = 1 - melted;
    state[WATER_MASS] = m * melted;
  } else if (stage === LIQUID) {
    const warmed = (q - heatAtEndOf(MELTING, inputs)) / (m * (inputs.waterHeatCapacity ?? NaN));
    state[TEMPERATURE] = (inputs.meltingPoint ?? NaN) + warmed;
  } else {
    const boiled = (q - heatAtEndOf(LIQUID, inputs)) / (inputs.vaporisationHeat ?? NaN);
    state[TEMPERATURE] = inputs.boilingPoint ?? NaN;
    state[VAPOUR_MASS] = boiled;
    state[WATER_MASS] = m - boiled;
  }
}

/**
 * The heating curve of water, a simplified teaching model: a beaker of crushed ice on a hot plate
 * that puts a constant net power P (W) into its contents — the plate's power less what it loses to
 * the room and the glass, which the model does not compute. Ice at T₀ warms to its melting point
 * T_m, melts at T_m, the water warms to its boiling point T_b, then boils at T_b until the
 * fraction f of it (`boilOffFraction`) has gone as vapour, when the run ends. Heat Q = P·t, and
 * the contents follow from Q in closed form, stage by stage (`derive`):
 *
 *   ice     T = T₀ + Q/(m·c_ice)                 up to Q₁ = m·c_ice·(T_m − T₀)
 *   melting T = T_m, ice left 1 − (Q − Q₁)/(m·L_f)  up to Q₂ = Q₁ + m·L_f
 *   water   T = T_m + (Q − Q₂)/(m·c_w)           up to Q₃ = Q₂ + m·c_w·(T_b − T_m)
 *   boiling T = T_b, vapour (Q − Q₃)/L_v          up to Q₄ = Q₃ + f·m·L_v
 *
 * The constants are inputs, set by the experiment (its definition states the values and their
 * sources): c_ice, L_f, c_w, L_v, T_m and T_b. Assumed: the contents are stirred, so ice and water
 * share one temperature; no heat goes to the beaker, the thermometer or the room; nothing
 * evaporates below T_b and the water does not superheat; the pressure is 1 atm; the heat capacities
 * are constant over each stage. Real heating curves are rounded at the corners and tilted on the
 * plateaus by exactly these effects; this one is not, and claims no lab precision.
 *
 * Stepping: a step stops exactly at each corner and returns the time that took, so the stopwatches
 * — `iceWarmingTime`, `meltingTime`, `waterWarmingTime`, `boilingTime`, each the run's own time
 * spent in its stage, and `boilStartTime`, the clock when T_b was reached — start and stop on the
 * corners whatever the step. Units: °C (as chemistry labs read them; differences in K), kg, J, s.
 *
 * Variables: `temperature` (°C), `iceFraction` (the fraction of the mass still ice), `waterMass`
 * and `vapourMass` (kg; the vapour is what has boiled away), `heat` Q supplied (J), `state`
 * (0 ice, 1 melting, 2 water, 3 boiling) and the stopwatches (s).
 */
export const heatingModel: SimulationModel = {
  id: 'thermal.heating-curve',
  inputs: [
    'power',
    'mass',
    'startTemperature',
    'iceHeatCapacity',
    'fusionHeat',
    'waterHeatCapacity',
    'vaporisationHeat',
    'meltingPoint',
    'boilingPoint',
    'boilOffFraction',
  ],
  variables: [
    'temperature',
    'iceFraction',
    'waterMass',
    'vapourMass',
    'heat',
    'state',
    'iceWarmingTime',
    'meltingTime',
    'waterWarmingTime',
    'boilingTime',
    'boilStartTime',
  ],
  predictions: [
    'iceWarmingTime',
    'meltingTime',
    'waterWarmingTime',
    'boilingTime',
    'boilStartTime',
    'totalTime',
    'totalHeat',
    'meltingPoint',
    'boilingPoint',
    'vapourMass',
    'waterMass',
    'iceHeatingRate',
    'waterHeatingRate',
    'meltingSlope',
    'warmingSlope',
  ],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    derive(state, inputs);
  },

  step(state, dt, inputs) {
    const q = state[HEAT] ?? 0;
    const end = heatAtEndOf(BOILING, inputs);
    if (!(q < end)) return 0; // all supplied: the run is over
    const p = inputs.power ?? NaN;
    const stage = stageAt(q, inputs);
    const corner = heatAtEndOf(stage, inputs);
    // The last step of a stage stops on its corner and takes only the time it needs.
    const reached = p * dt >= corner - q;
    const advanced = reached ? (corner - q) / p : dt;
    state[HEAT] = reached ? corner : q + p * dt;
    const clock = ICE_WARMING_TIME + stage;
    state[clock] = (state[clock] ?? 0) + advanced;
    if (stage !== BOILING) {
      state[BOIL_START_TIME] = (state[BOIL_START_TIME] ?? 0) + advanced;
    }
    derive(state, inputs);
    return advanced;
  },

  isComplete: (state, inputs) => (state[HEAT] ?? 0) >= heatAtEndOf(BOILING, inputs),

  /**
   * The theory, in closed form from the inputs: each stage lasts its heat over P — the plateaus
   * m·L_f/P and f·m·L_v/P — T_b is reached at Q₃/P and the run ends at Q₄/P; the slopes of the
   * curve, P/(m·c_ice) and P/(m·c_w) (K/s); the masses at the end, f·m of vapour and (1 − f)·m of
   * water; and, for a line of the melting time against m at one P, the slope L_f/P (s/kg), from
   * which L_f = slope·P; of the water's warming time against m, c_w·(T_b − T_m)/P.
   */
  predict(inputs) {
    refuseInvalid(inputs);
    const p = get(inputs, 'power');
    const m = get(inputs, 'mass');
    const f = get(inputs, 'boilOffFraction');
    const cw = get(inputs, 'waterHeatCapacity');
    const q1 = heatAtEndOf(SOLID, inputs);
    const q2 = heatAtEndOf(MELTING, inputs);
    const q3 = heatAtEndOf(LIQUID, inputs);
    const q4 = heatAtEndOf(BOILING, inputs);
    return {
      iceWarmingTime: q1 / p,
      meltingTime: (q2 - q1) / p,
      waterWarmingTime: (q3 - q2) / p,
      boilingTime: (q4 - q3) / p,
      boilStartTime: q3 / p,
      totalTime: q4 / p,
      totalHeat: q4,
      meltingPoint: get(inputs, 'meltingPoint'),
      boilingPoint: get(inputs, 'boilingPoint'),
      vapourMass: f * m,
      waterMass: (1 - f) * m,
      iceHeatingRate: p / (m * get(inputs, 'iceHeatCapacity')),
      waterHeatingRate: p / (m * cw),
      meltingSlope: get(inputs, 'fusionHeat') / p,
      warmingSlope: (cw * (get(inputs, 'boilingPoint') - get(inputs, 'meltingPoint'))) / p,
    };
  },
};
