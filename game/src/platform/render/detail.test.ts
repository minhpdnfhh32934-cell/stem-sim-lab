import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { describe, expect, it } from 'vitest';
import { controlShapes } from './consoleModel';
import { BEVEL_MAX_M, detailed, ModelDetail, withSmallParts } from './detail';
import { part } from './props/parts';
import { QUALITY } from './quality';

// Ultra's model detail: a part is rebuilt only when it is exactly what its parameters make (moved,
// turned a quarter), keeps its size and place, and every original comes back when Ultra is left.

const box = (geometry: THREE.BufferGeometry) => {
  geometry.computeBoundingBox();
  return geometry.boundingBox!;
};
const close = (a: THREE.Box3, b: THREE.Box3) => {
  for (const key of ['x', 'y', 'z'] as const) {
    expect(a.min[key]).toBeCloseTo(b.min[key], 6);
    expect(a.max[key]).toBeCloseTo(b.max[key], 6);
  }
};

describe('which parts are rebuilt', () => {
  it('rounds a box moved and turned by its model, same size, same place', () => {
    const made = new THREE.BoxGeometry(0.4, 0.05, 0.2).rotateX(Math.PI / 2).translate(1, 0.9, -3);
    const out = detailed(made)!;
    expect(out.type).toBe('RoundedBoxGeometry');
    close(box(out), box(made));
    expect(out.getAttribute('position').count).toBeGreaterThan(made.getAttribute('position').count);
  });

  it("rounds a box exactly as three's RoundedBoxGeometry does (its points and normals)", () => {
    const points = (g: THREE.BufferGeometry) => {
      const p = g.getAttribute('position');
      const n = g.getAttribute('normal');
      const out = new Set<string>();
      for (let i = 0; i < p.count; i++) {
        out.add(
          [p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)]
            .map((v) => v.toFixed(5))
            .join(','),
        );
      }
      return [...out].sort();
    };
    const ours = detailed(new THREE.BoxGeometry(0.4, 0.05, 0.2))!;
    const three = new RoundedBoxGeometry(0.4, 0.05, 0.2, 2, BEVEL_MAX_M);
    expect(points(ours)).toEqual(points(three));
    expect(ours.index!.count).toBe(three.getAttribute('position').count); // the same triangles
  });

  it('bevels a fifth of the thinnest side, 8 mm at most', () => {
    const plate = detailed(new THREE.BoxGeometry(0.5, 0.01, 0.5))!;
    expect((plate as unknown as { parameters: { radius: number } }).parameters.radius).toBeCloseTo(
      0.002,
    );
    const bench = detailed(new THREE.BoxGeometry(2, 0.9, 0.8))!;
    expect((bench as unknown as { parameters: { radius: number } }).parameters.radius).toBe(
      BEVEL_MAX_M,
    );
  });

  it('doubles a round part, leaves a faceted one (a hex nut stays six)', () => {
    const rod = detailed(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 32).rotateZ(Math.PI / 2));
    expect((rod as THREE.CylinderGeometry).parameters.radialSegments).toBe(64);
    expect(detailed(new THREE.CylinderGeometry(0.01, 0.01, 0.005, 6))).toBeNull();
    const ball = detailed(new THREE.SphereGeometry(0.02, 24, 16)) as THREE.SphereGeometry;
    expect([ball.parameters.widthSegments, ball.parameters.heightSegments]).toEqual([48, 32]);
    expect(
      (detailed(new THREE.CylinderGeometry(1, 1, 1, 96)) as THREE.CylinderGeometry).parameters
        .radialSegments,
    ).toBe(128);
  });

  it('leaves a part shaped any other way: scaled, bent, unindexed, or a plain buffer', () => {
    expect(detailed(new THREE.BoxGeometry(1, 1, 1).scale(1, 2, 1))).toBeNull();
    const bent = new THREE.BoxGeometry(1, 1, 1);
    bent.getAttribute('position').setY(0, 0.7);
    expect(detailed(bent)).toBeNull();
    expect(detailed(new THREE.BoxGeometry(1, 1, 1).toNonIndexed())).toBeNull();
    expect(detailed(new THREE.BufferGeometry())).toBeNull();
    expect(detailed(new THREE.CylinderGeometry(1, 1, 1, 32).rotateZ(0.3))).toBeNull();
  });
});

describe('merged parts (props, decor, room dressing)', () => {
  it('rebuilds a merge with its boxes bevelled and its faceted and free-form pieces as they were', () => {
    const nut = new THREE.CylinderGeometry(0.01, 0.01, 0.006, 6).translate(0.3, 0.1, 0);
    const blade = new THREE.BufferGeometry();
    blade.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3),
    );
    blade.setAttribute(
      'normal',
      new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3),
    );
    const pieces = [new THREE.BoxGeometry(0.6, 0.9, 0.5).translate(0, 0.45, 0), nut, blade];
    const nutCount = nut.getAttribute('position').count;
    const { geometry } = part('steel', true, pieces);
    const out = detailed(geometry)!;
    expect(out).not.toBeNull();
    close(box(out), box(geometry));
    // The box's vertices became a rounded box's; the nut's and the blade's are still there.
    const before = geometry.getAttribute('position').count;
    expect(out.getAttribute('position').count).toBeGreaterThan(before);
    expect(Object.keys(out.attributes).sort()).toEqual(Object.keys(geometry.attributes).sort());
    const position = out.getAttribute('position');
    const last = position.count - 3; // the blade, last, unchanged
    expect([position.getX(last + 1), position.getY(last + 2)]).toEqual([1, 1]);
    expect(out.index!.count % 3).toBe(0);
    expect(nutCount).toBeGreaterThan(0);
  });

  it('leaves a merge with nothing to round as it is', () => {
    const { geometry } = part('steel', true, [new THREE.CylinderGeometry(0.01, 0.01, 0.01, 6)]);
    expect(detailed(geometry)).toBeNull();
  });
});

