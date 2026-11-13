import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

// State slots.
const CLOCK = 0;
const FALL = 1; // how far the heavier side has fallen (m)
const V = 2;
const A = 3;
const TENSION_LIGHT = 4; // the string's pull on the lighter side (N)
const TENSION_HEAVY = 5;
const BLOCKED = 6; // 1 while the card is in the gate's beam
const DT = 7; // how long the beam was blocked (s), 0 until the card has left it
const GATE_SPEED = 8; // L/Δt (m/s), 0 until known
const FALL_TIME = 9; // the timer: from release to the pad (s), 0 until it lands
const MEASURED_A = 10; // 2·h/t² (m/s²), 0 until it lands
const G_ESTIMATE = 11; // a·(2M + Δm)/Δm (m/s²), 0 until it lands
const LANDED = 12;
const MASS_RATIO = 13; // Δm/(2M + Δm)

interface Machine {
  readonly a: number;
  readonly g: number;
  readonly light: number;
  readonly heavy: number;
  readonly drop: number;
  readonly card: number;
  /** The gate's beam, as a fall: the card's centre crosses it there. */
  readonly gate: number;
  readonly ratio: number;
}

const positive = (x: number) => x > 0 && x < Infinity;

/**
 * What the model accepts, as [input, accepts, rule]; anything else is refused with its reason,
 * never clamped (each check fails for NaN and ±∞).
 */
const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['mass', positive, 'above 0 kg and finite'],
  ['extraMass', positive, 'above 0 kg (the right side heavier) and finite'],
  ['pulleyMass', (m) => m >= 0 && m < Infinity, 'at least 0 kg and finite'],
  ['gravity', positive, 'above 0 m/s² and finite'],
  ['dropHeight', positive, 'above 0 m and finite'],
  ['cardLength', positive, 'above 0 m and finite'],
  ['gateAbovePad', positive, 'above 0 m and finite'],
];

