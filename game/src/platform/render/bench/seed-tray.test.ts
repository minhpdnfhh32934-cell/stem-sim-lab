import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { seedTray } from './seed-tray';

// The seed tray against its item: each dish's heap is its class's count (a drawn seed for
// ⌈N/160⌉ counted), the pods in the tray go as the seeds are counted, and without a run the
// dishes are empty and the tray full. (Freeing and fitting the room: registry.test.ts,
// apparatusExtents.test.ts.)

const item = ItemDefinitionSchema.parse(
  (bundledContent.items as { id: string }[]).find((i) => i.id === 'seed-tray'),
);
const pose = (offspring: number, sample: Record<string, number>): BenchPose => ({
  status: 'running',
  parameters: { parent1: 11, parent2: 11, offspring, sample: 1 },
  sample,
});
const counts = (yr: number, yw: number, gr: number, gw: number) => ({
  counted: yr + yw + gr + gw,
  yellowRound: yr,
  yellowWrinkled: yw,
  greenRound: gr,
  greenWrinkled: gw,
});

function build() {
  const rig = seedTray.rig!(item);
  const heap = (name: string) => (rig.group.getObjectByName(name) as THREE.InstancedMesh).count;
  return { rig, heap };
}

describe('seed tray', () => {
  it('draws one seed per seed counted up to 160 seeds, the dishes empty and the tray full without a run', () => {
    const { rig, heap } = build();
    rig.pose(pose(16, counts(NaN, NaN, NaN, NaN)), 0);
    expect(['yellowRound', 'greenWrinkled'].map(heap)).toEqual([0, 0]);
    expect(heap('pods')).toBe(40);
    rig.pose(pose(16, counts(9, 3, 3, 1)), 0);
    expect(['yellowRound', 'yellowWrinkled', 'greenRound', 'greenWrinkled'].map(heap)).toEqual([
      9, 3, 3, 1,
    ]);
    expect(heap('pods')).toBe(0); // all 16 counted
  });

  it('draws a seed for every ⌈N/160⌉ counted in a larger cross, and the pods left as counted', () => {
    const { rig, heap } = build();
    // Mendel's own F2, 556 seeds: 4 to a drawn seed.
    rig.pose(pose(556, counts(315, 101, 108, 32)), 0);
    expect(['yellowRound', 'yellowWrinkled', 'greenRound', 'greenWrinkled'].map(heap)).toEqual([
      79, 25, 27, 8,
    ]);
    rig.pose(pose(556, counts(139, 0, 0, 0)), 0);
    expect(heap('pods')).toBe(30); // three quarters still to count
  });
});
