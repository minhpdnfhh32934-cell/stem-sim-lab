/*
 * The rocket's swoop past the roof, for the live menu's opening (Phú 2026-11-18): it dives nose
 * first from above with its engines off, lights them and pulls out in a curve beside the building
 * (where Khoa lets go of its door), then climbs away under full thrust. Every number the opening
 * shows of it comes from here. Pure and deterministic.
 *
 * World axes, metres and seconds: y up; the origin is where it is at the moment Khoa lets go
 * (τ = 0).
 *
 * - **The dive.** Engines off: only weight and drag, integrated (fourth-order Runge–Kutta). Its
 *   fins keep its nose along its velocity until, a moment before the engines light, it swings it
 *   (thrusters, no change to its path) to where they will first push.
 * - **The pull-out.** A path drawn as a quintic: position, velocity and acceleration matched at
 *   both ends, from the moment the engines light to the moment Khoa lets go. The thrust is what
 *   that path needs, by Newton's second law: T = m·a − W − D. The rocket points along its
 *   thrust; its mass falls at ṁ = |T| / (Isp·g0).
 * - **The climb.** Integrated again: the thrust turns towards a direction and rises to a share of
 *   its maximum.
 *
 * Simplified: no lift, no wind, the air's density fixed (it moves within ~1 km), g uniform.
 */

import { burnAt, type Burn, G0 } from './rocketBurn';

export type Vec3 = readonly [number, number, number];

export interface SwoopSpec {
  readonly rocket: {
    /** Mass when the dive starts (kg). */
    readonly m0: number;
    readonly thrustMax: number;
    /** The least thrust its engines hold once lit (N). */
    readonly thrustMin: number;
    readonly isp: number;
    readonly cd: number;
    readonly diameter: number;
    /** Oxidiser to fuel, by mass (methane and oxygen). */
    readonly mixture: number;
  };
  /** Air density where it flies (kg/m³). */
  readonly rho: number;
  /** Where the dive starts: its time (s, before 0), position and velocity. */
  readonly dive: { readonly t: number; readonly at: Vec3; readonly v: Vec3 };
  /**
   * When the engines light (s, between the dive's start and 0); their thrust then (N) and where
   * it points; how long before it the nose swings round to there (s).
   */
  readonly ignite: {
    readonly t: number;
    readonly thrust: number;
    readonly dir: Vec3;
    readonly swing: number;
  };
  /** At τ = 0, at the origin: its velocity, and its thrust (the vector, N). */
  readonly release: { readonly v: Vec3; readonly thrust: Vec3 };
  /** After: the thrust turns to `toward` over `turn` s, rising to `throttle` × its maximum. */
  readonly climb: { readonly toward: Vec3; readonly turn: number; readonly throttle: number };
  /** Up to this time (s). */
  readonly end: number;
}

export interface SwoopState {
  readonly t: number;
  readonly phase: 'dive' | 'pull' | 'climb';
  readonly at: Vec3;
  readonly v: Vec3;
  readonly speed: number;
  readonly mass: number;
  /** Where its nose points (unit). */
  readonly axis: Vec3;
  /** The forces (N) and their sum. */
  readonly thrust: Vec3;
  readonly weight: Vec3;
  readonly drag: Vec3;
  readonly net: Vec3;
  /** Acceleration: net / mass (m/s²). */
  readonly accel: Vec3;
  /** What the crew feels (g): thrust and drag over m·g0. */
  readonly felt: number;
}

/**
 * The opening's swoop (in the frame of its centre of mass when Khoa lets go): over the top 300 m
 * out and 230 m up, a dive, the engines lit at −4.6 s, a pull-out of at most ~3.1 g, past the roof
 * at 18 m/s with its nose high, then a climb at half thrust towards SimLab. SimLab-1 coming back
 * nearly empty: 148 t.
 */
export const SWOOP_PAST_ROOF: SwoopSpec = {
  rocket: {
    m0: 148_000,
    thrustMax: 7.2e6,
    thrustMin: 0.32e6,
    isp: 327,
    cd: 0.3,
    diameter: 4,
    mixture: 3.6,
  },
  rho: 1.18,
  dive: { t: -10, at: [300, 230, 0], v: [-32, 0, 0] },
  ignite: { t: -4.6, thrust: 3e6, dir: [-0.643, 0.766, 0], swing: 1.4 },
  release: { v: [-18, 1, 0], thrust: [0.15e6, 1.9e6, 0] },
  climb: { toward: [-0.3, 0.8, -0.52], turn: 3, throttle: 0.5 },
  end: 10,
};

