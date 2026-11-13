import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const POSITION_A = 0;
const POSITION_B = 1;
const VELOCITY_A = 2;
const VELOCITY_B = 3;
const MOMENTUM_A = 4;
const MOMENTUM_B = 5;
const MOMENTUM = 6;
const KINETIC_A = 7;
const KINETIC_B = 8;
const KINETIC = 9;
const MOMENTUM_BEFORE = 10;
const KINETIC_BEFORE = 11;
const KINETIC_PERCENT = 12;
const GATE_TIME_A = 13;
const GATE_TIME_B = 14;
const COLLIDED = 15;

const positive = (x: number) => x > 0 && x < Infinity;

/**
 * What the model accepts, as [input, accepts, rule]; anything else is refused with its reason,
 * never clamped (each check fails for NaN and ±∞).
 */
const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['massA', positive, 'above 0 kg and finite'],
  ['massB', positive, 'above 0 kg and finite'],
  ['speed', positive, 'above 0 m/s (glider A moves towards glider B) and finite'],
  ['restitution', (e) => e >= 0 && e <= 1, 'from 0 (the gliders stick) to 1 (elastic)'],
  ['gliderLength', positive, 'above 0 m and finite'],
  ['flagLength', positive, 'above 0 m and finite'],
  ['trackLength', positive, 'above 0 m and finite'],
  ['startA', Number.isFinite, 'a finite position in m'],
  ['startB', Number.isFinite, 'a finite position in m'],
  ['gate1', Number.isFinite, 'a finite position in m'],
  ['gate2', Number.isFinite, 'a finite position in m'],
];

const read = (inputs: Inputs, id: string) => inputs[id] ?? NaN;

/**
 * The velocities just after the impact, B at rest before it: Newton's law of restitution
 * vB′ − vA′ = e·u with momentum conserved, written about the centre of mass so that equal masses
 * at e = 1 give vA′ = 0 exactly (vA′ = v_cm − e·m_B·u/M, vB′ = v_cm + e·m_A·u/M, M = m_A + m_B).
 */
function after(inputs: Inputs): { vA: number; vB: number } {
  const mA = read(inputs, 'massA');
  const mB = read(inputs, 'massB');
  const u = read(inputs, 'speed');
  const e = read(inputs, 'restitution');
  const total = mA + mB;
  const centre = (mA * u) / total;
  return { vA: centre - (e * mB * u) / total, vB: centre + (e * mA * u) / total };
}

