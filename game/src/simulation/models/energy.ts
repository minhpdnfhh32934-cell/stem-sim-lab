import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const DEG = Math.PI / 180;

const POSITION = 0;
const X = 1;
const HEIGHT = 2;
const TRACK_ANGLE = 3;
const SPEED = 4;
const KINETIC = 5;
const POTENTIAL = 6;
const MECHANICAL = 7;
const LOST = 8;
const DRAG_LOSS = 9;
const ROLLING_LOSS = 10;
const RETAINED = 11;
const BEAM_A = 12;
const GATE_TIME_A = 13;
const SPEED_A = 14;
const KINETIC_A = 15;
const BEAM_B = 16;
const GATE_TIME_B = 17;
const SPEED_B = 18;
const ENERGY_B = 19;
const IDEAL_SPEED_A = 20;
const CLOCK = 21;
const BLOCK_START_A = 22;
const BLOCK_START_B = 23;
const STOPPED = 24;

/**
 * What the model accepts, as [input, accepts, rule]; anything else is refused with its reason,
 * never clamped (each check fails for NaN and ±∞). The track's own consistency (the release on the
 * straight ramp, gate B's flag on it, the cart clearing gate B) is checked after these.
 */
const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['releaseHeight', (h) => h > 0 && h <= 10, 'above 0 and at most 10 m'],
  ['mass', (m) => m > 0 && m <= 100, 'above 0 and at most 100 kg'],
  ['sailArea', (a) => a >= 0 && a <= 1, 'from 0 to 1 m²'],
  ['gravity', (g) => g > 0 && g <= 100, 'above 0 and at most 100 m/s²'],
  ['rampAngle', (a) => a > 0 && a < 90, 'above 0 and below 90 degrees'],
  ['arcRadius', (r) => r > 0 && r <= 100, 'above 0 and at most 100 m'],
  ['flatLength', (l) => l > 0 && l <= 100, 'above 0 and at most 100 m'],
  ['rampLength', (l) => l > 0 && l <= 100, 'above 0 and at most 100 m'],
  ['flagWidth', (w) => w > 0 && w <= 1, 'above 0 and at most 1 m'],
  ['gateHeight', (h) => h > 0 && h <= 100, 'above 0 and at most 100 m'],
  ['rollingResistance', (c) => c >= 0 && c < 1, 'from 0 to below 1'],
  ['cartDragArea', (a) => a >= 0 && a <= 1, 'from 0 to 1 m²'],
  ['sailDragCoefficient', (c) => c >= 0 && c <= 10, 'from 0 to 10'],
  ['airDensity', (r) => r >= 0 && r <= 10, 'from 0 to 10 kg/m³'],
];

/**
 * The track and the cart, from validated inputs: filled in place (the model is stepped from one
 * thread), so stepping allocates nothing. Arc length s is measured along the track from gate A's
 * beam, positive towards the far ramp; the flat runs over |s| ≤ a, each arc over a ≤ |s| ≤ b and
 * each straight ramp over b ≤ |s| ≤ end.
 */
const track = {
  g: 0,
  m: 0,
  /** Rolling-resistance coefficient μ_r. */
  mu: 0,
  /** Air drag per unit mass and speed squared, ½·ρ·(C_d·A)/m (1/m). */
  drag: 0,
  radius: 0,
  alpha: 0,
  sin: 0,
  cos: 0,
  a: 0,
  b: 0,
  end: 0,
  /** Height of the arcs' upper ends above the flat, R·(1 − cos α). */
  yb: 0,
  w: 0,
  /** Arc length of gate B's beam. */
  gateB: 0,
};

function load(inputs: Inputs): typeof track {
  const alpha = (inputs.rampAngle ?? NaN) * DEG;
  const radius = inputs.arcRadius ?? NaN;
  const m = inputs.mass ?? NaN;
  const dragArea =
    (inputs.cartDragArea ?? NaN) + (inputs.sailDragCoefficient ?? NaN) * (inputs.sailArea ?? NaN);
  track.g = inputs.gravity ?? NaN;
  track.m = m;
  track.mu = inputs.rollingResistance ?? NaN;
  track.drag = (0.5 * (inputs.airDensity ?? NaN) * dragArea) / m;
  track.radius = radius;
  track.alpha = alpha;
  track.sin = Math.sin(alpha);
  track.cos = Math.cos(alpha);
  track.a = (inputs.flatLength ?? NaN) / 2;
  track.b = track.a + radius * alpha;
  track.end = track.b + (inputs.rampLength ?? NaN);
  track.yb = 2 * radius * Math.sin(alpha / 2) ** 2; // R(1 − cos α) without cancellation
  track.w = inputs.flagWidth ?? NaN;
  track.gateB = track.b + ((inputs.gateHeight ?? NaN) - track.yb) / track.sin;
  return track;
}