const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Vec3): Vec3 => {
  const l = len(a);
  return l > 0 ? scale(a, 1 / l) : [0, 1, 0];
};
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The angle between two directions (rad). */
export const angleBetween = (a: Vec3, b: Vec3): number =>
  Math.acos(Math.min(1, Math.max(-1, dot(unit(a), unit(b)))));

/** Turned from a towards b by a share k of the angle between them (unit vectors). */
function slerp(a: Vec3, b: Vec3, k: number): Vec3 {
  const ua = unit(a);
  const ub = unit(b);
  const angle = Math.acos(Math.min(1, Math.max(-1, dot(ua, ub))));
  if (angle < 1e-9) return ua;
  const s = Math.sin(angle);
  return add(scale(ua, Math.sin((1 - k) * angle) / s), ub, Math.sin(k * angle) / s);
}

const smooth = (x: number) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

/**
 * The swoop, worked out once at a fine step, then read at any time by interpolation (`at`):
 * cheap enough for every frame.
 */
export class Swoop {
  /** The step the track is kept at (s). */
  static readonly STEP = 0.005;
  private readonly times: number[] = [];
  private readonly states: SwoopState[] = [];
  private readonly mdotPerN: number;
  private readonly area: number;
  private readonly weightAt = (m: number): Vec3 => [0, -m * G0, 0];

  constructor(readonly spec: SwoopSpec) {
    const r = spec.rocket;
    this.mdotPerN = 1 / (r.isp * G0);
    this.area = Math.PI * (r.diameter / 2) ** 2;
    this.build();
  }

  private dragOf(v: Vec3): Vec3 {
    const speed = len(v);
    if (speed === 0) return [0, 0, 0];
    const d = 0.5 * this.spec.rho * speed * speed * this.spec.rocket.cd * this.area;
    return scale(v, -d / speed);
  }

  private state(
    t: number,
    phase: SwoopState['phase'],
    at: Vec3,
    v: Vec3,
    mass: number,
    thrust: Vec3,
  ): SwoopState {
    const weight = this.weightAt(mass);
    const drag = this.dragOf(v);
    const net = add(add(thrust, weight), drag);
    const { ignite } = this.spec;
    // Lit, it points along its thrust; unlit, its fins keep it nose first, until it swings round
    // for the engines.
    const axis =
      len(thrust) > 0
        ? unit(thrust)
        : slerp(unit(v), ignite.dir, smooth((t - (ignite.t - ignite.swing)) / ignite.swing));
    return {
      t,
      phase,
      at,
      v,
      speed: len(v),
      mass,
      axis,
      thrust,
      weight,
      drag,
      net,
      accel: scale(net, 1 / mass),
      felt: len(add(thrust, drag)) / (mass * G0),
    };
  }

