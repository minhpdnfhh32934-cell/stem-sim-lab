/**
 * The centreline of a chromatid in the 3D mitosis view (pure maths: three.js maths only).
 *
 * One line is drawn for every chromatid at every moment: in interphase it follows a tangled
 * chromatin thread (one of four fixed random curves, illustrative), condensed it is a rod — two
 * straight arms of the model's lengths meeting at the centromere — and while it condenses or
 * decondenses the line moves in place from one to the other (the same object, never two
 * see-through layers). Sister chromatids still joined are drawn touching at their centromeres
 * (the textbook X shape). Positions, lengths and the curves are illustrative, not to scale.
 */
import * as THREE from 'three';
import { CONSTRICTION, rodRadius } from '../../view3d/primitives/chromosomeTube';
import { ROD_RADIUS, SISTER_OFFSET, ease, type ChromatidInfo, type Vec3 } from './timeline';

/** Radius of a decondensed chromatin thread (world units; a condensed arm is ROD_RADIUS). */
export const THREAD_RADIUS = 0.06;

/** Morph share 0 (thread) … 1 (rod) at a condensation level. */
export function condensedShare(condensation: number): number {
  return ease(condensation, 0.15, 0.7);
}

/** The four chromatin thread curves (fixed random walks in a unit ball, as before). */
const THREADS: THREE.CatmullRomCurve3[] = Array.from({ length: 4 }, (_, v) => {
  let s = 1234 + v * 977;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const pts: THREE.Vector3[] = [];
  const p = new THREE.Vector3();
  for (let i = 0; i < 14; i++) {
    p.set(p.x + (r() - 0.5) * 0.9, p.y + (r() - 0.5) * 0.9, p.z + (r() - 0.5) * 0.9);
    if (p.length() > 1) p.setLength(0.9);
    pts.push(p.clone());
  }
  return new THREE.CatmullRomCurve3(pts);
});

/**
 * The chromatid's thread, sampled at its rings (`stations`: signed distances from the
 * centromere) and turned by its fixed rotation, around the centromere as before (unit-ball
 * units, static per chromatid). While it condenses, each point moves to its place on the rod.
 */
export function threadSamples(info: ChromatidInfo, stations: ArrayLike<number>): Float32Array {
  const curve = THREADS[info.threadVariant % THREADS.length] ?? THREADS[0];
  const out = new Float32Array(stations.length * 3);
  if (!curve) return out;
  const rot = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...info.threadRotation));
  const total = info.armA + info.armB;
  const v = new THREE.Vector3();
  for (let i = 0; i < stations.length; i++) {
    const u = Math.min(1, Math.max(0, ((stations[i] ?? 0) + info.armA) / total));
    curve.getPointAt(u, v).applyMatrix4(rot);
    out[3 * i] = v.x;
    out[3 * i + 1] = v.y;
    out[3 * i + 2] = v.z;
  }
  return out;
}

/**
 * The tube's radius profile at its rings (static per chromatid): `tip` = the condensed radius
 * without the waist (round tips), `waist` = how much the waist takes away (0…depth).
 */
export interface TubeProfile {
  tip: Float32Array;
  waist: Float32Array;
}

export function tubeProfile(info: ChromatidInfo, stations: ArrayLike<number>): TubeProfile {
  const tip = new Float32Array(stations.length);
  const waist = new Float32Array(stations.length);
  for (let i = 0; i < stations.length; i++) {
    const s = stations[i] ?? 0;
    const plain = rodRadius(s, info.armA, info.armB, ROD_RADIUS, 0);
    tip[i] = plain;
    waist[i] = plain > 0 ? 1 - rodRadius(s, info.armA, info.armB, ROD_RADIUS, 1) / plain : 0;
  }
  // The end rings are the tips themselves (no float rounding leaves a sliver of radius there).
  if (tip.length > 0) {
    tip[0] = 0;
    tip[tip.length - 1] = 0;
  }
  // The waist share never exceeds the constriction depth.
  for (let i = 0; i < waist.length; i++)
    waist[i] = Math.min(CONSTRICTION.depth, Math.max(0, waist[i] ?? 0));
  return { tip, waist };
}