/** Where the cart is released from rest: on the near (left) straight ramp, at height h. */
const releasePosition = (t: typeof track, h: number) => -(t.b + (h - t.yb) / t.sin);

/** expm1(z)/z and log1p(z)/z, 1 at z = 0: the exact limits, so no branch divides by zero. */
const e1 = (z: number) => (z === 0 ? 1 : Math.expm1(z) / z);
const l1 = (z: number) => (z === 0 ? 1 : Math.log1p(z) / z);
const atanc = (z: number) => (z === 0 ? 1 : Math.atan(z) / z);

/**
 * v² after a straight run of length d from v² = u, on a straight piece where moving on is resisted
 * by G = g·sin φ + μ_r·g·cos φ (per unit mass) plus drag k·v²: d(v²)/ds = −2G − 2k·v², so
 * v² = u·e^(−2kd) − 2G·d·(1 − e^(−2kd))/(2kd) — the second factor 1 without drag.
 */
const straightU = (u: number, G: number, k: number, d: number) =>
  u * Math.exp(-2 * k * d) - 2 * G * d * e1(-2 * k * d);

/**
 * The time to cover a straight piece of length d entered at v² = u, where G ≥ 0: from
 * dv/dt = −G − k·v², v = r·tan(θ₁ − ω·t) with r = √(G/k), ω = √(G·k), so
 * t = atan(z)/ω with z = ω·(v₁ − v₂)/(G + k·v₁·v₂), written so that G = 0 or k = 0 is its limit.
 */
function straightTime(u: number, G: number, k: number, d: number): number {
  const fall = 2 * d * e1(-2 * k * d) * (k * u + G); // u − v₂², without cancellation
  const v1 = Math.sqrt(u);
  const v2 = Math.sqrt(u - fall);
  const denominator = G + k * v1 * v2;
  if (denominator === 0) return d / v1; // no resistance at all: constant speed
  const slower = fall / (v1 + v2); // v₁ − v₂
  return (slower / denominator) * atanc((Math.sqrt(G * k) * slower) / denominator);
}

/**
 * v² after a length σ of a circular arc of radius R (concave up) entered at v² = u with the track
 * at slope φ₀ (rising towards +s), where φ = φ₀ + σ/R and the normal force is m(g·cos φ + v²/R):
 * d(v²)/dσ = −2g·sin φ − 2μ_r·g·cos φ − 2λ·v², λ = μ_r/R + k. Linear with constant
 * coefficients, so v² = P·sin φ + Q·cos φ + (u − P·sin φ₀ − Q·cos φ₀)·e^(−2λσ) with
 * P = −2gR(μ_r + 2λR)/(1 + 4λ²R²) and Q = 2gR + 2λR·P (with no losses, v² = 2gR·cos φ + const).
 */
function arcU(t: typeof track, u: number, phi0: number, sigma: number): number {
  const lambda = t.mu / t.radius + t.drag;
  const lr = 2 * lambda * t.radius;
  const p = (-2 * t.g * t.radius * (t.mu + lr)) / (1 + lr * lr);
  const q = 2 * t.g * t.radius + lr * p;
  const phi = phi0 + sigma / t.radius;
  return (
    p * Math.sin(phi) +
    q * Math.cos(phi) +
    (u - p * Math.sin(phi0) - q * Math.cos(phi0)) * Math.exp(-2 * lambda * sigma)
  );
}

/**
 * The closed-form run, from the release to the turn: v² at each piece's end, gate A's and gate B's
 * blocking times and the turning height. Refuses settings in which the cart would stop before its
 * flag clears gate B (then neither gate nor the energy balance at the turn can be measured).
 */
