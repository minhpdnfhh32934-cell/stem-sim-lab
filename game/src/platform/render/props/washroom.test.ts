import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CEILING_PROPS } from './ceiling';
import type { PropBuilder, PropPart } from './parts';
import { bounds, expectProp, triangles } from './testing';
import { BASEBOARD_H } from '../roomShell';
import { WASHROOM_PROPS } from './washroom';

// The washroom's and the ceilings' props (UX3) at the size their items ship, and at 0.8 × that;
// then what the toilet, the basin, the tiles and the hub's coffer promise.

/** The props as their items carry them: prop, item shape, size, triangles a copy may draw. */
const SHIPPED = [
  ['toilet', 'box', [0.4, 0.75, 0.65], 1100], // teacher-wc
  ['wall-basin', 'box', [0.5, 1, 0.4], 1100], // teacher-sink
  ['mirror', 'box', [0.6, 0.75, 0.02], 100], // washroom-mirror
  ['mirror-light', 'box', [0.6, 0.05, 0.07], 50], // mirror-light
  ['roll-holder', 'box', [0.16, 0.14, 0.12], 300], // toilet-roll-holder
  ['tile-wainscot', 'box', [2, 1.1, 0.015], 800], // wall-tiles (and its narrow and splash pieces); on the skirting (UX3.1)
  ['wc-door', 'box', [1.24, 2.2, 0.1], 600], // wc-door
  ['fixture-trim', 'box', [3.08, 0.065, 0.68], 100], // ceiling-trim, ceiling-trim-small
  ['fixture-trim', 'box', [3.08, 0.1, 0.68], 100], // lab-light-housing
  ['air-diffuser', 'box', [0.6, 0.04, 0.6], 250], // ceiling-diffuser
  ['ceiling-grille', 'box', [1.2, 0.03, 0.3], 250], // ceiling-return
  ['ceiling-grille', 'box', [0.25, 0.03, 0.25], 250], // vent-grille-small
  ['access-panel', 'box', [0.6, 0.015, 0.6], 200], // ceiling-access-panel
  ['cable-tray', 'box', [4.8, 0.28, 0.3], 1000], // cable-tray
  ['coffer-ring', 'cylinder', [8.6, 0.5, 8.6], 2500], // hub-coffer
] as const;

const BUILDERS: Record<string, PropBuilder> = { ...WASHROOM_PROPS, ...CEILING_PROPS };

const finish = (parts: readonly PropPart[], name: PropPart['finish']) => {
  const found = parts.find((p) => p.finish === name);
  expect(found, name).toBeDefined();
  return bounds(found!.geometry);
};

/** Triangles whose winding disagrees with their normals (drawn from the wrong side). */
function backwards(geometry: THREE.BufferGeometry): number {
  const [p, n, index] = [
    geometry.getAttribute('position'),
    geometry.getAttribute('normal'),
    geometry.getIndex()!,
  ];
  const corner = (i: number) => new THREE.Vector3().fromBufferAttribute(p, index.getX(i));
  const normal = (i: number) => new THREE.Vector3().fromBufferAttribute(n, index.getX(i));
  let wrong = 0;
  for (let i = 0; i < index.count; i += 3) {
    const [a, b, c] = [corner(i), corner(i + 1), corner(i + 2)];
    const face = c.sub(b).cross(a.sub(b));
    if (face.lengthSq() < 1e-14) continue; // degenerate (a cone's tip, a ring's seam)
    if (
      face.dot(
        normal(i)
          .add(normal(i + 1))
          .add(normal(i + 2)),
      ) < 0
    )
      wrong++;
  }
  return wrong;
}

