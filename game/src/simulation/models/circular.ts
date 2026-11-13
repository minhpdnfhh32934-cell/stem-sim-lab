import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const TURN = 2 * Math.PI;
const DEG = Math.PI / 180;

const STOPWATCH = 0;
const ANGLE = 1;
const TURNS_COUNTED = 2;
const X = 3;
const Z = 4;
const DROP = 5;
const RADIUS = 6;
const DROOP_ANGLE = 7;
const SPEED = 8;
const ACCELERATION = 9;
const CENTRIPETAL_FORCE = 10;
const TENSION = 11;
const PERIOD = 12;
const ANGULAR_VELOCITY = 13;
const PERIOD_SQUARED = 14;
const OMEGA_SQUARED = 15;

/**
 * What the model accepts, as [input, accepts, rule]; anything else is refused with its reason,
 * never clamped (each check fails for NaN and ±∞).
 */
const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['hangingMass', (m) => m > 0 && m <= 10, 'above 0 and at most 10 kg'],
  ['bungMass', (m) => m > 0 && m <= 1, 'above 0 and at most 1 kg'],
  ['length', (l) => l > 0 && l <= 5, 'above 0 and at most 5 m'],
  ['gravity', (g) => g > 0 && g <= 100, 'above 0 and at most 100 m/s²'],
  [
    'timedTurns',
    (n) => Number.isInteger(n) && n >= 1 && n <= 1000,
    'a whole number from 1 to 1000',
  ],
];

/** Refuses inputs the model cannot run, with the reason, before anything is computed from them. */
function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Circular motion input "${id}" is missing`);
    if (!accepts(value)) {
      throw new Error(`Circular motion input "${id}" must be ${rule}, got ${value}`);
    }
  }
  const big = inputs.hangingMass ?? NaN;
  const small = inputs.bungMass ?? NaN;
  // sin β = m/M: a pull M·g no larger than the bung's weight cannot hold it up and in as well.
  if (!(big > small)) {
    throw new Error(
      `Circular motion: the hanging mass M (${big} kg) must be heavier than the bung m ` +
        `(${small} kg): the string's pull M·g has to hold the bung up as well as pull it in ` +
        `(sin β = m/M < 1); hang more mass or use a lighter bung`,
    );
  }
}

/** sin β = m/M: β is the string's angle below the horizontal. */
const sinDroop = (inputs: Inputs) => (inputs.bungMass ?? NaN) / (inputs.hangingMass ?? NaN);

/** cos β = √(1 − sin²β), written as √((1 − s)(1 + s)) to keep its digits as s nears 1. */
const cosDroop = (inputs: Inputs) => {
  const s = sinDroop(inputs);
  return Math.sqrt((1 - s) * (1 + s));
};

/** ω = √(M·g/(m·L)), from M·g = m·ω²·L (rad/s). */
const angularVelocityOf = (inputs: Inputs) =>
  Math.sqrt(
    ((inputs.hangingMass ?? NaN) * (inputs.gravity ?? NaN)) /
      ((inputs.bungMass ?? NaN) * (inputs.length ?? NaN)),
  );

/**
 * The whirling bung: a simplified teaching model of uniform circular motion. A bung of mass m
 * (`bungMass`, kg) on a string goes round a horizontal circle centred on a vertical tube; the
 * string runs over the top of the tube and down through it to a hanger of mass M (`hangingMass`,
 * kg) at rest, so its tension is M·g (`gravity` g, m/s²). A marker on the string just below the
 * tube keeps the length L (`length`, m) from the top of the tube to the bung fixed: the bung goes
 * round at just the speed at which the marker stays there.
 *
 * The string slopes down from the top of the tube at β below the horizontal. Vertically
 * M·g·sin β = m·g, so sin β = m/M (M must exceed m, else it is refused); horizontally
 * M·g·cos β = m·ω²·r with the radius r = L·cos β, so M·g = m·ω²·L exactly: ω = √(M·g/(m·L)),
 * T = 2π/ω = 2π√(m·L/(M·g)). The circle is L·sin β below the top of the tube. The bung's speed is
 * v = ω·r, its centripetal acceleration ω²·r = v²/r towards the axis, and the centripetal force on
 * it, the horizontal part of the tension, m·ω²·r = M·g·cos β.
 *
 * Assumed: a massless, inextensible string; no friction where it runs over the top of the tube;
 * no air resistance; the tube still and vertical; the bung a point at its centre. The run starts
 * with the bung already whirling steadily, as it passes the start mark (θ = 0, on +x): how that
 * speed is reached is not modelled. The motion is exactly uniform, θ = ω·t, so each step is
 * exact; the stopwatch stops when the bung completes `timedTurns` N turns, the last step
 * shortened to end there.
 *
 * Variables. The bung's motion: `stopwatch` t since the start mark (s), `angle` θ turned (rad,
 * not wrapped), `turnsCounted` n, the whole turns completed, `x` = r·cos θ and `z` = −r·sin θ, its
 * position in the horizontal plane from the tube's axis (m; anticlockwise seen from above with y
 * up), `drop` L·sin β, the depth of its circle below the top of the tube (m), `radius` r (m),
 * `droopAngle` β (degrees), `speed` v (m/s), `acceleration` ω²·r (m/s²), `centripetalForce`
 * m·ω²·r (N) and `tension` M·g (N), constant during a run. Timed by the stopwatch at the start
 * mark, from the time the last whole turn ended (0 until the first one has): `period` T (s),
 * `angularVelocity` 2π/T (rad/s), `periodSquared` T² (s²) and `omegaSquared` ω² (rad²/s²).
 */
