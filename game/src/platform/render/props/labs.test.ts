import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PROPS } from '../../../gameplay/props';
import { FINISHES } from '../palette';
import { PROP_BUILDERS } from './index';
import { LAB_PROPS } from './labs';
import type { PropPart } from './parts';
import { bounds, EPSILON, expectProp, triangles } from './testing';

// Every laboratory prop at the size its items ship (Z3 §4, Appendix A; the fume hood and the
// microscope at their existing items' sizes), and at 0.8 × that so no detail fits one size only;
// then what each promises in a lab.

/** The labs' props as their items carry them: prop, item shape, size, triangles a copy may draw. */
const SHIPPED = [
  ['lab-island', 'box', [2.4, 0.9, 1.2], 550], // chem- and bio-island-bench
  ['stool', 'cylinder', [0.36, 0.65, 0.36], 600], // lab-stool
  ['wall-bench', 'box', [3, 0.9, 0.7], 400], // bio-wall-bench
  ['wall-bench-sink', 'box', [3, 0.9, 0.7], 600], // chem-wall-bench
  ['wall-bench-sink', 'box', [2, 0.9, 0.6], 600], // bio-sink-bench
  ['tap', 'box', [0.12, 0.35, 0.3], 500], // lab-tap
  ['cabinet-doors', 'box', [1.1, 1.8, 0.6], 120], // chem-cabinet-flammable
  ['cabinet-doors', 'box', [1.1, 1, 0.6], 120], // chem-cabinet-corrosive
  ['cabinet-doors', 'box', [1.2, 0.7, 0.35], 120], // the Physics Lab's wall cabinet (Z3 §4.5)
  ['glassware-shelf', 'box', [1.6, 1.8, 0.4], 2000], // chem-glassware-shelf
  ['safety-shower', 'box', [1, 2.4, 0.5], 1100], // chem-safety-shower
  ['extinguisher', 'cylinder', [0.16, 0.55, 0.16], 650], // fire-extinguisher
  ['microscope', 'box', [0.25, 0.4, 0.3], 800], // microscope, microscope-display
  ['specimen-cabinet', 'box', [1.2, 2, 0.45], 1800], // bio-specimen-cabinet
  ['refrigerator', 'box', [0.7, 1.8, 0.7], 120], // bio-refrigerator
  ['plant-shelf', 'box', [1.4, 1.8, 0.45], 900], // bio-plant-shelf
  ['fume-hood', 'box', [1.5, 2.2, 0.8], 500], // fume-hood
  ['light-switch', 'box', [0.086, 0.086, 0.016], 40], // lab-light-switch
] as const;

const finish = (parts: readonly PropPart[], name: PropPart['finish']) => {
  const found = parts.find((p) => p.finish === name);
  expect(found, name).toBeDefined();
  return found!.geometry;
};

/** The triangles of one part. */
const count = (geometry: THREE.BufferGeometry) => (geometry.getIndex()?.count ?? 0) / 3;

/** A part's vertices. */
function points(geometry: THREE.BufferGeometry): THREE.Vector3[] {
  const position = geometry.getAttribute('position');
  return Array.from({ length: position.count }, (_, i) =>
    new THREE.Vector3().fromBufferAttribute(position, i),
  );
}

/** A part's triangles, as their corners. */
function corners(geometry: THREE.BufferGeometry): THREE.Vector3[][] {
  const at = points(geometry);
  const index = geometry.getIndex()!;
  return Array.from({ length: index.count / 3 }, (_, t) =>
    [0, 1, 2].map((k) => at[index.getX(3 * t + k)]!),
  );
}

/** The highest surface of any part straight above the floor point (x, z), and its finish. */
function topAt(parts: readonly PropPart[], x: number, z: number) {
  let top: { y: number; finish: PropPart['finish'] } | null = null;
  for (const { finish: name, geometry } of parts) {
    for (const [a, b, c] of corners(geometry)) {
      if (!a || !b || !c) continue;
      const det = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
      if (Math.abs(det) < 1e-12) continue; // seen edge-on from above
      const u = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / det;
      const v = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / det;
      if (u < -EPSILON || v < -EPSILON || u + v > 1 + EPSILON) continue;
      const y = u * a.y + v * b.y + (1 - u - v) * c.y;
      if (!top || y > top.y) top = { y, finish: name };
    }
  }
  return top;
}

