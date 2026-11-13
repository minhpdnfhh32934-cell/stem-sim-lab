import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PROP_BUILDERS } from './index';
import { EPSILON, expectProp } from './testing';
import { reagentCabinetLayout } from './reagent';

// The reagent cabinet at the size an item would carry (1.2 × 1.9 × 0.5 m), and at 0.8 × that: its
// parts fit the item's box, and the drawn shelves and doors are exactly the boxes the layout gives
// the item's `hinged` (so physics, picture and a bottle's resting place agree).

const SIZES = [
  [1.2, 1.9, 0.5],
  [0.96, 1.52, 0.4],
] as const;

describe.each(SIZES)('reagent cabinet %s × %s × %s', (...size) => {
  const parts = PROP_BUILDERS['reagent-cabinet']!(size);
  const layout = reagentCabinetLayout(size);

  it('fits its box, one geometry per finish and leaf, normals and indices sound', () => {
    expectProp(parts, 'box', size);
  });

  it('has two leaves, each hinged where the layout says, on opposite sides', () => {
    const hinges = [...new Set(parts.filter((p) => p.hinge).map((p) => p.hinge))];
    expect(hinges).toHaveLength(2);
    expect(hinges.map((h) => [h!.x, h!.z, h!.opens])).toEqual(
      layout.leaves.map((l) => [l.hinge[0], l.hinge[1], l.opens]),
    );
    expect(layout.leaves[0]!.opens).toBe(-layout.leaves[1]!.opens);
  });

  it('draws each shelf top where the layout puts it, across the cabinet', () => {
    const body = parts.find((p) => p.finish === 'body' && !p.hinge)!.geometry;
    const position = body.getAttribute('position');
    const [w, , d] = size;
    for (const y of layout.shelves) {
      const top = new THREE.Box3();
      for (let i = 0; i < position.count; i++) {
        if (Math.abs(position.getY(i) - y) < EPSILON) {
          top.expandByPoint(new THREE.Vector3(position.getX(i), y, position.getZ(i)));
        }
      }
      expect(top.isEmpty(), `a surface at ${y}`).toBe(false);
      expect(top.min.x).toBeLessThanOrEqual(-w / 2 + 0.02);
      expect(top.max.x).toBeGreaterThanOrEqual(w / 2 - 0.02);
      expect(top.max.z - top.min.z).toBeGreaterThan(d / 2);
    }
  });

  it('has shelves in the order glassware reaches them: evenly spaced, the floor lowest', () => {
    const gaps = layout.shelves.slice(1).map((y, i) => y - layout.shelves[i]!);
    expect(layout.shelves).toHaveLength(4);
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0]!, 12);
    expect(gaps[0]).toBeGreaterThan(0.25); // room for a 0.14 m bottle and a 0.22 m flask
    // every carcass box is inside the item's box
    for (const { center, size: s } of layout.carcass) {
      center.forEach((c, i) =>
        expect(Math.abs(c) + s[i]! / 2).toBeLessThanOrEqual(size[i]! / 2 + 1e-9),
      );
    }
  });
});
