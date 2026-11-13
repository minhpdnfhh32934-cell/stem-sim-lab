import { describe, expect, it } from 'vitest';
import { DOOR_PROPS } from './doors';
import { bounds, expectProp, triangles } from './testing';

// The doors' props at the sizes their items ship: sound and inside the box; the leaf the same from
// both of its rooms (symmetric in z) and the wall pieces, turned by π on half the walls, symmetric
// in x; the vision panel at a standing eye's height.

const SHIPPED = [
  ['door-leaf', [1, 2.1, 0.08]],
  ['door-header', [2.12, 0.075, 0.14]],
  ['door-rail', [2, 0.09, 0.04]],
  ['door-jamb', [0.08, 2.2, 0.045]],
  ['door-jamb-sealed', [0.08, 2.2, 0.045]],
  ['door-plate-clean', [0.15, 0.15, 0.008]],
  ['door-plate-hazard', [0.2, 0.2, 0.008]],
] as const;

describe('door props', () => {
  it('cover every door builder', () => {
    expect(new Set(SHIPPED.map(([prop]) => prop))).toEqual(new Set(Object.keys(DOOR_PROPS)));
  });

  it.each(SHIPPED)('%s is sound, inside its box and symmetric', (prop, size) => {
    const parts = DOOR_PROPS[prop](size);
    expectProp(parts, 'box', size);
    expect(triangles(parts)).toBeLessThan(2000);
    for (const { finish, geometry } of parts) {
      const b = bounds(geometry);
      if (prop === 'door-leaf') expect(b.min.z, finish).toBeCloseTo(-b.max.z, 6);
      else if (!prop.startsWith('door-plate')) expect(b.min.x, finish).toBeCloseTo(-b.max.x, 6);
    }
  });

  it('fill the leaf to its box, with the vision panel from 1.0 to 1.85 m', () => {
    const [w, h, d] = [1, 2.1, 0.08];
    const parts = DOOR_PROPS['door-leaf']([w, h, d]);
    const body = bounds(parts.find((p) => p.finish === 'body')!.geometry);
    [body.max.x, body.max.y, body.max.z].forEach((v, i) =>
      expect(v).toBeCloseTo([w, h, d][i]! / 2, 6),
    );
    expect(body.min.y).toBeCloseTo(-h / 2, 6);
    const glass = bounds(parts.find((p) => p.finish === 'vision-glass')!.geometry);
    expect(glass.min.y + h / 2).toBeCloseTo(1.0, 6);
    expect(glass.max.y + h / 2).toBeCloseTo(1.85, 6);
  });
});
