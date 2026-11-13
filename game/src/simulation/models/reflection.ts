import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const RAY_BOX = 0;
const RAY_BOX_DEG = 1;
const INCIDENCE = 2;
const INCIDENCE_DEG = 3;
const REFLECTION = 4;
const REFLECTION_DEG = 5;
const REFLECTED = 6;
const REFLECTED_DEG = 7;
const BETWEEN_DEG = 8;
const DEG = Math.PI / 180;

/**
 * What the model accepts, as [input, accepts, rule]; anything else is refused with its reason,
 * never clamped (each check fails for NaN and ±∞).
 */
const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['rayAngle', (a) => a >= 0 && a < 90, 'from 0 to below 90°'],
  ['mirrorTurn', (a) => a >= 0 && a < 90, 'from 0 to below 90°'],
  ['sweepRate', (w) => w > 0 && w < Infinity, 'finite and above 0 °/s'],
];

/** Refuses inputs the model cannot run, with the reason, before anything is computed from them. */
function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Reflection input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Reflection input "${id}" must be ${rule}, got ${value}`);
  }
  const reach = (inputs.rayAngle ?? NaN) + (inputs.mirrorTurn ?? NaN);
  if (!(reach < 90)) {
    throw new Error(
      `Reflection: the ray would meet the mirror ${reach}° from its normal, grazing it or ` +
        `striking its back; keep θ + α below 90°`,
    );
  }
}

/**
 * Everything that follows from where the ray box stands. Board axes: x along the disc's 0° line
 * (away from the mirror's face when it is square), y towards the ray box's side. The light comes
 * in along d = −u (u: from the centre to the ray box), the mirror's front normal n is turned by α
 * away from the box, and the reflected ray is r = d − 2(d·n)·n. Its angles are then measured from
 * n, as a protractor measures them, not assigned from i.
 */
function derive(state: Float64Array, inputs: Inputs): void {
  const box = state[RAY_BOX] ?? 0;
  const turn = (inputs.mirrorTurn ?? NaN) * DEG;
  const ux = Math.cos(box);
  const uy = Math.sin(box);
  const nx = Math.cos(turn);
  const ny = -Math.sin(turn);
  const dn = -(ux * nx + uy * ny);
  const rx = -ux - 2 * dn * nx;
  const ry = -uy - 2 * dn * ny;
  const i = Math.atan2(Math.abs(ux * ny - uy * nx), ux * nx + uy * ny);
  const reflection = Math.atan2(Math.abs(rx * ny - ry * nx), rx * nx + ry * ny);
  const reflected = 0 - Math.atan2(ry, rx); // 0 − x: never −0
  state[RAY_BOX_DEG] = box / DEG;
  state[INCIDENCE] = i;
  state[INCIDENCE_DEG] = i / DEG;
  state[REFLECTION] = reflection;
  state[REFLECTION_DEG] = reflection / DEG;
  state[REFLECTED] = reflected;
  state[REFLECTED_DEG] = reflected / DEG;
  state[BETWEEN_DEG] = Math.atan2(Math.abs(ux * ry - uy * rx), ux * rx + uy * ry) / DEG;
}

/**
 * Reflection of a narrow ray by a plane mirror at the centre of a protractor disc on a ray-optics
 * board: a simplified teaching model of geometrical optics, not a lab-grade one. The mirror is an
 * ideal front-surface plane mirror whose face passes through the disc's centre, where the ray is
 * aimed; the ray has no width. The reflected ray follows the law of reflection in vector form
 * (r = d − 2(d·n)·n: in the plane of incidence, on the other side of the normal, at the same
 * angle); the model computes its direction and measures the angles from the normal.
 *
 * Angles on the disc are counted from its 0° line, the mirror's normal when it is square: the
 * ray box at θ_box on one side (`rayBox`); the mirror's normal turned by α (`mirrorTurn`, away from
 * the ray box, on its turntable) and the reflected ray at φ (`reflected`) on the other. So
 * i = θ_box + α and φ = θ_box + 2α: with the ray box fixed, turning the mirror by α turns the
 * reflected ray by 2α (the optical lever). α ≥ 0 and θ + α < 90° keep the ray on the mirror's
 * front; anything else is refused with its reason.
 *
 * A run is the ray box turned at a steady `sweepRate` (°/s, a presentation pace) from the disc's
 * 0° mark to the set `rayAngle` θ, the mirror standing at α throughout; the state depends only on
 * the angle reached, so it is exact at every step, and the step that reaches θ is shortened to
 * land on it, where the run ends.
 *
 * Variables: `rayBox` θ_box (rad, and in degrees); `incidence` i and `reflection` i′ (rad, and in
 * degrees), each measured from the mirror's normal; `reflected` φ, the reflected ray's angle on the
 * disc on the side away from the ray box (rad, and in degrees); `betweenDeg`, the angle between
 * the incident and reflected rays (°, = i + i′ = 2i).
 */
export const reflectionModel: SimulationModel = {
  id: 'optics.reflection',
  inputs: ['rayAngle', 'mirrorTurn', 'sweepRate'],
  variables: [
    'rayBox',
    'rayBoxDeg',
    'incidence',
    'incidenceDeg',
    'reflection',
    'reflectionDeg',
    'reflected',
    'reflectedDeg',
    'betweenDeg',
  ],
  predictions: [
    'rayBoxDeg',
    'incidenceDeg',
    'reflectionDeg',
    'reflectedDeg',
    'betweenDeg',
    'lawSlope',
    'leverSlope',
    'leverIntercept',
  ],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    derive(state, inputs);
  },

  step(state, dt, inputs) {
    const box = state[RAY_BOX] ?? 0;
    const target = (inputs.rayAngle ?? 0) * DEG;
    if (box >= target) return 0;
    const rate = (inputs.sweepRate ?? 0) * DEG;
    let next = box + rate * dt;
    let h = dt;
    if (next >= target) {
      next = target;
      h = (target - box) / rate;
    }
    state[RAY_BOX] = next;
    derive(state, inputs);
    return h;
  },

  isComplete: (state, inputs) => (state[RAY_BOX] ?? 0) >= (inputs.rayAngle ?? 0) * DEG,

  /**
   * The theory at the end of the run, in closed form (degrees): i = i′ = θ + α; the angle between
   * the rays 2i; the reflected ray on the disc φ = θ + 2α. Over runs: i′ against i is a line of
   * slope 1 through the origin (`lawSlope`); φ against α, at one θ, a line of slope 2
   * (`leverSlope`) and intercept θ (`leverIntercept`), where the square mirror sends the ray.
   */
  predict(inputs) {
    refuseInvalid(inputs);
    const theta = inputs.rayAngle ?? NaN;
    const alpha = inputs.mirrorTurn ?? NaN;
    const i = theta + alpha;
    return {
      rayBoxDeg: theta,
      incidenceDeg: i,
      reflectionDeg: i,
      reflectedDeg: theta + 2 * alpha,
      betweenDeg: 2 * i,
      lawSlope: 1,
      leverSlope: 2,
      leverIntercept: theta,
    };
  },
};
