import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

/** 0 °C on the kelvin scale (K): the definition of the Celsius scale. */
export const ZERO_CELSIUS = 273.15;

function need(inputs: Inputs, id: string, accepts: (v: number) => boolean, rule: string): number {
  const value = inputs[id];
  if (value === undefined) throw new Error(`Gas law input "${id}" is missing`);
  if (!accepts(value)) throw new Error(`Gas law input "${id}" must be ${rule}, got ${value}`);
  return value;
}

// ---------------------------------------------------------------------------------------------
// Boyle: a syringe on a pressure gauge

const B_CLOCK = 0;
const B_VOLUME = 1;
const B_PRESSURE = 2;
const B_PRODUCT = 3;
const B_INVERSE = 4;

/** The gauge's full scale (Pa): illustrative, a school gauge reading to 300 kPa. */
export const GAUGE_LIMIT = 300000;

function syringe(inputs: Inputs) {
  const V0 = need(inputs, 'startVolume', (v) => v > 0 && v <= 1e-4, 'above 0, at most 100 mL');
  const V = need(inputs, 'endVolume', (v) => v > 0 && v <= 1e-4, 'above 0, at most 100 mL');
  const p0 = need(inputs, 'atmosphericPressure', (v) => v >= 5e4 && v <= 1.2e5, '50–120 kPa');
  const duration = need(inputs, 'duration', (v) => v > 0 && v <= 60, 'above 0, at most 60 s');
  const top = (p0 * V0) / Math.min(V, V0);
  if (top > GAUGE_LIMIT)
    throw new Error(
      `Boyle: squeezing ${(V0 * 1e6).toFixed(0)} mL to ${(V * 1e6).toFixed(0)} mL would take the gauge past its ${GAUGE_LIMIT / 1000} kPa; squeeze less`,
    );
  return { V0, V, p0, duration };
}

function pressed(state: Float64Array, s: ReturnType<typeof syringe>, t: number) {
  const V = s.V0 + (s.V - s.V0) * Math.min(t / s.duration, 1);
  const p = (s.p0 * s.V0) / V; // isothermal: p·V stays p0·V0
  state[B_CLOCK] = t;
  state[B_VOLUME] = V;
  state[B_PRESSURE] = p;
  state[B_PRODUCT] = p * V;
  state[B_INVERSE] = 1 / V;
}

/**
 * Boyle's law with a syringe and a pressure gauge (KNTT Vật lí 12, bài 9) — a simplified teaching
 * model. Air at `atmosphericPressure` p0 (Pa) fills `startVolume` V0 (m³) of a sealed syringe;
 * the piston is moved steadily to `endVolume` V over `duration` (s), slowly enough that the air
 * stays at the room's temperature: p·V = p0·V0. The air is ideal, the seal does not leak and the
 * gauge's tube adds no volume. A run past the gauge's full scale is refused. Closed form in time.
 *
 * Variables: `clock` (s), `volume` V (m³), `pressure` p (Pa), `pressureVolume` p·V (J),
 * `inverseVolume` 1/V (1/m³).
 */
export const boyleModel: SimulationModel = {
  id: 'gases.boyle',
  inputs: ['startVolume', 'endVolume', 'atmosphericPressure', 'duration'],
  variables: ['clock', 'volume', 'pressure', 'pressureVolume', 'inverseVolume'],
  predictions: ['volume', 'pressure', 'pressureVolume', 'inverseVolume'],

  init(inputs, state) {
    state.fill(0);
    pressed(state, syringe(inputs), 0);
  },

  step(state, dt, inputs) {
    const s = syringe(inputs);
    const t0 = state[B_CLOCK] ?? 0;
    const t1 = Math.min(t0 + dt, s.duration);
    pressed(state, s, t1);
    return t1 - t0;
  },

  isComplete: (state, inputs) => (state[B_CLOCK] ?? 0) >= syringe(inputs).duration,

  /** The theory: V and p = p0·V0/V at the end; p·V = p0·V0 (the slope of p against 1/V); 1/V. */
  predict(inputs) {
    const s = syringe(inputs);
    return {
      volume: s.V,
      pressure: (s.p0 * s.V0) / s.V,
      pressureVolume: s.p0 * s.V0,
      inverseVolume: 1 / s.V,
    };
  },
};

