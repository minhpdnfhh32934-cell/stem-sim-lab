import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const LAB_TIME = 0;
const TEMPERATURE = 1;
const WATER = 2;
const DISSOLVED = 3;
const CRYSTALS = 4;
const SALT_PERCENT = 5;
const RECOVERY = 6;
const RESIDUE = 7;
const SALT_LOST = 8;
const UNDISSOLVED = 9;

/** The density of water at 20 °C, g/mL (998.21 kg/m³, CRC Handbook). */
const WATER_DENSITY = 0.9982;
/**
 * The solubility of sodium chloride, g per g of water: 35.9 g per 100 g at 20 °C, where it is
 * dissolved and rinsed, and 39.2 g per 100 g at 100 °C, where it crystallises from the boiling
 * filtrate (26.4 and 28.2 % by mass; solubility tables, e.g. the CRC Handbook's).
 */
const SOLUBILITY_ROOM = 0.359;
const SOLUBILITY_BOILING = 0.392;
/** The room, where the salt dissolves and the filtrate starts heating, °C. */
const ROOM_TEMPERATURE = 20;
/** Pure water boils at 100 °C at 1 atm (99.97 °C on ITS-90). */
const WATER_BOILING_POINT = 100;
/** Liquid water's specific heat, J/(g·K), and its latent heat of vaporisation at 100 °C, J/g. */
const WATER_HEAT_CAPACITY = 4.18;
const VAPORISATION_HEAT = 2257;
/**
 * The boiling-point elevation per gram of NaCl per gram of water, K: ΔT_b = i·K_b·b with
 * b = 1000·(salt/water)/M mol/kg, i = 2 (Na⁺ and Cl⁻, ideal), K_b = 0.513 K·kg/mol for water and
 * M = 58.44 g/mol. The ideal dilute value: a real saturated brine boils near 108.7 °C, not 106.9.
 */
const ELEVATION = (2 * 0.513 * 1000) / 58.44;

/**
 * What the model accepts, as [input, accepts, rule]; anything else is refused with its reason,
 * never clamped (each check fails for NaN and ±∞). The upper limits only keep it a bench-scale
 * separation.
 */
const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['saltMass', (m) => m > 0 && m <= 100, 'above 0 and at most 100 g'],
  ['waterVolume', (v) => v > 0 && v <= 1000, 'above 0 and at most 1000 mL'],
  ['rinses', (n) => Number.isInteger(n) && n >= 0 && n <= 10, 'a whole number from 0 to 10'],
  ['sandMass', (m) => m >= 0 && m <= 100, 'from 0 to 100 g'],
  ['rinseVolume', (v) => v > 0 && v <= 100, 'above 0 and at most 100 mL'],
  ['retainedWater', (m) => m >= 0 && m <= 100, 'from 0 to 100 g'],
  ['heaterPower', (p) => p > 0 && p <= 1e4, 'above 0 and at most 1e4 W'],
  ['timeLapse', (k) => k >= 1 && k <= 1e4, 'from 1 to 1e4'],
];

const get = (inputs: Inputs, id: string) => inputs[id] ?? NaN;

/** The water the salt is dissolved in, g. */
const dissolvingWater = (inputs: Inputs) => WATER_DENSITY * get(inputs, 'waterVolume');

/** The water that reaches the dish, g: all that was poured through, less what the residue holds. */
const filtrateWater = (inputs: Inputs) =>
  WATER_DENSITY *
    (get(inputs, 'waterVolume') + get(inputs, 'rinses') * get(inputs, 'rinseVolume')) -
  get(inputs, 'retainedWater');

/** Salt that does not dissolve in the water at 20 °C, g: past the solubility limit. */
const undissolvedAtStart = (inputs: Inputs) =>
  get(inputs, 'saltMass') -
  Math.min(get(inputs, 'saltMass'), SOLUBILITY_ROOM * dissolvingWater(inputs));

/**
 * Salt left with the sand after the filtration and n rinses, g: crystals that never dissolved and
 * salt dissolved in the water the wet residue holds. Each rinse mixes with that water, dissolves
 * what it can at 20 °C and drains back to the same held water (ideal dilution washing).
 */
function saltLeftWithSand(inputs: Inputs): number {
  const water = dissolvingWater(inputs);
  const held = get(inputs, 'retainedWater');
  const rinse = WATER_DENSITY * get(inputs, 'rinseVolume');
  let solid = undissolvedAtStart(inputs);
  let inHeld = ((get(inputs, 'saltMass') - solid) * held) / water;
  for (let k = 0; k < get(inputs, 'rinses'); k++) {
    const dissolved = Math.min(inHeld + solid, SOLUBILITY_ROOM * (held + rinse));
    solid = inHeld + solid - dissolved;
    inHeld = (dissolved * held) / (held + rinse);
  }
  return solid + inHeld;
}