describe('laboratory props', () => {
  it('cover every lab builder', () => {
    expect(new Set(SHIPPED.map(([prop]) => prop))).toEqual(new Set(Object.keys(LAB_PROPS)));
  });

  it('complete the registry: every prop of the closed list has a builder', () => {
    for (const prop of PROPS) expect(PROP_BUILDERS[prop], prop).toBeDefined();
  });

  describe.each(SHIPPED.flatMap((row) => [1, 0.8].map((scale) => [...row, scale] as const)))(
    '%s (%s %j, ≤ %d triangles) × %d',
    (prop, shape, size, budget, scale) => {
      it('is sound and inside its box', () => {
        const scaled = size.map((v) => v * scale);
        expectProp(LAB_PROPS[prop](scaled), shape, scaled);
      });

      if (scale === 1) {
        it('stays within its triangle budget (copies repeat across a lab)', () => {
          expect(triangles(LAB_PROPS[prop](size))).toBeLessThanOrEqual(budget);
        });
      }
    },
  );

  it('light nothing but the plant shelf’s grow strips: no lamp, display or reading', () => {
    for (const [prop, , size] of SHIPPED) {
      for (const { finish: name } of LAB_PROPS[prop](size)) {
        if (name === 'body') continue;
        const { look, glow = 0 } = FINISHES[name] as { look: string; glow?: number };
        if (look === 'light' || glow > 0)
          expect([prop, name]).toEqual(['plant-shelf', 'glow-cool']);
      }
    }
  });

  it('keep the island’s top clear, with a cup sink in it and cupboards on both sides', () => {
    const [w, h, d] = [2.4, 0.9, 1.2];
    const parts = LAB_PROPS['lab-island']([w, h, d]);
    expect(bounds(finish(parts, 'worktop-epoxy')).max.y).toBeCloseTo(h / 2, 6);
    const cup = topAt(parts, 0.05, 0.05); // beside the drain at its centre
    expect(cup?.finish).toBe('steel'); // the cup sink's bottom, seen through the top
    expect(cup?.y).toBeLessThan(h / 2 - 0.05);
    expect(topAt(parts, 0, 0)?.finish).toBe('trim'); // its drain
    for (const [x, z] of [
      [0.6, 0.3],
      [-0.9, -0.4],
    ] as const) {
      const top = topAt(parts, x, z);
      expect(top?.finish).toBe('worktop-epoxy');
      expect(top?.y).toBeCloseTo(h / 2, 6);
    }
    // Fronts and handles on both long sides: the island is worked from either.
    for (const name of ['body', 'steel'] as const) {
      const box = bounds(finish(parts, name));
      expect(box.min.z).toBeCloseTo(-box.max.z, 6);
    }
  });

  it('put a wall bench’s worktop on its cupboards, its back on the wall', () => {
    for (const prop of ['wall-bench', 'wall-bench-sink'] as const) {
      const [w, h, d] = [3, 0.9, 0.7];
      const parts = LAB_PROPS[prop]([w, h, d]);
      const top = bounds(finish(parts, 'worktop-epoxy'));
      expect([top.max.y, top.min.z, top.max.z]).toEqual([
        expect.closeTo(h / 2, 6),
        expect.closeTo(-d / 2, 6),
        expect.closeTo(d / 2, 6),
      ]);
      const body = bounds(finish(parts, 'body'));
      expect(body.min.z).toBeCloseTo(-d / 2, 6); // against the wall
      expect(body.max.z).toBeLessThan(d / 2 - 0.02); // the fronts under the worktop's edge
      expect(bounds(finish(parts, 'trim')).min.y).toBeCloseTo(-h / 2, 6); // the plinth
    }
    // Without a sink the top is one slab; with one, the bowl shows through it.
    expect(count(finish(LAB_PROPS['wall-bench']([3, 0.9, 0.7]), 'worktop-epoxy'))).toBe(12);
  });

  it('set the sink under the wall tap’s outlet, for both sink benches', () => {
    const [tw, th, td] = [0.12, 0.35, 0.3];
    const tap = LAB_PROPS.tap([tw, th, td]);
    // The outlet: the dark nozzle at the front (the lever is at the back, by the wall).
    const nozzle = points(finish(tap, 'trim')).filter((p) => p.z > 0);
    const [z0, z1] = [Math.min(...nozzle.map((p) => p.z)), Math.max(...nozzle.map((p) => p.z))];
    const fromWall = (z0 + z1) / 2 + td / 2; // the outlet's distance from the wall
    const height = Math.min(...nozzle.map((p) => p.y)) + th / 2; // above the worktop
    expect(fromWall).toBeGreaterThan(0.2);
    expect(height).toBeGreaterThan(0.12); // room for hands and glassware under it
    for (const [w, h, d] of [
      [3, 0.9, 0.7],
      [2, 0.9, 0.6],
    ] as const) {
      const bench = LAB_PROPS['wall-bench-sink']([w, h, d]);
      const under = topAt(bench, 0, -d / 2 + fromWall);
      expect(['steel', 'trim']).toContain(under?.finish); // the bowl or its drain, not the top
      expect(under?.y).toBeLessThan(h / 2 - 0.1);
      expect(topAt(bench, 0, -d / 2 + 0.03)?.finish).toBe('worktop-epoxy'); // behind it
    }
  });

  it('hang two cupboard doors (one if narrow) with handles at hand height', () => {
    const [w, h, d] = [1.1, 1.8, 0.6];
    const parts = LAB_PROPS['cabinet-doors']([w, h, d]);
    const handles = finish(parts, 'steel');
    expect(count(handles)).toBe(24); // two bar handles
    const box = bounds(handles);
    expect((box.min.y + box.max.y) / 2 + h / 2).toBeCloseTo(1.05, 6); // above the floor
    expect(box.max.z).toBeCloseTo(d / 2, 6);
    const narrow = finish(LAB_PROPS['cabinet-doors']([0.5, h, d]), 'steel');
    expect(count(narrow)).toBe(12); // one
  });

  it('shelve the glassware before a dark back, nothing on the top shelf', () => {
    const [w, h, d] = [1.6, 1.8, 0.4];
    const parts = LAB_PROPS['glassware-shelf']([w, h, d]);
    const back = bounds(finish(parts, 'frame-dark'));
    for (const name of ['glass', 'reagent-amber'] as const) {
      const ware = bounds(finish(parts, name));
      expect(ware.min.z).toBeGreaterThan(back.max.z);
      expect(ware.min.y).toBeGreaterThanOrEqual(-h / 2 + 0.08); // on the lowest shelf or above
      expect(ware.max.y).toBeLessThan(h / 2 - 0.1); // under the top shelf
    }
  });

  it('put the shower head overhead and the eyewash bowl at waist height', () => {
    const h = 2.4;
    const steel = points(finish(LAB_PROPS['safety-shower']([1, h, 0.5]), 'steel'));
    const heights = steel.map((p) => p.y + h / 2);
    expect(Math.max(...heights)).toBeGreaterThan(2.1);
    expect(Math.min(...heights.filter((y) => y > 1.5))).toBeGreaterThan(2.0); // the head's rim
    const eyewash = heights.filter((y) => y < 1.5);
    expect(Math.max(...eyewash)).toBeCloseTo(0.98, 6); // its rim
  });

  it('lean the microscope’s eyepiece to the front, its arm at the back', () => {
    const parts = LAB_PROPS.microscope([0.25, 0.4, 0.3]);
    const all = parts.flatMap(({ geometry }) => points(geometry));
    const highest = all.reduce((a, b) => (b.y > a.y ? b : a));
    expect(highest.z).toBeGreaterThan(0.03);
    expect(bounds(finish(parts, 'body')).min.z).toBeLessThan(-0.12);
  });

  it('keep the specimen jars behind the glazed doors', () => {
    const parts = LAB_PROPS['specimen-cabinet']([1.2, 2, 0.45]);
    expect(bounds(finish(parts, 'specimen-fluid')).max.z).toBeLessThan(
      bounds(finish(parts, 'glass')).min.z,
    );
  });

  it('grow the plants under the strips of the shelf above', () => {
    const parts = LAB_PROPS['plant-shelf']([1.4, 1.8, 0.45]);
    const glow = points(finish(parts, 'glow-cool'));
    for (const leaf of points(finish(parts, 'foliage'))) {
      const above = glow.filter((p) => p.y > leaf.y).map((p) => p.y);
      expect(above.length).toBeGreaterThan(0);
      expect(Math.min(...above) - leaf.y).toBeGreaterThan(0.05);
    }
  });

  it('leave the fume hood’s working opening under the sash clear', () => {
    const [w, h, d] = [1.5, 2.2, 0.8];
    const parts = LAB_PROPS['fume-hood']([w, h, d]);
    // From the work surface (0.9 m) to the sash's bottom edge (1.35 m), across the chamber,
    // between the baffle and the front: nothing.
    const open = new THREE.Box3(
      new THREE.Vector3(-0.6, -h / 2 + 0.91, -0.3),
      new THREE.Vector3(0.6, -h / 2 + 1.34, d / 2),
    );
    for (const { finish: name, geometry } of parts) {
      for (const triangle of corners(geometry)) {
        const box = new THREE.Box3().setFromPoints(triangle);
        expect(
          box.min.x < open.max.x &&
            box.max.x > open.min.x &&
            box.min.y < open.max.y &&
            box.max.y > open.min.y &&
            box.min.z < open.max.z &&
            box.max.z > open.min.z,
          `${name} in the opening`,
        ).toBe(false);
      }
    }
    expect(bounds(finish(parts, 'steel')).max.y).toBeCloseTo(h / 2, 6); // the exhaust collar
  });
});
