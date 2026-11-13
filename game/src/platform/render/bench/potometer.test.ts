import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { potometer } from './potometer';

// The potometer against its item: the bubble moves towards the shoot by the run's distance, the
// lamp lights with the light set at the desk, the fan turns only when it is on. (Freeing and
// fitting the room: registry.test.ts, apparatusExtents.test.ts.)

const item = ItemDefinitionSchema.parse(
  (bundledContent.items as { id: string }[]).find((i) => i.id === 'potometer'),
);
const pose = (illuminance: number, airSpeed: number, distance: number): BenchPose => ({
  status: 'running',
  parameters: { illuminance, humidity: 50, airSpeed, scaleResolution: 0.001 },
  sample: { distance },
});

function build() {
  const painted = new THREE.MeshStandardMaterial();
  const frame = potometer.frame(item, painted);
  const rig = potometer.rig!(item);
  const named = (name: string) => rig.group.getObjectByName(name) as THREE.Mesh;
  return { frame, rig, named };
}

describe('potometer', () => {
  it('moves the bubble towards the shoot by the distance, back to the scale’s zero without a run', () => {
    const { rig, named } = build();
    rig.pose(pose(10000, 0.1, 0), 0);
    const zero = named('bubble').position.x;
    rig.pose(pose(10000, 0.1, 0.05), 1 / 60);
    expect(named('bubble').position.x).toBeCloseTo(zero - 0.05, 12); // the shoot is to the left
    rig.pose(pose(10000, 0.1, NaN), 1 / 60);
    expect(named('bubble').position.x).toBeCloseTo(zero, 12);
  });

  it('lights the lamp with the light set, dark at 0 lux', () => {
    const { rig, named } = build();
    rig.pose(pose(0, 0.1, 0), 0);
    const dark = named('bulb').material;
    rig.pose(pose(20000, 0.1, 0), 0);
    expect(named('bulb').material).not.toBe(dark);
    rig.pose(pose(0, 0.1, 0), 0);
    expect(named('bulb').material).toBe(dark);
  });

  it('turns the fan only when it is on', () => {
    const { rig } = build();
    const blades = rig.group.getObjectByName('fan')!.children[0]!;
    rig.pose(pose(0, 0.1, 0), 0.5);
    expect(blades.rotation.z).toBe(0);
    rig.pose(pose(0, 3, 0), 0.5);
    expect(blades.rotation.z).toBeGreaterThan(0);
  });
});
