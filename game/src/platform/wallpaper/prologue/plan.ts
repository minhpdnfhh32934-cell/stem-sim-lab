/*
 * The rocket opening's script (Phú 2026-11-18), played in the live wallpaper's own world when the
 * app starts with the live menu background: SimLab-1 dives from the sky towards the roof (its
 * nose down), its engines light and time slows nearly to a stop (the flame's chemistry, then the
 * forces bending its path); it swoops on towards the building; inside the cabin Khoa presses to the
 * window, looks at the roof, opens the door; outside, he swings out and hangs from the doorway by
 * one hand; over the roof he lets go and lands (the camera low, looking up); the rocket climbs
 * away towards SimLab; he walks to Linh and sits down by her, and the menu comes in.
 *
 * Two clocks: the opening's own (real seconds since it began, `t`), and the rocket's (`tau`, s;
 * 0 when Khoa lets go, as `simulation/rocketSwoop.ts` keeps it). Time runs slow or fast between
 * them by the scale here; the whole world (the rocket, the two, the city) runs on the rocket's
 * clock. Pure: worked out once, read per frame (tested).
 */

/** The rocket's time when the opening begins (s). */
export const TAU_START = -8;
/** Khoa's moments, on the rocket's clock (s). */
export const STUNT = {
  /** He presses to the window. */
  press: -1.2,
  /** His right hand on the door's handle, his left braced on the doorway's frame; braced. */
  grip: -0.95,
  /**
   * The yank (Phú 2026-11-18: hold the handle, brace, wrench the door open): the door slides open
   * over these, fast at first; he lets the handle go part way, the door runs on.
   */
  doorFrom: -0.82,
  handleOff: -0.775,
  doorTo: -0.64,
  /** To the doorway's edge; his hand up to the bar outside; out, and hanging from these. */
  toSill: -0.6,
  reach: -0.5,
  out: -0.4,
  hang: -0.2,
  /** He lets go; lands. */
  release: 0,
  land: 0.85,
  /** Crouched until, risen by; watches the rocket go until; at his place by Linh by. */
  crouch: 1.75,
  risen: 2.5,
  watched: 3.25,
  standing: 5.6,
} as const;
/** When the engines light (the swoop's own, kept here for the shots). */
export const IGNITE = -4.6;

/** How fast the world's time runs against the opening's (×), keyed on the opening's clock. */
const SCALE_KEYS: readonly (readonly [number, number])[] = [
  [0, 1],
  [3.3, 1],
  [3.9, 0.03],
  [10.0, 0.03],
  [10.6, 1],
  [12.6, 1],
  [13.2, 0.22],
];
/** After Khoa lets go time comes back up, keyed on the rocket's clock: real speed as he lands. */
const AFTER_KEYS: readonly (readonly [number, number])[] = [
  [STUNT.release, 0.22],
  [0.62, 1],
  // The impact held a moment (a hit-stop), then real speed again.
  [STUNT.land - 0.01, 1],
  [STUNT.land + 0.02, 0.2],
  [STUNT.land + 0.16, 0.2],
  [STUNT.land + 0.5, 1],
];

export type Shot = 'sky' | 'tele' | 'chem' | 'phys' | 'swoop' | 'cabin' | 'hang' | 'land' | 'crane';
export type Notes = 'chem' | 'phys' | 'bio';

const smooth = (x: number) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

function keyed(keys: readonly (readonly [number, number])[], x: number): number {
  const first = keys[0];
  if (!first) return 1;
  if (x <= first[0]) return first[1];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (!a || !b) break;
    if (x <= b[0]) return a[1] + (b[1] - a[1]) * smooth((x - a[0]) / (b[0] - a[0]));
  }
  return keys[keys.length - 1]?.[1] ?? 1;
}

/** The world's time scale at opening time t with the rocket's clock at tau. */
const scaleAt = (t: number, tau: number): number =>
  tau < STUNT.release ? keyed(SCALE_KEYS, t) : keyed(AFTER_KEYS, tau);

export interface Moment {
  /** The rocket's clock. */
  tau: number;
  /** How fast the world runs now (×). */
  scale: number;
  shot: Shot;
  /** Seconds into the shot (opening time). */
  shotT: number;
  /** The shot's length (s). */
  shotLength: number;
  /** Whose notes show, and how long they have shown (s, opening time). */
  notes: Notes | null;
  notesT: number;
}

