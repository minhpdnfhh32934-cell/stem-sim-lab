import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import items from '../../content/items.json';
import { ItemDefinitionSchema } from '../../gameplay/item';
import { buildLauncher } from './launcherModel';

// The launcher model against the item it draws: what it frees, how the barrel swings over the
// simulated 0–90°, that nothing it draws stands in the ball's way, and that the pointer reads the
// angle on its scale.

const item = ItemDefinitionSchema.parse(items.find((i) => i.id === 'projectile-launcher'));
const launcher = item.launcher!;
const BALL = 0.03; // the projectile ball's radius (items.json: 60 mm)
const ANGLES = Array.from({ length: 19 }, (_, i) => i * 5);

function model() {
  const painted = new THREE.MeshStandardMaterial();
  const built = buildLauncher(item, launcher, painted);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(built.body, painted), built.parts, built.pivot);
  const named = (name: string) => {
    const found = root.getObjectByName(name);
    if (!(found instanceof THREE.Mesh)) throw new Error(`no ${name}`);
    return found;
  };
  const turn = (deg: number) => {
    built.pivot.rotation.z = (deg * Math.PI) / 180;
    root.updateMatrixWorld(true);
  };
  return { built, root, painted, named, turn };
}

describe('launcher model', () => {
  it('frees every geometry, material and instance buffer it made, and leaves the entity material to its owner', () => {
    const { built, root, painted } = model();
    const made = new Set<THREE.EventDispatcher<{ dispose: object }>>();
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        made.add(o.geometry as THREE.BufferGeometry);
        made.add(o.material as THREE.Material);
      }
      // A repeated part's transforms are a GPU buffer of their own (the e2e probe saw them stay).
      if (o instanceof THREE.InstancedMesh) made.add(o);
    });
    made.delete(painted);
    const freed = new Set<unknown>();
    for (const resource of made) resource.addEventListener('dispose', () => freed.add(resource));
    let paintedFreed = false;
    painted.addEventListener('dispose', () => (paintedFreed = true));
    built.dispose();
    expect(freed.size).toBe(made.size);
    expect(paintedFreed).toBe(false);
  });

  it.each(ANGLES)('at %i° the barrel swings between the cheeks, clear of the flange', (deg) => {
    const { named, turn } = model();
    turn(deg);
    const barrel = new THREE.Box3();
    for (const part of ['barrel', 'rod', 'rod-knob'])
      barrel.union(new THREE.Box3().setFromObject(named(part), true));
    const flange = new THREE.Box3().setFromObject(named('flange'), true);
    const cheeks = [named('cheek-near'), named('cheek-far')].map((c) =>
      new THREE.Box3().setFromObject(c, true),
    );
    expect(barrel.min.y).toBeGreaterThan(flange.max.y);
    for (const cheek of cheeks) expect(barrel.intersectsBox(cheek)).toBe(false);
  });

  it.each(ANGLES)('at %i° nothing it draws stands in the ball path past the muzzle', (deg) => {
    const { root, turn, built } = model();
    turn(deg);
    const t = (deg * Math.PI) / 180;
    const start = built.pivot.position;
    const boxes: THREE.Box3[] = [];
    root.traverse((o) => {
      // The muzzle block and its bore are the path's start; the pivot's own parts move with it.
      if (
        o instanceof THREE.Mesh &&
        !(o instanceof THREE.InstancedMesh) &&
        o.parent !== built.pivot
      )
        boxes.push(new THREE.Box3().setFromObject(o, true));
    });
    for (let s = 0.04; s <= 0.6; s += 0.01) {
      const p = new THREE.Vector3(start.x + s * Math.cos(t), start.y + s * Math.sin(t), start.z);
      for (const box of boxes) expect(box.distanceToPoint(p)).toBeGreaterThan(BALL);
    }
  });

  it.each(ANGLES)('at %i° the pointer lies on the scale’s tick for that angle', (deg) => {
    const { named, turn, built } = model();
    turn(deg);
    const tip = named('pointer').localToWorld(new THREE.Vector3(-0.07, 0, 0));
    const pointing = tip.sub(built.pivot.position).setZ(0).normalize();
    const t = (deg * Math.PI) / 180;
    expect(pointing.x).toBeCloseTo(-Math.cos(t), 6);
    expect(pointing.y).toBeCloseTo(-Math.sin(t), 6);
    // The scale has a tick in exactly that direction (each tick is one quad: four vertices).
    const ticks = (named('ticks').geometry as THREE.BufferGeometry).getAttribute('position');
    const directions = Array.from({ length: ticks.count / 4 }, (_, i) => {
      const centre = new THREE.Vector2();
      for (let k = 0; k < 4; k++)
        centre.add(new THREE.Vector2(ticks.getX(4 * i + k), ticks.getY(4 * i + k)));
      return centre.normalize();
    });
    const on = directions.filter(
      (v) => Math.abs(v.x + Math.cos(t)) < 1e-6 && Math.abs(v.y + Math.sin(t)) < 1e-6,
    );
    expect(on).toHaveLength(1);
  });
});
