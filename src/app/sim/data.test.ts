import { describe, expect, it } from 'vitest';
import { newtonLaws } from '@/physics/incline/scenes';
import { horizontalProjectile } from '@/physics/projectile/scenes';
import { energyConservation } from '@/physics/track/scenes';
import { columnsFor } from './data';

const vi = (t: { vi: string }) => t.vi;
const headers = (scene: Parameters<typeof columnsFor>[0]) =>
  columnsFor(scene, vi).map((c) => c.header);

describe('Số liệu headers (UI-21)', () => {
  it('a series label with its own unit, or an axis with several units, adds no second unit', () => {
    for (const h of [...headers(newtonLaws), ...headers(energyConservation)]) {
      expect(h).not.toMatch(/\)\s*\(/);
      expect(h).not.toContain(';');
    }
  });

  it('a series without a unit still gets the axis unit', () => {
    // Position graph: axis "Tọa độ (m)", series "x" → "x (m)".
    expect(headers(horizontalProjectile)).toContain('x (m)');
  });
});