/** The opening's timeline, worked out at a millisecond step. */
export class Plan {
  static readonly STEP = 0.001;
  private readonly taus: number[] = [];
  /** Opening times of: Khoa letting go, landing, standing at his place; the end. */
  readonly release: number;
  readonly land: number;
  readonly standing: number;
  readonly end: number;
  /** The shots: each from its start (opening time) to the next. */
  readonly shots: readonly (readonly [Shot, number])[];
  readonly notes: readonly (readonly [Notes, number, number])[];
  /** `at`'s answer, written in place each call (read it at once). */
  private readonly moment: Moment = {
    tau: 0,
    scale: 1,
    shot: 'sky',
    shotT: 0,
    shotLength: 1,
    notes: null,
    notesT: 0,
  };

  constructor() {
    let t = 0;
    let tau = TAU_START;
    let release = NaN;
    let land = NaN;
    let standing = NaN;
    this.taus.push(tau);
    while (tau < STUNT.standing + 6) {
      const h = Plan.STEP;
      // Midpoint rule: the scale at the step's middle.
      const mid = scaleAt(t + h / 2, tau + (scaleAt(t, tau) * h) / 2);
      const next = tau + mid * h;
      if (tau < STUNT.release && next >= STUNT.release) release = t + h;
      if (tau < STUNT.land && next >= STUNT.land) land = t + h;
      if (tau < STUNT.standing && next >= STUNT.standing) standing = t + h;
      tau = next;
      t += h;
      this.taus.push(tau);
    }
    this.release = release;
    this.land = land;
    this.standing = standing;
    // The menu comes in as he has nearly sat down (the wallpaper's own sit takes 7.2 s).
    this.end = standing + 4.6;
    const cabin = this.timeOf(STUNT.press - 0.33);
    this.shots = [
      ['sky', 0],
      ['tele', 2.5],
      ['chem', 4.05],
      ['phys', 7.05],
      ['swoop', 10.1],
      ['cabin', cabin],
      ['hang', this.timeOf(STUNT.out + 0.02)],
      ['land', release + 0.05],
      ['crane', land + 1.7],
    ];
    this.notes = [
      ['chem', 4.4, 7.0],
      ['phys', 7.35, 10.05],
      ['bio', cabin + 0.45, this.timeOf(STUNT.doorFrom) - 0.1],
    ];
  }

  /** The rocket's clock at opening time t. */
  tauAt(t: number): number {
    const i = Math.min(this.taus.length - 1, Math.max(0, Math.floor(t / Plan.STEP)));
    const a = this.taus[i] ?? TAU_START;
    const b = this.taus[Math.min(i + 1, this.taus.length - 1)] ?? a;
    const extra = Math.max(0, t - (this.taus.length - 1) * Plan.STEP);
    return a + (b - a) * Math.min(1, Math.max(0, t / Plan.STEP - i)) + extra;
  }

  /** The opening time at which the rocket's clock reaches tau (first). */
  timeOf(tau: number): number {
    let lo = 0;
    let hi = this.taus.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if ((this.taus[mid] ?? 0) < tau) lo = mid;
      else hi = mid;
    }
    return hi * Plan.STEP;
  }

  /** The moment at opening time t (one object, rewritten by the next call). */
  at(t: number): Readonly<Moment> {
    const tau = this.tauAt(t);
    let shot: Shot = 'sky';
    let start = 0;
    let next = this.end;
    for (let i = 0; i < this.shots.length; i++) {
      const s = this.shots[i];
      if (!s || t < s[1]) {
        next = s?.[1] ?? next;
        break;
      }
      shot = s[0];
      start = s[1];
      next = this.shots[i + 1]?.[1] ?? this.end;
    }
    let notes: Notes | null = null;
    let notesT = 0;
    for (const [which, from, to] of this.notes) {
      if (t >= from && t < to) {
        notes = which;
        notesT = t - from;
      }
    }
    const m = this.moment;
    m.tau = tau;
    m.scale = scaleAt(t, tau);
    m.shot = shot;
    m.shotT = t - start;
    m.shotLength = next - start;
    m.notes = notes;
    m.notesT = notesT;
    return m;
  }
}
