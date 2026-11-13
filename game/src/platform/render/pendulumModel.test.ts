import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import items from '../../content/items.json';
import { ItemDefinitionSchema } from '../../gameplay/item';
import { buildPendulumFrame, buildPendulumSwing, scaleLayout } from './pendulumModel';

// The pendulum stand against the item it draws and the model's ranges (experiments/pendulum.json: L 0.25–3 m,
// θ₀ −60…60°, and a frictionless swing stays within ±θ₀): what it frees, that the rod joins the
// pivot to the bob's centre, that the bearing parts share the pivot's axis, and that the swing —
// sampled at every 5° for five lengths, not continuously — clears the frame and the scales.

const item = ItemDefinitionSchema.parse(items.find((i) => i.id === 'pendulum-stand'));
const pendulum = item.pendulum!;
const pivotAt = new THREE.Vector3(
  pendulum.pivot[0],
  pendulum.pivot[1] - item.visual.size[1] / 2,
  pendulum.pivot[2],
);
const LENGTHS = [0.25, 0.5, 1, 2, 3];
const ANGLES = Array.from({ length: 25 }, (_, i) => -60 + i * 5);
const DEG = Math.PI / 180;

function build() {
  const painted = new THREE.MeshStandardMaterial();
  const frame = buildPendulumFrame(item, pendulum, painted);
  const swing = buildPendulumSwing(pendulum, pivotAt);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(frame.body, painted), frame.parts, swing.swing);
  const named = (name: string) => {
    const found = root.getObjectByName(name);
    if (!(found instanceof THREE.Mesh)) throw new Error(`no ${name}`);
    return found;
  };
  return { frame, swing, root, painted, named };
}

/** World boxes of a mesh: one per copy for an instanced part, else one. */
function boxes(object: THREE.Object3D): THREE.Box3[] {
  const mesh = object as THREE.Mesh;
  const geometry = mesh.geometry;
  geometry.computeBoundingBox();
  const local = geometry.boundingBox ?? new THREE.Box3();
  if (!(mesh instanceof THREE.InstancedMesh)) return [new THREE.Box3().setFromObject(mesh, true)];
  return Array.from({ length: mesh.count }, (_, i) => {
    const m = new THREE.Matrix4();
    mesh.getMatrixAt(i, m);
    return local.clone().applyMatrix4(m.premultiply(mesh.matrixWorld));
  });
}

describe('pendulum model', () => {
  it('frees every geometry, material and instance buffer it made, and leaves the entity material', () => {
    const { frame, swing, root, painted } = build();
    const made = new Set<THREE.EventDispatcher<{ dispose: object }>>();
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        made.add(o.geometry as THREE.BufferGeometry);
        made.add(o.material as THREE.Material);
      }
      if (o instanceof THREE.InstancedMesh) made.add(o);
    });
    made.delete(painted);
    const freed = new Set<unknown>();
    for (const resource of made) resource.addEventListener('dispose', () => freed.add(resource));
    let paintedFreed = false;
    painted.addEventListener('dispose', () => (paintedFreed = true));
    frame.dispose();
    swing.dispose();
    expect(freed.size).toBe(made.size);
    expect(paintedFreed).toBe(false);
  });

  it('carries the axle, its nuts, the hangers and the hub on the pivot’s own axis', () => {
    const { root, named } = build();
    root.updateMatrixWorld(true);
    for (const name of ['axle', 'hub']) {
      const p = named(name).getWorldPosition(new THREE.Vector3());
      expect(p.x).toBeCloseTo(pivotAt.x, 9);
      expect(p.y).toBeCloseTo(pivotAt.y, 9);
    }
    // Instance transforms are stored in float32: centred to a micrometre.
    for (const box of boxes(named('nuts'))) {
      const c = box.getCenter(new THREE.Vector3());
      expect(c.x).toBeCloseTo(pivotAt.x, 6);
      expect(c.y).toBeCloseTo(pivotAt.y, 6);
    }
    // A hanger's round end is drawn about its own origin: each copy's origin is the pivot.
    const hangers = named('hangers') as THREE.InstancedMesh;
    for (let i = 0; i < hangers.count; i++) {
      const m = new THREE.Matrix4();
      hangers.getMatrixAt(i, m);
      const o = new THREE.Vector3().setFromMatrixPosition(m.premultiply(hangers.matrixWorld));
      expect(o.x).toBeCloseTo(pivotAt.x, 6);
      expect(o.y).toBeCloseTo(pivotAt.y, 6);
    }
  });

  describe.each(LENGTHS)('L = %f m', (length) => {
    it.each(ANGLES)('at %i° the rod joins the pivot to the bob’s centre', (deg) => {
      const { swing, root, named } = build();
      swing.pose(length, deg * DEG);
      root.updateMatrixWorld(true);
      const rod = named('rod');
      const top = rod.localToWorld(new THREE.Vector3(0, 0, 0));
      const end = rod.localToWorld(new THREE.Vector3(0, -1, 0));
      const bob = named('bob').getWorldPosition(new THREE.Vector3());
      expect(top.distanceTo(pivotAt)).toBeLessThan(1e-9);
      expect(end.distanceTo(bob)).toBeLessThan(1e-9);
      expect(bob.distanceTo(pivotAt)).toBeCloseTo(length, 9);
      expect(bob.x - pivotAt.x).toBeCloseTo(length * Math.sin(deg * DEG), 9);
    });

    it.each(ANGLES)('at %i° the swing clears the frame and the scales', (deg) => {
      const { swing, frame, root } = build();
      swing.pose(length, deg * DEG);
      root.updateMatrixWorld(true);
      const moving: THREE.Box3[] = [];
      swing.swing.traverse((o) => {
        // The hub turns on the axle (it shares its axis by design); everything below it must clear.
        if (o instanceof THREE.Mesh && o.name !== 'hub') moving.push(...boxes(o));
      });
      const fixed: THREE.Box3[] = [
        new THREE.Box3().setFromObject(new THREE.Mesh(frame.body), true),
      ];
      frame.parts.traverse((o) => {
        if (o instanceof THREE.Mesh && o.name !== 'axle') fixed.push(...boxes(o));
      });
      const layout = scaleLayout(item, pendulum);
      const plane = (center: THREE.Vector3, width: number, height: number) =>
        new THREE.Box3(
          new THREE.Vector3(center.x - width / 2, center.y - height / 2, center.z),
          new THREE.Vector3(center.x + width / 2, center.y + height / 2, center.z),
        );
      fixed.push(
        plane(layout.protractor.center, layout.protractor.width, layout.protractor.height),
        plane(layout.ruler.center, layout.ruler.width, layout.ruler.length),
      );
      for (const m of moving) for (const f of fixed) expect(m.intersectsBox(f)).toBe(false);
    });
  });
});
