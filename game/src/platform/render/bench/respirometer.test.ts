import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { respirometer } from './respirometer';

// The respirometer against its item: the seeds' drop moves towards the tubes by the gas taken up
// (1 mL along the scale's 0.2 m), back to the zero mark without a run; the seeds and the absorber
// look as the desk sets them. (Freeing and fitting the room: registry.test.ts,
// apparatusExtents.test.ts.)

const item = ItemDefinitionSchema.parse(
  (bundledContent.items as { id: string }[]).find((i) => i.id === 'respirometer'),
);
const pose = (seeds: number, absorber: number, gasTakenUp: number): BenchPose => ({
  status: 'running',
  parameters: { seeds, absorber, temperature: 20, pipetteResolution: 0.01 },
  sample: { gasTakenUp },
});

function build() {
  const painted = new THREE.MeshStandardMaterial();
  const frame = respirometer.frame(item, painted);
  const rig = respirometer.rig!(item);
  const named = (name: string) => rig.group.getObjectByName(name) as THREE.Mesh;
  return { frame, rig, named };
}

describe('respirometer', () => {
  it('moves the drop towards the tubes by the gas taken up, back to zero without a run', () => {
    const { rig, named } = build();
    rig.pose(pose(0, 1, 0), 0);
    const zero = named('drop').position.x;
    rig.pose(pose(0, 1, 0.5), 1 / 60);
    expect(named('drop').position.x).toBeCloseTo(zero - 0.1, 12); // 0.5 mL of 1 mL along 0.2 m
    rig.pose(pose(0, 1, NaN), 1 / 60);
    expect(named('drop').position.x).toBeCloseTo(zero, 12);
  });

  it('draws the seeds and the absorber the desk sets', () => {
    const { rig, named } = build();
    const looks = [0, 1, 2].map((seeds) => {
      rig.pose(pose(seeds, 1, 0), 0);
      return named('seeds').material;
    });
    expect(new Set(looks).size).toBe(3);
    rig.pose(pose(0, 0, 0), 0);
    const water = named('absorber').material;
    rig.pose(pose(0, 1, 0), 0);
    expect(named('absorber').material).not.toBe(water);
  });
});
