import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { resonanceRig } from './resonance-rig';

// The resonance rig against its item: the rod follows the motor, the mass its displacement, the
// spring stretched between them; the vane widens with the damping.
// (Freeing and fitting the room: registry.test.ts, apparatusExtents.test.ts.)

const item = ItemDefinitionSchema.parse(
  (bundledContent.items as { id: string }[]).find((i) => i.id === 'resonance-rig'),
);
const pose = (displacement: number, driver: number, dampingRatio = 0.05): BenchPose => ({
  status: 'running',
  parameters: { driveFrequency: 2, dampingRatio, rulerResolution: 0.001 },
  sample: { displacement, driver },
});

function build() {
  const rig = resonanceRig.rig!(item);
  const named = (name: string) => rig.group.getObjectByName(name) as THREE.Mesh;
  return { rig, named };
}

describe('resonance rig', () => {
  it('moves the mass by its displacement and the rod by the driver, the spring between', () => {
    const { rig, named } = build();
    rig.pose(pose(0, 0), 0);
    const rest = named('mass').position.y;
    const length = named('spring').scale.y;
    rig.pose(pose(0.05, 0.01), 0);
    expect(named('mass').position.y - rest).toBeCloseTo(0.05, 12);
    expect(named('spring').scale.y - length).toBeCloseTo(0.01 - 0.05, 12); // shorter by x − driver
    expect(named('rod').position.y - named('spring').position.y).toBeCloseTo(0, 12);
  });

  it('widens the vane with heavier damping', () => {
    const { rig, named } = build();
    rig.pose(pose(0, 0, 0.05), 0);
    const narrow = named('vane').scale.x;
    rig.pose(pose(0, 0, 0.2), 0);
    expect(named('vane').scale.x).toBeGreaterThan(narrow);
  });
});
