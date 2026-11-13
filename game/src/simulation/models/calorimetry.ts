import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

/** The constants of both calorimetry models, with their sources. */
export const CALORIMETRY = {
  /** c of liquid water at 25 °C (J/(kg·K)): CRC Handbook of Chemistry and Physics, 4.1813 J/(g·K). */
  waterSpecificHeat: 4181,
  /** Specific latent heat of fusion of ice at 0 °C (J/kg): CRC Handbook, 333.6 J/g. */
  iceLatentHeat: 333600,
} as const;

function need(inputs: Inputs, id: string, accepts: (v: number) => boolean, rule: string): number {
  const value = inputs[id];
  if (value === undefined) throw new Error(`Calorimetry input "${id}" is missing`);
  if (!accepts(value)) throw new Error(`Calorimetry input "${id}" must be ${rule}, got ${value}`);
  return value;
}

/** Lab time after a step of `dt` run seconds at `lapse` lab seconds per run second, stopping on `end`. */
function advance(time: number, dt: number, lapse: number, end: number) {
  const next = Math.min(time + lapse * dt, end);
  return { next, took: (next - time) / lapse };
}

// ---------------------------------------------------------------------------------------------
// Specific heat of water with a joulemeter

const H_TIME = 0;
const H_TEMPERATURE = 1;
const H_ENERGY = 2;
const H_RISE = 3;
const H_SEEN = 4;

function heating(inputs: Inputs) {
  const P = need(inputs, 'power', (v) => v > 0 && v <= 200, 'above 0 and at most 200 W');
  const m = need(inputs, 'waterMass', (v) => v > 0 && v <= 1, 'above 0 and at most 1 kg');
  const duration = need(inputs, 'heatingTime', (v) => v > 0 && v <= 3600, 'above 0 s, at most 1 h');
  const T0 = need(inputs, 'roomTemperature', (v) => v >= 0 && v <= 40, '0–40 °C');
  const C = need(inputs, 'calorimeterCapacity', (v) => v >= 0 && v <= 1000, '0–1000 J/K');
  const k = need(inputs, 'lossCoefficient', (v) => v >= 0 && v <= 10, '0–10 W/K');
  const lapse = need(inputs, 'timeLapse', (v) => v > 0, 'above 0');
  const capacity = m * CALORIMETRY.waterSpecificHeat + C; // J/K
  const rise = (t: number) =>
    // (m·c + C)·dT/dt = P − k·(T − T0), from T0: the closed form; no loss (k = 0) its limit P·t/(m·c + C).
    k === 0 ? (P * t) / capacity : (P / k) * -Math.expm1((-k * t) / capacity);
  const end = rise(duration);
  if (T0 + end > 95)
    throw new Error(
      `Specific heat: the water would reach ${(T0 + end).toFixed(0)} °C and start to boil away; heat it less (lower power, shorter time or more water)`,
    );
  return { P, m, duration, T0, C, lapse, rise };
}

function heated(state: Float64Array, h: ReturnType<typeof heating>, t: number) {
  const rise = h.rise(t);
  state[H_TIME] = t;
  state[H_TEMPERATURE] = h.T0 + rise;
  state[H_ENERGY] = h.P * t; // the joulemeter: the energy given to the heater
  state[H_RISE] = rise;
  // c worked out as the practical does: (E/ΔT − C)/m, all losses ignored; 0 before any rise.
  state[H_SEEN] = rise > 0 ? ((h.P * t) / rise - h.C) / h.m : 0;
}

/**
 * The specific heat of water with a joulemeter (KNTT Vật lí 12, bài 4–6 practical) — a simplified
 * teaching model. A heater of `power` P (W) in `waterMass` m (kg) of water in a calorimeter of heat
 * capacity C (`calorimeterCapacity`, J/K, illustrative), stirred so the water is at one temperature,
 * for `heatingTime` t (s). The calorimeter loses heat to the room by Newton's cooling,
 * k·(T − T0) (`lossCoefficient` k, W/K, illustrative; decision D9 of the Phase T contract), so
 * (m·c + C)·dT/dt = P − k·(T − T0), T = T0 + (P/k)·(1 − e^(−k·t/(m·c + C))). The joulemeter reads
 * E = P·t. Worked as the practical does, c = (E/ΔT − C)/m ignores the loss and comes out a little
 * high. A run that would bring the water near boiling is refused. Time is compressed:
 * `timeLapse` lab seconds per run second; closed form in time.
 *
 * Variables: `labTime` (s), `temperature` T (°C), `energy` E (J), `temperatureRise` ΔT (K),
 * `specificHeatSeen` (J/(kg·K), 0 before any rise).
 */
export const specificHeatModel: SimulationModel = {
  id: 'thermal.specific-heat',
  inputs: [
    'power',
    'waterMass',
    'heatingTime',
    'roomTemperature',
    'calorimeterCapacity',
    'lossCoefficient',
    'timeLapse',
  ],
  variables: ['labTime', 'temperature', 'energy', 'temperatureRise', 'specificHeatSeen'],
  predictions: [
    'specificHeat',
    'temperatureRise',
    'lossFreeRise',
    'energy',
    'finalTemperature',
    'risePerJoule',
    'heatCapacity',
  ],

  init(inputs, state) {
    state.fill(0);
    heated(state, heating(inputs), 0);
  },

  step(state, dt, inputs) {
    const h = heating(inputs);
    const time = state[H_TIME] ?? 0;
    if (!(time < h.duration)) return 0;
    const { next, took } = advance(time, dt, h.lapse, h.duration);
    heated(state, h, next);
    return took;
  },

  isComplete: (state, inputs) => (state[H_TIME] ?? 0) >= heating(inputs).duration,

  /**
   * The theory: water's c; the rise ΔT at the end of heating (with the loss) and without it,
   * P·t/(m·c + C); the joulemeter's E = P·t; the final temperature; and the slope of ΔT against E
   * without loss, 1/(m·c + C), whose inverse is the heat capacity of water and can, m·c + C.
   */
  predict(inputs) {
    const h = heating(inputs);
    const rise = h.rise(h.duration);
    return {
      specificHeat: CALORIMETRY.waterSpecificHeat,
      temperatureRise: rise,
      lossFreeRise: (h.P * h.duration) / (h.m * CALORIMETRY.waterSpecificHeat + h.C),
      energy: h.P * h.duration,
      finalTemperature: h.T0 + rise,
      risePerJoule: 1 / (h.m * CALORIMETRY.waterSpecificHeat + h.C),
      heatCapacity: h.m * CALORIMETRY.waterSpecificHeat + h.C,
    };
  },
};

