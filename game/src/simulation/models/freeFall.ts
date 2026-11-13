import type { SimulationModel } from '../SimulationModel';

const Y = 0;
const V = 1;
const A = 2;

/**
 * 1-D motion under constant gravity without air resistance; y is height above the ground (m),
 * v is vertical velocity (m/s, up positive). Constant acceleration makes the per-step update
 * exact, and ground contact is solved analytically inside the step, so results match the theory
 * t = (v0 + √(v0² + 2gh)) / g, v = −√(v0² + 2gh) to floating-point precision.
 */
export const freeFallModel: SimulationModel = {
  id: 'kinematics.free-fall',
  inputs: ['height', 'gravity', 'initialVelocity'],
  variables: ['y', 'v', 'a'],
  predictions: ['fallTime', 'impactVelocity'],

  init(inputs, state) {
    state[Y] = inputs.height ?? 0;
    state[V] = inputs.initialVelocity ?? 0;
    state[A] = -(inputs.gravity ?? 0);
  },

  step(state, dt) {
    const y = state[Y] ?? 0;
    const v = state[V] ?? 0;
    const a = state[A] ?? 0;
    const yNext = y + v * dt + 0.5 * a * dt * dt;
    if (yNext > 0 || a >= 0) {
      state[Y] = yNext;
      state[V] = v + a * dt;
      return dt;
    }
    // Positive root of y + v·t + a·t²/2 = 0 with g = -a > 0.
    const g = -a;
    const contact = Math.min(dt, Math.max(0, (v + Math.sqrt(v * v + 2 * g * y)) / g));
    state[Y] = 0;
    state[V] = v + a * contact;
    return contact;
  },

  isComplete: (state) => (state[Y] ?? 0) <= 0,

  predict(inputs) {
    const h = inputs.height ?? 0;
    const g = inputs.gravity ?? 0;
    const v0 = inputs.initialVelocity ?? 0;
    const impact = Math.sqrt(v0 * v0 + 2 * g * h);
    return { fallTime: (v0 + impact) / g, impactVelocity: -impact };
  },
};