// ---------------------------------------------------------------------------------------------
// Charles: an air column in a capillary, in a water bath

const C_TIME = 0;
const C_TEMPERATURE = 1;
const C_LENGTH = 2;
const C_KELVIN = 3;

function column(inputs: Inputs) {
  const target = need(
    inputs,
    'bathTemperature',
    (v) => v >= 0 && v <= 95,
    '0–95 °C (a water bath)',
  );
  const start = need(inputs, 'startTemperature', (v) => v >= 0 && v <= 95, '0–95 °C');
  const L0 = need(inputs, 'startLength', (v) => v > 0 && v <= 0.3, 'above 0, at most 0.3 m');
  const rate = need(inputs, 'heatingRate', (v) => v > 0 && v <= 1, 'above 0, at most 1 K/s');
  const lapse = need(inputs, 'timeLapse', (v) => v > 0, 'above 0');
  // The bath is brought steadily from the room to the set temperature (or cooled with ice).
  const duration = Math.max(Math.abs(target - start) / rate, 1);
  return { target, start, L0, lapse, duration };
}

function warmed(state: Float64Array, c: ReturnType<typeof column>, t: number) {
  const share = Math.min(t / c.duration, 1);
  const temperature = c.start + (c.target - c.start) * share;
  state[C_TIME] = t;
  state[C_TEMPERATURE] = temperature;
  // At constant pressure V ∝ T (kelvin); a capillary of even bore, so the column's length is too.
  state[C_LENGTH] = (c.L0 * (temperature + ZERO_CELSIUS)) / (c.start + ZERO_CELSIUS);
  state[C_KELVIN] = temperature + ZERO_CELSIUS;
}

/**
 * Charles's law with an air column in a water bath (KNTT Vật lí 12, bài 10) — a simplified teaching
 * model. Dry air is trapped in a capillary of even bore by a short index of liquid, open to the
 * room: its pressure stays the atmosphere's plus the index's. At `startTemperature` (°C) the column
 * is `startLength` L0 (m). The bath is taken steadily at `heatingRate` (K/s) to `bathTemperature`
 * t (°C) and the air follows it at once; V/T stays constant, so L = L0·(t + 273.15)/(t0 + 273.15),
 * a straight line in t that reaches 0 at −273.15 °C. The air is ideal and dry (no vapour), the
 * index moves freely and the glass does not expand. Time is compressed (`timeLapse`).
 *
 * Variables: `labTime` (s), `temperature` t (°C), `length` L (m), `absoluteTemperature` T (K).
 */
export const charlesModel: SimulationModel = {
  id: 'gases.charles',
  inputs: ['bathTemperature', 'startTemperature', 'startLength', 'heatingRate', 'timeLapse'],
  variables: ['labTime', 'temperature', 'length', 'absoluteTemperature'],
  predictions: ['temperature', 'length', 'lengthPerKelvin', 'lengthAtZeroCelsius', 'absoluteZero'],

  init(inputs, state) {
    state.fill(0);
    warmed(state, column(inputs), 0);
  },

  step(state, dt, inputs) {
    const c = column(inputs);
    const time = state[C_TIME] ?? 0;
    if (!(time < c.duration)) return 0;
    const next = Math.min(time + c.lapse * dt, c.duration);
    warmed(state, c, next);
    return (next - time) / c.lapse;
  },

  isComplete: (state, inputs) => (state[C_TIME] ?? 0) >= column(inputs).duration,

  /**
   * The theory: the bath's temperature and L at it; the slope of L against t, L0/(t0 + 273.15)
   * (m/K); its intercept at 0 °C, L0·273.15/(t0 + 273.15); and where the line meets 0, −273.15 °C.
   */
  predict(inputs) {
    const c = column(inputs);
    const perKelvin = c.L0 / (c.start + ZERO_CELSIUS);
    return {
      temperature: c.target,
      length: perKelvin * (c.target + ZERO_CELSIUS),
      lengthPerKelvin: perKelvin,
      lengthAtZeroCelsius: perKelvin * ZERO_CELSIUS,
      absoluteZero: -ZERO_CELSIUS,
    };
  },
};