export const circularModel: SimulationModel = {
  id: 'mechanics.circular-motion',
  inputs: ['hangingMass', 'bungMass', 'length', 'gravity', 'timedTurns'],
  variables: [
    'stopwatch',
    'angle',
    'turnsCounted',
    'x',
    'z',
    'drop',
    'radius',
    'droopAngle',
    'speed',
    'acceleration',
    'centripetalForce',
    'tension',
    'period',
    'angularVelocity',
    'periodSquared',
    'omegaSquared',
  ],
  predictions: [
    'tension',
    'droopAngle',
    'radius',
    'drop',
    'angularVelocity',
    'period',
    'timeForTurns',
    'speed',
    'acceleration',
    'centripetalForce',
    'periodSquared',
    'omegaSquared',
    'periodSquaredSlope',
    'forceSlope',
  ],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    const omega = angularVelocityOf(inputs);
    const r = (inputs.length ?? NaN) * cosDroop(inputs);
    state[X] = r;
    state[DROP] = (inputs.length ?? NaN) * sinDroop(inputs);
    state[RADIUS] = r;
    state[DROOP_ANGLE] = Math.asin(sinDroop(inputs)) / DEG;
    state[SPEED] = omega * r;
    state[ACCELERATION] = omega * omega * r;
    state[CENTRIPETAL_FORCE] = (inputs.bungMass ?? NaN) * omega * omega * r;
    state[TENSION] = (inputs.hangingMass ?? NaN) * (inputs.gravity ?? NaN);
  },

  step(state, dt, inputs) {
    const n = inputs.timedTurns ?? NaN;
    const end = TURN * n;
    const theta0 = state[ANGLE] ?? 0;
    if (!(theta0 < end)) return 0; // the N turns are timed
    const omega = angularVelocityOf(inputs);
    const t0 = state[STOPWATCH] ?? 0;
    const reached = theta0 + omega * dt >= end;
    const h = reached ? (end - theta0) / omega : dt;
    const theta = reached ? end : theta0 + omega * h;
    state[STOPWATCH] = t0 + h;
    state[ANGLE] = theta;
    const counted = reached ? n : Math.floor(theta / TURN);
    if (counted > (state[TURNS_COUNTED] ?? 0)) {
      // When the bung passed the start mark, inside the step: exact, as θ is linear in t.
      const lap = reached ? t0 + h : t0 + (TURN * counted - theta0) / omega;
      const period = lap / counted;
      const timed = TURN / period;
      state[TURNS_COUNTED] = counted;
      state[PERIOD] = period;
      state[ANGULAR_VELOCITY] = timed;
      state[PERIOD_SQUARED] = period * period;
      state[OMEGA_SQUARED] = timed * timed;
    }
    const r = state[RADIUS] ?? NaN;
    state[X] = r * Math.cos(theta);
    state[Z] = -r * Math.sin(theta);
    return h;
  },

  isComplete: (state, inputs) => (state[ANGLE] ?? 0) >= TURN * (inputs.timedTurns ?? NaN),

  /**
   * The theory, in closed form: the tension M·g; β = asin(m/M) (degrees); r = L·cos β and the
   * circle's depth L·sin β; ω = √(M·g/(m·L)), T = 2π/ω, the time for N turns N·T; v = ω·r, the
   * centripetal acceleration ω²·r and force m·ω²·r; T² and ω². For T² against L at one M and m, a
   * line through the origin of slope 4π²·m/(M·g) (s²/m); for M·g against ω² at one L and m, a
   * line through the origin of slope m·L (kg·m).
   */
  predict(inputs) {
    refuseInvalid(inputs);
    const big = inputs.hangingMass ?? NaN;
    const small = inputs.bungMass ?? NaN;
    const length = inputs.length ?? NaN;
    const g = inputs.gravity ?? NaN;
    const omega = angularVelocityOf(inputs);
    const period = TURN / omega;
    const r = length * cosDroop(inputs);
    return {
      tension: big * g,
      droopAngle: Math.asin(sinDroop(inputs)) / DEG,
      radius: r,
      drop: length * sinDroop(inputs),
      angularVelocity: omega,
      period,
      timeForTurns: (inputs.timedTurns ?? NaN) * period,
      speed: omega * r,
      acceleration: omega * omega * r,
      centripetalForce: small * omega * omega * r,
      periodSquared: period * period,
      omegaSquared: omega * omega,
      periodSquaredSlope: (TURN * TURN * small) / (big * g),
      forceSlope: small * length,
    };
  },
};
