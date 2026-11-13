import type { SimulationModel } from '../SimulationModel';

const DEG = Math.PI / 180;
/** A solid ball rolling without slipping: a = (5/7)·g·sin α (moment of inertia ⅖·m·r²). */
const ROLLING = 5 / 7;

// State slots.
const CLOCK = 0;
const S = 1; // the ball centre's distance down the rail from its release (m)
const V = 2;
const A = 3;
const BLOCKED_A = 4; // 1 while the ball is in gate A's beam
const BLOCKED_B = 5;
const DT_A = 6; // how long gate A's beam was blocked (s), 0 until the ball has left it
const DT_B = 7;
const T_AB = 8; // from the ball's first blocking gate A to its first blocking gate B (s)
const SPEED_A = 9; // d/Δt_A: the speed at gate A as the timer gives it (m/s)
const SPEED_B = 10;
const AVERAGE = 11; // (x_B − x_A)/t_AB: the average speed between the gates (m/s)
const PASSED = 12; // 1 once the ball has left gate B's beam
const SPEED_B_SQ = 13; // (d/Δt_B)²: against gate B's distance, a line of slope 2a

interface Rail {
  readonly a: number;
  readonly d: number;
  readonly gateA: number;
  readonly gateB: number;
  readonly length: number;
}

function rail(inputs: Readonly<Record<string, number>>): Rail {
  const angle = inputs.angle ?? NaN;
  const g = inputs.gravity ?? NaN;
  const d = inputs.ballDiameter ?? NaN;
  const gateA = inputs.gateA ?? NaN;
  const gateB = inputs.gateB ?? NaN;
  const length = inputs.railLength ?? NaN;
  if (!(angle > 0 && angle < 90))
    throw new Error(`The rail's angle must be between 0 and 90°, got ${angle}`);
  if (!(g > 0)) throw new Error(`Gravity must be positive, got ${g}`);
  if (!(d > 0)) throw new Error(`The ball's diameter must be positive, got ${d}`);
  if (!(gateA - d / 2 > 0)) throw new Error('Gate A must stand past the ball where it is released');
  if (!(gateB - d / 2 > gateA + d / 2))
    throw new Error('Gate B must stand past gate A by more than the ball');
  if (!(length >= gateB + d / 2)) throw new Error('The rail must reach past gate B');
  return { a: ROLLING * g * Math.sin(angle * DEG), d, gateA, gateB, length };
}

/** When the ball's centre, released at rest at s = 0, has rolled s (s ≥ 0): t = √(2s/a). */
const timeAt = (s: number, a: number) => Math.sqrt((2 * s) / a);

/**
 * Measuring speed with photogates — a simplified teaching model (KNTT Vật lí 10, bài 6). A steel
 * ball of diameter `ballDiameter` d (m) is released at rest on a rail tilted at `angle` α (°) and
 * rolls without slipping (a solid sphere: a = (5/7)·g·sin α; `gravity` g in m/s²). Two photogates
 * stand `gateA` and `gateB` (m) down the rail from the ball's centre at release; each beam crosses
 * the ball's centre line, so it is blocked while the centre is within d/2 of it. The digital timer
 * gives how long each beam was blocked, Δt_A and Δt_B, and the time t_AB from the ball's first
 * blocking A to its first blocking B. From them: the speed at each gate v = d/Δt (the average over
 * the ball's own width, which the textbook takes as the instantaneous speed) and the average speed
 * between the gates (x_B − x_A)/t_AB. Constant acceleration makes each step exact, and every beam
 * event is solved exactly inside its step. The run ends when the ball has left gate B's beam (or
 * at the rail's end, `railLength`). No rolling resistance, no air, no slipping, and the rail
 * starts exactly at the ball's release.
 *
 * Variables: `clock` t (s), `distance` s (m), `speed` v (m/s), `acceleration` a (m/s²),
 * `gateABlocked` and `gateBBlocked` (0 or 1), `blockedA` Δt_A, `blockedB` Δt_B, `timeAB` t_AB (s,
 * 0 until known: a run's state is always finite), `speedA`, `speedB`, `averageSpeed` (m/s, 0 until
 * known), `passed` (0 or 1),
 * `speedBSquared` (m²/s²): run at several gate-B distances x, it lies on v² = 2·a·x, slope 2a.
 */
