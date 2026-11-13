import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import items from '../../content/items.json';
import { ItemDefinitionSchema } from '../../gameplay/item';
import { buildTowerCarriage, buildTowerFrame, towerLayout } from './towerModel';

// The free-fall tower against the item it draws and the heights the station can show
// (experiments/free-fall.json: h 0.2–3 m; the ball falls from h to the floor, y = 0): what it frees; that the
// held ball sits on the path under the release head, held by the jaws' pads, the index marking h
// on the scale; that the ball stays on the path while it falls; that the jaws and the lamp follow
// the release; and that nothing that moves meets the frame — sampled at 7 release heights and 6
// points of each fall, not continuously.

const item = ItemDefinitionSchema.parse(items.find((i) => i.id === 'drop-tower'));
const tower = item.dropTower!;
const layout = towerLayout(item, tower);
const { floor, axis, radius: r } = layout;
const RELEASES = [0.2, 0.5, 1, 1.5, 2, 2.5, 3];
/** Points of a fall, as fractions of h: held, just let go, 90 %, half, 10 %, landed. */
const FALL = [1, 0.999, 0.9, 0.5, 0.1, 0];

function build() {
  const painted = new THREE.MeshStandardMaterial();
  const frame = buildTowerFrame(item, tower, painted);
  const carriage = buildTowerCarriage(item, tower);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(frame.body, painted), frame.parts, carriage.group);
  const named = (name: string) => {
    const found = root.getObjectByName(name);
    if (!found) throw new Error(`no ${name}`);
    return found;
  };
  return { frame, carriage, root, painted, named };
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

const meshes = (object: THREE.Object3D, skip: string[] = []) => {
  const found: THREE.Mesh[] = [];
  object.traverse((o) => {
    if (o instanceof THREE.Mesh && !skip.includes(o.name)) found.push(o as THREE.Mesh);
  });
  return found;
};

