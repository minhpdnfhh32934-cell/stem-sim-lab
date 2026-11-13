import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { leverBalance } from './lever-balance';

// The lever balance against its item: the bar turns with the run's tilt (+: right end down), the
// hangers stand at the dialled distances and hang plumb, each carrying its 50 g slots.
// (Freeing and fitting the room: registry.test.ts, apparatusExtents.test.ts.)

const item = ItemDefinitionSchema.parse(
  (bundledContent.items as { id: string }[]).find((i) => i.id === 'lever-balance'),
);
const pose = (tilt: number, d1 = 0.15, d2 = 0.3, m1 = 0.1, m2 = 0.05): BenchPose => ({
  status: 'running',
  parameters: { mass1: m1, distance1: d1, mass2: m2, distance2: d2 },
  sample: { tilt },
});

function build() {
  const rig = leverBalance.rig!(item);
  const named = (name: string) => rig.group.getObjectByName(name) as THREE.Object3D;
  return { rig, named };
}

describe('lever balance bench', () => {
  it('turns the bar with the tilt, right end down for +', () => {
    const { rig, named } = build();
    rig.pose(pose(10), 0);
    expect(named('bar').rotation.z).toBeCloseTo((-10 * Math.PI) / 180, 12);
    // The right hanger is now lower than the left one.
    expect(named('hanger-2').position.y).toBeLessThan(named('hanger-1').position.y);
  });

  it('hangs each hanger at its distance, its slots for its mass, plumb', () => {
    const { rig, named } = build();
    rig.pose(pose(0, 0.1, 0.25, 0.15, 0.05), 0);
    expect(named('hanger-1').position.x).toBeCloseTo(-0.1, 12);
    expect(named('hanger-2').position.x).toBeCloseTo(0.25, 12);
    expect(named('hanger-1').rotation.z).toBe(0);
    const shown = (name: string) => named(name).children.filter((c) => c.visible).length - 1; // less the rod
    expect(shown('hanger-1')).toBe(3);
    expect(shown('hanger-2')).toBe(1);
  });

  it('draws the bar level without a run', () => {
    const { rig, named } = build();
    rig.pose(pose(NaN), 0);
    expect(named('bar').rotation.z).toBeCloseTo(0, 12);
  });
});
