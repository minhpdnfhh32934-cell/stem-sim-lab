/** Minimal immutable 2D vector helpers (SI, y axis pointing up). */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export const vec = (x: number, y: number): Vec2 => ({ x, y });
export const ZERO: Vec2 = vec(0, 0);

export const add = (a: Vec2, b: Vec2): Vec2 => vec(a.x + b.x, a.y + b.y);
export const sub = (a: Vec2, b: Vec2): Vec2 => vec(a.x - b.x, a.y - b.y);
export const scale = (a: Vec2, k: number): Vec2 => vec(a.x * k, a.y * k);
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;
export const length = (a: Vec2): number => Math.hypot(a.x, a.y);
export const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

export function normalize(a: Vec2): Vec2 {
  const l = length(a);
  return l === 0 ? ZERO : vec(a.x / l, a.y / l);
}

/** Vector from polar form; angle in radians measured from +x, counter-clockwise. */
export const fromPolar = (magnitude: number, angle: number): Vec2 =>
  vec(magnitude * Math.cos(angle), magnitude * Math.sin(angle));

/** Angle of a vector in radians, in (-π, π]. */
export const angleOf = (a: Vec2): number => Math.atan2(a.y, a.x);

export const rotate = (a: Vec2, angle: number): Vec2 => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return vec(a.x * c - a.y * s, a.x * s + a.y * c);
};

export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 =>
  vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
