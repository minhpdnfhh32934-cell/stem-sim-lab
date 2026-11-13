import type { SimulationModel } from '../SimulationModel';

const DEG = Math.PI / 180;
/** Internal sub-step (s): the lever's swing is integrated at this step whatever the runtime's. */
const SUB = 0.0005;

// State slots.
const CLOCK = 0;
const TILT = 1; // the bar's angle, + when its right end goes down (°)
const SPIN = 2; // its angular speed (°/s)
const MOMENT1 = 3; // the left mass's moment about the pivot, m1·g·d1 (N·m), turning it left-down
const MOMENT2 = 4; // the right mass's, m2·g·d2 (N·m), turning it right-down
const NET = 5; // M2 − M1 (N·m): + turns the right end down
const AT_STOP = 6; // −1, 0 or +1: resting on the left stop, free, or on the right stop

interface Lever {
  readonly m1: number;
  readonly d1: number;
  readonly m2: number;
  readonly d2: number;
  readonly g: number;
  readonly inertia: number;
  readonly damping: number;
  readonly stop: number;
  readonly duration: number;
}

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['mass1', (m) => m > 0 && m <= 1, 'above 0 and at most 1 kg'],
  ['mass2', (m) => m > 0 && m <= 1, 'above 0 and at most 1 kg'],
  ['distance1', (d) => d > 0 && d <= 0.3, 'above 0 and at most 0.3 m (the bar’s half length)'],
  ['distance2', (d) => d > 0 && d <= 0.3, 'above 0 and at most 0.3 m (the bar’s half length)'],
  ['gravity', (g) => g > 0 && g <= 30, 'above 0 and at most 30 m/s²'],
  ['barInertia', (i) => i > 0 && i <= 1, 'above 0 and at most 1 kg·m²'],
  ['damping', (c) => c >= 0 && c <= 10, 'from 0 to 10 N·m·s'],
  ['stopAngle', (a) => a > 0 && a <= 30, 'above 0 and at most 30°'],
  ['duration', (t) => t > 0 && t <= 60, 'above 0 and at most 60 s'],
];

function lever(inputs: Readonly<Record<string, number>>): Lever {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Lever input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Lever input "${id}" must be ${rule}, got ${value}`);
  }
  return {
    m1: inputs.mass1 ?? NaN,
    d1: inputs.distance1 ?? NaN,
    m2: inputs.mass2 ?? NaN,
    d2: inputs.distance2 ?? NaN,
    g: inputs.gravity ?? NaN,
    inertia: inputs.barInertia ?? NaN,
    damping: inputs.damping ?? NaN,
    stop: (inputs.stopAngle ?? NaN) * DEG,
    duration: inputs.duration ?? NaN,
  };
}

/** The masses' moments about the pivot when the bar is level, and their difference. */
function moments(l: Lever) {
  const m1 = l.m1 * l.g * l.d1;
  const m2 = l.m2 * l.g * l.d2;
  return { m1, m2, net: m2 - m1 };
}

/**
 * Moment of a force: a lever balance — a simplified teaching model (KNTT Vật lí 10, bài 21). A light
 * bar pivoted at its middle carries `mass1` m1 (kg) hung `distance1` d1 (m) left of the pivot and
 * `mass2` m2 hung `distance2` d2 right of it (`gravity` g). Each mass's weight turns the bar about
 * the pivot with the moment M = m·g·d (its lever arm d·cos θ when the bar is tilted θ): the bar
 * balances level when M1 = M2, and otherwise turns towards the larger moment until it rests on a
 * stop at ±`stopAngle`.
 *
 * Its swing: (I + m1·d1² + m2·d2²)·θ'' = (M2 − M1)·cos θ − c·θ', the bar's own `barInertia` I and
 * the hung masses as points, viscous friction at the pivot `damping` c (illustrative). Released
 * level and at rest; integrated by semi-implicit Euler at a fixed 0.5 ms whatever the runtime's
 * step, so the run is the same at any step. A stop is reached exactly within a sub-step and holds
 * the bar there while the net moment presses it in (an inelastic stop). Balanced moments leave it
 * level: θ'' = 0 exactly. The run ends after `duration` s. The bar's own weight is balanced on the
 * pivot; hangers and strings weightless.
 *
 * Variables: `clock` t (s), `tilt` θ (°, + right end down), `spin` θ' (°/s), `moment1` M1 and
 * `moment2` M2 (N·m, level), `netMoment` M2 − M1 (N·m), `atStop` (−1, 0, +1).
 */
export const leverModel: SimulationModel = {
  id: 'statics.lever',
  inputs: [
    'mass1',
    'distance1',
    'mass2',
    'distance2',
    'gravity',
    'barInertia',
    'damping',
    'stopAngle',
    'duration',
  ],
  variables: ['clock', 'tilt', 'spin', 'moment1', 'moment2', 'netMoment', 'atStop'],
  predictions: ['moment1', 'moment2', 'netMoment', 'restingSide', 'weightRight', 'momentLeft'],

  init(inputs, state) {
    const l = lever(inputs);
    const m = moments(l);
    state.fill(0);
    state[MOMENT1] = m.m1;
    state[MOMENT2] = m.m2;
    state[NET] = m.net;
  },

  step(state, dt, inputs) {
    const l = lever(inputs);
    const t0 = state[CLOCK] ?? 0;
    const t1 = Math.min(t0 + dt, l.duration);
    const total = l.inertia + l.m1 * l.d1 * l.d1 + l.m2 * l.d2 * l.d2;
    const net = state[NET] ?? 0;
    let theta = (state[TILT] ?? 0) * DEG;
    let omega = (state[SPIN] ?? 0) * DEG;
    let stop = state[AT_STOP] ?? 0;
    for (let t = t0; t < t1 - 1e-12;) {
      const h = Math.min(SUB, t1 - t);
      t += h;
      const accel = (net * Math.cos(theta) - l.damping * omega) / total;
      if (stop !== 0 && Math.sign(accel) === stop) continue; // pressed into its stop: stays
      stop = 0;
      omega += accel * h;
      theta += omega * h;
      if (Math.abs(theta) >= l.stop) {
        theta = Math.sign(theta) * l.stop;
        omega = 0;
        stop = Math.sign(theta);
      }
    }
    state[CLOCK] = t1;
    state[TILT] = theta / DEG;
    state[SPIN] = omega / DEG;
    state[AT_STOP] = stop;
    return t1 - t0;
  },

  isComplete: (state, inputs) => (state[CLOCK] ?? 0) >= (inputs.duration ?? NaN),

  /**
   * The theory: M1, M2 and M2 − M1 (level); which side the bar rests on (−1 left down, 0 level, +1
   * right down); and, for M2 − M1 against d2 at fixed m1, d1 and m2, the line's slope m2·g
   * (`weightRight`) and intercept −m1·g·d1 (`momentLeft`, negated): it balances at d2 = m1·d1/m2.
   */
  predict(inputs) {
    const l = lever(inputs);
    const m = moments(l);
    return {
      moment1: m.m1,
      moment2: m.m2,
      netMoment: m.net,
      restingSide: Math.abs(m.net) < 1e-12 ? 0 : Math.sign(m.net),
      weightRight: l.m2 * l.g,
      momentLeft: -m.m1,
    };
  },
};
