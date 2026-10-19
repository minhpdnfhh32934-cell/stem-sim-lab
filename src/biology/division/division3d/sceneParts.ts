/**
 * Pure maths for the finer parts of the 3D division views (mitosis, meiosis) (no three.js objects, no DOM): where
 * nuclear pores, envelope vesicles, cell-plate vesicles and the microtubule triplets of a
 * centriole sit, and how the nuclear envelope breaks into vesicles and re-forms.
 *
 * Counts of pores and vesicles, sizes and positions are illustrative (not the model's numbers,
 * not to scale); what they show is the textbook process (Campbell): the nuclear envelope (a
 * double membrane with pores) fragments into vesicles in prophase and re-forms around each set
 * of chromosomes in telophase; Golgi vesicles gather at the equator and fuse into the cell plate
 * from the centre outwards; a centriole is a ring of nine microtubule triplets.
 */
import { ease, type Vec3 } from './math';

/** `n` points spread evenly over the unit sphere (Fibonacci spiral, deterministic). */
export function spherePointsEven(n: number): Vec3[] {
  const out: Vec3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * golden;
    out.push([r * Math.cos(a), y, r * Math.sin(a)]);
  }
  return out;
}

/**
 * The nuclear envelope at level `e` (1 = whole, 0 = gone; the timeline's own value): how much of
 * the continuous double membrane is shown, how big its vesicles are (0…1) and how far they have
 * drifted out (share of the nuclear radius). The membrane breaks into vesicles first, then the
 * vesicles disperse; in telophase the same path runs backwards (vesicles gather and fuse).
 */
export function envelopeBreakdown(e: number): { shell: number; vesicles: number; drift: number } {
  const x = Math.min(1, Math.max(0, e));
  return {
    shell: ease(x, 0.55, 1),
    vesicles: 4 * x * (1 - x),
    drift: 0.35 * (1 - x),
  };
}

/** One slot of the cell-plate disc: distance from the axis and its place on the plane. */
export interface PlateSlot {
  r: number;
  y: number;
  z: number;
  /** Small offset across the plane (vesicles do not sit on one mathematical plane). */
  x: number;
}

/**
 * Up to `n` vesicle slots spread evenly over the equatorial plane (sunflower pattern) out to
 * `reach`, keeping only those inside the cell's cross-section (|y| ≤ hy, |z| ≤ hz).
 */
export function plateSlots(n: number, reach: number, hy: number, hz: number): PlateSlot[] {
  const out: PlateSlot[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const r = reach * Math.sqrt((i + 0.5) / n);
    const a = i * golden;
    const y = r * Math.cos(a);
    const z = r * Math.sin(a);
    if (Math.abs(y) > hy || Math.abs(z) > hz) continue;
    // Deterministic jitter across the plane, ±0.12.
    const x = 0.12 * Math.sin(i * 12.9898);
    out.push({ r, y, z, x });
  }
  return out;
}

/** Band of vesicles ahead of the growing plate's edge (world units). */
export const PLATE_FRONT = { ahead: 0.9, fused: 0.15 } as const;

/**
 * Size (0…1) of the vesicle in a slot at distance `r` from the axis while the plate has grown to
 * `plateRadius`: vesicles wait just beyond the edge and fuse as the edge reaches them (none
 * before the plate starts, none once it is complete).
 */
export function plateVesicleSize(r: number, plateRadius: number, growing: boolean): number {
  if (!growing) return 0;
  const d = r - plateRadius;
  if (d < -PLATE_FRONT.fused || d > PLATE_FRONT.ahead) return 0;
  if (d < 0) return ease(d, -PLATE_FRONT.fused, 0);
  return 1 - ease(d, 0.45 * PLATE_FRONT.ahead, PLATE_FRONT.ahead);
}

/** One microtubule of a centriole: its centre across the barrel (x, z), and its radius. */
export interface Tubule {
  x: number;
  z: number;
  radius: number;
}

/**
 * Nine triplets of microtubules (A, B, C) around a barrel of outer radius `barrel`, each triplet
 * tilted like a pinwheel blade — the textbook cross-section of a centriole.
 */
export function centrioleTriplets(barrel: number): Tubule[] {
  const radius = barrel * 0.13;
  const out: Tubule[] = [];
  const tilt = (50 * Math.PI) / 180;
  const mid = barrel - 2.5 * radius;
  for (let k = 0; k < 9; k++) {
    const a = (2 * Math.PI * k) / 9;
    // Blade direction: the radial direction turned by the tilt.
    const dx = Math.cos(a + tilt);
    const dz = Math.sin(a + tilt);
    const cx = mid * Math.cos(a);
    const cz = mid * Math.sin(a);
    for (let j = -1; j <= 1; j++) {
      out.push({ x: cx + dx * j * 2 * radius, z: cz + dz * j * 2 * radius, radius });
    }
  }
  return out;
}
