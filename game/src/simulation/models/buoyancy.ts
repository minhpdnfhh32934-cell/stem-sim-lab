import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const DEPTH = 0;
const VOLUME = 1;
const BUOYANCY = 2;
const READING = 3;
const MASS = 4;
const DENSITY = 5;
const SINK = 6;

/**
 * What the model accepts, as [input, accepts, rule]; anything else is refused with its reason,
 * never clamped (each check fails for NaN and ±∞). The fluid is a liquid filling an overflow can;
 * the lowering is slow enough to be quasi-static, as the model leaves out drag (see below).
 */
const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  [
    'objectDensity',
    (r) => r > 0 && r <= 23000,
    'above 0 and at most 23000 kg/m³ (osmium, the densest element, is 22590)',
  ],
  [
    'fluidDensity',
    (r) => r >= 500 && r <= 14000,
    "a liquid's, from 500 to 14000 kg/m³ (mercury is 13546)",
  ],
  ['edgeLength', (a) => a > 0 && a <= 0.2, 'above 0 and at most 0.2 m'],
  ['gravity', (g) => g > 0 && g < Infinity, 'above 0 m/s² and finite'],
  [
    'loweringSpeed',
    (v) => v > 0 && v <= 0.02,
    'above 0 and at most 0.02 m/s, slow enough to leave out drag',
  ],
  ['clearance', (c) => c >= 0 && c <= 0.1, 'from 0 to 0.1 m'],
];

/** Refuses inputs the model cannot run, with the reason, before anything is computed from them. */
function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Buoyancy input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Buoyancy input "${id}" must be ${rule}, got ${value}`);
  }
}

/** Where the run ends: the block's bottom at a + c, its top `clearance` under the surface. */
const endDepth = (inputs: Inputs) => (inputs.edgeLength ?? NaN) + (inputs.clearance ?? NaN);

/** Everything the sensor and the measuring cylinder show with the block's bottom at `depth`. */
function derive(state: Float64Array, depth: number, inputs: Inputs): void {
  const a = inputs.edgeLength ?? NaN;
  const g = inputs.gravity ?? NaN;
  const under = Math.min(Math.max(depth, 0), a); // the block's height below the surface
  const volume = a * a * under;
  const mass = (inputs.objectDensity ?? NaN) * (a * a * a);
  const buoyancy = (inputs.fluidDensity ?? NaN) * volume * g;
  const reading = mass * g - buoyancy;
  state[DEPTH] = depth;
  state[VOLUME] = volume;
  state[BUOYANCY] = buoyancy;
  state[READING] = reading;
  state[MASS] = mass;
  // m/V as the readings give it; 0 before the block touches the fluid (V = 0), never m/0.
  state[DENSITY] = volume > 0 ? mass / volume : 0;
  state[SINK] = Math.sign(reading);
}

/**
 * Density and buoyancy by Archimedes' principle: a solid cube of edge a and density ρ
 * (`objectDensity`), held on the rigid rod of a force sensor, is lowered at a steady speed v
 * (`loweringSpeed`) into a liquid of density ρ_f (`fluidDensity`) that fills an overflow
 * (displacement) can to its spout; the liquid it pushes out runs into a measuring cylinder. SI
 * throughout: kg, m, m³, N, kg/m³. A teaching model, exact for its idealisations.
 *
 * The block's bottom starts `clearance` c above the surface and stops when its top is c under
 * it (depth a + c). With h its bottom's depth (negative above the surface), the immersed volume
 * is V_sub = a²·min(max(h, 0), a); the overflow keeps the surface at the spout, so V_sub is also
 * the volume collected. The buoyant force is the weight of that liquid, F_b = ρ_f·g·V_sub
 * (Archimedes) — the same as the net hydrostatic pressure force on the faces, ρ_f·g·h·a² on the
 * bottom less ρ_f·g·(h − a)·a² on the top once it is under. The sensor reads F = W − F_b with
 * W = m·g, m = ρ·a³: positive while it holds the block up, negative while its rod pushes a block
 * lighter than the liquid under (a force sensor reads push and pull; a spring balance could
 * not). Fully under, F_b = ρ_f·g·a³ whatever the depth.
 *
 * Quasi-static: the state depends only on the depth, so each step is exact and the last one
 * lands on the end. Left out: drag (½·ρ_f·C_d·a²·v², about 1e-4 N for a 4 cm cube in salt water
 * at 0.01 m/s with C_d ≈ 1.05, about 4e-4 N at the 0.02 m/s bound), the meniscus where the
 * block crosses the surface (up to about σ·4a ≈ 0.01 N on a 4 cm cube in water, gone once it is
 * under), the rod's own volume, the air's buoyancy (ρ_air·g·V, about 0.1 % of W for a block of
 * 900 kg/m³), the liquid held back at the spout, and any compression of the block or liquid.
 *
 * Variables: `depth` h (m), `submergedVolume` V_sub (m³), `buoyantForce` F_b (N), `reading` F
 * (N), `mass` m (kg, as the reading in air gives it: W/g), `density` m/V_sub (kg/m³: the
 * block's density once fully under, larger while only part of it displaces liquid, 0 before it
 * touches), and `sinkOrFloat`, sign(F): +1 the block would sink if let go there, −1 rise, 0 stay.
 */
export const buoyancyModel: SimulationModel = {
  id: 'mechanics.buoyancy',
  inputs: ['objectDensity', 'fluidDensity', 'edgeLength', 'gravity', 'loweringSpeed', 'clearance'],
  variables: [
    'depth',
    'submergedVolume',
    'buoyantForce',
    'reading',
    'mass',
    'density',
    'sinkOrFloat',
  ],
  predictions: [
    'weight',
    'apparentWeight',
    'buoyantForce',
    'volume',
    'mass',
    'density',
    'sinkOrFloat',
    'fluidWeightDensity',
    'fullDepth',
  ],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    derive(state, 0 - (inputs.clearance ?? NaN), inputs); // 0 − c: never −0
  },

  step(state, dt, inputs) {
    const end = endDepth(inputs);
    const depth = state[DEPTH] ?? 0;
    if (!(depth < end)) return 0; // fully lowered
    const v = inputs.loweringSpeed ?? NaN;
    const remaining = (end - depth) / v;
    if (remaining <= dt + 1e-12) {
      derive(state, end, inputs);
      return Math.min(remaining, dt);
    }
    derive(state, depth + v * dt, inputs);
    return dt;
  },

  isComplete: (state, inputs) => (state[DEPTH] ?? 0) >= endDepth(inputs),

  /**
   * The theory, fully under: W = ρ·a³·g, F_b = ρ_f·a³·g (the weight of the liquid displaced),
   * the apparent weight W − F_b, the volume a³, the mass ρ·a³, the density ρ, sign(W − F_b)
   * (+1 sinks, −1 floats, 0 neither), ρ_f·g (N/m³: the slope of F_b against V over runs in one
   * liquid) and the depth a from which it is fully under.
   */
  predict(inputs) {
    refuseInvalid(inputs);
    const a = inputs.edgeLength ?? NaN;
    const g = inputs.gravity ?? NaN;
    const rho = inputs.objectDensity ?? NaN;
    const rhoF = inputs.fluidDensity ?? NaN;
    const volume = a * a * a;
    const mass = rho * volume;
    const weight = mass * g;
    const buoyantForce = rhoF * volume * g;
    return {
      weight,
      apparentWeight: weight - buoyantForce,
      buoyantForce,
      volume,
      mass,
      density: rho,
      sinkOrFloat: Math.sign(weight - buoyantForce),
      fluidWeightDensity: rhoF * g,
      fullDepth: a,
    };
  },
};