function theoryOf(inputs: Inputs) {
  const t = load(inputs);
  const { g, mu, drag, sin, cos, a, b, w } = t;
  const h = inputs.releaseHeight ?? NaN;
  const gFlat = mu * g;
  const gDown = -g * sin + mu * g * cos;
  const gUp = g * sin + mu * g * cos;
  const bottom = arcU(t, straightU(0, gDown, drag, (h - t.yb) / sin), -t.alpha, b - a);
  const enterA = straightU(bottom, gFlat, drag, a - w / 2);
  const leaveA = straightU(enterA, gFlat, drag, w);
  const flatEnd = straightU(leaveA, gFlat, drag, a - w / 2);
  const rampFoot = arcU(t, flatEnd, 0, b - a);
  const enterB = straightU(rampFoot, gUp, drag, t.gateB - w / 2 - b);
  const climb = (rampFoot / (2 * gUp)) * l1((drag * rampFoot) / gUp); // to v = 0
  const turnHeight = t.yb + climb * sin;
  if (!(bottom > 0 && flatEnd > 0 && rampFoot > 0 && b + climb > t.gateB + w / 2)) {
    throw new Error(
      `Energy track: the cart would stop before its flag clears light gate B at ` +
        `${inputs.gateHeight} m; raise the release height or lower the losses`,
    );
  }
  return {
    gateTimeA: straightTime(enterA, gFlat, drag, w),
    gateTimeB: straightTime(enterB, gUp, drag, w),
    turnHeight,
  };
}

/** Refuses inputs the model cannot run, with the reason, before anything is computed from them. */
function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Energy track input "${id}" is missing`);
    if (!accepts(value))
      throw new Error(`Energy track input "${id}" must be ${rule}, got ${value}`);
  }
  const t = load(inputs);
  const top = t.yb + (t.end - t.b) * t.sin;
  const h = inputs.releaseHeight ?? NaN;
  if (!(t.w < 2 * t.a)) {
    throw new Error(`Energy track: the flag (${t.w} m) must be shorter than the flat section`);
  }
  if (!(t.sin > t.mu * t.cos)) {
    throw new Error(`Energy track: the cart would not start rolling: tan α must exceed μ_r`);
  }
  if (!(h > t.yb && h <= top)) {
    throw new Error(
      `Energy track: the release height must be on the straight ramp, above ` +
        `${t.yb.toFixed(4)} m and at most ${top.toFixed(4)} m, got ${h} m`,
    );
  }
  if (!(t.gateB - t.w / 2 > t.b && t.gateB + t.w / 2 < t.end)) {
    throw new Error(`Energy track: light gate B's flag must pass on the straight far ramp`);
  }
}

/** Where `place` puts its answer: filled in place, so placing the cart allocates nothing. */
const point = { x: 0, y: 0, slope: 0 };

/** The track at arc length s: horizontal position x, height y above the flat and slope φ (rad). */
function place(t: typeof track, s: number): typeof point {
  const along = Math.abs(s);
  const side = s < 0 ? -1 : 1;
  if (along <= t.a) {
    point.x = s;
    point.y = 0;
    point.slope = 0;
  } else if (along <= t.b) {
    const theta = (along - t.a) / t.radius;
    point.x = side * (t.a + t.radius * Math.sin(theta));
    point.y = 2 * t.radius * Math.sin(theta / 2) ** 2;
    point.slope = side * theta;
  } else {
    point.x = side * (t.a + t.radius * t.sin + (along - t.b) * t.cos);
    point.y = t.yb + (along - t.b) * t.sin;
    point.slope = side * t.alpha;
  }
  return point;
}

/**
 * The track at arc length s for these inputs (x, y and slope, as a run reports them) and
 * `release`, the s the cart starts from: for drawing the track, and the cart before a run. It
 * allocates, so not for every frame: a run's own `x`, `height` and `trackAngle` are.
 */
export function trackPoint(inputs: Inputs, s: number) {
  const t = load(inputs);
  return { ...place(t, s), release: releasePosition(t, inputs.releaseHeight ?? NaN) };
}

/** The piece of track s lies on, moving towards +s (a joint belongs to the piece it starts). */
const pieceAt = (t: typeof track, s: number) =>
  s < -t.b ? 0 : s < -t.a ? 1 : s < t.a ? 2 : s < t.b ? 3 : 4;

/** The slope φ of piece `piece` at s, continued smoothly past its ends (for Runge–Kutta stages). */
function slopeOn(t: typeof track, piece: number, s: number): number {
  if (piece === 0) return -t.alpha;
  if (piece === 1) return (s + t.a) / t.radius;
  if (piece === 3) return (s - t.a) / t.radius;
  return piece === 4 ? t.alpha : 0;
}