// ---------------------------------------------------------------------------------------------
// Specific latent heat of fusion of ice, with a control funnel

const F_TIME = 0;
const F_ENERGY = 1;
const F_HEATED = 2;
const F_CONTROL = 3;
const F_SEEN = 4;
const F_UNCORRECTED = 5;
const F_BY_HEATER = 6;

function melting(inputs: Inputs) {
  const P = need(inputs, 'power', (v) => v > 0 && v <= 200, 'above 0 and at most 200 W');
  const duration = need(inputs, 'heatingTime', (v) => v > 0 && v <= 3600, 'above 0 s, at most 1 h');
  const gain = need(inputs, 'roomHeatGain', (v) => v >= 0 && v <= 20, '0–20 W');
  const ice = need(inputs, 'iceMass', (v) => v > 0 && v <= 2, 'above 0 and at most 2 kg');
  const lapse = need(inputs, 'timeLapse', (v) => v > 0, 'above 0');
  const melted = ((P + gain) * duration) / CALORIMETRY.iceLatentHeat;
  if (melted > ice)
    throw new Error(
      `Latent heat: ${(melted * 1000).toFixed(0)} g of ice would melt, more than the ${(ice * 1000).toFixed(0)} g in the funnel; heat it for less time or at a lower power`,
    );
  return { P, duration, gain, lapse };
}

function melted(state: Float64Array, f: ReturnType<typeof melting>, t: number) {
  const L = CALORIMETRY.iceLatentHeat;
  const heated = ((f.P + f.gain) * t) / L;
  const control = (f.gain * t) / L;
  state[F_TIME] = t;
  state[F_ENERGY] = f.P * t;
  state[F_HEATED] = heated;
  state[F_CONTROL] = control;
  // λ worked as the practical does, from the two beakers; and without the control, all the
  // melt put down to the heater. 0 before anything has melted.
  state[F_SEEN] = heated > control ? (f.P * t) / (heated - control) : 0;
  state[F_UNCORRECTED] = heated > 0 ? (f.P * t) / heated : 0;
  state[F_BY_HEATER] = heated - control;
}

/**
 * The specific latent heat of fusion of ice (KNTT Vật lí 12, bài 4–6 practical) — a simplified
 * teaching model. Two equal funnels of crushed ice at 0 °C drain into beakers; one holds an
 * immersion heater of `power` P (W), switched on for `heatingTime` t (s), the other is a control.
 * Both take heat from the room at `roomHeatGain` (W, illustrative, the same for both). All the
 * heater's heat goes into the ice around it, and all melt drains: m₁ = (P + P_room)·t/λ in the
 * heated funnel's beaker, m₂ = P_room·t/λ in the control's. λ = P·t/(m₁ − m₂); without the control,
 * P·t/m₁ comes out low. A run that would melt more than the funnel's `iceMass` is refused. Time is
 * compressed (`timeLapse`); closed form in time.
 *
 * Variables: `labTime` (s), `energy` E = P·t (J), `meltHeated` m₁ and `meltControl` m₂ (kg),
 * `latentHeatSeen` and `latentHeatUncorrected` (J/kg, 0 before any melt), `meltByHeater` m₁ − m₂
 * (kg).
 */
export const latentHeatModel: SimulationModel = {
  id: 'thermal.latent-heat',
  inputs: ['power', 'heatingTime', 'roomHeatGain', 'iceMass', 'timeLapse'],
  variables: [
    'labTime',
    'energy',
    'meltHeated',
    'meltControl',
    'latentHeatSeen',
    'latentHeatUncorrected',
    'meltByHeater',
  ],
  predictions: ['latentHeat', 'meltHeated', 'meltControl', 'meltByHeater', 'energy', 'uncorrected'],

  init(inputs, state) {
    state.fill(0);
    melted(state, melting(inputs), 0);
  },

  step(state, dt, inputs) {
    const f = melting(inputs);
    const time = state[F_TIME] ?? 0;
    if (!(time < f.duration)) return 0;
    const { next, took } = advance(time, dt, f.lapse, f.duration);
    melted(state, f, next);
    return took;
  },

  isComplete: (state, inputs) => (state[F_TIME] ?? 0) >= melting(inputs).duration,

  /** The theory: λ of ice; both beakers' melt at the end; E = P·t; and P·t/m₁, the uncorrected λ. */
  predict(inputs) {
    const f = melting(inputs);
    const L = CALORIMETRY.iceLatentHeat;
    const heated = ((f.P + f.gain) * f.duration) / L;
    return {
      latentHeat: L,
      meltHeated: heated,
      meltControl: (f.gain * f.duration) / L,
      meltByHeater: (f.P * f.duration) / L,
      energy: f.P * f.duration,
      uncorrected: (f.P * f.duration) / heated,
    };
  },
};
