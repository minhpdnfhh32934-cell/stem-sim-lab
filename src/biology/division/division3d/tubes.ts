/**
 * Chromatid tubes of the 3D division views (mitosis, meiosis): detail per quality tier, the
 * kinetochore disc and the contact shade between sisters. Illustration only: sizes are not to
 * scale (`dimensions.ts`) and shading says nothing about structure.
 */
import type { QualityTier } from '@/perf/tiers';
import { ILLUSTRATIVE_SCALE, TUBE_RINGS_PER_UNIT, TUBE_RINGS_PER_UNIT_MANY } from './dimensions';

/** Kinetochore disc radius (a small dark disc on the centromere's outer face). */
export const KINETOCHORE_RADIUS = 0.085 * ILLUSTRATIVE_SCALE;

/**
 * Where sister chromatids touch, the facing sides are shaded darker (vertex colours, down to
 * 82 %), fading over `reach` from the centromere as the arms diverge.
 */
export const CONTACT_SHADE = { strength: 0.18, reach: 0.55 * ILLUSTRATIVE_SCALE } as const;

/**
 * Sides and ring density of a chromatid tube per tier. A big chromosome set (more than 16
 * chromatids: 2n > 8, which the views do not offer but a timeline can hold) gets the lightest
 * tubes, so a playback frame stays cheap however many chromatids move (smoothness first).
 */
export function tubeDetail(
  tier: QualityTier,
  chromatids: number,
): { sides: number; ringsPerUnit: number; tipRings: number; waistRings: number } {
  const many = chromatids > 16;
  const sides = many ? 6 : tier === 'high' ? 10 : tier === 'medium' ? 8 : 6;
  return many
    ? { sides, ringsPerUnit: TUBE_RINGS_PER_UNIT_MANY, tipRings: 3, waistRings: 4 }
    : { sides, ringsPerUnit: TUBE_RINGS_PER_UNIT, tipRings: 6, waistRings: 8 };
}