describe('washroom and ceiling props', () => {
  it('cover every washroom and ceiling builder', () => {
    expect(new Set(SHIPPED.map(([prop]) => prop))).toEqual(new Set(Object.keys(BUILDERS)));
  });

  describe.each(SHIPPED.flatMap((row) => [1, 0.8].map((scale) => [...row, scale] as const)))(
    '%s (%s %j, ≤ %d triangles) × %d',
    (prop, shape, size, budget, scale) => {
      const scaled = size.map((v) => v * scale);

      it('is sound and inside its box, every face drawn from its outside', () => {
        const parts = BUILDERS[prop]!(scaled);
        expectProp(parts, shape, scaled);
        for (const { finish: name, geometry } of parts) expect(backwards(geometry), name).toBe(0);
      });

      if (scale === 1) {
        it('stays within its triangle budget', () => {
          expect(triangles(BUILDERS[prop]!(size))).toBeLessThanOrEqual(budget);
        });
      }
    },
  );

  it('seat the toilet at 0.4–0.45 m and keep its cistern on the wall (−z)', () => {
    const h = 0.75;
    const seat = finish(WASHROOM_PROPS.toilet([0.4, h, 0.65]), 'seat-white');
    expect(seat.max.y + h / 2).toBeGreaterThan(0.4);
    expect(seat.max.y + h / 2).toBeLessThan(0.45);
    const body = finish(WASHROOM_PROPS.toilet([0.4, h, 0.65]), 'body');
    expect(body.min.z).toBeCloseTo(-0.325, 3);
  });

  it('hang the basin’s rim at 0.83 m, its tap and trap inside its box, nothing on the floor', () => {
    const h = 1;
    const parts = WASHROOM_PROPS['wall-basin']([0.5, h, 0.4]);
    const body = finish(parts, 'body');
    expect(body.max.y + h / 2).toBeCloseTo(0.83, 3);
    expect(body.min.y + h / 2).toBeGreaterThan(0.6); // knee room under it
    expect(finish(parts, 'steel').min.y + h / 2).toBeGreaterThan(0.3); // the trap, off the floor
  });

  it('lay 200 mm tiles from the corner, cut to fit under the edge trim', () => {
    const [w, h] = [0.5, 1.2];
    const parts = WASHROOM_PROPS['tile-wainscot']([w, h, 0.015]);
    const tiles = parts.find((p) => p.finish === 'body')!;
    expect(triangles([tiles]) / 12).toBe(3 * 6); // 0.2 + 0.2 + a 0.1 cut; 6 rows
    expect(finish(parts, 'aluminium').min.y).toBeCloseTo(h / 2 - 0.01, 6);
  });

  it('hang the washroom door’s leaf on one hinge at its +x jamb, its casing fixed', () => {
    const parts = WASHROOM_PROPS['wc-door']([1.24, 2.2, 0.1]);
    const leaf = parts.filter((p) => p.hinge);
    expect(leaf.map((p) => p.finish)).toEqual(['body', 'steel', 'trim']);
    for (const { hinge } of leaf) {
      expect(hinge).toBe(leaf[0]!.hinge); // one leaf
      expect(hinge?.x).toBeCloseTo(0.54, 9);
      expect(hinge?.z).toBeCloseTo(-0.01, 9);
      expect(hinge?.opens).toBe(1);
      expect(Object.keys(hinge ?? {}).sort()).toEqual(['opens', 'x', 'z']);
    }
    const panel = bounds(leaf[0]!.geometry);
    for (const [got, want] of [
      [panel.min.toArray(), [-0.54, -1.09, -0.05]],
      [panel.max.toArray(), [0.54, 1.03, -0.01]],
    ] as const)
      want.forEach((n, i) => expect(got[i]).toBeCloseTo(n, 6));
    expect(finish(leaf, 'steel').min.x).toBeLessThan(-0.45); // the lever, at the free edge
    const casing = bounds(parts.find((p) => p.finish === 'body' && !p.hinge)!.geometry);
    expect(casing.min.x).toBeCloseTo(-0.62, 6);
    expect(casing.min.y).toBeCloseTo(-1.1, 6);
    expect(casing.max.z).toBeCloseTo(0, 6);
  });

  it('keep the hub coffer between the oculus (r 3.3 m) and the pendant’s cable (r 4.5 m)', () => {
    for (const { geometry } of CEILING_PROPS['coffer-ring']([8.6, 0.5, 8.6])) {
      const p = geometry.getAttribute('position');
      let [near, far] = [Infinity, 0];
      for (let i = 0; i < p.count; i++) {
        const r = Math.hypot(p.getX(i), p.getZ(i));
        [near, far] = [Math.min(near, r), Math.max(far, r)];
      }
      expect(near).toBeGreaterThan(3.3);
      expect(far).toBeLessThan(4.5 - 0.08); // the pendant's ceiling cup
    }
  });
});

describe('the tile wainscot on the room skirting (UX3.1)', () => {
  it('starts on top of the skirting, so no tile face shares its plane', async () => {
    // Before: both stood 12 mm off the wall over the skirting's 10 cm, white and dark fighting.
    const { bundledContent } = await import('../../../content');
    const rooms = bundledContent.rooms as { placements: { item: string; position: number[] }[] }[];
    const tiles = rooms
      .flatMap((room) => room.placements)
      .filter((p) => p.item === 'wall-tiles' || p.item === 'wall-tiles-narrow');
    expect(tiles.length).toBeGreaterThan(0);
    for (const p of tiles) expect(p.position[1]).toBeGreaterThanOrEqual(BASEBOARD_H);
  });
});