/** The next joint or flag edge past s, moving towards +s; Infinity past the last. */
function nextBreak(t: typeof track, s: number): number {
  const half = t.w / 2;
  if (s < -t.b) return -t.b;
  if (s < -t.a) return -t.a;
  if (s < -half) return -half;
  if (s < half) return half;
  if (s < t.a) return t.a;
  if (s < t.b) return t.b;
  if (s < t.gateB - half) return t.gateB - half;
  return s < t.gateB + half ? t.gateB + half : Infinity;
}

/** s, v and the work done against drag and rolling resistance — or their rates of change. */
interface Motion {
  s: number;
  v: number;
  drag: number;
  rolling: number;
}
const motion = (): Motion => ({ s: 0, v: 0, drag: 0, rolling: 0 });

// The rates of change of s, v and the two losses on one piece, written into `out`.
function rates(t: typeof track, piece: number, s: number, v: number, out: Motion): void {
  const phi = slopeOn(t, piece, s);
  const curvature = piece === 1 || piece === 3 ? 1 / t.radius : 0;
  const normal = t.g * Math.cos(phi) + curvature * v * v; // N/m
  const rolling = t.mu * normal;
  const air = t.drag * v * v;
  out.s = v;
  out.v = -t.g * Math.sin(phi) - rolling - air;
  out.drag = t.m * air * v;
  out.rolling = t.m * rolling * v;
}

const k1 = motion();
const k2 = motion();
const k3 = motion();
const k4 = motion();
const trial = motion(); // the motion after a trial step

/** One classical Runge–Kutta step of length h on one piece, from the state into `trial`. */
function rk4(t: typeof track, piece: number, state: Float64Array, h: number): void {
  const s = state[POSITION] ?? 0;
  const v = state[SPEED] ?? 0;
  rates(t, piece, s, v, k1);
  rates(t, piece, s + (h / 2) * k1.s, v + (h / 2) * k1.v, k2);
  rates(t, piece, s + (h / 2) * k2.s, v + (h / 2) * k2.v, k3);
  rates(t, piece, s + h * k3.s, v + h * k3.v, k4);
  const sixth = h / 6;
  trial.s = s + sixth * (k1.s + 2 * k2.s + 2 * k3.s + k4.s);
  trial.v = v + sixth * (k1.v + 2 * k2.v + 2 * k3.v + k4.v);
  trial.drag = (state[DRAG_LOSS] ?? 0) + sixth * (k1.drag + 2 * k2.drag + 2 * k3.drag + k4.drag);
  trial.rolling =
    (state[ROLLING_LOSS] ?? 0) +
    sixth * (k1.rolling + 2 * k2.rolling + 2 * k3.rolling + k4.rolling);
}

/** Newton's method on the step length: the h ≤ limit at which trial[of] reaches `target`. */
function solveStep(
  t: typeof track,
  piece: number,
  state: Float64Array,
  of: 's' | 'v',
  target: number,
  limit: number,
): number {
  rk4(t, piece, state, limit);
  const from = of === 's' ? (state[POSITION] ?? 0) : (state[SPEED] ?? 0);
  let h = (limit * (target - from)) / (trial[of] - from); // linear first guess
  for (let i = 0; i < 30; i++) {
    rk4(t, piece, state, h);
    rates(t, piece, trial.s, trial.v, k1); // d(trial)/dh at the end of the step
    const next = Math.min(limit, Math.max(0, h - (trial[of] - target) / k1[of]));
    if (Math.abs(next - h) <= 1e-15 * limit) break;
    h = next;
  }
  rk4(t, piece, state, h);
  return h;
}

/** Values that follow from s, v and the losses: position, energies and what is kept. */
function derive(state: Float64Array, inputs: Inputs): void {
  const { x, y, slope } = place(track, state[POSITION] ?? 0);
  const m = track.m;
  const v = state[SPEED] ?? 0;
  const kinetic = 0.5 * m * v * v;
  const potential = m * track.g * y;
  state[X] = x;
  state[HEIGHT] = y;
  state[TRACK_ANGLE] = slope;
  state[KINETIC] = kinetic;
  state[POTENTIAL] = potential;
  state[MECHANICAL] = kinetic + potential;
  state[LOST] = (state[DRAG_LOSS] ?? 0) + (state[ROLLING_LOSS] ?? 0);
  state[RETAINED] = (100 * (kinetic + potential)) / (m * track.g * (inputs.releaseHeight ?? NaN));
}