/** When the filtrate starts to boil, s: c·m_w·(T_b − 20 °C)/P, T_b raised by its salt. */
const boilTime = (inputs: Inputs, salt: number, water: number) =>
  (WATER_HEAT_CAPACITY *
    water *
    (WATER_BOILING_POINT + (ELEVATION * salt) / water - ROOM_TEMPERATURE)) /
  get(inputs, 'heaterPower');

/** When the last water has boiled off, s: t_b + m_w·L_v/P. */
const dryTime = (inputs: Inputs, salt: number, water: number) =>
  boilTime(inputs, salt, water) + (VAPORISATION_HEAT * water) / get(inputs, 'heaterPower');

/** Refuses inputs the model cannot run, with the reason, before anything is computed from them. */
function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Separation input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Separation input "${id}" must be ${rule}, got ${value}`);
  }
  const water = dissolvingWater(inputs);
  const held = get(inputs, 'retainedWater');
  if (!(water > held)) {
    throw new Error(
      `Separation: the wet residue holds ${held} g of water, all of the ${water.toFixed(2)} g ` +
        `poured in, so no filtrate would pass; use more water`,
    );
  }
}

/** The dish at lab time t: warming, then boiling down at P/L_v, salt crystallising once saturated. */
function derive(state: Float64Array, t: number, inputs: Inputs): void {
  const saltIn = get(inputs, 'saltMass');
  const salt = saltIn - (state[SALT_LOST] ?? NaN);
  const water0 = filtrateWater(inputs);
  const power = get(inputs, 'heaterPower');
  const tb = boilTime(inputs, salt, water0);
  // Dry exactly at t_dry (the same sum as `dryTime`); max: rounding just before it never leaves
  // −1e-15 g of water.
  const water =
    t <= tb
      ? water0
      : t >= tb + (VAPORISATION_HEAT * water0) / power
        ? 0
        : Math.max(0, water0 - (power * (t - tb)) / VAPORISATION_HEAT);
  const dissolved = Math.min(salt, SOLUBILITY_BOILING * water);
  const crystals = salt - dissolved;
  state[LAB_TIME] = t;
  state[TEMPERATURE] =
    t <= tb
      ? ROOM_TEMPERATURE + (power * t) / (WATER_HEAT_CAPACITY * water0)
      : WATER_BOILING_POINT + ELEVATION * Math.min(salt / water, SOLUBILITY_BOILING); // dry: x/0 = ∞
  state[WATER] = water;
  state[DISSOLVED] = dissolved;
  state[CRYSTALS] = crystals;
  state[SALT_PERCENT] = (100 * crystals) / (get(inputs, 'sandMass') + saltIn);
  state[RECOVERY] = (100 * crystals) / saltIn;
}

/**
 * Separating a sand–salt mixture as a school lab does: a simplified teaching model of the mass
 * balance and the heat, not a model of a real filtration to lab precision. Units as a chemistry
 * lab uses them: masses in g, volumes in mL, temperature in °C, power in W, time in s.
 *
 * Before the run (worked out at init, not in time): `saltMass` g of NaCl and `sandMass` g of sand
 * are stirred into `waterVolume` mL of water at 20 °C. The salt dissolves up to its solubility,
 * 35.9 g per 100 g of water; any more stays solid with the sand (too little water). The mixture is
 * filtered: the sand stays on the paper, and the wet residue holds `retainedWater` g of water (one
 * illustrative constant for this sand and paper, not a measured property) carrying salt at the
 * solution's own salt-to-water ratio. Each of the `rinses` portions of `rinseVolume` mL mixes with
 * that held water, dissolves what it can and drains back to it, so with all the salt dissolved the
 * salt left behind is S·(m_held/m_w)·qⁿ, q = m_held/(m_held + m_rinse): the ideal dilution washing
 * of gravimetric analysis, where several small rinses beat one large one. Everything that passed
 * is the filtrate; the dried residue is the sand plus the salt it kept, so residue + recovered salt
 * is always the mixture's mass.
 *
 * The run: the filtrate is heated in an evaporating dish at a constant net power P
 * (`heaterPower`, what reaches the liquid; illustrative). It warms from 20 °C at P/(c·m_w) to its
 * boiling point, 100 °C raised by the ideal elevation i·K_b·b; then boils away at P/L_v. Once the
 * salt-to-water ratio reaches the solubility at 100 °C (39.2 g per 100 g) the salt crystallises,
 * the solution stays saturated and its boiling point stays at 106.9 °C (ideal; real brine boils
 * near 108.7 °C). The run ends when the dish is dry. Left out: the dish's and the salt's heat
 * capacity, evaporation below the boiling point, the heat that warms the brine as its boiling point
 * rises (under 0.5 % of the heat at the dials' settings), spitting near dryness, and the salt's
 * slightly higher solubility above 100 °C. The state depends only on the lab time, in closed
 * form, so each step is exact.
 *
 * Time is compressed: `timeLapse` lab seconds pass per run second; `labTime` is the heating time.
 *
 * Variables: `labTime` (s), `temperature` of the liquid (°C), `waterMass` in the dish (g),
 * `dissolvedSalt` and `crystalMass` in the dish (g), `saltPercent` the crystals as a percent of
 * the mixture and `recovery` as a percent of the salt put in (%), and, fixed at the start,
 * `residueMass` the dried residue, `saltLost` the salt it kept and `undissolvedSalt` the salt the
 * water could not dissolve (g).
 */
export const separationModel: SimulationModel = {
  id: 'chemistry.separation',
  inputs: [
    'saltMass',
    'waterVolume',
    'rinses',
    'sandMass',
    'rinseVolume',
    'retainedWater',
    'heaterPower',
    'timeLapse',
  ],
  variables: [
    'labTime',
    'temperature',
    'waterMass',
    'dissolvedSalt',
    'crystalMass',
    'saltPercent',
    'recovery',
    'residueMass',
    'saltLost',
    'undissolvedSalt',
  ],
  predictions: [
    'saltRecovered',
    'saltPercent',
    'recovery',
    'residueMass',
    'saltLost',
    'undissolvedSalt',
    'boilTime',
    'crystalTime',
    'dryTime',
    'recoveryFraction',
  ],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    const lost = saltLeftWithSand(inputs);
    state[UNDISSOLVED] = undissolvedAtStart(inputs);
    state[SALT_LOST] = lost;
    state[RESIDUE] = get(inputs, 'sandMass') + lost;
    derive(state, 0, inputs);
  },

  step(state, dt, inputs) {
    const lapse = get(inputs, 'timeLapse');
    const time = state[LAB_TIME] ?? 0;
    const end = dryTime(
      inputs,
      get(inputs, 'saltMass') - (state[SALT_LOST] ?? NaN),
      filtrateWater(inputs),
    );
    if (!(time < end)) return 0; // the dish is dry
    const reached = time + lapse * dt >= end;
    derive(state, reached ? end : time + lapse * dt, inputs);
    return reached ? (end - time) / lapse : dt;
  },

  isComplete: (state, inputs) =>
    (state[LAB_TIME] ?? 0) >=
    dryTime(inputs, get(inputs, 'saltMass') - (state[SALT_LOST] ?? NaN), filtrateWater(inputs)),

  /**
   * The theory, in closed form: the mass balance (salt undissolved, left with the sand, recovered;
   * the dried residue; the recovered salt as a percent of the mixture and of the salt put in); the
   * times the filtrate starts to boil, starts to crystallise (its water down to salt/s₁₀₀) and is
   * dry; and the slope of recovered salt against salt in the mixture while all of it dissolves,
   * f = 1 − (m_held/m_w)·qⁿ, through the origin.
   */
  predict(inputs) {
    refuseInvalid(inputs);
    const saltIn = get(inputs, 'saltMass');
    const lost = saltLeftWithSand(inputs);
    const salt = saltIn - lost;
    const water = filtrateWater(inputs);
    const held = get(inputs, 'retainedWater');
    const q = held / (held + WATER_DENSITY * get(inputs, 'rinseVolume'));
    const tb = boilTime(inputs, salt, water);
    return {
      saltRecovered: salt,
      saltPercent: (100 * salt) / (get(inputs, 'sandMass') + saltIn),
      recovery: (100 * salt) / saltIn,
      residueMass: get(inputs, 'sandMass') + lost,
      saltLost: lost,
      undissolvedSalt: undissolvedAtStart(inputs),
      boilTime: tb,
      crystalTime:
        tb + ((water - salt / SOLUBILITY_BOILING) * VAPORISATION_HEAT) / get(inputs, 'heaterPower'),
      dryTime: dryTime(inputs, salt, water),
      recoveryFraction: 1 - (held / dissolvingWater(inputs)) * Math.pow(q, get(inputs, 'rinses')),
    };
  },
};
