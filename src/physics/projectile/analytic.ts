/**
 * Closed-form projectile motion (point mass, uniform g, no air resistance).
 * Launch from (0, h0) with speed v0 at angle α above the horizontal; ground at y = 0.
 * Source: standard kinematics (SGK Vật lí 10; Halliday–Resnick–Walker, ch. 4).
 */
export interface ProjectileInput {
  v0: number;
  angle: number; // rad
  h0: number;
  g: number;
}

export interface ProjectileResult {
  vx0: number;
  vy0: number;
  /** Time until y = 0 (s). */
  flightTime: number;
  /** Horizontal distance at landing (m). */
  range: number;
  /** Highest y reached (m) — h0 when launched downward/horizontally. */
  maxHeight: number;
  /** Time at the highest point (0 if the ball never rises). */
  apexTime: number;
  /** Speed at impact (m/s). */
  impactSpeed: number;
  /** Impact angle below the horizontal (rad). */
  impactAngle: number;
}

export function projectile({ v0, angle, h0, g }: ProjectileInput): ProjectileResult {
  if (!(g > 0)) throw new RangeError('g must be positive');
  if (h0 < 0) throw new RangeError('h0 must be ≥ 0');
  const vx0 = v0 * Math.cos(angle);
  const vy0 = v0 * Math.sin(angle);
  // y(t) = h0 + vy0 t − ½ g t² = 0 → positive root (numerically stable form).
  const disc = Math.sqrt(vy0 * vy0 + 2 * g * h0);
  const flightTime = vy0 >= 0 ? (vy0 + disc) / g : (2 * h0) / (disc - vy0);
  const apexTime = vy0 > 0 ? vy0 / g : 0;
  const maxHeight = vy0 > 0 ? h0 + (vy0 * vy0) / (2 * g) : h0;
  const vyImpact = vy0 - g * flightTime;
  return {
    vx0,
    vy0,
    flightTime,
    range: vx0 * flightTime,
    maxHeight,
    apexTime,
    impactSpeed: Math.hypot(vx0, vyImpact),
    impactAngle: Math.atan2(-vyImpact, Math.abs(vx0)),
  };
}

/** Position at time t. */
export function projectileAt(p: ProjectileInput, t: number): { x: number; y: number } {
  return {
    x: p.v0 * Math.cos(p.angle) * t,
    y: p.h0 + p.v0 * Math.sin(p.angle) * t - 0.5 * p.g * t * t,
  };
}