describe('small parts only Ultra draws (knurls, screws, vents)', () => {
  it('builds them only when Ultra lays its detail, in the part, on its shape', () => {
    let built = 0;
    const screw = () => {
      built++;
      return [new THREE.CylinderGeometry(0.003, 0.003, 0.002, 12).translate(0, 0.05, 0.1)];
    };
    const plate = withSmallParts(new THREE.BoxGeometry(0.2, 0.1, 0.2), screw);
    const before = plate.getAttribute('position').count;
    expect(built).toBe(0); // High and below: the part as made, nothing extra built
    expect(plate.getAttribute('position').count).toBe(before);
    const out = detailed(plate)!;
    expect(built).toBe(1);
    const rounded = detailed(new THREE.BoxGeometry(0.2, 0.1, 0.2))!;
    // The bevelled box and the screw (made indexed, its uv dropped to match).
    expect(out.getAttribute('position').count).toBeGreaterThan(
      rounded.getAttribute('position').count,
    );
    expect(Object.keys(out.attributes).sort()).toEqual(Object.keys(rounded.attributes).sort());
  });

  it('adds them to a part whose shape stays (a loft, a merge with nothing to round)', () => {
    const { geometry } = part('steel', true, [new THREE.CylinderGeometry(0.01, 0.01, 0.01, 6)]);
    const count = geometry.getAttribute('position').count;
    withSmallParts(geometry, () => [new THREE.BoxGeometry(0.01, 0.01, 0.01)]);
    const out = detailed(geometry)!;
    expect(out.getAttribute('position').count).toBe(count + 24);
    close(box(out), box(geometry));
  });

  it('knurls a knob and gives a desk its vents and plate, under Ultra only', () => {
    const knob = controlShapes('knob', [0.08, 0.05, 0.08]).body;
    const desk = controlShapes('desk', [1.8, 0.85, 0.7]).trim!;
    for (const made of [knob, desk]) {
      const count = made.getAttribute('position').count;
      expect(detailed(made)!.getAttribute('position').count).toBeGreaterThan(count);
    }
    // Inside the item's box: the knob's ridges stand off its grip, not past its skirt.
    close(box(detailed(knob)!), box(knob));
  });
});

describe('laid on models, and taken off', () => {
  const plain = () => new THREE.MeshStandardMaterial();

  it("swaps a mesh's part, once per shared geometry, and puts every original back", () => {
    const shared = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const a = new THREE.Mesh(shared, plain());
    const b = new THREE.Mesh(shared, plain());
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.02, 24), plain());
    const root = new THREE.Group().add(a, b, knob);
    const detail = new ModelDetail();
    detail.adopt(root);
    expect(a.geometry).not.toBe(shared);
    expect(b.geometry).toBe(a.geometry);
    detail.adopt(root); // adopted again: nothing changes
    expect(b.geometry).toBe(a.geometry);
    detail.drop(root);
    expect(a.geometry).toBe(shared);
    expect(b.geometry).toBe(shared);
    expect(knob.geometry.parameters.radialSegments).toBe(24);
  });

  it('builds a scene coming in over the next frames, within a budget, and drops what is queued', () => {
    const shared = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const a = new THREE.Mesh(shared, plain());
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.2), plain());
    const detail = new ModelDetail();
    detail.adoptLater(new THREE.Group().add(a, b));
    expect(a.geometry).toBe(shared); // nothing built yet: the parts as made
    detail.update(0); // at least one a frame, however small the budget
    expect(a.geometry).not.toBe(shared);
    expect(b.geometry.type).toBe('BoxGeometry');
    detail.update(Infinity);
    expect(b.geometry.type).toBe('RoundedBoxGeometry');
    // Built once: another mesh of the same part takes it at once.
    const c = new THREE.Mesh(shared, plain());
    detail.adoptLater(c);
    expect(c.geometry).toBe(a.geometry);
    // Ultra left with parts still queued: none is laid later.
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), plain());
    detail.adoptLater(d);
    detail.drop(new THREE.Group());
    detail.update(Infinity);
    expect(d.geometry.type).toBe('BoxGeometry');
  });

  it('leaves a box with its own picture or several materials (their UV faces would move)', () => {
    const labelled = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
    const label = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.01), labelled);
    const sides = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [plain(), plain()]);
    const detail = new ModelDetail();
    detail.adopt(new THREE.Group().add(label, sides));
    expect(label.geometry.type).toBe('BoxGeometry');
    expect(sides.geometry.type).toBe('BoxGeometry');
  });

  it('frees the detailed part with its original, whichever its owner frees', () => {
    const detail = new ModelDetail();
    const first = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), plain());
    detail.adopt(first);
    let freed = 0;
    first.geometry.addEventListener('dispose', () => freed++);
    const original = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), plain());
    const made = original.geometry;
    detail.adopt(original);
    let originalFreed = 0;
    made.addEventListener('dispose', () => originalFreed++);
    first.geometry.dispose(); // an owner freeing what its mesh holds
    expect(freed).toBe(1);
    original.geometry.dispose();
    expect(originalFreed).toBe(1);
  });

  it('is Ultra only', () => {
    expect(QUALITY.ultra.modelDetail).toBe(true);
    for (const q of ['low', 'medium', 'high'] as const) expect(QUALITY[q].modelDetail).toBe(false);
  });
});
