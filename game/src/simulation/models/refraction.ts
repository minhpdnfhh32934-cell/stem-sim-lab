import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const INCIDENCE = 0;
const INCIDENCE_DEG = 1;
const REFLECTION = 2;
const REFLECTION_DEG = 3;
const TIR = 4;
const REFLECTANCE = 5;
const LAST_INCIDENCE = 6;
const LAST_INCIDENCE_DEG = 7;
const REFRACTION = 8;
const REFRACTION_DEG = 9;
const SIN_BLOCK = 10;
const SIN_AIR = 11;
const DEG = Math.PI / 180;

/** The indices on the incident side n₁ and the far side n₂: air (taken as 1) and the block. */
const leaving = (inputs: Inputs) => (inputs.direction ?? 0) >= 0.5;
const n1Of = (inputs: Inputs) => (leaving(inputs) ? (inputs.index ?? NaN) : 1);
const n2Of = (inputs: Inputs) => (leaving(inputs) ? 1 : (inputs.index ?? NaN));

/** The critical angle asin(n₂/n₁) (rad); Infinity when n₁ ≤ n₂, where every ray refracts. */
const criticalOf = (n1: number, n2: number) => (n1 > n2 ? Math.asin(n2 / n1) : Infinity);

/**
 * The Fresnel reflectance of unpolarised light, (Rs + Rp)/2, at incidence i and refraction t
 * (rad) from n₁ into n₂: Rs = ((n₁cos i − n₂cos t)/(n₁cos i + n₂cos t))²,
 * Rp = ((n₁cos t − n₂cos i)/(n₁cos t + n₂cos i))² (Hecht, Optics, 5th ed., §4.6).
 */
export function fresnelReflectance(n1: number, n2: number, i: number, t: number): number {
  const ci = Math.cos(i);
  const ct = Math.cos(t);
  const rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct);
  const rp = (n1 * ct - n2 * ci) / (n1 * ct + n2 * ci);
  return (rs * rs + rp * rp) / 2;
}

/** Refuses inputs the model cannot run, by name, never clamping them. */
function refuseInvalid(inputs: Inputs): void {
  const n = inputs.index;
  const angle = inputs.angle;
  const rate = inputs.sweepRate;
  const direction = inputs.direction;
  if (!(n !== undefined && n > 0 && n < Infinity)) {
    throw new Error(`Refraction input "index" must be finite and above 0, got ${n}`);
  }
  if (!(direction !== undefined && direction >= 0 && direction <= 1)) {
    throw new Error(`Refraction input "direction" must be from 0 to 1, got ${direction}`);
  }
  if (!(angle !== undefined && angle >= 0 && angle < 90)) {
    throw new Error(`Refraction input "angle" must be from 0 to below 90°, got ${angle}`);
  }
  if (!(rate !== undefined && rate > 0 && rate < Infinity)) {
    throw new Error(`Refraction input "sweepRate" must be finite and above 0 °/s, got ${rate}`);
  }
}

/**
 * Everything that follows from the ray box's angle i. Under total internal reflection there is
 * no refracted ray: the `last…`, refraction and sine slots keep the last refracted ray's values.
 */
function derive(state: Float64Array, inputs: Inputs): void {
  const n1 = n1Of(inputs);
  const n2 = n2Of(inputs);
  const i = state[INCIDENCE] ?? 0;
  state[INCIDENCE_DEG] = i / DEG;
  state[REFLECTION] = i;
  state[REFLECTION_DEG] = i / DEG;
  const critical = criticalOf(n1, n2);
  const tir = i > critical;
  state[TIR] = tir ? 1 : 0;
  if (tir) {
    state[REFLECTANCE] = 1;
    return;
  }
  // At the critical angle n₁·sin i / n₂ is exactly 1, but rounds to either side of it for some n.
  const s = i >= critical ? 1 : Math.min(1, (n1 * Math.sin(i)) / n2);
  const t = Math.asin(s);
  state[REFLECTANCE] = fresnelReflectance(n1, n2, i, t);
  state[LAST_INCIDENCE] = i;
  state[LAST_INCIDENCE_DEG] = i / DEG;
  state[REFRACTION] = t;
  state[REFRACTION_DEG] = t / DEG;
  state[SIN_BLOCK] = leaving(inputs) ? Math.sin(i) : s;
  state[SIN_AIR] = leaving(inputs) ? s : Math.sin(i);
}

