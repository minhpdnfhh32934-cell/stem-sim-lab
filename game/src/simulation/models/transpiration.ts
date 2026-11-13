import type { SimulationModel } from '../SimulationModel';
import { PHOTOSYNTHESIS } from './photosynthesis';

type Inputs = Readonly<Record<string, number>>;

const LAB_TIME = 0;
const DISTANCE = 1;
const UPTAKE = 2;
const RATE = 3;
const DEFICIT = 4;
const STOMATAL = 5;
const BOUNDARY = 6;
const CONDUCTANCE = 7;
const SHARE = 8;

/**
 * The model's constants. The physical ones are standard values; the leaf's two conductances are
 * illustrative, chosen inside the ranges measured for soft-leaved plants, not measured for any
 * one species.
 */
export const TRANSPIRATION = {
  /**
   * g_s of fully open stomata, to water vapour (mol/(m²·s)): illustrative, inside the 0.1–0.6
   * measured for herbaceous mesophytes (Körner, Scheel & Bauer 1979, Photosynthetica 13, 45).
   */
  maxStomatalConductance: 0.3,
  /** g_s in the dark, through the cuticle and closed stomata (mol/(m²·s)): illustrative. */
  darkConductance: 0.01,
  /**
   * The illuminance that opens the stomata halfway (lux): the photosynthesis model's half-
   * saturating light, P_max/α = 5 000 lux, as stomatal conductance tracks photosynthetic
   * capacity (Wong, Cowan & Farquhar 1979, Nature 282, 424). Illustrative, like its source.
   */
  halfOpenIlluminance: PHOTOSYNTHESIS.maxRate / PHOTOSYNTHESIS.lightResponse,
  /**
   * c in g_b = c·√(u/d), forced convection over a flat leaf, for water vapour on one side
   * (mol/(m²·s), u in m/s, d in m): Campbell & Norman 1998, "An Introduction to Environmental
   * Biophysics", ch. 7 — the laminar flat-plate law Sh = 0.664·Re^½·Sc^⅓ for air at 20 °C.
   */
  boundaryCoefficient: 0.147,
  /** A flat leaf's characteristic dimension d = 0.72·w, w its width (Campbell & Norman 1998). */
  dimensionPerWidth: 0.72,
  /** Air pressure P (kPa): the standard atmosphere. */
  airPressure: 101.325,
  /** Molar mass of water (g/mol). */
  waterMolarMass: 18.015,
  /** Density of water at 20 °C (g/mL), used at every temperature (0.7 % off at 40 °C at most). */
  waterDensity: 0.9982,
} as const;

/**
 * Saturation vapour pressure over water (kPa) at `celsius`: Tetens' form with Buck's (1981, J.
 * Appl. Meteor. 20, 1527) coefficients, as Campbell & Norman use it; within 0.1 % of the IAPWS-95
 * values from 0 to 40 °C.
 */
export const saturationPressure = (celsius: number) =>
  0.61121 * Math.exp((17.502 * celsius) / (celsius + 240.97));

/**
 * What the model accepts, as [input, accepts, rule]; anything else is refused with its reason,
 * never clamped (each check fails for NaN and ±∞). Below 0.1 m/s free convection, which the model
 * leaves out, sets the boundary layer; full sunlight is about 100 000 lux; the vapour-pressure
 * formula and the leaf are taken no further than 0–40 °C.
 */
const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['illuminance', (i) => i >= 0 && i <= 1e5, 'from 0 to 100 000 lux'],
  ['humidity', (h) => h >= 0 && h <= 100, 'from 0 to 100 %'],
  [
    'airSpeed',
    (u) => u >= 0.1 && u <= 10,
    'from 0.1 to 10 m/s (in stiller air free convection, not modelled, sets the boundary layer)',
  ],
  ['temperature', (t) => t >= 0 && t <= 40, 'from 0 to 40 °C'],
  ['leafArea', (a) => a > 0 && a <= 1, 'above 0 and at most 1 m²'],
  ['leafWidth', (w) => w > 0 && w <= 0.5, 'above 0 and at most 0.5 m'],
  ['boreDiameter', (d) => d > 0 && d <= 0.01, 'above 0 and at most 0.01 m'],
  ['scaleLength', (l) => l > 0 && l <= 2, 'above 0 and at most 2 m'],
  ['duration', (t) => t > 0 && t <= 86400, 'above 0 and at most 86 400 s'],
  ['timeLapse', (k) => k >= 1 && k <= 1e4, 'from 1 to 1e4'],
];

