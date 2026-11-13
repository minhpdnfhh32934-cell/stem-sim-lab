import { describe, expect, it } from 'vitest';
import { around, glassGrid, glassPane, type Rect } from './glassFloor';

const area = ([x0, x1, z0, z1]: Rect) => (x1 - x0) * (z1 - z0);

describe('a glass floor', () => {
  it('lays the slab round the glass: together they cover the slab exactly', () => {
    const slab: Rect = [-13.125, 13.125, -12.125, 6.125];
    const hole: Rect = [-9, 9, -8, 2];
    const pieces = around(slab, hole);
    expect(pieces).toHaveLength(4);
    expect(pieces.reduce((s, p) => s + area(p), 0) + area(hole)).toBeCloseTo(area(slab), 9);
    for (const [x0, x1, z0, z1] of pieces) {
      const inside = x0 >= hole[0] && x1 <= hole[1] && z0 >= hole[2] && z1 <= hole[3];
      expect(inside).toBe(false);
    }
  });

  it('leaves out the empty strips of a glass area at the slab edge', () => {
    expect(around([0, 10, 0, 10], [0, 5, 0, 10])).toEqual([[5, 10, 0, 10]]);
  });

  it('sets the glass and its grid flush under the floor top', () => {
    for (const geometry of [glassPane([-9, 9, -8, 2], 0), glassGrid([-9, 9, -8, 2], 0)]) {
      geometry.computeBoundingBox();
      expect(geometry.boundingBox!.max.y).toBeLessThanOrEqual(0);
      expect(geometry.boundingBox!.min.y).toBeGreaterThan(-0.1);
    }
  });
});
