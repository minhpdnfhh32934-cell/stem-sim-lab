import { describe, expect, it } from 'vitest';
import { TIERS, type QualityTier } from '@/perf/tiers';
import type { GpuClass } from './gpuInfo';
import { quality3d } from './quality3d';

describe('quality3d', () => {
  it('one table for every 3D view: what each tier draws (GPU unknown = integrated)', () => {
    const rows = (['low', 'medium', 'high'] as QualityTier[]).map((t) => {
      const q = quality3d(t, TIERS[t], 'unknown');
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
      // High without a discrete GPU: High's detail, no shadow maps (no heavier than 0.7.0,
      // whose shadow maps no scene used).
      ['high', 24, false, 0, true, true, 1500, 10, true, 2, true],
    ]);
  });

  it('post-processing per tier and GPU: only High on a discrete GPU runs the full chain', () => {
    const rows: [QualityTier, GpuClass][] = [
      ['low', 'discrete'],
      ['medium', 'discrete'],
      ['medium', 'integrated'],
      ['high', 'software'],
      ['high', 'integrated'],
      ['high', 'unknown'],
      ['high', 'discrete'],
    ];
    const table = rows.map(([t, g]) => {
      const q = quality3d(t, TIERS[t], g);
      return [
        t,
        g,
        q.postFx,
        q.ao,
        q.bloom,
        q.msaaSamples,
        q.transmission,
        q.shadows,
        q.shadowScenes,
        q.envIntensity,
        q.labelCap,
        q.segments,
      ];
    });
    expect(table).toEqual([
      ['low', 'discrete', 'none', false, false, 0, false, false, false, 0, 0, 8],
      ['medium', 'discrete', 'none', false, false, 0, false, false, false, 1, 6, 16],
      ['medium', 'integrated', 'none', false, false, 0, false, false, false, 1, 6, 16],
      ['high', 'software', 'none', false, false, 0, false, false, false, 1, 10, 24],
      ['high', 'integrated', 'none', false, false, 0, false, false, false, 1, 10, 24],
      ['high', 'unknown', 'none', false, false, 0, false, false, false, 1, 10, 24],
      ['high', 'discrete', 'full', true, true, 4, true, true, true, 1, 10, 24],
    ]);
    expect(quality3d('high', TIERS.high, 'discrete').shadowMapSize).toBe(1024);
  });

  it('High on an integrated GPU draws exactly what High on an unknown GPU draws', () => {
    expect({ ...quality3d('high', TIERS.high, 'integrated'), gpu: 'x' }).toEqual({
      ...quality3d('high', TIERS.high, 'unknown'),
      gpu: 'x',
    });
  });

  it('never fewer than 8 segments, at least one instance', () => {
    const q = quality3d('medium', { ...TIERS.medium, sphereSegments: 3, maxParticles: 0 });
    expect(q.segments).toBe(8);
    expect(q.maxInstances).toBe(1);
  });

  it('shadow maps only when the High tier allows them, on a discrete GPU', () => {
    expect(quality3d('high', { ...TIERS.high, shadows: false }, 'discrete').shadows).toBe(false);
    expect(quality3d('medium', { ...TIERS.medium, shadows: true }, 'discrete').shadows).toBe(false);
    expect(quality3d('high', TIERS.high, 'integrated').shadows).toBe(false);
  });

  it('jsdom: the GPU is unknown, so tests get no post-processing', () => {
    expect(quality3d('high', TIERS.high).postFx).toBe('none');
    expect(quality3d('high', TIERS.high).gpu).toBe('unknown');
  });
});
