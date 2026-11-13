import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const INTENSITY = 0;
const DISTANCE_SQUARED = 1;
const RATE = 2;
const ELAPSED = 3;
const VOLUME = 4;
const BUBBLES = 5;
const MEAN_RATE = 6;
const INVERSE_RATE = 7;
const LIMITING = 8;

/**
 * The teaching model's constants. All are illustrative, chosen so that a school-sized sprig of
 * pondweed gives tens of bubbles a minute near the lamp and saturates within the dials' range —
 * not measured values for Elodea, whose real rates vary with the sprig, its age and its light
 * history by far more than these figures suggest.
 */
export const PHOTOSYNTHESIS = {
  /** Illuminance at the reference distance (lux): roughly a bright bench lamp at 10 cm. */
  referenceIntensity: 10_000,
  /** Where the reference illuminance is given (m). */
  referenceDistance: 0.1,
  /**
   * α, the rate per lux while light is scarce (mL/s per lux), the same at every CO₂ and
   * temperature (the light reactions are photochemical). P_max/α = 5 000 lux is the illuminance
   * of half the plateau when CO₂ and temperature are saturated.
   */
  lightResponse: 2e-6,
  /** The light-, CO₂- and temperature-saturated rate of O₂ release (mL/s; 0.6 mL a minute). */
  maxRate: 0.01,
  /** Hydrogencarbonate concentration giving half the CO₂-saturated rate (mol/L; 5 mmol/L). */
  halfCarbon: 0.005,
  /** Temperature of the fastest rate (°C). */
  optimumTemperature: 30,
  /** Below the optimum the rate halves for every 10 °C cooler (Q₁₀ = 2, a common textbook value). */
  q10: 2,
  /** Above the optimum the rate falls linearly to 0 here (°C): enzymes denature. */
  upperTemperature: 45,
  /** O₂ in one bubble (mL): a sphere of about 2.7 mm across. */
  bubbleVolume: 0.01,
} as const;

/** Codes of the limiting factor (result classes map them to words). */
export const LIMITING_FACTOR = { light: 1, carbon: 2, temperature: 3 } as const;

/**
 * What the model accepts, as [input, accepts, rule]; anything else is refused with its reason,
 * never clamped (each check fails for NaN and ±∞). The lamp's size is not modelled, so it comes
 * no closer than 1 cm. Hydrogencarbonate dissolves to about 1 mol/L; with none at all, or at
 * 45 °C where the enzymes have denatured, no O₂ is given off and 1/rate has no value. The
 * temperature model ends at 0 °C (ice).
 */
const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['distance', (d) => d >= 0.01 && d <= 10, 'from 0.01 to 10 m'],
  ['carbonate', (c) => c > 0 && c <= 1, 'above 0 and at most 1 mol/L'],
  ['temperature', (t) => t >= 0 && t < PHOTOSYNTHESIS.upperTemperature, 'from 0 to below 45 °C'],
  ['duration', (t) => t > 0 && t <= 3600, 'above 0 and at most 3600 s'],
];

/** The temperature factor f(T): 1 at the optimum, Q₁₀ below it, a linear fall above it. */
export function temperatureFactor(celsius: number): number {
  const { optimumTemperature: top, q10, upperTemperature: upper } = PHOTOSYNTHESIS;
  return celsius <= top
    ? q10 ** ((celsius - top) / 10)
    : Math.max(0, (upper - celsius) / (upper - top));
}

