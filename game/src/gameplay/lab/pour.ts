import type { Quat, Vec3 } from '../../core/math';
import type { ContainerDefinition } from '../item';

/** Pour geometry and pacing, pure and allocation-free (`LiquidSystem` reads them each step). */

const DEG = Math.PI / 180;

/** `p + q·v` (a point given in an object's frame, in the world), into `out`. */
export function pointOf(
  position: Readonly<Vec3>,
  q: Readonly<Quat>,
  v: Readonly<Vec3>,
  out: Vec3,
): Vec3 {
  const [x, y, z, w] = q;
  const [vx, vy, vz] = v;
  // t = 2·(q.xyz × v); v' = v + w·t + q.xyz × t
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  out[0] = position[0] + vx + w * tx + (y * tz - z * ty);
  out[1] = position[1] + vy + w * ty + (z * tx - x * tz);
  out[2] = position[2] + vz + w * tz + (x * ty - y * tx);
  return out;
}

/**
 * The pour rate (mL/s) of a held source: a squeezed one its full rate while squeezed; a tipped
 * one from nothing at `minTiltDeg` to its full rate at `fullTiltDeg`, linear between (pacing,
 * an AFFORDANCE: no model reads it).
 */
export function pourRate(
  pour: NonNullable<ContainerDefinition['pour']>,
  tilt: number,
  squeezing: boolean,
): number {
  if (pour.trigger === 'squeeze') return squeezing ? pour.rateMlPerS : 0;
  const f = (tilt - pour.minTiltDeg * DEG) / ((pour.fullTiltDeg - pour.minTiltDeg) * DEG);
  return pour.rateMlPerS * Math.min(1, Math.max(0, f));
}

/** Whether a spout over a receiver's mouth is within its capture radius, horizontally. */
export function overMouth(
  spout: Readonly<Vec3>,
  mouth: Readonly<Vec3>,
  receiver: NonNullable<ContainerDefinition['mouth']>,
): boolean {
  const r = receiver.captureRadius ?? receiver.radius;
  return (spout[0] - mouth[0]) ** 2 + (spout[2] - mouth[2]) ** 2 <= r * r;
}

/**
 * Whole µL to ask for each fixed step at a rate, the fraction carried to the next step, so a pour
 * of rate R for N steps of h asks for floor(R·N·h·1000) µL whatever the steps' grouping.
 */
export class PourMeter {
  private carry = 0;

  /** The µL to ask for this step. */
  take(rateMlPerS: number, h: number): number {
    const exact = rateMlPerS * h * 1000 + this.carry;
    const want = Math.floor(exact);
    this.carry = exact - want;
    return want;
  }

  /** Less moved than asked (the source ran out, the mark was reached): nothing is owed. */
  reset(): void {
    this.carry = 0;
  }
}
