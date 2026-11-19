import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CeilingBreach } from './breach';
import { Helicopter } from './helicopter';
import responders from '../../../content/responders.json';
import { ResponderSquadSchema } from '../../../gameplay/emergency/squad';

// The hub's ceiling blown open and mended (Phú 2026-11-13): the slab swapped for one with a hole
// where the squad comes in, the debris falling and lying on the floor, the hole closing from its
// edge, and the slab back once it is whole; the helicopter built in its livery, posed and freed.

const H = 1 / 60;
const SKY = new THREE.Color('#eaf2fb');

/** A hub-like ceiling: 26 × 18 m, 0.2 m thick, its underside at 9 m. */
function hall() {
  const rooms = new THREE.Group();
  const material = new THREE.MeshStandardMaterial();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(26, 0.2, 18), material);
  slab.position.set(0, 9.1, -3);
  slab.userData = { part: 'ceiling', roomId: 'simlab-hub' };
  rooms.add(slab);
  return { rooms, slab, material };
}

describe('CeilingBreach', () => {
  it('opens a jagged hole in the slab, lets the debris fall and lie on the floor, and mends', () => {
    const { rooms, slab, material } = hall();
    const breach = new CeilingBreach(() => 'medium');
    breach.open(slab, 0, -3, 3.6);
    expect(slab.visible).toBe(false);
    expect(breach.opened(slab)).toBe(true);
    const holed = rooms.getObjectByName('ceiling-breached') as THREE.Mesh;
    expect(holed).toBeDefined();
    // Its faces wear the ceiling's own material; its underside where the slab's was.
    expect((holed.material as THREE.Material[])[0]).toBe(material);
    holed.geometry.computeBoundingBox();
    const box = holed.geometry.boundingBox!;
    expect(box.min.y + holed.position.y).toBeCloseTo(9, 5);
    expect(box.max.x - box.min.x).toBeCloseTo(26, 5);
    // The hole: nothing of the slab over its middle (a ray up through it meets no face).
    const up = new THREE.Raycaster(new THREE.Vector3(0, 5, -3), new THREE.Vector3(0, 1, 0));
    rooms.updateMatrixWorld(true);
    expect(up.intersectObject(holed).length).toBe(0);
    const aside = new THREE.Raycaster(new THREE.Vector3(8, 5, -3), new THREE.Vector3(0, 1, 0));
    expect(aside.intersectObject(holed).length).toBeGreaterThan(0);

    // The blast: debris falls and comes to rest on the floor (y 0) within a few seconds.
    let blast = 0;
    for (let i = 0; i < 6 / H; i++) {
      breach.update(H, i * H, 1, blast, 0, SKY, 1, 1, 720, 70);
      blast += H;
    }
    const debris = breach.group.children.find(
      (o): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh,
    )!;
    expect(debris.visible).toBe(true);
    expect(debris.count).toBe(64);
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    for (let i = 0; i < debris.count; i++) {
      debris.getMatrixAt(i, m);
      p.setFromMatrixPosition(m);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThan(0.4); // lying on the floor, not hanging in the air
    }

    // Mending: the patch shows, closing in; the slab back once whole.
    breach.update(H, 7, 0.5, 7, 0, SKY, 1, 0, 720, 70);
    const patch = rooms.getObjectByName('ceiling-mending') as THREE.Mesh;
    expect(patch.visible).toBe(true);
    breach.update(H, 8, 0.01, 8, 0, SKY, 1, 0, 720, 70);
    // Nearly closed: a ray up through the hole, half a metre off its middle, meets the patch.
    const near = new THREE.Raycaster(new THREE.Vector3(0.5, 5, -3), new THREE.Vector3(0, 1, 0));
    expect(near.intersectObject(patch).length).toBeGreaterThan(0);
    breach.close();
    expect(slab.visible).toBe(true);
    expect(rooms.getObjectByName('ceiling-breached')).toBeUndefined();
    expect(rooms.getObjectByName('ceiling-mending')).toBeUndefined();
    breach.dispose();
  });

  it('builds each squad’s helicopter, turns its rotor, and frees it', () => {
    const squads = ResponderSquadSchema.array().parse(responders);
    expect(squads.length).toBeGreaterThanOrEqual(2);
    for (const squad of squads) {
      const heli = new Helicopter(squad);
      const view = { visible: true, x: 0, y: 14, z: -3, yaw: 0.3, bank: 0, pitch: 0, rotor: 1 };
      heli.update(view, 0, 0, 0, H, 0, 1);
      expect(heli.group.visible).toBe(true);
      expect(heli.group.position.toArray()).toEqual([0, 14, -3]);
      expect(heli.group.rotation.y).toBeCloseTo(0.3, 6);
      const rotor = heli.group.children[0]?.children.find(
        (o) => o instanceof THREE.Group && o.children.length >= 3,
      );
      const before = rotor?.rotation.y ?? 0;
      heli.update(view, 0, 0, 0, 0.1, 0.1, 1);
      expect(rotor?.rotation.y).not.toBe(before);
      // Nothing of it casts a shadow (it moves every frame).
      heli.group.traverse((o) => expect(o.castShadow).toBe(false));
      heli.dispose();
      expect(heli.group.parent).toBeNull();
    }
  });
});