/** Gate A or B: the flag's front edge starts blocking the beam, its back edge ends it. */
function passFlagEdge(state: Float64Array, s: number, inputs: Inputs): void {
  const half = track.w / 2;
  const clock = state[CLOCK] ?? 0;
  if (s === -half) {
    state[BLOCK_START_A] = clock;
    state[BEAM_A] = 1;
  } else if (s === half) {
    const dt = clock - (state[BLOCK_START_A] ?? 0);
    state[GATE_TIME_A] = dt;
    state[SPEED_A] = track.w / dt;
    state[KINETIC_A] = 0.5 * track.m * (track.w / dt) ** 2;
    state[BEAM_A] = 0;
  } else if (s === track.gateB - half) {
    state[BLOCK_START_B] = clock;
    state[BEAM_B] = 1;
  } else if (s === track.gateB + half) {
    const dt = clock - (state[BLOCK_START_B] ?? 0);
    state[GATE_TIME_B] = dt;
    state[SPEED_B] = track.w / dt;
    state[ENERGY_B] = track.m * (track.g * (inputs.gateHeight ?? NaN) + 0.5 * (track.w / dt) ** 2);
    state[BEAM_B] = 0;
  }
}

/**
 * A cart released from rest on a curved low-friction track, timed by two light gates: a teaching
 * model with its losses stated, not a model of one real cart. The track (a valley, symmetric) is
 * a straight ramp at `rampAngle` α (degrees, converted here) of length `rampLength`, a circular arc
 * of radius `arcRadius` R turning it level, a flat of length `flatLength` with light gate A's beam
 * at its middle, then the same arc and ramp rising on the far side, gate B's beam where the track
 * is `gateHeight` h_B above the flat. The cart (mass `mass` m, kg) is a point on the track line:
 * heights are those of its reference point above its level on the flat, where potential energy is
 * zero. It starts from rest at `releaseHeight` h on the near ramp and the run ends where it stops
 * on the far ramp, at its turning height h'.
 *
 * Along the track, m·dv/dt = −m·g·sin φ − μ_r·N − ½ρ·(C_d·A)·v², with φ the track's slope, N =
 * m(g·cos φ + v²/R) on the arcs (the track also supplies the centripetal force) and m·g·cos φ
 * elsewhere. Rolling resistance μ_r·N (`rollingResistance`, lumping the wheels' rolling and the
 * bearings' friction) and quadratic air drag are the only losses; C_d·A is the cart's
 * (`cartDragArea`) plus a card sail's, `sailDragCoefficient` × `sailArea`, added as if neither
 * shielded the other, in air of density `airDensity`. The wheels are taken as massless (a real
 * cart's spinning wheels hold a few percent of its kinetic energy), the track as rigid, and no
 * energy is lost at the joints (the arcs make the slope continuous).
 *
 * Integrated by classical Runge–Kutta on [s, v, drag loss, rolling loss], each piece of track with
 * its own smooth law (continued past its end for the inner stages); every step is cut to land
 * exactly on a joint or a flag edge (Newton's method on the step length), so the integration
 * never straddles a change of law and each gate's blocking time is timed between exact landings.
 * The last step is cut where v reaches 0. The losses are integrated as work, not inferred, so
 * Eₖ + Eₚ + losses = m·g·h checks the integration. Light gate X's beam is blocked while the
 * cart's flag (width `flagWidth` w, centred on the cart's reference point) is across it; the
 * gate's speed is w/Δt — the mean over the flag, as a real timer gives it.
 *
 * Variables: `position` s (m along the track from gate A, + towards the far ramp), `x` (m,
 * horizontal from gate A), `height` y (m above the flat), `trackAngle` φ (rad, + rising towards
 * +s), `speed` v (m/s), `kineticEnergy` ½m·v², `potentialEnergy` m·g·y, `mechanicalEnergy` their
 * sum, `energyLost` = `dragLoss` + `rollingLoss` (J, work done against each), `retained` the
 * mechanical energy as a percentage of m·g·h; per gate (A, B): `beamA` 1 while the flag blocks it,
 * `gateTimeA` Δt (s), `speedA` w/Δt (m/s), `kineticA` ½m(w/Δt)² (J), and `beamB`, `gateTimeB`,
 * `speedB`, `energyB` m·g·h_B + ½m(w/Δt_B)² (J) — each 0 until the flag has passed;
 * `idealSpeedA` √(2gh), the speed at gate A without losses (m/s, constant: what conservation of
 * mechanical energy predicts, shown beside w/Δt); `clock` (s), the block start times and
 * `stopped`, 1 once the cart has turned.
 */
