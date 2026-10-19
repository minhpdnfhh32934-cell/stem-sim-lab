import { describe, expect, it } from 'vitest';
import {
  PLATE_FRONT,
  centrioleTriplets,
  envelopeBreakdown,
  plateSlots,
  plateVesicleSize,
  spherePointsEven,
} from './sceneParts';

describe('finer parts of the 3D mitosis view', () => {
  it('points spread over the whole unit sphere', () => {
    const pts = spherePointsEven(40);
    expect(pts).toHaveLength(40);
    for (const p of pts) expect(Math.hypot(...p)).toBeCloseTo(1, 9);
    const mean = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]);
    for (const m of mean) expect(Math.abs(m / 40)).toBeLessThan(0.05);
  });

  it('the envelope breaks into vesicles, which then disperse (and re-form backwards)', () => {
    expect(envelopeBreakdown(1)).toEqual({ shell: 1, vesicles: 0, drift: 0 });
    expect(envelopeBreakdown(0)).toEqual({ shell: 0, vesicles: 0, drift: 0.35 });
    const mid = envelopeBreakdown(0.5);
    expect(mid.shell).toBe(0);
    expect(mid.vesicles).toBe(1);
    // While the sheet is still there, its pieces are already breaking off.
    const early = envelopeBreakdown(0.85);
    expect(early.shell).toBeGreaterThan(0.3);
    expect(early.vesicles).toBeGreaterThan(0.3);
  });

  it('cell-plate vesicles wait beyond the edge and fuse as it reaches them', () => {
    const slots = plateSlots(90, 5.4, 3.65, 3.65);
    for (const s of slots) {
      expect(Math.abs(s.y)).toBeLessThanOrEqual(3.65);
      expect(Math.abs(s.z)).toBeLessThanOrEqual(3.65);
      expect(Math.hypot(s.y, s.z)).toBeCloseTo(s.r, 9);
    }
    expect(plateVesicleSize(1, 0.5, false)).toBe(0);
    expect(plateVesicleSize(1, 0.5, true)).toBeGreaterThan(0.5);
    expect(plateVesicleSize(1, 1 - PLATE_FRONT.ahead - 0.01, true)).toBe(0);
    expect(plateVesicleSize(1, 1 + PLATE_FRONT.fused + 0.01, true)).toBe(0);
  });

  it('a centriole is a ring of nine triplets of microtubules', () => {
    const t = centrioleTriplets(0.1);
    expect(t).toHaveLength(27);
    // Inside the barrel, and touching neighbours within a triplet.
    for (const u of t) expect(Math.hypot(u.x, u.z) + u.radius).toBeLessThanOrEqual(0.1 + 1e-3);
    expect(Math.hypot(t[1]!.x - t[0]!.x, t[1]!.z - t[0]!.z)).toBeCloseTo(2 * t[0]!.radius, 9);
  });
});