describe('free-fall tower model', () => {
  it('frees every geometry, material and instance buffer it made, and leaves the entity material', () => {
    const { frame, carriage, root, painted } = build();
    const made = new Set<THREE.EventDispatcher<{ dispose: object }>>();
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        made.add(o.geometry as THREE.BufferGeometry);
        made.add(o.material as THREE.Material);
      }
      if (o instanceof THREE.InstancedMesh) made.add(o);
    });
    // The lamp's other material (released) is not on a mesh now: pose it to find it too.
    carriage.pose(1, 0.5, true);
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) made.add(o.material as THREE.Material);
    });
    made.delete(painted);
    const freed = new Set<unknown>();
    for (const resource of made) resource.addEventListener('dispose', () => freed.add(resource));
    let paintedFreed = false;
    painted.addEventListener('dispose', () => (paintedFreed = true));
    frame.dispose();
    carriage.dispose();
    expect(freed.size).toBe(made.size);
    expect(paintedFreed).toBe(false);
  });

  it('keeps the column within the item’s box, the collider, and the scale reading from the floor', () => {
    const { frame } = build();
    frame.body.computeBoundingBox();
    const [w, h, d] = item.visual.size;
    const box = frame.body.boundingBox!;
    expect(box.min.x).toBeGreaterThanOrEqual(-w / 2);
    expect(box.max.x).toBeLessThanOrEqual(w / 2);
    expect(box.min.z).toBeGreaterThanOrEqual(-d / 2);
    expect(box.max.z).toBeLessThanOrEqual(d / 2);
    expect(box.min.y).toBeGreaterThanOrEqual(-h / 2);
    expect(box.max.y).toBeLessThanOrEqual(h / 2);
    // The scale's 0 is the floor, the ball's path's end; its face just in front of the column's.
    const { center, length } = layout.scale;
    expect(center.y - length / 2).toBeCloseTo(floor, 12);
    expect(center.z).toBeGreaterThan(box.max.z);
    expect(center.z - box.max.z).toBeLessThan(0.005);
  });

  describe.each(RELEASES)('h = %f m', (h) => {
    it('holds the ball on the path under the head, in the jaws, the index at h on the scale', () => {
      const { carriage, root, named } = build();
      carriage.pose(h, h, false);
      root.updateMatrixWorld(true);
      const ball = named('ball').getWorldPosition(new THREE.Vector3());
      expect(ball.x).toBeCloseTo(axis.x, 12);
      expect(ball.z).toBeCloseTo(axis.y, 12);
      expect(ball.y - r - floor).toBeCloseTo(h, 12);
      const head = new THREE.Box3().setFromObject(named('release-head'), true);
      expect(head.min.y - (ball.y + r)).toBeCloseTo(0.004, 9); // just above the ball's top
      expect(head.getCenter(new THREE.Vector3()).x).toBeCloseTo(axis.x, 9);
      expect(head.getCenter(new THREE.Vector3()).z).toBeCloseTo(axis.y, 9);
      // Each pad's top inner edge is on the ball's surface: it holds the ball, below its equator.
      for (const jaw of ['jaw+x', 'jaw-x']) {
        const pad = named(jaw).getObjectByName('pad') as THREE.Mesh;
        const box = new THREE.Box3().setFromObject(pad, true);
        const inner =
          Math.abs(box.min.x - axis.x) < Math.abs(box.max.x - axis.x) ? box.min.x : box.max.x;
        const edge = new THREE.Vector3(inner, box.max.y, axis.y);
        expect(edge.distanceTo(ball)).toBeCloseTo(r, 9);
        expect(box.max.y).toBeLessThan(ball.y);
      }
      // The index's red line at h on the scale, just in front of its face: from its tab, beside
      // the scale's left edge, across the ticks (drawn from that edge), short of the figures.
      const index = new THREE.Box3().setFromObject(named('index'), true);
      expect(index.getCenter(new THREE.Vector3()).y - floor).toBeCloseTo(h, 12);
      const { center, width } = layout.scale;
      const left = center.x - width / 2;
      expect(index.min.x).toBeLessThan(left);
      expect(index.max.x).toBeGreaterThan(left + (28 / 64) * width); // the long ticks' length
      expect(index.max.x).toBeLessThan(center.x + width / 2);
      expect(index.min.z).toBeGreaterThan(center.z);
    });

    it.each(FALL)(
      'at %f of the fall: on the path, clear of everything fixed and of the open clamp',
      (f) => {
        const { carriage, frame, root } = build();
        const y = f * h;
        const released = f < 1;
        carriage.pose(h, y, released);
        root.updateMatrixWorld(true);
        const ball = root.getObjectByName('ball')!;
        const at = ball.getWorldPosition(new THREE.Vector3());
        expect(Number.isFinite(at.x + at.y + at.z)).toBe(true);
        expect(at.x).toBeCloseTo(axis.x, 12);
        expect(at.z).toBeCloseTo(axis.y, 12);
        expect(at.y - r - floor).toBeCloseTo(y, 12);
        const [ballBox] = boxes(ball);
        // Fixed: the frame, the column, the scale's plane. The mat is met only by the landed ball,
        // which rests on the floor through its 2 mm.
        const fixed = [new THREE.Box3().setFromObject(new THREE.Mesh(frame.body), true)];
        for (const m of meshes(frame.parts, y < 0.002 ? ['mat'] : [])) fixed.push(...boxes(m));
        const { center, width, length } = layout.scale;
        const scale = new THREE.Box3(
          new THREE.Vector3(center.x - width / 2, center.y - length / 2, center.z),
          new THREE.Vector3(center.x + width / 2, center.y + length / 2, center.z),
        );
        for (const box of fixed) expect(ballBox!.intersectsBox(box)).toBe(false);
        if (y < 0.002) {
          const [mat] = boxes(root.getObjectByName('mat')!);
          expect(mat!.max.y - ballBox!.min.y).toBeLessThanOrEqual(0.002 + 1e-6); // 2 mm into it
        }
        expect(ballBox!.intersectsBox(scale)).toBe(false);
        // The carriage: clear of the ball once open (held, the pads touch it by design).
        const parts = meshes(root.getObjectByName('carriage')!, released ? [] : ['pad']);
        for (const m of parts)
          for (const box of boxes(m)) expect(box.intersectsBox(ballBox!)).toBe(false);
        // …and of the frame, but for the column and its rail, which the sleeve rides on, and the
        // scale, which it slides over.
        for (const m of meshes(root.getObjectByName('carriage')!))
          for (const box of boxes(m))
            for (const fixedPart of meshes(frame.parts, ['rail']))
              for (const other of boxes(fixedPart)) expect(box.intersectsBox(other)).toBe(false);
      },
    );
  });

  it('opens the jaws and puts out the lamp once released, and closes them again', () => {
    const { carriage, named } = build();
    const lamp = named('lamp') as THREE.Mesh;
    const held = lamp.material;
    carriage.pose(1.5, 1.5, false);
    expect(named('jaw+x').rotation.z).toBe(0);
    expect(named('jaw-x').rotation.z).toBe(0);
    carriage.pose(1.5, 1.2, true);
    expect(named('jaw+x').rotation.z).toBeGreaterThan(0.3);
    expect(named('jaw-x').rotation.z).toBeLessThan(-0.3);
    expect(lamp.material).not.toBe(held);
    const open = lamp.material;
    carriage.pose(1.5, 0, true); // landed: still open
    expect(lamp.material).toBe(open);
    carriage.pose(1.5, 1.5, false); // reset: held again
    expect(named('jaw+x').rotation.z).toBe(0);
    expect(lamp.material).toBe(held);
  });

  it('poses by assignment: the same objects and materials, however often', () => {
    const { carriage, root } = build();
    const count = () => {
      let n = 0;
      const materials = new Set<unknown>();
      root.traverse((o) => {
        n++;
        if (o instanceof THREE.Mesh) materials.add(o.material);
      });
      return { n, materials: materials.size };
    };
    carriage.pose(3, 3, false);
    const before = count();
    for (const h of RELEASES) for (const f of FALL) carriage.pose(h, f * h, f < 1);
    carriage.pose(3, 3, false);
    expect(count()).toEqual(before);
  });
});