export const energyTrackModel: SimulationModel = {
  id: 'mechanics.energy-track',
  inputs: [
    'releaseHeight',
    'mass',
    'sailArea',
    'gravity',
    'rampAngle',
    'arcRadius',
    'flatLength',
    'rampLength',
    'flagWidth',
    'gateHeight',
    'rollingResistance',
    'cartDragArea',
    'sailDragCoefficient',
    'airDensity',
  ],
  variables: [
    'position',
    'x',
    'height',
    'trackAngle',
    'speed',
    'kineticEnergy',
    'potentialEnergy',
    'mechanicalEnergy',
    'energyLost',
    'dragLoss',
    'rollingLoss',
    'retained',
    'beamA',
    'gateTimeA',
    'speedA',
    'kineticA',
    'beamB',
    'gateTimeB',
    'speedB',
    'energyB',
    'idealSpeedA',
    'clock',
    'blockStartA',
    'blockStartB',
    'stopped',
  ],
  predictions: [
    'startEnergy',
    'gateTimeA',
    'speedA',
    'kineticA',
    'gateTimeB',
    'speedB',
    'energyB',
    'turnHeight',
    'energyLost',
    'retained',
    'idealSpeedA',
    'energySlope',
  ],

  init(inputs, state) {
    refuseInvalid(inputs);
    theoryOf(inputs); // refuses a cart that would not clear gate B
    state.fill(0);
    const h = inputs.releaseHeight ?? NaN;
    state[POSITION] = releasePosition(load(inputs), h);
    state[IDEAL_SPEED_A] = Math.sqrt(2 * track.g * h);
    derive(state, inputs);
  },

  step(state, dt, inputs) {
    if (state[STOPPED] === 1) return 0;
    const t = load(inputs);
    let used = 0;
    // A step lands on at most the 8 joints and flag edges plus the turn: 16 is a safe bound.
    for (let i = 0; i < 16 && used < dt && state[STOPPED] !== 1; i++) {
      const s = state[POSITION] ?? 0;
      const piece = pieceAt(t, s);
      const limit = dt - used;
      let h = limit;
      let turns = false;
      rk4(t, piece, state, h);
      if ((state[SPEED] ?? 0) > 0 && trial.v <= 0) {
        h = solveStep(t, piece, state, 'v', 0, h);
        turns = true;
      }
      const edge = nextBreak(t, s);
      const lands = trial.s >= edge;
      if (lands) {
        h = solveStep(t, piece, state, 's', edge, h);
        turns = false;
      }
      state[POSITION] = lands ? edge : trial.s;
      state[SPEED] = turns ? 0 : trial.v;
      state[DRAG_LOSS] = trial.drag;
      state[ROLLING_LOSS] = trial.rolling;
      state[CLOCK] = (state[CLOCK] ?? 0) + h;
      used += h;
      if (lands) passFlagEdge(state, edge, inputs);
      if (turns) state[STOPPED] = 1;
    }
    derive(state, inputs);
    return used;
  },

  isComplete: (state) => state[STOPPED] === 1,

  /**
   * The theory, in closed form (`theoryOf`): v² piece by piece — on a straight piece
   * d(v²)/ds = −2G − 2k·v² (G = g·sin φ + μ_r·g·cos φ, k = ½ρC_dA/m), on an arc the same with the
   * centripetal load, both linear in v² — so each gate's blocking time, w/Δt, Eₖ at A, E at B and
   * the turning height h' where v² reaches 0 on the far ramp; the energy lost m·g·(h − h') and the
   * share kept 100·h'/h. Also what conservation of mechanical energy alone predicts: the lossless
   * speed at A, √(2gh), and the slope 1 of Eₖ at A against Eₚ at the release (the analysis'
   * reference line, not the model's own: the losses put the runs a little below it).
   */
  predict(inputs) {
    refuseInvalid(inputs);
    const { gateTimeA, gateTimeB, turnHeight } = theoryOf(inputs);
    const { g, m, w } = track;
    const h = inputs.releaseHeight ?? NaN;
    const speedA = w / gateTimeA;
    const speedB = w / gateTimeB;
    return {
      startEnergy: m * g * h,
      gateTimeA,
      speedA,
      kineticA: 0.5 * m * speedA * speedA,
      gateTimeB,
      speedB,
      energyB: m * (g * (inputs.gateHeight ?? NaN) + 0.5 * speedB * speedB),
      turnHeight,
      energyLost: m * g * (h - turnHeight),
      retained: (100 * turnHeight) / h,
      idealSpeedA: Math.sqrt(2 * g * h),
      energySlope: 1,
    };
  },
};