  private build(): void {
    const { spec } = this;
    const h = Swoop.STEP;
    const push = (s: SwoopState) => {
      this.times.push(s.t);
      this.states.push(s);
    };

    // The dive: weight and drag only.
    let t = spec.dive.t;
    let p = spec.dive.at;
    let v = spec.dive.v;
    const m0 = spec.rocket.m0;
    const fall = (vel: Vec3): Vec3 => add(scale(this.dragOf(vel), 1 / m0), [0, -G0, 0]);
    push(this.state(t, 'dive', p, v, m0, [0, 0, 0]));
    while (t < spec.ignite.t - 1e-9) {
      const dt = Math.min(h, spec.ignite.t - t);
      const k1v = fall(v);
      const k1p = v;
      const k2v = fall(add(v, k1v, dt / 2));
      const k2p = add(v, k1v, dt / 2);
      const k3v = fall(add(v, k2v, dt / 2));
      const k3p = add(v, k2v, dt / 2);
      const k4v = fall(add(v, k3v, dt));
      const k4p = add(v, k3v, dt);
      p = add(p, add(add(k1p, k2p, 2), add(k3p, k4p, 2)), dt / 6);
      v = add(v, add(add(k1v, k2v, 2), add(k3v, k4v, 2)), dt / 6);
      t += dt;
      push(this.state(t, 'dive', p, v, m0, [0, 0, 0]));
    }

    // The pull-out: a quintic from the lit engines' first push (along the velocity) to the
    // release; the thrust is what the path needs. The mass at the release is found by iterating
    // (it changes the acceleration asked for there by a fraction of a percent).
    const p0 = p;
    const v0 = v;
    const thrust0 = scale(unit(spec.ignite.dir), spec.ignite.thrust);
    const a0 = scale(add(add(thrust0, this.weightAt(m0)), this.dragOf(v0)), 1 / m0);
    const L = -spec.ignite.t;
    let mEnd = m0;
    let track: { t: number; p: Vec3; v: Vec3; a: Vec3 }[] = [];
    let masses: number[] = [];
    for (let iteration = 0; iteration < 4; iteration++) {
      const a1 = scale(
        add(add(spec.release.thrust, this.weightAt(mEnd)), this.dragOf(spec.release.v)),
        1 / mEnd,
      );
      const n = Math.max(1, Math.round(L / h));
      track = [];
      for (let i = 0; i <= n; i++) {
        const s = i / n;
        track.push({
          t: spec.ignite.t + s * L,
          ...quintic(p0, v0, a0, [0, 0, 0], spec.release.v, a1, L, s),
        });
      }
      // m' = −|T|/(Isp·g0), T = m·a − W − D = m·(a + g) − D: integrated by the trapezium rule,
      // solved for the step's end mass (the thrust depends on it).
      masses = [m0];
      let m = m0;
      for (let i = 1; i < track.length; i++) {
        const prev = track[i - 1];
        const cur = track[i];
        if (!prev || !cur) continue;
        const dt = cur.t - prev.t;
        const tPrev = len(add(scale(add(prev.a, [0, G0, 0]), m), this.dragOf(prev.v), -1));
        let next = m;
        for (let j = 0; j < 3; j++) {
          const tCur = len(add(scale(add(cur.a, [0, G0, 0]), next), this.dragOf(cur.v), -1));
          next = m - 0.5 * dt * this.mdotPerN * (tPrev + tCur);
        }
        m = next;
        masses.push(m);
      }
      mEnd = m;
    }
    track.forEach((k, i) => {
      if (i === 0) return; // the dive's last state is there already
      const m = masses[i] ?? mEnd;
      const thrust = add(scale(add(k.a, [0, G0, 0]), m), this.dragOf(k.v), -1);
      push(this.state(k.t, 'pull', k.p, k.v, m, thrust));
    });

    // The climb: the thrust turned towards the climb's direction, rising to its share of the
    // maximum, integrated.
    const from = spec.release.thrust;
    const fromSize = len(from);
    const target = spec.climb.throttle * spec.rocket.thrustMax;
    const thrustAt = (time: number): Vec3 => {
      const k = smooth(time / spec.climb.turn);
      return scale(
        slerp(from, spec.climb.toward, k),
        fromSize + (target - fromSize) * smooth(time / 1.2),
      );
    };
    let m = mEnd;
    p = [0, 0, 0];
    v = spec.release.v;
    t = 0;
    const accelOf = (time: number, vel: Vec3, mass: number): Vec3 =>
      scale(add(add(thrustAt(time), this.weightAt(mass)), this.dragOf(vel)), 1 / mass);
    while (t < spec.end - 1e-9) {
      const dt = Math.min(h, spec.end - t);
      const mdot = (time: number) => len(thrustAt(time)) * this.mdotPerN;
      const mMid = m - (dt / 2) * mdot(t + dt / 4);
      const mEndStep = m - (dt / 6) * (mdot(t) + 4 * mdot(t + dt / 2) + mdot(t + dt));
      const k1v = accelOf(t, v, m);
      const k1p = v;
      const k2v = accelOf(t + dt / 2, add(v, k1v, dt / 2), mMid);
      const k2p = add(v, k1v, dt / 2);
      const k3v = accelOf(t + dt / 2, add(v, k2v, dt / 2), mMid);
      const k3p = add(v, k2v, dt / 2);
      const k4v = accelOf(t + dt, add(v, k3v, dt), mEndStep);
      const k4p = add(v, k3v, dt);
      p = add(p, add(add(k1p, k2p, 2), add(k3p, k4p, 2)), dt / 6);
      v = add(v, add(add(k1v, k2v, 2), add(k3v, k4v, 2)), dt / 6);
      m = mEndStep;
      t += dt;
      push(this.state(t, 'climb', p, v, m, thrustAt(t)));
    }
  }

  /** The first and last times it is worked out for. */
  get span(): [number, number] {
    return [this.times[0] ?? 0, this.times[this.times.length - 1] ?? 0];
  }