export const photogateSpeedModel: SimulationModel = {
  id: 'kinematics.photogate-speed',
  inputs: ['angle', 'gravity', 'ballDiameter', 'gateA', 'gateB', 'railLength'],
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
    'passed',
    'speedBSquared',
  ],
  predictions: [
    'acceleration',
    'blockedA',
    'blockedB',
    'timeAB',
    'speedA',
    'speedB',
    'averageSpeed',
    'centreSpeedA',
    'centreSpeedB',
    'gateDistance',
    'speedBSquared',
    'twiceAcceleration',
  ],

  init(inputs, state) {
    const { a } = rail(inputs);
    state.fill(0);
    state[A] = a;
  },

  step(state, dt, inputs) {
    const r = rail(inputs);
    const t0 = state[CLOCK] ?? 0;
    const end = timeAt(Math.min(r.gateB + r.d / 2, r.length), r.a);
    const t1 = Math.min(t0 + dt, end);
    const s1 = 0.5 * r.a * t1 * t1;
    state[CLOCK] = t1;
    state[S] = s1;
    state[V] = r.a * t1;
    // The beam events, exactly: each is a time the ball's centre reaches gate ± d/2.
    const enterA = timeAt(r.gateA - r.d / 2, r.a);
    const leaveA = timeAt(r.gateA + r.d / 2, r.a);
    const enterB = timeAt(r.gateB - r.d / 2, r.a);
    const leaveB = timeAt(r.gateB + r.d / 2, r.a);
    state[BLOCKED_A] = t1 >= enterA && t1 < leaveA ? 1 : 0;
    state[BLOCKED_B] = t1 >= enterB && t1 < leaveB ? 1 : 0;
    if (t1 >= leaveA && state[DT_A] === 0) {
      state[DT_A] = leaveA - enterA;
      state[SPEED_A] = r.d / (leaveA - enterA);
    }
    if (t1 >= enterB && state[T_AB] === 0) {
      state[T_AB] = enterB - enterA;
      state[AVERAGE] = (r.gateB - r.gateA) / (enterB - enterA);
    }
    if (t1 >= leaveB && state[DT_B] === 0) {
      state[DT_B] = leaveB - enterB;
      state[SPEED_B] = r.d / (leaveB - enterB);
      state[SPEED_B_SQ] = (r.d / (leaveB - enterB)) ** 2;
      state[PASSED] = 1;
    }
    return t1 - t0;
  },

  isComplete: (state, inputs) => {
    const r = rail(inputs);
    return (state[CLOCK] ?? 0) >= timeAt(Math.min(r.gateB + r.d / 2, r.length), r.a) - 1e-12;
  },

  /**
   * The theory, from s = ½·a·t² with a = (5/7)·g·sin α: each beam's blocked time, t_AB, the speeds
   * the timer gives (d/Δt and the average between the gates), and the ball's speed as its centre
   * crosses each beam, v = √(2·a·x) — which d/Δt approaches as d shrinks.
   */
  predict(inputs) {
    const r = rail(inputs);
    const enterA = timeAt(r.gateA - r.d / 2, r.a);
    const leaveA = timeAt(r.gateA + r.d / 2, r.a);
    const enterB = timeAt(r.gateB - r.d / 2, r.a);
    const leaveB = timeAt(r.gateB + r.d / 2, r.a);
    return {
      acceleration: r.a,
      blockedA: leaveA - enterA,
      blockedB: leaveB - enterB,
      timeAB: enterB - enterA,
      speedA: r.d / (leaveA - enterA),
      speedB: r.d / (leaveB - enterB),
      averageSpeed: (r.gateB - r.gateA) / (enterB - enterA),
      centreSpeedA: Math.sqrt(2 * r.a * r.gateA),
      centreSpeedB: Math.sqrt(2 * r.a * r.gateB),
      gateDistance: r.gateB - r.gateA,
      speedBSquared: (r.d / (leaveB - enterB)) ** 2,
      twiceAcceleration: 2 * r.a,
    };
  },
};
