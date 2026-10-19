/**
 * Small vector and easing helpers shared by the 3D cell-division timelines (mitosis, meiosis).
 * Pure maths: no three.js, no DOM. Units are arbitrary "cell units"; y is up.
 */

export type Vec3 = [number, number, number];

export const clamp01 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x);

/** Smoothstep easing of u inside the window [a, b]. */
export function ease(u: number, a = 0, b = 1): number {
  const x = clamp01((u - a) / (b - a));
  return x * x * (3 - 2 * x);
}

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const v3 = (x: number, y: number, z: number): Vec3 => [x, y, z];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const lerpV = (a: Vec3, b: Vec3, k: number): Vec3 => [
  lerp(a[0], b[0], k),
  lerp(a[1], b[1], k),
  lerp(a[2], b[2], k),
];
export function norm(a: Vec3, fallback: Vec3 = [0, 1, 0]): Vec3 {
  const l = len(a);
  return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : fallback;
}
/** The spindle axis of the first (or only) division. */
export const X: Vec3 = [1, 0, 0];

/** A random unit vector (rejection sampling; deterministic for a seeded `rand`). */
export function randomUnit(rand: () => number): Vec3 {
  for (;;) {
    const p: Vec3 = [rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1];
    const l = len(p);
    if (l > 0.2 && l <= 1) return mul(p, 1 / l);
  }
}

/** A random point in the unit ball. */
export function randomInBall(rand: () => number): Vec3 {
  for (;;) {
    const p: Vec3 = [rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1];
    if (len(p) <= 1) return p;
  }
}

/** Two unit vectors perpendicular to `d` and to each other. */
export function basis(d: Vec3): [Vec3, Vec3] {
  const e1 = norm(cross(d, [0, 0, 1]), norm(cross(d, [0, 1, 0])));
  return [e1, norm(cross(d, e1))];
}
