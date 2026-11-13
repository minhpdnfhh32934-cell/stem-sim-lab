import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { resonanceTubeRig } from './resonance-tube-rig';

// The resonance tube against its item: the water's surface falls as the column grows, the
// reservoir's surface at the same height. (Freeing and fitting the room: registry.test.ts,
// apparatusExtents.test.ts.)

const item = ItemDefinitionSchema.parse(
  (bundledContent.items as { id: string }[]).find((i) => i.id === 'resonance-tube-rig'),
);
const pose = (column: number): BenchPose => ({
  status: 'running',
  parameters: { frequency: 512, temperature: 20, rulerResolution: 0.001 },
  sample: { column },
});

describe('resonance tube rig', () => {
  it('lowers the water by the column, the reservoir with it', () => {
    const rig = resonanceTubeRig.rig!(item);
    const water = rig.group.getObjectByName('water') as THREE.Mesh;
    const reservoir = rig.group.getObjectByName('reservoir') as THREE.Object3D;
    rig.pose(pose(0.1), 0);
    const [w1, r1] = [water.scale.y, reservoir.position.y];
    rig.pose(pose(0.4), 0);
    expect(w1 - water.scale.y).toBeCloseTo(0.3, 12);
    expect(r1 - reservoir.position.y).toBeCloseTo(0.3, 12);
    // The two surfaces at one height: the tube's water top and the reservoir's centre.
    expect(water.position.y + water.scale.y).toBeCloseTo(reservoir.position.y, 12);
  });
});
