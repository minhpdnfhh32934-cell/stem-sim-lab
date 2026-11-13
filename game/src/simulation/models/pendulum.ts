import type { SimulationModel } from '../SimulationModel';

const THETA = 0;
const OMEGA = 1;
const ALPHA = 2;
const X = 3;
const Y = 4;
const SPEED = 5;
const KINETIC = 6;
const POTENTIAL = 7;
const ENERGY = 8;
const CLOCK = 9;
const CROSSINGS = 10;
const FIRST_CROSSING = 11;
const LAST_CROSSING = 12;
const TURNS = 13;
const LAST_TURN = 14;
const PERIOD = 15;
const DEG = Math.PI / 180;

/** Full oscillations a run measures: it ends at the turning point that completes the last one. */
export const PENDULUM_OSCILLATIONS = 3;

/**
 * Complete elliptic integral of the first kind, K(k) = ∫₀^{π/2} dφ / √(1 − k² sin²φ), by the
 * arithmetic–geometric mean: K(k) = π / (2·AGM(1, √(1 − k²))). Converges quadratically; K(1) = ∞.
 */
export function ellipticK(k: number): number {
  if (k >= 1) return Infinity;
  let a = 1;
  let b = Math.sqrt(1 - k * k);
  for (let i = 0; i < 40 && Math.abs(a - b) > 1e-16 * a; i++) {
    const mean = (a + b) / 2;
    b = Math.sqrt(a * b);
    a = mean;
  }
  return Math.PI / (2 * a);
}

/** sin²(θmax/2) for a release at θ₀ (rad) with angular velocity ω₀, from energy conservation. */
const halfAmplitudeSin2 = (theta0: number, omega0: number, c: number) =>
  Math.sin(theta0 / 2) ** 2 + (omega0 * omega0) / (4 * c);

