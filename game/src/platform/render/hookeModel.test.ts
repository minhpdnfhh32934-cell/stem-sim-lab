import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import items from '../../content/items.json';
import { ItemDefinitionSchema } from '../../gameplay/item';
import { buildSpringFrame, buildSpringHanger, SPRING, springLayout } from './hookeModel';

// The spring stand against the item it draws and the lengths the station can show: from the
// shortest held spring (L₀ + mg/k + y₀ with 0.05 kg, 200 N/m, y₀ −0.1 m: 0.1025 m; RUN refuses it,
// but it is drawn while set) through the natural length and the elastic limit (0.8 m) to a load
// held past it (2 kg on 20 N/m: 1.28 m, refused, still drawn) — sampled, not continuous. What it
// frees; that the spring is a valid, finite coil joined to its loops; that the hanger follows the
// length and the pointer reads the extension on the ruler; that posing reuses its buffers; and
// that nothing that moves meets the frame or the ruler.

const item = ItemDefinitionSchema.parse(items.find((i) => i.id === 'spring-stand'));
const stand = item.springStand!;
const layout = springLayout(item, stand);
const LENGTHS = [0.1025, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.0, 1.28];

function build() {
  const painted = new THREE.MeshStandardMaterial();
  const frame = buildSpringFrame(item, stand, painted);
  const hanger = buildSpringHanger(stand, layout.hook);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(frame.body, painted), frame.parts, hanger.group);
  const named = (name: string) => {
    const found = root.getObjectByName(name);
    if (!found) throw new Error(`no ${name}`);
    return found;
  };
  const coil = named('coil') as THREE.Mesh;
  return { frame, hanger, root, painted, named, coil };
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

/** The coil's first or last ring's centre (the wire's axis there), in world space. */
function ringCentre(coil: THREE.Mesh, last: boolean) {
  const position = coil.geometry.getAttribute('position');
  const first = last ? position.count - SPRING.sides : 0;
  const c = new THREE.Vector3();
  for (let j = 0; j < SPRING.sides; j++)
    c.add(new THREE.Vector3().fromBufferAttribute(position, first + j));
  return coil.localToWorld(c.divideScalar(SPRING.sides));
}

describe('spring stand model', () => {
  it('frees every geometry, material and instance buffer it made, and leaves the entity material', () => {
    const { frame, hanger, root, painted } = build();
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
    hanger.dispose();
    expect(freed.size).toBe(made.size);
    expect(paintedFreed).toBe(false);
  });

  it('keeps the column within the item’s box, the collider', () => {
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
  });

  it('closed, the coil is shorter than the shortest spring it is drawn as', () => {
    const coilAtShortest = (LENGTHS[0] ?? 0) - 2 * SPRING.radius;
    expect(SPRING.turns * 2 * SPRING.wire).toBeLessThan(coilAtShortest);
  });

  describe.each(LENGTHS)('length %f m', (length) => {
    it('is a finite coil with unit normals, joined to its loops, the hanger at its end', () => {
      const { hanger, root, named, coil } = build();
      hanger.pose(length);
      root.updateMatrixWorld(true);
      const position = coil.geometry.getAttribute('position');
      const normal = coil.geometry.getAttribute('normal');
      const index = coil.geometry.getIndex()!;
      for (let i = 0; i < position.count; i++) {
        const p = new THREE.Vector3().fromBufferAttribute(position, i);
        expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
        expect(new THREE.Vector3().fromBufferAttribute(normal, i).length()).toBeCloseTo(1, 5);
      }
      for (let i = 0; i < index.count; i++) expect(index.getX(i)).toBeLessThan(position.count);
      // The hanger at the spring's length below the hook; the coil from loop to loop.
      const at = named('hanger').getWorldPosition(new THREE.Vector3());
      expect(at.x).toBeCloseTo(layout.hook.x, 9);
      expect(layout.hook.y - at.y).toBeCloseTo(length, 9);
      const R = SPRING.radius;
      // Float32 buffers: to a micrometre.
      const top = ringCentre(coil, false);
      const bottom = ringCentre(coil, true);
      expect(top.distanceTo(layout.hook.clone().add(new THREE.Vector3(R, -R, 0)))).toBeLessThan(
        1e-6,
      );
      expect(bottom.distanceTo(at.clone().add(new THREE.Vector3(R, R, 0)))).toBeLessThan(1e-6);
    });

    it('the pointer reads the extension on the ruler', () => {
      const { hanger, root, named } = build();
      hanger.pose(length);
      root.updateMatrixWorld(true);
      const pointer = named('pointer') as THREE.Mesh;
      pointer.geometry.computeBoundingBox();
      const tip = pointer.localToWorld(
        new THREE.Vector3(pointer.geometry.boundingBox!.min.x, 0, 0),
      );
      expect(layout.ruler.zero - tip.y).toBeCloseTo(length - stand.naturalLength, 9);
      // Its tip at the ruler's near edge.
      expect(tip.x).toBeCloseTo(layout.ruler.center.x + layout.ruler.width / 2, 9);
    });

    it('nothing that hangs meets the frame or the ruler', () => {
      const { hanger, frame, root } = build();
      hanger.pose(length);
      root.updateMatrixWorld(true);
      const moving: THREE.Box3[] = [];
      hanger.group.traverse((o) => {
        // The top loop hangs in the eye bolt by design; the pointer touches the ruler (above).
        if (o instanceof THREE.Mesh && o.name !== 'top-loop' && o.name !== 'pointer')
          moving.push(...boxes(o));
      });
      const fixed: THREE.Box3[] = [
        new THREE.Box3().setFromObject(new THREE.Mesh(frame.body), true),
      ];
      frame.parts.traverse((o) => {
        if (o instanceof THREE.Mesh && o.name !== 'eye') fixed.push(...boxes(o));
      });
      const { center, width, length: span } = layout.ruler;
      fixed.push(
        new THREE.Box3(
          new THREE.Vector3(center.x - width / 2, center.y - span / 2, center.z),
          new THREE.Vector3(center.x + width / 2, center.y + span / 2, center.z),
        ),
      );
      for (const m of moving) for (const f of fixed) expect(m.intersectsBox(f)).toBe(false);
    });
  });

  it('poses in place: the same buffers, rewritten only when the length changes', () => {
    const { hanger, root, coil } = build();
    const position = coil.geometry.getAttribute('position') as THREE.BufferAttribute;
    const array = position.array;
    const children = (() => {
      let n = 0;
      root.traverse(() => n++);
      return n;
    })();
    const before = new THREE.Vector3().fromBufferAttribute(position, position.count - 1);
    hanger.pose(0.5);
    const version = position.version;
    const after = new THREE.Vector3().fromBufferAttribute(position, position.count - 1);
    expect(after.y).toBeLessThan(before.y - 0.2); // spread to 0.5 m from 0.2 m
    hanger.pose(0.5);
    expect(position.version).toBe(version); // unchanged: not rewritten
    for (const length of LENGTHS) hanger.pose(length);
    expect(position.array).toBe(array);
    expect(coil.geometry.getAttribute('position')).toBe(position);
    let n = 0;
    root.traverse(() => n++);
    expect(n).toBe(children);
  });
});
