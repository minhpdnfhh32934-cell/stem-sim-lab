import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { benchFixture } from '../../../game/benchFixture';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { demoBoard } from './demoBoard';

// The reference bench model against the fixture's board (0.4 × 0.03 × 0.3 m, its rig standing on
// top): the board is the item's box, the rig stands at bench.top, the lamp follows the run and the
// gauge the `level` variable, and posing only assigns. (Freeing: registry.test.ts.)

const item = ItemDefinitionSchema.parse(
  (benchFixture().items as { id: string }[]).find((i) => i.id === 'fixture-board'),
);
const [w, h, d] = item.visual.size;
const pose = (status: BenchPose['status'], level: number): BenchPose => ({
  status,
  parameters: {},
  sample: { v: NaN, i: NaN, level },
});

function build() {
  const painted = new THREE.MeshStandardMaterial();
  const frame = demoBoard.frame(item, painted);
  const rig = demoBoard.rig!(item);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(frame.body, painted), frame.parts, rig.group);
  const named = (name: string) => root.getObjectByName(name) as THREE.Mesh;
  return { frame, rig, root, painted, named };
}

describe('demo bench model', () => {
  it('draws the board as the item’s box, the strip and posts on it, the rig at bench.top', () => {
    const { frame, rig, root, painted, named } = build();
    frame.body.computeBoundingBox();
    const box = frame.body.boundingBox!;
    for (const [lo, hi, size] of [
      [box.min.x, box.max.x, w],
      [box.min.y, box.max.y, h],
      [box.min.z, box.max.z, d],
    ] as const) {
      expect(lo).toBeCloseTo(-size / 2, 6);
      expect(hi).toBeCloseTo(size / 2, 6);
    }
    expect(named('strip').material).toBe(painted); // focus shows on it too
    root.updateMatrixWorld(true);
    const parts = new THREE.Box3().setFromObject(frame.parts, true);
    expect(parts.min.y).toBeCloseTo(h / 2, 9); // standing on the board
    // bench.top [0, 0.03, 0] is from the base: in the box's frame, its top face's centre.
    expect(rig.group.position.toArray()).toEqual([0, 0.03 - h / 2, 0]);
  });

  it('lights the lamp while a run is in progress and shows the level on the gauge', () => {
    const { rig, named } = build();
    const lamp = named('lamp');
    const gauge = named('gauge');
    const off = lamp.material;
    expect(gauge.visible).toBe(false); // no run
    rig.pose(pose('running', 0.5), 1 / 60);
    expect(lamp.material).not.toBe(off);
    expect(gauge.visible).toBe(true);
    expect(gauge.scale.y).toBeCloseTo(0.1, 12); // half of its 0.2 m
    rig.pose(pose('completed', 1), 1 / 60);
    expect(lamp.material).toBe(off);
    expect(gauge.scale.y).toBeCloseTo(0.2, 12);
    rig.pose(pose('configured', NaN), 1 / 60); // RESET: no run
    expect(gauge.visible).toBe(false);
  });

  it('poses by assignment: the same objects and materials, however often', () => {
    const { rig, root } = build();
    const count = () => {
      let n = 0;
      const materials = new Set<unknown>();
      root.traverse((o) => {
        n++;
        if (o instanceof THREE.Mesh) materials.add(o.material);
      });
      return { n, materials: materials.size };
    };
    const before = count();
    for (let i = 0; i <= 100; i++) rig.pose(pose(i % 2 ? 'running' : 'stopped', i / 100), 1 / 60);
    rig.pose(pose('configured', NaN), 1 / 60);
    expect(count()).toEqual(before);
  });
});
