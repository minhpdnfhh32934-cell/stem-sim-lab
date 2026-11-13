import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { photogateRail } from './photogate-rail';

// The measuring-speed apparatus against its item: the rail tilts to the desk's angle, gate B stands
// at its distance, the ball rolls with the run, the timer's lamps light while a beam is blocked.
// (Freeing and fitting the room: registry.test.ts, apparatusExtents.test.ts.)

const item = ItemDefinitionSchema.parse(
  (bundledContent.items as { id: string }[]).find((i) => i.id === 'photogate-rail'),
);
const pose = (angle: number, gateB: number, sample: Record<string, number>): BenchPose => ({
  status: 'running',
  parameters: { angle, gateB, timerResolution: 0.001 },
  sample,
});

function build() {
  const painted = new THREE.MeshStandardMaterial();
  const frame = photogateRail.frame(item, painted);
  const rig = photogateRail.rig!(item);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(frame.body, painted), frame.parts, rig.group);
  const named = (name: string) => root.getObjectByName(name) as THREE.Object3D;
  return { frame, rig, root, named };
}

describe('photogate rail', () => {
  it('tilts the rail to the angle, high end on the left, and puts gate B at its distance', () => {
    const { rig, root, named } = build();
    rig.pose(pose(10, 0.8, { distance: 0, gateABlocked: 0, gateBBlocked: 0 }), 0);
    expect(named('rail').rotation.z).toBeCloseTo((-10 * Math.PI) / 180, 12);
    root.updateMatrixWorld(true);
    const ball = named('ball').getWorldPosition(new THREE.Vector3());
    const gateA = named('gate-a').getWorldPosition(new THREE.Vector3());
    const gateB = named('gate-b').getWorldPosition(new THREE.Vector3());
    // Down the rail: x grows and y falls from the ball to A to B, 0.3 m and 0.8 m along it.
    expect(gateA.x).toBeGreaterThan(ball.x);
    expect(gateB.x).toBeGreaterThan(gateA.x);
    expect(gateA.y).toBeLessThan(ball.y);
    expect(gateB.distanceTo(gateA)).toBeCloseTo(0.5, 9);
    rig.pose(pose(10, 0.5, { distance: 0, gateABlocked: 0, gateBBlocked: 0 }), 0);
    root.updateMatrixWorld(true);
    expect(named('gate-b').getWorldPosition(new THREE.Vector3()).distanceTo(gateA)).toBeCloseTo(
      0.2,
      9,
    );
  });

  it('rolls the ball down the rail with the run, and lights a lamp while its beam is blocked', () => {
    const { rig, root, named } = build();
    rig.pose(pose(15, 0.8, { distance: 0, gateABlocked: 0, gateBBlocked: 0 }), 0);
    root.updateMatrixWorld(true);
    const start = named('ball').getWorldPosition(new THREE.Vector3());
    const lamps = rig.group.children.filter(
      (c) => c instanceof THREE.Mesh && c.geometry instanceof THREE.SphereGeometry,
    ) as THREE.Mesh[];
    const off = lamps.map((l) => l.material);
    rig.pose(pose(15, 0.8, { distance: 0.3, gateABlocked: 1, gateBBlocked: 0 }), 1 / 60);
    root.updateMatrixWorld(true);
    expect(named('ball').getWorldPosition(new THREE.Vector3()).distanceTo(start)).toBeCloseTo(
      0.3,
      9,
    );
    expect(lamps.map((l, i) => l.material !== off[i])).toEqual([true, false]);
    rig.pose(pose(15, 0.8, { distance: NaN, gateABlocked: NaN, gateBBlocked: NaN }), 1 / 60); // no run
    root.updateMatrixWorld(true);
    expect(named('ball').getWorldPosition(new THREE.Vector3()).distanceTo(start)).toBeCloseTo(0, 9);
    expect(lamps.map((l, i) => l.material !== off[i])).toEqual([false, false]);
  });
});