/** Everything a run's inputs fix (refused if invalid): light, plateau, rate, limiting factor. */
function rates(inputs: Inputs) {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Photosynthesis input "${id}" is missing`);
    if (!accepts(value)) {
      throw new Error(`Photosynthesis input "${id}" must be ${rule}, got ${value}`);
    }
  }
  const { referenceIntensity, referenceDistance, lightResponse, halfCarbon, maxRate } =
    PHOTOSYNTHESIS;
  const d = inputs.distance ?? NaN;
  const c = inputs.carbonate ?? NaN;
  const distanceSquared = d * d;
  const intensity = (referenceIntensity * referenceDistance ** 2) / distanceSquared;
  const carbon = c / (c + halfCarbon);
  const heat = temperatureFactor(inputs.temperature ?? NaN);
  const light = lightResponse * intensity;
  const plateau = maxRate * carbon * heat;
  const rate = (light * plateau) / (light + plateau);
  // Only underflow at the domain's far edges (C or 45 − T near 1e-300) gets here.
  if (!(rate > 0)) throw new Error('Photosynthesis gives no O₂ at these inputs');
  // Light limits on the light-limited part of the curve, αI < P_c (below half the plateau);
  // otherwise the smaller of f_C and f(T) (Blackman's minimum). Above the optimum f(T) < 1 means
  // too hot: cooling, not warming, would raise the rate.
  const limiting =
    light < plateau
      ? LIMITING_FACTOR.light
      : carbon <= heat
        ? LIMITING_FACTOR.carbon
        : LIMITING_FACTOR.temperature;
  return { intensity, distanceSquared, rate, plateau, limiting };
}

/** Whole bubbles in `volume` mL; a volume a whole number of bubbles within rounding counts it. */
const bubblesIn = (volume: number) => Math.floor(volume / PHOTOSYNTHESIS.bubbleVolume + 1e-9);

/**
 * Photosynthesis of pondweed (Elodea) under a lamp: a simplified teaching model of limiting
 * factors, not lab-grade biology. The sprig sits in hydrogencarbonate solution (the CO₂ source)
 * in a water bath at a set temperature behind a heat filter, so the lamp changes only the light;
 * the O₂ it releases rises as bubbles into a capillary or an inverted measuring cylinder over a
 * collection time (`duration`, s). Units as the lab uses them: distance in m, illuminance in lux,
 * hydrogencarbonate in mol/L, temperature in °C, gas in mL, time in s.
 *
 * Light falls off with the inverse square of the distance from a point lamp,
 * I = I_ref·(d_ref/d)², and the rate of O₂ release is constant during a run (steady state at
 * once). It follows the rectangular-hyperbola light-response curve (Baly 1935), which joins the
 * light-limited line αI to the plateau P_c set by CO₂ and temperature:
 * P = αI·P_c/(αI + P_c), i.e. 1/P = 1/(αI) + 1/P_c, with P_c = P_max · C/(C + K_C) · f(T) and
 * f(T) = Q₁₀^((T − T_opt)/10) up to T_opt, falling linearly to 0 at T_max above it (constants:
 * `PHOTOSYNTHESIS`). In dim light P ≈ αI whatever the CO₂ and temperature (the curves share one
 * starting slope); CO₂ and warmth raise the plateau and the light at which the rate levels off
 * (half the plateau at I = P_c/α). Limiting factor: light while αI < P_c, else the smaller of the
 * CO₂ and temperature factors — a teaching convention, not a sensitivity analysis. Not modelled:
 * respiration (no compensation point: the rate is gross O₂), the minutes a real sprig needs to
 * settle after a change, gas other than O₂ in the bubbles, O₂ dissolving in the water, the lamp's
 * size close up, the hydrogencarbonate used up, and the sharp corners of Blackman's law (the
 * hyperbola is smooth).
 *
 * Variables: `intensity` I (lux), `distanceSquared` d² (m²), `rate` P (mL/s), `elapsed`
 * collection time (s), `volume` V = P·t of O₂ collected (mL), `bubbles` counted,
 * ⌊V / V_bubble⌋, `meanRate` V/t (mL/s), `inverseRate` t/V (s/mL; both 0 before any time has
 * passed) and `limiting` (1 light, 2 CO₂, 3 temperature). V comes in closed form from the elapsed
 * time, never by summing steps; the last step stops on the collection time and returns the time
 * it took.
 */
export const photosynthesisModel: SimulationModel = {
  id: 'biology.photosynthesis',
  inputs: ['distance', 'carbonate', 'temperature', 'duration'],
  variables: [
    'intensity',
    'distanceSquared',
    'rate',
    'elapsed',
    'volume',
    'bubbles',
    'meanRate',
    'inverseRate',
    'limiting',
  ],
  predictions: [
    'intensity',
    'distanceSquared',
    'rate',
    'saturatedRate',
    'volume',
    'bubbles',
    'inverseRate',
    'limiting',
    'lightSlope',
    'inverseRateSlope',
    'inverseRateIntercept',
  ],

  init(inputs, state) {
    const r = rates(inputs);
    state.fill(0);
    state[INTENSITY] = r.intensity;
    state[DISTANCE_SQUARED] = r.distanceSquared;
    state[RATE] = r.rate;
    state[LIMITING] = r.limiting;
  },

  step(state, dt, inputs) {
    const duration = inputs.duration ?? NaN;
    const t = state[ELAPSED] ?? 0;
    if (!(t < duration)) return 0;
    const reached = dt >= duration - t;
    const next = reached ? duration : t + dt;
    const volume = (state[RATE] ?? 0) * next;
    state[ELAPSED] = next;
    state[VOLUME] = volume;
    state[BUBBLES] = bubblesIn(volume);
    state[MEAN_RATE] = volume / next;
    state[INVERSE_RATE] = next / volume;
    return reached ? duration - t : dt;
  },

  isComplete: (state, inputs) => (state[ELAPSED] ?? 0) >= (inputs.duration ?? NaN),

  /**
   * The theory: I, d², P, the light-saturated plateau P_c, V = P·t and its bubbles after the
   * whole collection time, 1/P, the limiting factor, `lightSlope` = α·I_ref·d_ref² (mL·m²/s), the
   * slope of P against 1/d² while light is scarce (the same for every CO₂ and temperature), and
   * `inverseRateSlope` = 1/(α·I_ref·d_ref²) (s/(mL·m²)), the exact slope of 1/P against d², whose
   * intercept is 1/P_c (`inverseRateIntercept`, s/mL).
   */
  predict(inputs) {
    const r = rates(inputs);
    const { referenceIntensity, referenceDistance, lightResponse } = PHOTOSYNTHESIS;
    const volume = r.rate * (inputs.duration ?? NaN);
    const lightSlope = lightResponse * referenceIntensity * referenceDistance ** 2;
    return {
      intensity: r.intensity,
      distanceSquared: r.distanceSquared,
      rate: r.rate,
      saturatedRate: r.plateau,
      volume,
      bubbles: bubblesIn(volume),
      inverseRate: 1 / r.rate,
      limiting: r.limiting,
      lightSlope,
      inverseRateSlope: 1 / lightSlope,
      inverseRateIntercept: 1 / r.plateau,
    };
  },
};
