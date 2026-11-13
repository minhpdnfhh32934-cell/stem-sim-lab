import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

// State slots.
const CLOCK = 0;
const S = 1; // how far the glider's card centre has moved from its start (m)
const V = 2;
const A = 3;
const BLOCKED_A = 4; // 1 while the card is in gate A's beam
const BLOCKED_B = 5;
const DT_A = 6; // how long gate A's beam was blocked (s), 0 until the card has left it
const DT_B = 7;
const T_AB = 8; // from the card's first blocking gate A to its first blocking gate B (s)
const SPEED_A = 9; // L/Δt_A (m/s)
const SPEED_B = 10;
const AVERAGE = 11; // (x_B − x_A)/t_AB (m/s)
const MEASURED_A = 12; // (v_B² − v_A²)/(2·(x_B − x_A)) (m/s²), 0 until known
const PASSED = 13; // 1 once the card has left gate B's beam
const FORCE = 14; // the hanging weight m·g (N)
const FORCE_PER_MASS = 15; // m·g/(M + m) (m/s²)
const TENSION = 16; // the string's pull on the glider (N)

interface Cart {
  readonly a: number;
  readonly u: number;
  readonly card: number;
  readonly gateA: number;
  readonly gateB: number;
  /** How far the card centre goes before the run ends: its leaving gate B. */
  readonly end: number;
  readonly force: number;
  readonly total: number;
  readonly tension: number;
}

const finite = (x: number) => Number.isFinite(x);
const positive = (x: number) => x > 0 && x < Infinity;

/**
 * What the model accepts, as [input, accepts, rule]; anything else is refused with its reason,
 * never clamped (each check fails for NaN and ±∞).
 */
const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['gliderMass', positive, 'above 0 kg and finite'],
  ['hangingMass', (m) => m >= 0 && m < Infinity, 'at least 0 kg (none) and finite'],
  ['launchSpeed', (u) => u >= 0 && u < Infinity, 'at least 0 m/s (released at rest) and finite'],
  ['pulleyMass', (m) => m >= 0 && m < Infinity, 'at least 0 kg and finite'],
  ['gravity', positive, 'above 0 m/s² and finite'],
  ['cardLength', positive, 'above 0 m and finite'],
  ['gateA', finite, 'a finite distance in m'],
  ['gateB', finite, 'a finite distance in m'],
  ['travel', positive, 'above 0 m and finite'],
  ['dropHeight', positive, 'above 0 m and finite'],
];