// One classical Runge–Kutta step of θ'' = −c·sin θ, written into `out` = [θ, ω].
const rk4 = (theta: number, omega: number, c: number, h: number, out: Float64Array) => {
  const k1t = omega;
  const k1w = -c * Math.sin(theta);
  const k2t = omega + (h / 2) * k1w;
  const k2w = -c * Math.sin(theta + (h / 2) * k1t);
  const k3t = omega + (h / 2) * k2w;
  const k3w = -c * Math.sin(theta + (h / 2) * k2t);
  const k4t = omega + h * k3w;
  const k4w = -c * Math.sin(theta + h * k3t);
  out[0] = theta + (h / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
  out[1] = omega + (h / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
};
const next = new Float64Array(2); // scratch: the model is stepped from one thread

/** Values that follow from θ and ω: acceleration, bob position, speed and energies. */
function derive(state: Float64Array, inputs: Readonly<Record<string, number>>): void {
  const length = inputs.length ?? 1;
  const g = inputs.gravity ?? 0;
  const mass = inputs.mass ?? 0;
  const theta = state[THETA] ?? 0;
  const omega = state[OMEGA] ?? 0;
  const rise = 2 * Math.sin(theta / 2) ** 2; // 1 − cos θ without cancellation at small angles
  state[ALPHA] = -(g / length) * Math.sin(theta);
  state[X] = length * Math.sin(theta);
  state[Y] = length * rise;
  state[SPEED] = length * Math.abs(omega);
  const kinetic = 0.5 * mass * length * length * omega * omega;
  const potential = mass * g * length * rise;
  state[KINETIC] = kinetic;
  state[POTENTIAL] = potential;
  state[ENERGY] = kinetic + potential;
}

/**
 * The ideal simple pendulum: a bob on a massless rigid rod of length L swinging under gravity,
 * no friction or air resistance, governed by the nonlinear equation θ'' = −(g/L)·sin θ — not
 * the small-angle approximation. θ is the angle from the vertical (rad, positive towards the
 * apparatus' +x), ω = θ' (rad/s), α = θ'' (rad/s²); x is the bob's horizontal offset from below
 * the pivot and y its height above the lowest point (m); energies in J with the lowest point as
 * zero. Inputs: `length` L (m), `angle` θ₀ (degrees, converted here), `gravity` g (m/s²),
 * `mass` m of the bob (kg; only the energies depend on it) and `omega0` ω₀ (rad/s).
 *
 * Classical fourth-order Runge–Kutta on the definition's fixed step. Zero crossings and turning
 * points are found inside a step by linear interpolation — accurate there because θ'' ≈ 0 at
 * a crossing and ω'' ≈ 0 at a turning point. The period is timed between zero crossings (each
 * a half period apart); the run ends exactly at the turning point that completes
 * PENDULUM_OSCILLATIONS oscillations (the last step is shortened to it).
 */
export const pendulumModel: SimulationModel = {
  id: 'mechanics.pendulum',
  inputs: ['length', 'angle', 'gravity', 'mass', 'omega0'],
  variables: [
    'theta',
    'omega',
    'alpha',
    'x',
    'y',
    'speed',
    'kinetic',
    'potential',
    'energy',
    'clock',
    'crossings',
    'firstCrossing',
    'lastCrossing',
    'turns',
    'lastTurn',
    'period',
  ],
  predictions: ['smallAnglePeriod', 'period', 'amplitude', 'maxSpeed', 'energy'],

  init(inputs, state) {
    state.fill(0);
    state[THETA] = (inputs.angle ?? 0) * DEG;
    state[OMEGA] = inputs.omega0 ?? 0;
    derive(state, inputs);
  },

  step(state, dt, inputs) {
    const c = (inputs.gravity ?? 0) / (inputs.length ?? 1);
    const t0 = state[CLOCK] ?? 0;
    const thetaA = state[THETA] ?? 0;
    const omegaA = state[OMEGA] ?? 0;
    rk4(thetaA, omegaA, c, dt, next);
    let h = dt;
    // A turning point (ω changes sign; the release from rest is not one).
    const omegaB = next[1] ?? 0;
    if ((omegaA > 0 && omegaB <= 0) || (omegaA < 0 && omegaB >= 0)) {
      const at = (dt * omegaA) / (omegaA - omegaB);
      const turns = (state[TURNS] ?? 0) + 1;
      state[TURNS] = turns;
      state[LAST_TURN] = t0 + at;
      if (turns >= 2 * PENDULUM_OSCILLATIONS && at > 0) {
        h = at; // end exactly at the turning point that completes the last oscillation
        rk4(thetaA, omegaA, c, h, next);
      }
    }
    // A zero crossing (θ changes sign); consecutive ones are half a period apart.
    const thetaB = next[0] ?? 0;
    if ((thetaA > 0 && thetaB <= 0) || (thetaA < 0 && thetaB >= 0)) {
      const crossing = t0 + (h * thetaA) / (thetaA - thetaB);
      const count = (state[CROSSINGS] ?? 0) + 1;
      state[CROSSINGS] = count;
      if (count === 1) state[FIRST_CROSSING] = crossing;
      state[LAST_CROSSING] = crossing;
      if (count >= 2) state[PERIOD] = (2 * (crossing - (state[FIRST_CROSSING] ?? 0))) / (count - 1);
    }
    state[THETA] = thetaB;
    state[OMEGA] = next[1] ?? 0;
    state[CLOCK] = t0 + h;
    derive(state, inputs);
    return h;
  },

  isComplete: (state) => (state[TURNS] ?? 0) >= 2 * PENDULUM_OSCILLATIONS,

  predict(inputs) {
    const length = inputs.length ?? 1;
    const g = inputs.gravity ?? 0;
    const mass = inputs.mass ?? 0;
    const c = g / length;
    const s2 = halfAmplitudeSin2((inputs.angle ?? 0) * DEG, inputs.omega0 ?? 0, c);
    const k = Math.sqrt(Math.min(1, s2)); // k = sin(θmax/2); at 1 it swings over the top
    return {
      smallAnglePeriod: 2 * Math.PI * Math.sqrt(length / g),
      period: 4 * Math.sqrt(length / g) * ellipticK(k),
      amplitude: 2 * Math.asin(k),
      maxSpeed: 2 * Math.sqrt(g * length) * k,
      energy: 2 * mass * g * length * k * k,
    };
  },
};
