import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;
type Domain = readonly (readonly [string, (value: number) => boolean, string])[];

function refuse(name: string, domain: Domain, inputs: Inputs): void {
  for (const [id, accepts, rule] of domain) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`${name} input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`${name} input "${id}" must be ${rule}, got ${value}`);
  }
}

// ---------------------------------------------------------------- logistic growth

const LOGISTIC: Domain = [
  ['rate', (r) => r > 0 && r <= 5, 'above 0 and at most 5 per day'],
  ['capacity', (k) => k >= 10 && k <= 1000, 'from 10 to 1000'],
  ['start', (n) => n >= 1 && n <= 1000, 'from 1 to 1000'],
  ['days', (d) => d > 0 && d <= 100, 'above 0 and at most 100 days'],
  ['daysPerSecond', (s) => s > 0 && s <= 20, 'above 0 and at most 20'],
];

/** The logistic curve: N(t) = K / (1 + (K − N₀)/N₀ · e^(−rt)). */
export const logistic = (r: number, k: number, n0: number, t: number) =>
  k / (1 + ((k - n0) / n0) * Math.exp(-r * t));

/** The day N reaches K/2 (the steepest point), for N₀ below it: ln((K − N₀)/N₀) / r. */
export const halfCapacityDay = (r: number, k: number, n0: number) =>
  n0 < k / 2 ? Math.log((k - n0) / n0) / r : 0;

const L_TIME = 0;
const L_DAY = 1;
const L_N = 2;
const L_GROWTH = 3;
const L_HALF = 4;

function logisticAt(state: Float64Array, inputs: Inputs, day: number): void {
  const r = inputs.rate ?? NaN;
  const k = inputs.capacity ?? NaN;
  const n0 = inputs.start ?? NaN;
  const n = logistic(r, k, n0, day);
  state[L_DAY] = day;
  state[L_N] = n;
  state[L_GROWTH] = r * n * (1 - n / k);
  const half = halfCapacityDay(r, k, n0);
  state[L_HALF] = day >= half ? half : 0;
}

/**
 * Logistic population growth (yeast or Paramecium in a culture): from `start` individuals the
 * population grows at the rate `rate` (per day) while resources last, slowing as it nears the
 * carrying capacity `capacity`: dN/dt = rN(1 − N/K), solved exactly. `days` of growth are run at
 * `daysPerSecond`. r and K are set at the desk (illustrative values, not one species').
 *
 * Variables: `time` (s), `day`, `population` (N), `growth` (dN/dt, per day), `halfDay` (the day N
 * passed K/2, 0 before).
 */
export const logisticGrowthModel: SimulationModel = {
  id: 'biology.logistic-growth',
  inputs: ['rate', 'capacity', 'start', 'days', 'daysPerSecond'],
  variables: ['time', 'day', 'population', 'growth', 'halfDay'],
  predictions: ['population', 'halfDay', 'peakGrowth'],

  init(inputs, state) {
    refuse('Logistic growth', LOGISTIC, inputs);
    state.fill(0);
    logisticAt(state, inputs, 0);
  },

  step(state, dt, inputs) {
    const end = (inputs.days ?? NaN) / (inputs.daysPerSecond ?? NaN);
    const time = state[L_TIME] ?? 0;
    if (!(time < end)) return 0;
    const h = Math.min(dt, end - time);
    state[L_TIME] = time + h;
    logisticAt(state, inputs, (time + h) * (inputs.daysPerSecond ?? NaN));
    return h;
  },

  isComplete: (state, inputs) =>
    (state[L_TIME] ?? 0) >= (inputs.days ?? NaN) / (inputs.daysPerSecond ?? NaN) - 1e-9,

  predict(inputs) {
    refuse('Logistic growth', LOGISTIC, inputs);
    const r = inputs.rate ?? NaN;
    const k = inputs.capacity ?? NaN;
    const n0 = inputs.start ?? NaN;
    const days = inputs.days ?? NaN;
    const half = halfCapacityDay(r, k, n0);
    const end = logistic(r, k, n0, days);
    // The fastest growth of the run: rN(1 − N/K) rises until N = K/2, then falls. At K/2 if the
    // run passes it; at the end if it stops before; at the start if it began past it.
    const growth = (n: number) => r * n * (1 - n / k);
    return {
      population: end,
      halfDay: half <= days ? half : 0,
      peakGrowth: n0 >= k / 2 ? growth(n0) : half <= days ? (r * k) / 4 : growth(end),
    };
  },
};

// ---------------------------------------------------------------- predator and prey

const PREDATOR_PREY: Domain = [
  ['prey', (x) => x >= 1 && x <= 1000, 'from 1 to 1000'],
  ['predators', (y) => y >= 1 && y <= 1000, 'from 1 to 1000'],
  ['preyBirth', (a) => a > 0 && a <= 5, 'above 0 and at most 5 per day'],
  ['predatorDeath', (g) => g > 0 && g <= 5, 'above 0 and at most 5 per day'],
  ['predation', (b) => b > 0 && b <= 1, 'above 0 and at most 1'],
  ['conversion', (d) => d > 0 && d <= 1, 'above 0 and at most 1'],
  ['days', (d) => d > 0 && d <= 200, 'above 0 and at most 200 days'],
  ['daysPerSecond', (s) => s > 0 && s <= 20, 'above 0 and at most 20'],
];

const P_TIME = 0;
const P_DAY = 1;
const P_PREY = 2;
const P_PREDATORS = 3;
const SUBSTEP = 0.002; // day: RK4 well inside its accuracy for these rates

/** Lotka–Volterra's conserved quantity V = δx − γ ln x + βy − α ln y. */
export function conserved(x: number, y: number, inputs: Inputs): number {
  const a = inputs.preyBirth ?? NaN;
  const b = inputs.predation ?? NaN;
  const g = inputs.predatorDeath ?? NaN;
  const d = inputs.conversion ?? NaN;
  return d * x - g * Math.log(x) + b * y - a * Math.log(y);
}

function rk4(state: Float64Array, inputs: Inputs, days: number): void {
  const a = inputs.preyBirth ?? NaN;
  const b = inputs.predation ?? NaN;
  const g = inputs.predatorDeath ?? NaN;
  const d = inputs.conversion ?? NaN;
  const fx = (x: number, y: number) => a * x - b * x * y;
  const fy = (x: number, y: number) => d * x * y - g * y;
  const steps = Math.max(1, Math.ceil(days / SUBSTEP - 1e-9));
  const h = days / steps;
  let x = state[P_PREY] ?? 0;
  let y = state[P_PREDATORS] ?? 0;
  for (let i = 0; i < steps; i++) {
    const k1x = fx(x, y);
    const k1y = fy(x, y);
    const k2x = fx(x + (h / 2) * k1x, y + (h / 2) * k1y);
    const k2y = fy(x + (h / 2) * k1x, y + (h / 2) * k1y);
    const k3x = fx(x + (h / 2) * k2x, y + (h / 2) * k2y);
    const k3y = fy(x + (h / 2) * k2x, y + (h / 2) * k2y);
    const k4x = fx(x + h * k3x, y + h * k3y);
    const k4y = fy(x + h * k3x, y + h * k3y);
    x += (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    y += (h / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
  }
  state[P_PREY] = x;
  state[P_PREDATORS] = y;
}

/**
 * Predator and prey — the Lotka–Volterra model (hares and lynx, rabbits and foxes): prey are born
 * at `preyBirth` per day and eaten at `predation`·x·y; predators gain `conversion`·x·y and die at
 * `predatorDeath` per day:  dx/dt = αx − βxy,  dy/dt = δxy − γy  (RK4, fixed sub-steps of
 * 0.002 day). The populations cycle around the equilibrium x* = γ/δ, y* = α/β, the predators'
 * peak after the prey's. Rates are illustrative, not one ecosystem's; `days` are run at
 * `daysPerSecond`.
 *
 * Variables: `time` (s), `day`, `prey`, `predators`.
 */
export const predatorPreyModel: SimulationModel = {
  id: 'biology.predator-prey',
  inputs: [
    'prey',
    'predators',
    'preyBirth',
    'predatorDeath',
    'predation',
    'conversion',
    'days',
    'daysPerSecond',
  ],
  variables: ['time', 'day', 'prey', 'predators'],
  predictions: ['preyEquilibrium', 'predatorEquilibrium', 'period'],

  init(inputs, state) {
    refuse('Predator–prey', PREDATOR_PREY, inputs);
    state.fill(0);
    state[P_PREY] = inputs.prey ?? NaN;
    state[P_PREDATORS] = inputs.predators ?? NaN;
  },

  step(state, dt, inputs) {
    const per = inputs.daysPerSecond ?? NaN;
    const end = (inputs.days ?? NaN) / per;
    const time = state[P_TIME] ?? 0;
    if (!(time < end)) return 0;
    const h = Math.min(dt, end - time);
    rk4(state, inputs, h * per);
    state[P_TIME] = time + h;
    state[P_DAY] = (time + h) * per;
    return h;
  },

  isComplete: (state, inputs) =>
    (state[P_TIME] ?? 0) >= (inputs.days ?? NaN) / (inputs.daysPerSecond ?? NaN) - 1e-9,

  predict(inputs) {
    refuse('Predator–prey', PREDATOR_PREY, inputs);
    const a = inputs.preyBirth ?? NaN;
    const g = inputs.predatorDeath ?? NaN;
    return {
      preyEquilibrium: g / (inputs.conversion ?? NaN),
      predatorEquilibrium: a / (inputs.predation ?? NaN),
      period: (2 * Math.PI) / Math.sqrt(a * g), // small cycles about the equilibrium
    };
  },
};
