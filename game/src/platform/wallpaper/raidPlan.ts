/*
 * A raid on the floating lab (Phase W-5), as times: the squad's helicopter flies in from the right
 * of the picture over the city, hovers over the hall's oculus, the oculus is blown, ropes drop and
 * four come down them into the hall, the ropes are reeled in and it flies off to the far left. The
 * smoke drifts off and the glass mends. Pure (tested); `raid.ts` draws it. Times in seconds from
 * the raid's start; places relative to the hover point over the oculus (m, the roof's frame).
 */

export const RAID = {
  inbound: 12,
  blast: 14,
  ropesDown: 15,
  /** When each of the four starts down its rope. */
  slides: [16, 16.6, 17.2, 17.8],
  slide: 1.5,
  reelFrom: 26,
  reelTo: 28,
  depart: 28,
  gone: 42,
  /** The oculus's glass is whole again (the smoke mostly gone). */
  mended: 89,
  /** How high over the oculus it hovers, and how far the ropes drop (to the hole). */
  hover: 10,
  rope: 10.5,
} as const;

/** Where it comes from and goes to, from the hover point. */
const FROM: readonly [number, number, number] = [330, 45, 280];
const VIA: readonly [number, number, number] = [160, 30, 90];
const TO: readonly [number, number, number] = [-620, 140, -560];
const HOVER: readonly [number, number, number] = [0, 0, 0];

export interface HeliPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  bank: number;
  rotor: number;
  visible: boolean;
}

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const easeIn = (x: number) => Math.pow(Math.min(1, Math.max(0, x)), 2.2);

type Vec3 = readonly [number, number, number];

function bezier(a: Vec3, b: Vec3, c: Vec3, u: number, i: 0 | 1 | 2): number {
  const v = 1 - u;
  return v * v * a[i] + 2 * v * u * b[i] + u * u * c[i];
}

/** The helicopter at time `t` of a raid, written into `out`. */
export function heliAt(t: number, out: HeliPose): HeliPose {
  out.visible = t >= 0 && t < RAID.gone;
  out.rotor = 1;
  if (t < RAID.inbound) {
    const u = easeOut(t / RAID.inbound);
    const k = 1 - u;
    out.x = bezier(FROM, VIA, HOVER, u, 0);
    out.y = bezier(FROM, VIA, HOVER, u, 1);
    out.z = bezier(FROM, VIA, HOVER, u, 2);
    // Facing along its way; nose down while fast, up as it brakes; banked into the turn.
    const u2 = Math.min(1, u + 0.02);
    const dx = bezier(FROM, VIA, HOVER, u2, 0) - out.x;
    const dz = bezier(FROM, VIA, HOVER, u2, 2) - out.z;
    out.yaw = Math.atan2(-dx, -dz);
    out.pitch =
      0.16 * k -
      0.12 * smooth((t - RAID.inbound + 3) / 2) * (1 - smooth((t - RAID.inbound + 0.5) / 0.5));
    out.bank = -0.22 * Math.sin(Math.PI * u) * k;
  } else if (t < RAID.depart) {
    // Holding over the oculus, a little drift and bob; the blast rocks it.
    const kick =
      t > RAID.blast ? Math.exp(-(t - RAID.blast) * 2.5) * Math.sin((t - RAID.blast) * 14) : 0;
    out.x = Math.sin(t * 0.7) * 0.6;
    out.y = Math.sin(t * 1.1) * 0.35 + kick * 0.6;
    out.z = Math.cos(t * 0.5) * 0.5;
    const inbound = bezierYaw(1);
    out.yaw = inbound + Math.sin(t * 0.3) * 0.05;
    out.pitch = 0.02 * Math.sin(t * 0.9) + kick * 0.08;
    out.bank = 0.03 * Math.sin(t * 0.8) + kick * 0.1;
  } else {
    const u = easeIn((t - RAID.depart) / (RAID.gone - RAID.depart));
    out.x = TO[0] * u;
    out.y = TO[1] * u;
    out.z = TO[2] * u;
    const turn = smooth((t - RAID.depart) / 3);
    out.yaw = bezierYaw(1) * (1 - turn) + Math.atan2(-TO[0], -TO[2]) * turn;
    out.pitch = 0.18 * smooth((t - RAID.depart) / 4);
    out.bank = 0.25 * Math.sin(Math.PI * turn);
  }
  return out;
}

/** Its heading at the end of the way in (it keeps it while hovering). */
function bezierYaw(u: number): number {
  const a = Math.max(0, u - 0.02);
  const dx = bezier(FROM, VIA, HOVER, u, 0) - bezier(FROM, VIA, HOVER, a, 0);
  const dz = bezier(FROM, VIA, HOVER, u, 2) - bezier(FROM, VIA, HOVER, a, 2);
  return Math.atan2(-dx, -dz);
}

/** How far down the ropes hang (0–1 of their length) at `t`. */
export function ropesAt(t: number): number {
  if (t < RAID.ropesDown || t >= RAID.reelTo) return 0;
  if (t < RAID.ropesDown + 1) return easeOut(t - RAID.ropesDown);
  if (t < RAID.reelFrom) return 1;
  return 1 - smooth((t - RAID.reelFrom) / (RAID.reelTo - RAID.reelFrom));
}

/** How far down its rope one of the four is (0 at the door … 1 into the hole), or −1 when not on it. */
export function slideAt(t: number, i: number): number {
  const start = RAID.slides[i] ?? Infinity;
  if (t < start || t > start + RAID.slide) return -1;
  const u = (t - start) / RAID.slide;
  // Quick down the rope, braking for the last metres.
  return u < 0.75 ? (u / 0.75) * 0.82 : 0.82 + 0.18 * smooth((u - 0.75) / 0.25);
}

/** The oculus is open (blown) between the blast and its mending. */
export const blownAt = (t: number): boolean => t >= RAID.blast && t < RAID.mended;
