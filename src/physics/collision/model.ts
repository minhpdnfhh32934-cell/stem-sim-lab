/**
 * Instantaneous collision of two smooth (frictionless) disks. Only the velocity
 * components along the line of centres n change:
 *   J = (1 + e) (v₁ − v₂)·n / (1/m₁ + 1/m₂),  v₁′ = v₁ − (J/m₁) n,  v₂′ = v₂ + (J/m₂) n.
 * e = 1: perfectly elastic; e = 0 here means *perfectly inelastic* ("va chạm mềm"):
 * the bodies stick and move with the centre-of-mass velocity.
 * Sources: SGK Vật lí 10 (động lượng); Halliday–Resnick–Walker ch. 9.
 */
export interface V2 {
  x: number;
  y: number;
}

export interface CollisionResult {
  v1: V2;
  v2: V2;
}

export function collide(m1: number, m2: number, v1: V2, v2: V2, n: V2, e: number): CollisionResult {
  if (e <= 0) {
    const M = m1 + m2;
    const v = { x: (m1 * v1.x + m2 * v2.x) / M, y: (m1 * v1.y + m2 * v2.y) / M };
    return { v1: v, v2: { ...v } };
  }
  const vn = (v1.x - v2.x) * n.x + (v1.y - v2.y) * n.y;
  if (vn <= 0) return { v1, v2 }; // separating: no impulse
  const J = ((1 + e) * vn) / (1 / m1 + 1 / m2);
  return {
    v1: { x: v1.x - (J / m1) * n.x, y: v1.y - (J / m1) * n.y },
    v2: { x: v2.x + (J / m2) * n.x, y: v2.y + (J / m2) * n.y },
  };
}

/** Same result derived in the centre-of-mass frame (used as an independent check). */
export function collideCM(
  m1: number,
  m2: number,
  v1: V2,
  v2: V2,
  n: V2,
  e: number,
): CollisionResult {
  const M = m1 + m2;
  const c = { x: (m1 * v1.x + m2 * v2.x) / M, y: (m1 * v1.y + m2 * v2.y) / M };
  if (e <= 0) return { v1: c, v2: { ...c } };
  const reflect = (u: V2): V2 => {
    const un = u.x * n.x + u.y * n.y;
    return { x: u.x - (1 + e) * un * n.x, y: u.y - (1 + e) * un * n.y };
  };
  const u1 = reflect({ x: v1.x - c.x, y: v1.y - c.y });
  const u2 = reflect({ x: v2.x - c.x, y: v2.y - c.y });
  return { v1: { x: u1.x + c.x, y: u1.y + c.y }, v2: { x: u2.x + c.x, y: u2.y + c.y } };
}

/**
 * Earliest τ ∈ [0, max] at which two disks (relative position d, relative velocity w,
 * contact distance R) touch while approaching, or null.
 */
export function contactTime(d: V2, w: V2, R: number, max: number): number | null {
  const a = w.x * w.x + w.y * w.y;
  const b = 2 * (d.x * w.x + d.y * w.y);
  const c = d.x * d.x + d.y * d.y - R * R;
  if (b >= 0 || a === 0) return null; // not approaching
  if (c <= 0) return 0; // already touching/overlapping while approaching
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= max ? t : null;
}

export const kinetic = (m: number, v: V2) => 0.5 * m * (v.x * v.x + v.y * v.y);
