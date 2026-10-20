import { describe, expect, it } from 'vitest';
import { TIERS, type QualityTier } from '@/perf/tiers';
import { quality3d } from './quality3d';

describe('quality3d', () => {
  it('one table for every 3D view: what each tier draws', () => {
    const rows = (['low', 'medium', 'high'] as QualityTier[]).map((t) => {
      const q = quality3d(t, TIERS[t]);
      return [
        t,
        q.segments,
        q.shadows,
        q.shadowMapSize,
        q.contactShadow,
        q.envMap,
        q.maxInstances,
        q.labelCap,
        q.detail,
        q.pixelRatioCap,
        q.antialias,
      ];
    });
    expect(rows).toEqual([
      // Low: the view shows its 2D picture (no 3D is drawn); the row is for completeness.
      ['low', 8, false, 0, false, false, 225, 0, false, 1, false],
      ['medium', 16, false, 0, true, true, 600, 6, false, 1.5, true],
      ['high', 24, true, 1024, true, true, 1500, 10, true, 2, true],
    ]);
  });

  it('never fewer than 8 segments, at least one instance', () => {
    const q = quality3d('medium', { ...TIERS.medium, sphereSegments: 3, maxParticles: 0 });
    expect(q.segments).toBe(8);
    expect(q.maxInstances).toBe(1);
  });

  it('shadow maps only when the High tier allows them', () => {
    expect(quality3d('high', { ...TIERS.high, shadows: false }).shadows).toBe(false);
    expect(quality3d('medium', { ...TIERS.medium, shadows: true }).shadows).toBe(false);
  });
});