function cart(inputs: Inputs): Cart {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Air track input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Air track input "${id}" must be ${rule}, got ${value}`);
  }
  const M = inputs.gliderMass ?? NaN;
  const m = inputs.hangingMass ?? NaN;
  const mu = inputs.pulleyMass ?? NaN;
  const g = inputs.gravity ?? NaN;
  const u = inputs.launchSpeed ?? NaN;
  const card = inputs.cardLength ?? NaN;
  const gateA = inputs.gateA ?? NaN;
  const gateB = inputs.gateB ?? NaN;
  const end = gateB + card / 2;
  const layout: readonly (readonly [boolean, string])[] = [
    [m > 0 || u > 0, 'with nothing hanging from the string, the launcher must push the glider'],
    [gateA - card / 2 > 0, "the glider's card must start before light gate A"],
    [
      gateB - card / 2 > gateA + card / 2,
      'light gate B must stand past gate A by more than the card',
    ],
    [
      end <= (inputs.travel ?? NaN),
      'the glider must clear gate B before it reaches the pulley end',
    ],
    [
      m === 0 || end < (inputs.dropHeight ?? NaN),
      'the hanging mass would reach the floor before the glider clears gate B',
    ],
  ];
  for (const [holds, rule] of layout) if (!holds) throw new Error(`Air track layout: ${rule}`);
  const a = (m * g) / (M + m + mu);
  return {
    a,
    u,
    card,
    gateA,
    gateB,
    end,
    force: m * g,
    total: M + m,
    tension: M * a,
  };
}

/** When the card centre, starting at 0 with speed u and acceleration a, has gone s ≥ 0. */
function timeAt(s: number, c: Cart): number {
  if (c.a === 0) return s / c.u;
  // ½·a·t² + u·t − s = 0, the positive root, written to stay exact as a → 0.
  return (2 * s) / (c.u + Math.sqrt(c.u * c.u + 2 * c.a * s));
}

/** The beam events: when the card's front reaches and its back leaves each gate. */
function events(c: Cart) {
  const half = c.card / 2;
  return {
    enterA: timeAt(c.gateA - half, c),
    leaveA: timeAt(c.gateA + half, c),
    enterB: timeAt(c.gateB - half, c),
    leaveB: timeAt(c.gateB + half, c),
  };
}

/** The speeds the timer gives, L/Δt, and the acceleration worked out from them. */
function readings(c: Cart) {
  const e = events(c);
  const speedA = c.card / (e.leaveA - e.enterA);
  const speedB = c.card / (e.leaveB - e.enterB);
  return {
    ...e,
    speedA,
    speedB,
    average: (c.gateB - c.gateA) / (e.enterB - e.enterA),
    measured: (speedB * speedB - speedA * speedA) / (2 * (c.gateB - c.gateA)),
  };
}

/**
 * A glider on a level air track — uniform motion and Newton's second law, a simplified teaching
 * model (KNTT Vật lí 10: speed and velocity; Newton's second law). The glider (`gliderMass` M,
 * kg) rides on a cushion of air: no friction, no drag. A light string from it runs over a pulley
 * at the track's end to a hanging mass (`hangingMass` m, kg; 0: none, the string slack). The
 * launcher may give the glider a push first (`launchSpeed` u, m/s). The string stays taut and does
 * not stretch, so glider and hanging mass move together with one acceleration,
 * a = m·g/(M + m + μ) (Newton's second law for the two together; `gravity` g in m/s²; `pulleyMass`
 * μ = I/r², the pulley's inertia as a mass at its rim, 0 for an ideal pulley). With no hanging mass
 * a = 0: the pushed glider moves in a straight line at constant speed u.
 *
 * The glider carries a card `cardLength` L long; light gates stand `gateA` and `gateB` (m) along
 * the track from the card's centre at the start. The digital timer gives how long each beam is
 * blocked, Δt_A and Δt_B, and the time t_AB from the card's first blocking A to its first blocking
 * B. From them the speeds v = L/Δt (the average over the card), the average speed (x_B − x_A)/t_AB
 * and the acceleration (v_B² − v_A²)/(2·(x_B − x_A)). s = u·t + ½·a·t² makes each step exact and
 * every beam event is solved exactly. The run ends when the card has left gate B. The layout is
 * checked first: gate B must be cleared before the glider reaches the pulley (`travel`, m) and,
 * with a hanging mass, before that reaches the floor (`dropHeight`, m).
 *
 * Variables: `clock` t (s), `distance` s (m), `speed` v (m/s), `acceleration` a (m/s²),
 * `gateABlocked`, `gateBBlocked` (0 or 1), `blockedA`, `blockedB`, `timeAB` (s), `speedA`,
 * `speedB`, `averageSpeed` (m/s), `measuredAcceleration` (m/s²) — each 0 until known — `passed`
 * (0 or 1), `force` m·g (N), `forcePerMass` m·g/(M + m) (m/s²: the acceleration Newton's second
 * law gives for the pull on the two masses), `tension` M·a (N, the string's pull on the glider).
 */
export const airTrackCartModel: SimulationModel = {
  id: 'dynamics.air-track-cart',
  inputs: [
    'gliderMass',
    'hangingMass',
    'launchSpeed',
    'pulleyMass',
    'gravity',
    'cardLength',
    'gateA',
    'gateB',
    'travel',
    'dropHeight',
  ],
  variables: [
    'clock',
    'distance',
    'speed',
    'acceleration',
    'gateABlocked',
    'gateBBlocked',
    'blockedA',
    'blockedB',
    'timeAB',
    'speedA',
    'speedB',
    'averageSpeed',
    'measuredAcceleration',
    'passed',
    'force',
    'forcePerMass',
    'tension',
  ],
  predictions: [
    'acceleration',
    'blockedA',
    'blockedB',
    'timeAB',
    'speedA',
    'speedB',
    'averageSpeed',
    'measuredAcceleration',
    'force',
    'forcePerMass',
    'tension',
    'totalMass',
    'unitSlope',
  ],

  init(inputs, state) {
    const c = cart(inputs);
    state.fill(0);
    state[V] = c.u;
    state[A] = c.a;
    state[FORCE] = c.force;
    state[FORCE_PER_MASS] = c.force / c.total;
    state[TENSION] = c.tension;
  },

  step(state, dt, inputs) {
    const c = cart(inputs);
    const r = readings(c);
    const t0 = state[CLOCK] ?? 0;
    const t1 = Math.min(t0 + dt, r.leaveB);
    state[CLOCK] = t1;
    state[S] = c.u * t1 + 0.5 * c.a * t1 * t1;
    state[V] = c.u + c.a * t1;
    state[BLOCKED_A] = t1 >= r.enterA && t1 < r.leaveA ? 1 : 0;
    state[BLOCKED_B] = t1 >= r.enterB && t1 < r.leaveB ? 1 : 0;
    if (t1 >= r.leaveA && state[DT_A] === 0) {
      state[DT_A] = r.leaveA - r.enterA;
      state[SPEED_A] = r.speedA;
    }
    if (t1 >= r.enterB && state[T_AB] === 0) {
      state[T_AB] = r.enterB - r.enterA;
      state[AVERAGE] = r.average;
    }
    if (t1 >= r.leaveB && state[DT_B] === 0) {
      state[DT_B] = r.leaveB - r.enterB;
      state[SPEED_B] = r.speedB;
      state[MEASURED_A] = r.measured;
      state[PASSED] = 1;
    }
    return t1 - t0;
  },

  isComplete: (state, inputs) => (state[CLOCK] ?? 0) >= readings(cart(inputs)).leaveB - 1e-12,

  /**
   * The theory: a = m·g/(M + m + μ); from s = u·t + ½·a·t², each beam's blocked time, t_AB, the
   * speeds the timer gives and the acceleration worked out from them — the same formulas on the
   * exact event times, so a little over a: each L/Δt is the speed at the middle of the card's
   * passage, whose square falls short of the speed's at the gate by a²·Δt²/4 — more at gate A,
   * where the card is slower, so v_B² − v_A² comes out a hair over 2·a·(x_B − x_A);
   * the pull m·g, the masses M + m, m·g/(M + m), the string's pull on the glider M·a; for the
   * analysis, the slope of a against m·g/(M + m), 1 for an ideal pulley.
   */
  predict(inputs) {
    const c = cart(inputs);
    const r = readings(c);
    return {
      acceleration: c.a,
      blockedA: r.leaveA - r.enterA,
      blockedB: r.leaveB - r.enterB,
      timeAB: r.enterB - r.enterA,
      speedA: r.speedA,
      speedB: r.speedB,
      averageSpeed: r.average,
      measuredAcceleration: r.measured,
      force: c.force,
      forcePerMass: c.force / c.total,
      tension: c.tension,
      totalMass: c.total,
      unitSlope: c.total / (c.total + (inputs.pulleyMass ?? 0)),
    };
  },
};