function machine(inputs: Inputs): Machine {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Atwood input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Atwood input "${id}" must be ${rule}, got ${value}`);
  }
  const M = inputs.mass ?? NaN;
  const dm = inputs.extraMass ?? NaN;
  const mu = inputs.pulleyMass ?? NaN;
  const g = inputs.gravity ?? NaN;
  const drop = inputs.dropHeight ?? NaN;
  const card = inputs.cardLength ?? NaN;
  const gate = drop - (inputs.gateAbovePad ?? NaN);
  if (!(gate - card / 2 > 0)) {
    throw new Error('Atwood layout: the card must start above the light gate');
  }
  if (!(gate + card / 2 < drop)) {
    throw new Error('Atwood layout: the card must clear the light gate before the mass lands');
  }
  const a = (dm * g) / (2 * M + dm + mu);
  return { a, g, light: M, heavy: M + dm, drop, card, gate, ratio: dm / (2 * M + dm) };
}

/** When the heavier side, released at rest, has fallen x ≥ 0: t = √(2x/a). */
const timeAt = (x: number, m: Machine) => Math.sqrt((2 * x) / m.a);

/**
 * The Atwood machine — two bodies joined by a string over a pulley, a simplified teaching model
 * (connected bodies; Newton's second law). Two equal masses `mass` M (kg) hang either side of a
 * pulley; a small `extraMass` Δm (kg) on the right makes that side heavier. An electromagnet holds
 * them, both at rest; at release the right side falls `dropHeight` h (m) to a pad, which stops the
 * timer, while the left rises as far. The string is light and does not stretch; the pulley turns
 * without friction, its inertia `pulleyMass` μ = I/r² as a mass at its rim (0: an ideal pulley).
 * Newton's second law for each side and the pulley gives one acceleration,
 * a = Δm·g/(2M + Δm + μ) (`gravity` g, m/s²), and the string's pulls T_left = M·(g + a) and
 * T_right = (M + Δm)·(g − a) (equal for an ideal pulley). Constant acceleration makes each step
 * exact: x = ½·a·t².
 *
 * The timer gives the fall time t = √(2h/a); from it a = 2h/t² and, the masses known, the estimate
 * of g = a·(2M + Δm)/Δm (which leaves out the pulley's inertia: low by the factor
 * (2M + Δm)/(2M + Δm + μ)). A light gate `gateAbovePad` (m) above the pad times a card
 * `cardLength` L long on the right mass: its speed there, L/Δt.
 *
 * Variables: `clock` t (s), `fall` x (m), `speed` v (m/s), `acceleration` a (m/s²),
 * `tensionLeft`, `tensionRight` (N), `gateBlocked` (0 or 1), `blocked` Δt (s), `gateSpeed` (m/s),
 * `fallTime` t (s), `measuredAcceleration` 2h/t² (m/s²), `gravityEstimate` (m/s²) — each 0 until
 * known — `landed` (0 or 1), `massRatio` Δm/(2M + Δm).
 */
export const atwoodModel: SimulationModel = {
  id: 'dynamics.atwood',
  inputs: [
    'mass',
    'extraMass',
    'pulleyMass',
    'gravity',
    'dropHeight',
    'cardLength',
    'gateAbovePad',
  ],
  variables: [
    'clock',
    'fall',
    'speed',
    'acceleration',
    'tensionLeft',
    'tensionRight',
    'gateBlocked',
    'blocked',
    'gateSpeed',
    'fallTime',
    'measuredAcceleration',
    'gravityEstimate',
    'landed',
    'massRatio',
  ],
  predictions: [
    'acceleration',
    'tensionLeft',
    'tensionRight',
    'blocked',
    'gateSpeed',
    'fallTime',
    'measuredAcceleration',
    'gravityEstimate',
    'massRatio',
    'landingSpeed',
    'ratioSlope',
  ],

  init(inputs, state) {
    const m = machine(inputs);
    state.fill(0);
    state[A] = m.a;
    state[TENSION_LIGHT] = m.light * (m.g + m.a);
    state[TENSION_HEAVY] = m.heavy * (m.g - m.a);
    state[MASS_RATIO] = m.ratio;
  },

  step(state, dt, inputs) {
    const m = machine(inputs);
    const t0 = state[CLOCK] ?? 0;
    const land = timeAt(m.drop, m);
    const t1 = Math.min(t0 + dt, land);
    state[CLOCK] = t1;
    state[FALL] = t1 >= land ? m.drop : 0.5 * m.a * t1 * t1;
    state[V] = m.a * t1;
    const enter = timeAt(m.gate - m.card / 2, m);
    const leave = timeAt(m.gate + m.card / 2, m);
    state[BLOCKED] = t1 >= enter && t1 < leave ? 1 : 0;
    if (t1 >= leave && state[DT] === 0) {
      state[DT] = leave - enter;
      state[GATE_SPEED] = m.card / (leave - enter);
    }
    if (t1 >= land && state[LANDED] === 0) {
      state[LANDED] = 1;
      state[V] = 0; // on the pad
      state[FALL_TIME] = land;
      const a = (2 * m.drop) / (land * land);
      state[MEASURED_A] = a;
      state[G_ESTIMATE] = (a * (m.light + m.heavy)) / (m.heavy - m.light);
    }
    return t1 - t0;
  },

  isComplete: (state) => state[LANDED] === 1,

  /**
   * The theory: a = Δm·g/(2M + Δm + μ), the two pulls, the gate's blocked time and L/Δt, the fall
   * time √(2h/a), a from it (= a), the estimate of g that leaves out μ, Δm/(2M + Δm), the speed
   * at landing √(2·a·h); for the analysis, the slope of a against Δm/(2M + Δm),
   * g·(2M + Δm)/(2M + Δm + μ) — g for an ideal pulley.
   */
  predict(inputs) {
    const m = machine(inputs);
    const enter = timeAt(m.gate - m.card / 2, m);
    const leave = timeAt(m.gate + m.card / 2, m);
    const total = m.light + m.heavy;
    return {
      acceleration: m.a,
      tensionLeft: m.light * (m.g + m.a),
      tensionRight: m.heavy * (m.g - m.a),
      blocked: leave - enter,
      gateSpeed: m.card / (leave - enter),
      fallTime: timeAt(m.drop, m),
      measuredAcceleration: m.a,
      gravityEstimate: (m.a * total) / (m.heavy - m.light),
      massRatio: m.ratio,
      landingSpeed: Math.sqrt(2 * m.a * m.drop),
      ratioSlope: (m.g * total) / (total + (inputs.pulleyMass ?? 0)),
    };
  },
};
