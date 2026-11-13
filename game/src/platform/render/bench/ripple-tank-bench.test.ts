import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import type { SessionState } from '../../../simulation/ExperimentSession';
import { rippleTankBench } from './ripple-tank-bench';

// The ripple tank against its item: the dippers S1S2 apart, the probe where the run has it, the
// water still without a run and moving with one. (Freeing and fitting the room: registry.test.ts,
// apparatusExtents.test.ts.)

const item = ItemDefinitionSchema.parse(
  (bundledContent.items as { id: string }[]).find((i) => i.id === 'ripple-tank-bench'),
);
const pose = (status: SessionState, d: number, probe = NaN): BenchPose => ({
  status,
  parameters: { frequency: 20, sourceSeparation: d, rulerResolution: 0.001 },
  sample: { probe },
});

function build() {
  const rig = rippleTankBench.rig!(item);
  const named = (name: string) => rig.group.getObjectByName(name) as THREE.Mesh;
  const pixels = () =>
    Array.from(
      ((named('water').material as THREE.MeshBasicMaterial).map as THREE.DataTexture).image
        .data as Uint8Array,
    );
  return { rig, named, pixels };
}

describe('ripple tank bench', () => {
  it('stands the dippers S1S2 apart and the probe where the run has it', () => {
    const { rig, named } = build();
    rig.pose(pose('idle', 0.06), 0);
    expect(named('dipper-2').position.x - named('dipper-1').position.x).toBeCloseTo(0.06, 12);
    rig.pose(pose('running', 0.08, 0.012), 0.01);
    expect(named('dipper-2').position.x - named('dipper-1').position.x).toBeCloseTo(0.08, 12);
    expect(named('probe').position.x).toBeCloseTo(0.012, 12);
  });

  it('keeps the water still without a run, moving with one, still again after', () => {
    const { rig, pixels } = build();
    rig.pose(pose('idle', 0.06), 0);
    const still = pixels();
    expect(new Set(still).size).toBeLessThanOrEqual(4); // one colour (RGBA)
    rig.pose(pose('running', 0.06, 0), 0.01);
    const first = pixels();
    expect(new Set(first).size).toBeGreaterThan(50);
    rig.pose(pose('running', 0.06, 0), 0.2);
    expect(pixels()).not.toEqual(first); // the ripples drift
    rig.pose(pose('completed', 0.06, 0.03), 0);
    expect(pixels()).toEqual(still);
  });
});