/** Refuses inputs or a layout the model cannot run, with the reason, before anything is computed. */
function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Collision input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Collision input "${id}" must be ${rule}, got ${value}`);
  }
  const l = read(inputs, 'gliderLength');
  const half = read(inputs, 'flagLength') / 2;
  const a0 = read(inputs, 'startA');
  const b0 = read(inputs, 'startB');
  const g1 = read(inputs, 'gate1');
  const g2 = read(inputs, 'gate2');
  const end = read(inputs, 'trackLength') - l / 2; // B's centre when it meets the far buffer
  // The layout, in the order a run meets it: each gate times one whole card, one way.
  const layout: readonly (readonly [boolean, string])[] = [
    [half * 2 <= l, 'the card must not be longer than its glider'],
    [a0 - l / 2 >= 0, 'glider A must start on the track'],
    [a0 + half <= g1, "glider A's card must start before light gate 1"],
    [g1 + half <= b0 - l, "glider A's card must clear light gate 1 before A reaches glider B"],
    [b0 + half <= g2, "glider B's card must start clear of light gate 2"],
    [g2 + half <= end, "glider B's card must clear light gate 2 before B reaches the far end"],
  ];
  for (const [holds, rule] of layout) if (!holds) throw new Error(`Collision layout: ${rule}`);
  // Only the impact is modelled: glider A must not rebound into the launcher end first.
  const { vA, vB } = after(inputs);
  const aAtEnd = b0 - l + vA * ((end - b0) / vB);
  if (!(aAtEnd - l / 2 >= 0)) {
    throw new Error(
      'Collision: glider A would bounce back into the launcher end before glider B reaches the ' +
        'far end; make glider A heavier, the bumpers less elastic or the track longer',
    );
  }
}

/** Momenta and kinetic energies from the masses and the velocities. */
function derive(state: Float64Array, inputs: Inputs): void {
  const mA = read(inputs, 'massA');
  const mB = read(inputs, 'massB');
  const vA = state[VELOCITY_A] ?? NaN;
  const vB = state[VELOCITY_B] ?? NaN;
  state[MOMENTUM_A] = mA * vA;
  state[MOMENTUM_B] = mB * vB;
  state[MOMENTUM] = mA * vA + mB * vB;
  state[KINETIC_A] = 0.5 * mA * vA * vA;
  state[KINETIC_B] = 0.5 * mB * vB * vB;
  const kinetic = 0.5 * mA * vA * vA + 0.5 * mB * vB * vB;
  state[KINETIC] = kinetic;
  state[KINETIC_PERCENT] = (100 * kinetic) / (state[KINETIC_BEFORE] ?? NaN);
}

/** The nearest of three stops ahead of x (Infinity if none is): a moving glider's next event. */
const nextStop = (x: number, a: number, b: number, c: number) =>
  Math.min(x < a ? a : Infinity, x < b ? b : Infinity, x < c ? c : Infinity);

/**
 * A one-dimensional collision of two gliders on a level air track, glider B at rest: a simplified
 * teaching model. SI units: masses in kg, positions in m (each glider's centre, measured along
 * the track from the launcher end), velocities in m/s (positive towards the far end), momentum in
 * kg·m/s, kinetic energy in J, gate times in s.
 *
 * The track is frictionless and level and the air does not drag: between impacts each glider
 * moves at constant velocity, so every step is exact. Glider A (mass m_A) starts at `startA`,
 * already moving at `speed` u (the launcher has pushed it), and passes light gate 1 at `gate1`;
 * glider B (m_B) rests at `startB`, past it, with light gate 2 at `gate2` beyond. Each glider is
 * `gliderLength` ℓ long and carries a card `flagLength` L long on its centre; a gate times how
 * long its beam is blocked, Δt = L/|v| at constant v. Gate 1 times glider A's card before the
 * impact, gate 2 glider B's card after it (their first passage each: a rebounding A or a
 * following A is not timed).
 *
 * The impact is instantaneous (bumpers that act over a few milliseconds, far shorter than the
 * gate times) and obeys Newton's law of restitution with momentum conserved (Halliday, Resnick &
 * Walker, Fundamentals of Physics, ch. 9; Meriam & Kraige, Engineering Mechanics: Dynamics,
 * "Impact"): vB′ − vA′ = e·u and m_A·vA′ + m_B·vB′ = m_A·u, so
 * vA′ = u·(m_A − e·m_B)/(m_A + m_B) and vB′ = u·m_A·(1 + e)/(m_A + m_B). e = 1 is elastic (kinetic
 * energy kept), 0 < e < 1 partly elastic, e = 0 perfectly inelastic (the gliders stick and move on
 * together at m_A·u/(m_A + m_B)). The fraction of the kinetic energy kept is
 * 1 − (1 − e²)·m_B/(m_A + m_B); the rest goes into the bumpers (heat, sound, deformation). e is a
 * stated property of the bumpers, not computed from their material.
 *
 * Steps land exactly on each event — a card edge reaching a gate's beam, the impact (A's front
 * meeting B's back, `startB` − ℓ for A's centre), B's front reaching the far buffer at
 * `trackLength` — so the step size changes where samples fall, never the result. The run ends when
 * glider B reaches the far buffer; the bounce off it is not modelled. Layouts in which a gate
 * would not time one whole card one way, or glider A would rebound into the launcher end before
 * the run ends, are refused with the reason.
 *
 * Variables: `positionA`, `positionB` (m), `velocityA`, `velocityB` (m/s), `momentumA`,
 * `momentumB` and their sum `momentum` (kg·m/s), `kineticA`, `kineticB` and their sum `kinetic`
 * (J), the totals before the impact `momentumBefore` and `kineticBefore` (fixed from the start: B
 * rests, A coasts), `kineticPercent` 100·E_k/E_k,before (%), `gateTimeA` and `gateTimeB` (s, the
 * blocked time so far: 0 until a card reaches its gate, growing while it blocks the beam) and
 * `collided` (0 before the impact, 1 from it on).
 */
export const collisionModel: SimulationModel = {
  id: 'mechanics.collision',
  inputs: [
    'massA',
    'massB',
    'speed',
    'restitution',
    'gliderLength',
    'flagLength',
    'startA',
    'startB',
    'gate1',
    'gate2',
    'trackLength',
  ],
  variables: [
    'positionA',
    'positionB',
    'velocityA',
    'velocityB',
    'momentumA',
    'momentumB',
    'momentum',
    'kineticA',
    'kineticB',
    'kinetic',
    'momentumBefore',
    'kineticBefore',
    'kineticPercent',
    'gateTimeA',
    'gateTimeB',
    'collided',
  ],
  predictions: [
    'momentumBefore',
    'momentumAfter',
    'velocityA',
    'velocityB',
    'kineticBefore',
    'kineticAfter',
    'kineticPercent',
    'gateTimeA',
    'gateTimeB',
    'collisionTime',
    'momentumSlope',
    'kineticSlope',
  ],

  init(inputs, state) {
    refuseInvalid(inputs);
    const mA = read(inputs, 'massA');
    const u = read(inputs, 'speed');
    state.fill(0);
    state[POSITION_A] = read(inputs, 'startA');
    state[POSITION_B] = read(inputs, 'startB');
    state[VELOCITY_A] = u;
    state[MOMENTUM_BEFORE] = mA * u;
    state[KINETIC_BEFORE] = 0.5 * mA * u * u;
    derive(state, inputs);
  },

  step(state, dt, inputs) {
    const l = read(inputs, 'gliderLength');
    const half = read(inputs, 'flagLength') / 2;
    const end = read(inputs, 'trackLength') - l / 2;
    let xA = state[POSITION_A] ?? NaN;
    let xB = state[POSITION_B] ?? NaN;
    const vA = state[VELOCITY_A] ?? NaN;
    const vB = state[VELOCITY_B] ?? NaN;
    const before = state[COLLIDED] === 0;
    if (!before && xB >= end) return 0; // B is at the far buffer: the run is over
    // Before the impact only A moves (towards gate 1's card edges and B); after it, B's events.
    const gate = read(inputs, before ? 'gate1' : 'gate2');
    const x = before ? xA : xB;
    const v = before ? vA : vB;
    const stop = nextStop(x, gate - half, gate + half, before ? xB - l : end);
    const reached = (stop - x) / v <= dt;
    const h = reached ? (stop - x) / v : dt;
    // A gate counts while the card covers its beam: steps never straddle a card edge.
    const timer = before ? GATE_TIME_A : GATE_TIME_B;
    if (Math.abs(x + (v * h) / 2 - gate) < half) state[timer] = (state[timer] ?? 0) + h;
    xA += vA * h;
    xB += vB * h;
    if (reached && before) xA = stop;
    if (reached && !before) xB = stop;
    if (before && xB - l - xA <= 0) {
      xA = xB - l; // A's front bumper meets B's back
      const { vA: a, vB: b } = after(inputs);
      state[VELOCITY_A] = a;
      state[VELOCITY_B] = b;
      state[COLLIDED] = 1;
    }
    state[POSITION_A] = xA;
    state[POSITION_B] = !before && xB >= end ? end : xB;
    derive(state, inputs);
    return h;
  },

  isComplete: (state, inputs) =>
    state[COLLIDED] === 1 &&
    (state[POSITION_B] ?? NaN) >= read(inputs, 'trackLength') - read(inputs, 'gliderLength') / 2,

  /**
   * The theory, in closed form: the momentum before, m_A·u, and after — the same, by
   * conservation; the velocities after the impact; the kinetic energy before, ½m_A·u², after, that
   * times the fraction kept 1 − (1 − e²)·m_B/(m_A + m_B), and that fraction in %; the gate times
   * L/u and L/vB′; the time of the impact, (startB − ℓ − startA)/u; for the analyses, the slope of
   * p′ against p (1) and of E_k′ against E_k (the fraction kept), both lines through the origin.
   */
  predict(inputs) {
    refuseInvalid(inputs);
    const mA = read(inputs, 'massA');
    const mB = read(inputs, 'massB');
    const u = read(inputs, 'speed');
    const e = read(inputs, 'restitution');
    const { vA, vB } = after(inputs);
    const momentum = mA * u;
    const kinetic = 0.5 * mA * u * u;
    const kept = 1 - ((1 - e * e) * mB) / (mA + mB);
    return {
      momentumBefore: momentum,
      momentumAfter: momentum,
      velocityA: vA,
      velocityB: vB,
      kineticBefore: kinetic,
      kineticAfter: kinetic * kept,
      kineticPercent: 100 * kept,
      gateTimeA: read(inputs, 'flagLength') / u,
      gateTimeB: read(inputs, 'flagLength') / vB,
      collisionTime:
        (read(inputs, 'startB') - read(inputs, 'gliderLength') - read(inputs, 'startA')) / u,
      momentumSlope: 1,
      kineticSlope: kept,
    };
  },
};