/**
 * Reflection and refraction of a narrow ray at the centre of the flat face of a semicircular
 * block on a ray-optics board — a simplified teaching model of geometrical optics, not a
 * lab-grade one. `direction` < 0.5: the ray comes from the air onto the flat face and enters
 * the block (n₁ = 1, n₂ = n); ≥ 0.5: it travels inside the block along a radius, crosses the
 * curved face undeviated and leaves through the flat face (n₁ = n, n₂ = 1), so beyond the
 * critical angle asin(1/n) it is totally reflected. At the flat face: reflection r′ = i; Snell's
 * law n₁·sin i = n₂·sin r; the fraction of the light reflected, the Fresnel reflectance of
 * unpolarised light (1 under total internal reflection). `index` n is the block's index
 * relative to air: air is taken as exactly 1 (it is 1.0003 at 589 nm, 15 °C, 101.3 kPa — a
 * 0.03 % effect), one wavelength (no dispersion), smooth, clear, isotropic, non-absorbing media,
 * an ideal ray (no beam width); the light reflected at the curved face is not counted.
 *
 * A run is the ray box turned at a steady `sweepRate` (°/s) from 0° to the set `angle` (°),
 * as a student turns the disc; the state depends only on the angle reached, so it is exact at
 * every step. A step is shortened to land exactly on the critical angle, so the last refracted
 * ray is the grazing one, and on the set angle, where the run ends.
 *
 * Variables: `incidence` i (rad) of the ray box, `reflection` (= i), each also in degrees;
 * `tir` 1 under total internal reflection, else 0; `reflectance` R (fraction, no unit); of the
 * last refracted ray (the current one unless totally reflected): `lastIncidence` (rad, and in
 * degrees), `refraction` r (rad, and in degrees), and the sines of its angles in the block
 * (`sinBlock`) and in air (`sinAir`), for which sin(air angle) = n·sin(block angle) both ways.
 */
export const refractionModel: SimulationModel = {
  id: 'optics.refraction',
  inputs: ['index', 'direction', 'angle', 'sweepRate'],
  variables: [
    'incidence',
    'incidenceDeg',
    'reflection',
    'reflectionDeg',
    'tir',
    'reflectance',
    'lastIncidence',
    'lastIncidenceDeg',
    'refraction',
    'refractionDeg',
    'sinBlock',
    'sinAir',
  ],
  predictions: [
    'incidenceDeg',
    'reflectionDeg',
    'tir',
    'reflectance',
    'lastIncidenceDeg',
    'refraction',
    'refractionDeg',
    'sinBlock',
    'sinAir',
    'index',
    'criticalAngle',
    'criticalAngleDeg',
  ],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    derive(state, inputs);
  },

  step(state, dt, inputs) {
    const i = state[INCIDENCE] ?? 0;
    const target = (inputs.angle ?? 0) * DEG;
    if (i >= target) return 0;
    const rate = (inputs.sweepRate ?? 0) * DEG;
    const critical = criticalOf(n1Of(inputs), n2Of(inputs));
    const stop = i < critical && critical < target ? critical : target;
    let next = i + rate * dt;
    let h = dt;
    if (next >= stop) {
      next = stop;
      h = (stop - i) / rate;
    }
    state[INCIDENCE] = next;
    derive(state, inputs);
    return h;
  },

  isComplete: (state, inputs) => (state[INCIDENCE] ?? 0) >= (inputs.angle ?? 0) * DEG,

  /**
   * The theory at the set angle i, in closed form: r′ = i; for i up to the critical angle
   * r = asin(n₁·sin i / n₂) and R from the Fresnel equations; beyond it total internal
   * reflection, R = 1, and the last refracted ray is the grazing one at the critical angle
   * (r = 90°). The block's index n, the slope of sin(air angle) against sin(block angle). The
   * critical angle asin(1/n) only for a ray leaving the block: entering, there is none.
   */
  predict(inputs) {
    refuseInvalid(inputs);
    const n1 = n1Of(inputs);
    const n2 = n2Of(inputs);
    const i = (inputs.angle ?? 0) * DEG;
    const critical = criticalOf(n1, n2);
    const tir = i > critical;
    const last = tir ? critical : i;
    // At and past C the last refracted ray grazes: r = 90° exactly, as in derive().
    const t = i >= critical ? Math.PI / 2 : Math.asin(Math.min(1, (n1 * Math.sin(last)) / n2));
    const out = leaving(inputs);
    const theory: Record<string, number> = {
      incidenceDeg: i / DEG,
      reflectionDeg: i / DEG,
      tir: tir ? 1 : 0,
      reflectance: tir ? 1 : fresnelReflectance(n1, n2, i, t),
      lastIncidenceDeg: last / DEG,
      refraction: t,
      refractionDeg: t / DEG,
      sinBlock: Math.sin(out ? last : t),
      sinAir: Math.sin(out ? t : last),
      index: inputs.index ?? NaN,
    };
    if (critical < Infinity) {
      theory.criticalAngle = critical;
      theory.criticalAngleDeg = critical / DEG;
    }
    return theory;
  },
};
