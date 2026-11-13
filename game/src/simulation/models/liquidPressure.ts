import type { SimulationModel } from '../SimulationModel';

/**
 * The liquids in the tank, kg/m³ at 20 °C (CRC Handbook of Chemistry and Physics, 91st ed.):
 * water 998.2; sodium chloride solution 26 % by mass (near saturation) 1197.2 ("Concentrative
 * Properties of Aqueous Solutions"); ethanol 789.3. Indexed by the `liquid` input.
 */
export const LIQUIDS: readonly { readonly name: string; readonly density: number }[] = [
  { name: 'water', density: 998.2 },
  { name: 'salt water (26 % NaCl)', density: 1197.2 },
  { name: 'ethanol', density: 789.3 },
];

// State slots.
const CLOCK = 0;
const DEPTH = 1; // the probe membrane's depth below the surface (m)
const GAUGE = 2; // the liquid's pressure there above the air's, ρ·g·h (Pa)
const PRESSURE = 3; // p0 + ρ·g·h (Pa)
const DIFFERENCE = 4; // the manometer's level difference Δh (m)

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['liquid', (l) => l === 0 || l === 1 || l === 2, '0 (water), 1 (salt water) or 2 (ethanol)'],
  ['depth', (h) => h > 0 && h <= 0.3, 'above 0 and at most 0.3 m (the tank’s depth)'],
  ['gravity', (g) => g > 0 && g <= 30, 'above 0 and at most 30 m/s²'],
  ['airPressure', (p) => p > 0 && p <= 2e5, 'above 0 and at most 2e5 Pa'],
  ['manometerDensity', (r) => r > 0 && r <= 2e4, 'above 0 and at most 2e4 kg/m³'],
  ['lowerSpeed', (v) => v > 0 && v <= 1, 'above 0 and at most 1 m/s'],
  ['holdTime', (t) => t >= 0 && t <= 60, 'from 0 to 60 s'],
];

function tank(inputs: Readonly<Record<string, number>>) {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Liquid pressure input "${id}" is missing`);
    if (!accepts(value))
      throw new Error(`Liquid pressure input "${id}" must be ${rule}, got ${value}`);
  }
  const rho = LIQUIDS[inputs.liquid ?? NaN]?.density ?? NaN;
  const h = inputs.depth ?? NaN;
  const v = inputs.lowerSpeed ?? NaN;
  return {
    rho,
    h,
    g: inputs.gravity ?? NaN,
    p0: inputs.airPressure ?? NaN,
    rhoM: inputs.manometerDensity ?? NaN,
    v,
    end: h / v + (inputs.holdTime ?? NaN),
  };
}

type Tank = ReturnType<typeof tank>;

function derive(state: Float64Array, k: Tank, t: number): void {
  const depth = Math.min(k.v * t, k.h);
  const gauge = k.rho * k.g * depth;
  state[CLOCK] = t;
  state[DEPTH] = depth;
  state[GAUGE] = gauge;
  state[PRESSURE] = k.p0 + gauge;
  state[DIFFERENCE] = gauge / (k.rhoM * k.g);
}

/**
 * Pressure in a liquid against depth — a simplified teaching model (KNTT Vật lí 10, bài 34). A
 * probe (a funnel closed by a thin membrane) is lowered at `lowerSpeed` (m/s) into a tank of
 * `liquid` (`LIQUIDS`) to `depth` h (m) below its surface and held there `holdTime` s; a tube joins
 * it to a U-tube manometer of liquid of `manometerDensity` (kg/m³). At depth d the liquid's
 * pressure is p = p0 + ρ·g·d (`airPressure` p0 on the surface, `gravity` g): the manometer's
 * levels differ by Δh = ρ·g·d/(ρ_m·g) = (ρ/ρ_m)·d. The liquid is at rest and incompressible; the
 * membrane and the air in the tube pass the pressure on without loss; the manometer follows at
 * once (quasi-static). In closed form in time: a step never changes the state.
 *
 * Variables: `clock` t (s), `probeDepth` d (m), `gaugePressure` ρ·g·d and `pressure` p0 + ρ·g·d
 * (Pa), `manometerDifference` Δh (m).
 */
export const liquidPressureModel: SimulationModel = {
  id: 'fluids.liquid-pressure',
  inputs: [
    'liquid',
    'depth',
    'gravity',
    'airPressure',
    'manometerDensity',
    'lowerSpeed',
    'holdTime',
  ],
  variables: ['clock', 'probeDepth', 'gaugePressure', 'pressure', 'manometerDifference'],
  predictions: ['gaugePressure', 'pressure', 'manometerDifference', 'density', 'weightDensity'],

  init(inputs, state) {
    state.fill(0);
    derive(state, tank(inputs), 0);
  },

  step(state, dt, inputs) {
    const k = tank(inputs);
    const t0 = state[CLOCK] ?? 0;
    const t1 = Math.min(t0 + dt, k.end);
    derive(state, k, t1);
    return t1 - t0;
  },

  isComplete: (state, inputs) => (state[CLOCK] ?? 0) >= tank(inputs).end - 1e-12,

  /**
   * The theory at the full depth h: ρ·g·h, p0 + ρ·g·h, Δh = (ρ/ρ_m)·h; the liquid's density ρ and,
   * for the gauge pressure against depth, the slope ρ·g (`weightDensity`, N/m³ = Pa/m).
   */
  predict(inputs) {
    const k = tank(inputs);
    const gauge = k.rho * k.g * k.h;
    return {
      gaugePressure: gauge,
      pressure: k.p0 + gauge,
      manometerDifference: gauge / (k.rhoM * k.g),
      density: k.rho,
      weightDensity: k.rho * k.g,
    };
  },
};
