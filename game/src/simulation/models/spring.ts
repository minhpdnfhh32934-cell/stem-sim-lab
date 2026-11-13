import type { SimulationModel } from '../SimulationModel';

const EXTENSION = 0;
const DISPLACEMENT = 1;
const VELOCITY = 2;
const LENGTH = 3;
const FORCE = 4;
const LOAD = 5;
const RATIO = 6;

/** A run ends once the swing left is smaller than this fraction of the rest extension. */
export const SPRING_SETTLED = 1e-3;

/**
 * The acceleration x'' (m/s², downward positive) of the mass on the spring, stretched by x and
 * moving at v: m·x'' = m·g − k·x − c·v, with viscous damping c = 2ζ·√(k·m) (`damping` ζ, the
 * fraction of critical damping).
 */
export function springAcceleration(
  x: number,
  v: number,
  inputs: Readonly<Record<string, number>>,
): number {
  const m = inputs.mass ?? 1;
  const k = inputs.stiffness ?? 0;
  const c = 2 * (inputs.damping ?? 0) * Math.sqrt(k * m);
  return (inputs.gravity ?? 0) - (k * x + c * v) / m;
}

/** The rest extension Δl = m·g/k, where the spring's pull balances the weight. */
const restOf = (inputs: Readonly<Record<string, number>>) =>
  ((inputs.mass ?? 0) * (inputs.gravity ?? 0)) / (inputs.stiffness ?? 1);

/** Values that follow from x: from rest, the length, the spring's pull, the weight and m·g/x. */
function derive(state: Float64Array, inputs: Readonly<Record<string, number>>): void {
  const x = state[EXTENSION] ?? 0;
  const load = (inputs.mass ?? 0) * (inputs.gravity ?? 0);
  state[DISPLACEMENT] = x - restOf(inputs);
  state[LENGTH] = (inputs.naturalLength ?? 0) + x;
  state[FORCE] = (inputs.stiffness ?? 0) * x;
  state[LOAD] = load;
  state[RATIO] = x > 0 ? load / x : 0;
}

/**
 * A mass on a spring, hanging, in one dimension: m·x'' + c·x' + k·x = m·g. Coordinates, all
 * downward positive and in SI: x, the extension from the natural length L₀ (the spring's top end
 * fixed); Δl = m·g/k, the rest extension where the pull k·x balances the weight; y = x − Δl, the
 * displacement from rest, for which m·y'' + c·y' + k·y = 0. Held at y₀ (`offset`) below rest and
 * let go at rest (v = 0), the mass swings about Δl, the swings dying away under the damping until
 * it comes to rest at the static equilibrium of Hooke's law, k·Δl = m·g. An ideal spring: linear,
 * massless and elastic; uniform g; the damping a simplified viscous term c·x' with c = 2ζ·√(k·m).
 * ζ < 1 swings (underdamped), ζ = 1 returns fastest without swinging (critical), ζ > 1 creeps back
 * (overdamped).
 *
 * Variables: `extension` x, `displacement` y (m), `velocity` v = x' (m/s), `length` L = L₀ + x
 * (m), `force` k·x — the spring's pull on the mass, its size (N; the force itself is −k·x, up) —
 * `load` m·g (N) and `ratio` m·g/x (N/m; 0 at x = 0, never 0/0), the stiffness it gives at rest.
 * Semi-implicit Euler on the experiment's fixed step: the new velocity moves the mass. The run
 * ends by itself at rest: when the energy left in the oscillation is that of a swing smaller
 * than `SPRING_SETTLED` of Δl — at once when held at rest (y₀ = 0).
 */
export const springModel: SimulationModel = {
  id: 'mechanics.spring',
  inputs: ['mass', 'stiffness', 'gravity', 'naturalLength', 'damping', 'offset'],
  variables: ['extension', 'displacement', 'velocity', 'length', 'force', 'load', 'ratio'],
  predictions: [
    'load',
    'extension',
    'length',
    'stiffness',
    'start',
    'peak',
    'lowest',
    'period0',
    'periodDamped',
    'decayRate',
    'envelope0',
    'dampedStiffness',
    'periodSquaredSlope',
    'dampingRatio',
  ],

  init(inputs, state) {
    state.fill(0);
    state[EXTENSION] = restOf(inputs) + (inputs.offset ?? 0);
    derive(state, inputs);
  },

  step(state, dt, inputs) {
    const x = state[EXTENSION] ?? 0;
    const v = state[VELOCITY] ?? 0;
    const next = v + springAcceleration(x, v, inputs) * dt;
    state[VELOCITY] = next;
    state[EXTENSION] = x + next * dt;
    derive(state, inputs);
    return dt;
  },

  isComplete(state, inputs) {
    const m = inputs.mass ?? 1;
    const k = inputs.stiffness ?? 1;
    const y = state[DISPLACEMENT] ?? 0;
    const v = state[VELOCITY] ?? 0;
    // ½k·A² = ½k·y² + ½m·v²: A, the swing the energy left would make about rest.
    return y * y + (m * v * v) / k <= (SPRING_SETTLED * restOf(inputs)) ** 2;
  },

  /**
   * The theory. At rest (statics): F = m·g, Δl = m·g/k, L = L₀ + Δl, k. Let go at y₀ from rest
   * (dynamics): the start x₀ = Δl + y₀; the energy of the swing never grows, so the extension
   * stays between Δl − |y₀| (`lowest`) and Δl + |y₀| (`peak`), both reached when undamped; the
   * undamped period T₀ = 2π√(m/k); for ζ < 1 the damped period T_d = 2π/ω_d with
   * ω_d = ω₀√(1 − ζ²), ω₀ = √(k/m), the decay rate of the swings ζ·ω₀ and the curve through their
   * peaks, |y₀|·e^(−ζω₀t) (`envelope0` = |y₀|): let go at rest, y′ = 0 at t = nπ/ω_d exactly,
   * where |y| = |y₀|·e^(−ζω₀t); the envelope that touches the motion,
   * |y₀|/√(1 − ζ²)·e^(−ζω₀t), lies above the peaks and is not what the peaks measure. For a line
   * of T_d² against m at the same k and ζ the slope
   * 4π²/(k(1 − ζ²)) and the stiffness it gives, 4π²/slope = k(1 − ζ²). None of these for ζ ≥ 1,
   * where there is no swing.
   */
  predict(inputs) {
    const m = inputs.mass ?? 0;
    const k = inputs.stiffness ?? 1;
    const zeta = inputs.damping ?? 0;
    const load = m * (inputs.gravity ?? 0);
    const extension = restOf(inputs);
    const y0 = inputs.offset ?? 0;
    const omega0 = Math.sqrt(k / m);
    const theory: Record<string, number> = {
      load,
      extension,
      length: (inputs.naturalLength ?? 0) + extension,
      stiffness: k,
      start: extension + y0,
      peak: extension + Math.abs(y0),
      lowest: extension - Math.abs(y0),
      period0: (2 * Math.PI) / omega0,
      dampingRatio: zeta,
    };
    if (zeta < 1) {
      const root = Math.sqrt(1 - zeta * zeta);
      theory.periodDamped = (2 * Math.PI) / (omega0 * root);
      theory.decayRate = zeta * omega0;
      theory.envelope0 = Math.abs(y0);
      theory.dampedStiffness = k * root * root;
      theory.periodSquaredSlope = (4 * Math.PI ** 2) / (k * root * root);
    }
    return theory;
  },
};
