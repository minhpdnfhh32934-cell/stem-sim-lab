import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { forceBoard } from './force-board';

// The force board against its item: balance 1 along +x, balance 2 at the dialled angle, balance 3
// opposite the resultant; the indicators at the readings; the ring at its offset during a run.
// (Freeing and fitting the room: registry.test.ts, apparatusExtents.test.ts.)

const item = ItemDefinitionSchema.parse(
  (bundledContent.items as { id: string }[]).find((i) => i.id === 'force-board'),
);
const pose = (
  f1: number,
  f2: number,
  angle: number,
  sample: Record<string, number>,
): BenchPose => ({
  status: 'running',
  parameters: { force1: f1, force2: f2, angle, balanceResolution: 0.1 },
  sample,
});
const none = { offset: NaN, reading1: NaN, reading2: NaN, reading3: NaN };

function build() {
  const rig = forceBoard.rig!(item);
  const named = (name: string) => rig.group.getObjectByName(name) as THREE.Object3D;
  return { rig, named };
}

describe('force board', () => {
  it('turns balance 2 to the angle and balance 3 opposite the resultant', () => {
    const { rig, named } = build();
    rig.pose(pose(3, 4, 90, none), 0);
    expect(named('balance-1').rotation.z).toBe(0);
    expect(named('balance-2').rotation.z).toBeCloseTo(Math.PI / 2, 12);
    expect(named('balance-3').rotation.z).toBeCloseTo(Math.atan2(4, 3) + Math.PI, 12);
  });

  it('stands each indicator at its reading: further along the barrel for a smaller force', () => {
    const { rig, named } = build();
    rig.pose(pose(3, 4, 90, { offset: 0, reading1: 3, reading2: 4, reading3: 5 }), 0);
    const x = (i: number) => named(`indicator-${i}`).position.x;
    expect(x(1)).toBeGreaterThan(x(2));
    expect(x(2)).toBeGreaterThan(x(3));
  });

  it('moves the ring towards balance 3 by the offset, and back to the mark', () => {
    const { rig, named } = build();
    rig.pose(pose(3, 4, 90, { offset: 0, reading1: 3, reading2: 4, reading3: 5 }), 0);
    const mark = named('ring').position.clone();
    rig.pose(pose(3, 4, 90, { offset: 0.01, reading1: 3, reading2: 4, reading3: 4.5 }), 0);
    expect(named('ring').position.distanceTo(mark)).toBeCloseTo(0.01, 12);
    rig.pose(pose(3, 4, 90, none), 0);
    expect(named('ring').position.distanceTo(mark)).toBeCloseTo(0, 12);
  });
});
