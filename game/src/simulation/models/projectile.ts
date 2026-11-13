import type { SimulationModel } from '../SimulationModel';

const X = 0;
const Y = 1;
const VX = 2;
const VY = 3;
const SPEED = 4;
const DEG = Math.PI / 180;

/** Time until a body at height h ≥ 0 moving up at vy lands on y = 0 under gravity g > 0. */
const timeToLand = (vy: number, g: number, h: number) => (vy + Math.sqrt(vy * vy + 2 * g * h)) / g;

/**
 * 2-D projectile motion under constant gravity without air resistance. `x` is the horizontal
 * distance from the launch point along the launch direction and `y` the height of the ball's
 * lowest point above the floor (m); `vx`, `vy` in m/s, up positive. Inputs: `velocity` v₀ (m/s),
 * `angle` θ above the horizontal (degrees), `gravity` g (m/s²), `height` h — the launch height
 * above the floor (m; 0 gives the textbook same-height case).
 *
 * Constant acceleration makes each step exact, and floor contact is solved inside the step, so
 * the measured flight time, range and impact speed equal the theory to floating-point
 * precision; the measured maximum height is the highest stepped state, at most g·dt²/8 below
 * the true apex.
 */
export const projectileModel: SimulationModel = {
  id: 'kinematics.projectile',
  inputs: ['velocity', 'angle', 'gravity', 'height'],
  variables: ['x', 'y', 'vx', 'vy', 'speed'],
  predictions: ['flightTime', 'range', 'maxHeight', 'impactSpeed'],

  init(inputs, state) {
    const v = inputs.velocity ?? 0;
    const theta = (inputs.angle ?? 0) * DEG;
    state[X] = 0;
    state[Y] = inputs.height ?? 0;
    state[VX] = v * Math.cos(theta);
    state[VY] = v * Math.sin(theta);
    state[SPEED] = v;
  },

  step(state, dt, inputs) {
    const g = inputs.gravity ?? 0;
    const y = state[Y] ?? 0;
    const vx = state[VX] ?? 0;
    const vy = state[VY] ?? 0;
    const yNext = y + vy * dt - 0.5 * g * dt * dt;
    let t = dt;
    if (yNext > 0 || g <= 0) {
      state[Y] = yNext;
    } else {
      t = Math.min(dt, Math.max(0, timeToLand(vy, g, y))); // lands within this step
      state[Y] = 0;
    }
    state[X] = (state[X] ?? 0) + vx * t;
    state[VY] = vy - g * t;
    state[SPEED] = Math.hypot(vx, vy - g * t);
    return t;
  },

  // On the floor and not rising: landed (also covers a horizontal launch from the floor).
  isComplete: (state) => (state[Y] ?? 0) <= 0 && (state[VY] ?? 0) <= 0,

  predict(inputs) {
    const v = inputs.velocity ?? 0;
    const theta = (inputs.angle ?? 0) * DEG;
    const g = inputs.gravity ?? 0;
    const h = inputs.height ?? 0;
    const vx = v * Math.cos(theta);
    const vy = v * Math.sin(theta);
    const flightTime = timeToLand(vy, g, h);
    return {
      flightTime,
      range: vx * flightTime,
      maxHeight: h + (vy > 0 ? (vy * vy) / (2 * g) : 0),
      impactSpeed: Math.sqrt(v * v + 2 * g * h),
    };
  },
};