/** Half-width of the rounded corner where the two arms meet at the centromere. */
const CORNER = 0.25;
/** Reach of the pinch that joins two sisters at their centromeres (along the chromatid). */
const PINCH_REACH = 0.4;

export interface CentrelineInput {
  /** Centromere and arm directions of the pose (unit vectors). */
  centromere: Vec3;
  dirA: Vec3;
  dirB: Vec3;
  /** Thread samples (`threadSamples`) and their scale (world units per unit ball). */
  thread: ArrayLike<number>;
  /** Radius profile (`tubeProfile`). */
  profile: TubeProfile;
  threadScale: number;
  /** Morph share: 0 = thread, 1 = rod (`condensedShare`). */
  m: number;
  /** Towards the sister (unit), and how much of the gap between the two waists to close. */
  towardSister: Vec3;
  pinch: number;
}

/**
 * Writes the centreline (one point per station) into `out` and the tube radius at each station
 * into `radii`. Rod: arm A along dirA, arm B along dirB, a rounded corner at the centromere.
 */
export function writeCentreline(
  info: ChromatidInfo,
  stations: ArrayLike<number>,
  o: CentrelineInput,
  out: Float32Array,
  radii: Float32Array,
): void {
  const [cx, cy, cz] = o.centromere;
  const [ax, ay, az] = o.dirA;
  const [bx, by, bz] = o.dirB;
  const m = o.m;
  // Short arms (big chromosome sets) keep the corner and the pinch off their tips.
  const shorter = Math.min(info.armA, info.armB);
  const w = Math.min(CORNER, 0.45 * shorter);
  const reach = Math.min(PINCH_REACH, 0.7 * shorter);
  // The waists touch: each sister moves its waist by the gap between the two waist surfaces.
  const waistR = rodRadius(0, info.armA, info.armB, ROD_RADIUS, 1);
  const shift = Math.max(0, SISTER_OFFSET - waistR) * o.pinch * m;
  const thinR = THREAD_RADIUS / ROD_RADIUS;
  for (let i = 0; i < stations.length; i++) {
    const s = stations[i] ?? 0;
    let rx: number;
    let ry: number;
    let rz: number;
    if (s <= -w) {
      rx = cx - ax * s;
      ry = cy - ay * s;
      rz = cz - az * s;
    } else if (s >= w) {
      rx = cx + bx * s;
      ry = cy + by * s;
      rz = cz + bz * s;
    } else {
      // Quadratic Bézier from c + dirA·w through (towards) c to c + dirB·w.
      const t = (s + w) / (2 * w);
      const p0 = (1 - t) * (1 - t) * w;
      const p2 = t * t * w;
      rx = cx + ax * p0 + bx * p2;
      ry = cy + ay * p0 + by * p2;
      rz = cz + az * p0 + bz * p2;
    }
    if (shift > 0) {
      const x = Math.min(1, Math.abs(s) / reach);
      const k = shift * (1 - x * x * (3 - 2 * x));
      rx += o.towardSister[0] * k;
      ry += o.towardSister[1] * k;
      rz += o.towardSister[2] * k;
    }
    const tx = cx + (o.thread[3 * i] ?? 0) * o.threadScale;
    const ty = cy + (o.thread[3 * i + 1] ?? 0) * o.threadScale;
    const tz = cz + (o.thread[3 * i + 2] ?? 0) * o.threadScale;
    out[3 * i] = tx + (rx - tx) * m;
    out[3 * i + 1] = ty + (ry - ty) * m;
    out[3 * i + 2] = tz + (rz - tz) * m;
    radii[i] =
      (o.profile.tip[i] ?? 0) * (1 - m * (o.profile.waist[i] ?? 0)) * (thinR + (1 - thinR) * m);
  }
}