  /** Its state at time t, exactly as kept (the nearest kept step at or before t). */
  stateAt(t: number): SwoopState {
    const s = this.states[this.index(t)] ?? this.states[0];
    if (!s) throw new Error('The swoop has no track');
    return s;
  }

  /** Position and nose direction at time t, interpolated between kept steps (written in place). */
  poseAt(t: number, at: number[], axis: number[]): void {
    const i = this.index(t);
    const a = this.states[i];
    const b = this.states[Math.min(i + 1, this.states.length - 1)];
    if (!a || !b) return;
    const ta = this.times[i] ?? 0;
    const tb = this.times[Math.min(i + 1, this.times.length - 1)] ?? ta;
    const k = tb > ta ? Math.min(1, Math.max(0, (t - ta) / (tb - ta))) : 0;
    for (const j of [0, 1, 2] as const) {
      at[j] = a.at[j] + (b.at[j] - a.at[j]) * k;
      axis[j] = a.axis[j] + (b.axis[j] - a.axis[j]) * k;
    }
    const l = Math.hypot(axis[0] ?? 0, axis[1] ?? 0, axis[2] ?? 0) || 1;
    for (let j = 0; j < 3; j++) axis[j] = (axis[j] ?? 0) / l;
  }

  /** What burns each second at time t (its thrust then). */
  burnAt(t: number): Burn {
    const r = this.spec.rocket;
    return burnAt(len(this.stateAt(t).thrust), r.isp, r.mixture);
  }

  private index(t: number): number {
    const { times } = this;
    if (t <= (times[0] ?? 0)) return 0;
    let lo = 0;
    let hi = times.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if ((times[mid] ?? 0) <= t) lo = mid;
      else hi = mid;
    }
    return (times[hi] ?? 0) <= t ? hi : lo;
  }
}

/** A quintic Hermite on [0, L] at s ∈ [0, 1]: position, velocity, acceleration. */
function quintic(
  p0: Vec3,
  v0: Vec3,
  a0: Vec3,
  p1: Vec3,
  v1: Vec3,
  a1: Vec3,
  L: number,
  s: number,
): { p: Vec3; v: Vec3; a: Vec3 } {
  const s2 = s * s;
  const s3 = s2 * s;
  const s4 = s3 * s;
  const s5 = s4 * s;
  const h = [
    1 - 10 * s3 + 15 * s4 - 6 * s5,
    s - 6 * s3 + 8 * s4 - 3 * s5,
    0.5 * s2 - 1.5 * s3 + 1.5 * s4 - 0.5 * s5,
    0.5 * s3 - s4 + 0.5 * s5,
    -4 * s3 + 7 * s4 - 3 * s5,
    10 * s3 - 15 * s4 + 6 * s5,
  ];
  const d = [
    -30 * s2 + 60 * s3 - 30 * s4,
    1 - 18 * s2 + 32 * s3 - 15 * s4,
    s - 4.5 * s2 + 6 * s3 - 2.5 * s4,
    1.5 * s2 - 4 * s3 + 2.5 * s4,
    -12 * s2 + 28 * s3 - 15 * s4,
    30 * s2 - 60 * s3 + 30 * s4,
  ];
  const dd = [
    -60 * s + 180 * s2 - 120 * s3,
    -36 * s + 96 * s2 - 60 * s3,
    1 - 9 * s + 18 * s2 - 10 * s3,
    3 * s - 12 * s2 + 10 * s3,
    -24 * s + 84 * s2 - 60 * s3,
    60 * s - 180 * s2 + 120 * s3,
  ];
  const mix = (w: number[], k: [number, number, number, number, number, number]): Vec3 => {
    const terms: Vec3[] = [p0, scale(v0, L), scale(a0, L * L), scale(a1, L * L), scale(v1, L), p1];
    let out: Vec3 = [0, 0, 0];
    terms.forEach((term, i) => (out = add(out, term, (w[i] ?? 0) * (k[i] ?? 0))));
    return out;
  };
  const one: [number, number, number, number, number, number] = [1, 1, 1, 1, 1, 1];
  return {
    p: mix(h, one),
    v: mix(d, [1 / L, 1 / L, 1 / L, 1 / L, 1 / L, 1 / L]),
    a: mix(dd, [1 / (L * L), 1 / (L * L), 1 / (L * L), 1 / (L * L), 1 / (L * L), 1 / (L * L)]),
  };
}