/** Everything a run's inputs fix (refused if invalid): the conductances, D, E and the bubble. */
function rates(inputs: Inputs) {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Transpiration input "${id}" is missing`);
    if (!accepts(value)) {
      throw new Error(`Transpiration input "${id}" must be ${rule}, got ${value}`);
    }
  }
  const c = TRANSPIRATION;
  const light = inputs.illuminance ?? NaN;
  const stomatal =
    c.darkConductance +
    ((c.maxStomatalConductance - c.darkConductance) * light) / (light + c.halfOpenIlluminance);
  const boundary =
    c.boundaryCoefficient *
    Math.sqrt((inputs.airSpeed ?? NaN) / (c.dimensionPerWidth * (inputs.leafWidth ?? NaN)));
  const conductance = (stomatal * boundary) / (stomatal + boundary);
  const deficit =
    (saturationPressure(inputs.temperature ?? NaN) * (100 - (inputs.humidity ?? NaN))) / 100;
  const flux = (conductance * deficit) / c.airPressure; // mol/(m²·s)
  const volumeRate = (flux * (inputs.leafArea ?? NaN) * c.waterMolarMass) / c.waterDensity; // mL/s
  const boreArea = Math.PI * ((inputs.boreDiameter ?? NaN) / 2) ** 2;
  const duration = inputs.duration ?? NaN;
  const uptake = volumeRate * duration;
  const distance = (uptake * 1e-6) / boreArea;
  const scale = inputs.scaleLength ?? NaN;
  if (!(distance <= scale)) {
    throw new Error(
      `Transpiration: the bubble would move ${distance.toFixed(3)} m, past the end of the ` +
        `${scale} m scale; shorten the measuring time or choose conditions with a lower rate`,
    );
  }
  return {
    stomatal,
    boundary,
    conductance,
    share: (100 * boundary) / (stomatal + boundary),
    deficit,
    rate: 1000 * flux,
    uptake,
    distance,
  };
}

/**
 * Transpiration of a leafy shoot in a bubble potometer: a simplified teaching model of how light,
 * humidity and moving air change the rate, not a model of one species to lab precision. The cut
 * shoot is sealed under water into the potometer; the water it takes up is drawn from a
 * horizontal capillary whose air bubble moves towards the shoot along a scale. Uptake is taken to
 * equal the water lost by transpiration (in a real shoot about 1 % is kept for growth and
 * photosynthesis). Units as a biology lab uses them: illuminance in lux, humidity in %, air speed
 * in m/s, temperature in °C, D in kPa, conductances in mol/(m²·s), E in mmol/(m²·s) per one side
 * of leaf, water in mL, distances in m, time in s.
 *
 * Water vapour diffuses from the saturated air in the leaf to the room through two conductances
 * in series, the stomata g_s and the boundary layer g_b: 1/g = 1/g_s + 1/g_b. The stomata open
 * with light as a rectangular hyperbola, g_s = g_dark + (g_max − g_dark)·I/(I + I_½); the boundary
 * layer thins as the air moves, g_b = 0.147·√(u/d), d = 0.72·w (constants: `TRANSPIRATION`). The
 * leaf is at air temperature (a heat filter in front of the lamp; the leaf's energy balance is
 * not modelled), so the driving force is the vapour-pressure deficit of the air,
 * D = e_s(T)·(1 − RH/100), and E = g·D/P (Campbell & Norman 1998, ch. 14, isothermal; the small
 * mass-flow correction of von Caemmerer & Farquhar 1981 is left out). The rate is steady at once:
 * the shoot is taken to have settled to the conditions before the bubble is timed (real stomata
 * take 5–30 min). `stomatalShare` = r_s/(r_s + r_b) = g/g_s, the stomata's share of the resistance,
 * is also the fraction by which E changes for a fractional change in g_s: in the dark the stomata
 * control the rate and the fan hardly matters; open stomata in still air share control with it.
 *
 * Time is compressed: `duration` lab seconds of timing are shown at `timeLapse` lab seconds per
 * run second; `labTime` is the timing the run represents. The volume taken up,
 * V = E·A·M_w/ρ_w·t (A the leaf area of one side), moves the bubble x = V/(π·r²) along the bore
 * of radius r; both come in closed form from the elapsed time, never by summing steps, and the
 * last step stops on the measuring time and returns the run time it took. A run whose bubble would
 * pass the end of the scale (`scaleLength`) is refused.
 *
 * Variables: `labTime` (s), `distance` x (m), `uptake` V (mL), `transpirationRate` E from them,
 * 1000·V·ρ_w/(M_w·A·t) (mmol/(m²·s); 0 before any time has passed), `vapourDeficit` D (kPa),
 * `stomatalConductance` g_s, `boundaryConductance` g_b and `conductance` g (mol/(m²·s)) and
 * `stomatalShare` (%).
 */
export const transpirationModel: SimulationModel = {
  id: 'biology.transpiration',
  inputs: [
    'illuminance',
    'humidity',
    'airSpeed',
    'temperature',
    'leafArea',
    'leafWidth',
    'boreDiameter',
    'scaleLength',
    'duration',
    'timeLapse',
  ],
  variables: [
    'labTime',
    'distance',
    'uptake',
    'transpirationRate',
    'vapourDeficit',
    'stomatalConductance',
    'boundaryConductance',
    'conductance',
    'stomatalShare',
  ],
  predictions: [
    'vapourDeficit',
    'stomatalConductance',
    'boundaryConductance',
    'conductance',
    'stomatalShare',
    'transpirationRate',
    'uptake',
    'distance',
    'rateSlope',
  ],

  init(inputs, state) {
    const r = rates(inputs);
    state.fill(0);
    state[DEFICIT] = r.deficit;
    state[STOMATAL] = r.stomatal;
    state[BOUNDARY] = r.boundary;
    state[CONDUCTANCE] = r.conductance;
    state[SHARE] = r.share;
  },

  step(state, dt, inputs) {
    const c = TRANSPIRATION;
    const duration = inputs.duration ?? NaN;
    const lapse = inputs.timeLapse ?? NaN;
    const time = state[LAB_TIME] ?? 0;
    if (!(time < duration)) return 0; // the timing is over
    const reached = time + lapse * dt >= duration;
    const next = reached ? duration : time + lapse * dt;
    const area = inputs.leafArea ?? NaN;
    const flux = ((state[CONDUCTANCE] ?? 0) * (state[DEFICIT] ?? 0)) / c.airPressure;
    const uptake = ((flux * area * c.waterMolarMass) / c.waterDensity) * next;
    state[LAB_TIME] = next;
    state[UPTAKE] = uptake;
    state[DISTANCE] = (uptake * 1e-6) / (Math.PI * ((inputs.boreDiameter ?? NaN) / 2) ** 2);
    state[RATE] = (1000 * uptake * c.waterDensity) / (c.waterMolarMass * area * next);
    return reached ? (duration - time) / lapse : dt;
  },

  isComplete: (state, inputs) => (state[LAB_TIME] ?? 0) >= (inputs.duration ?? NaN),

  /**
   * The theory: D, g_s, g_b, g, the stomata's share of the resistance, E, and V and x after the
   * whole measuring time; and `rateSlope` = 1000·g/P (mmol/(m²·s·kPa)), the slope of E against D
   * at one light and air speed, a line through the origin (no deficit, no transpiration).
   */
  predict(inputs) {
    const r = rates(inputs);
    return {
      vapourDeficit: r.deficit,
      stomatalConductance: r.stomatal,
      boundaryConductance: r.boundary,
      conductance: r.conductance,
      stomatalShare: r.share,
      transpirationRate: r.rate,
      uptake: r.uptake,
      distance: r.distance,
      rateSlope: (1000 * r.conductance) / TRANSPIRATION.airPressure,
    };
  },
};
