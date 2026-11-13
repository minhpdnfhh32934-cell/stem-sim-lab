import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { pressureTank } from './pressure-tank';

// The pressure tank against its item: the probe goes down with the run, the manometer's columns
// part by its Δh (the probe's side down), the liquid's colour follows the dial.
// (Freeing and fitting the room: registry.test.ts, apparatusExtents.test.ts.)

const item = ItemDefinitionSchema.parse(
  (bundledContent.items as { id: string }[]).find((i) => i.id === 'pressure-tank'),
);
const pose = (liquid: number, probeDepth: number, manometerDifference: number): BenchPose => ({
  status: 'running',
  parameters: { liquid, depth: 0.2, rulerResolution: 0.001 },
  sample: { probeDepth, manometerDifference },
});

function build() {
  const rig = pressureTank.rig!(item);
  const named = (name: string) => rig.group.getObjectByName(name) as THREE.Mesh;
  return { rig, named };
}

describe('pressure tank', () => {
  it('lowers the probe by its depth', () => {
    const { rig, named } = build();
    rig.pose(pose(0, 0, 0), 0);
    const top = named('probe').position.y;
    rig.pose(pose(0, 0.12, 0.12), 0);
    expect(top - named('probe').position.y).toBeCloseTo(0.12, 12);
  });

  it('parts the manometer’s columns by Δh, the probe’s side down', () => {
    const { rig, named } = build();
    rig.pose(pose(0, 0, 0), 0);
    expect(named('left-column').scale.y).toBeCloseTo(named('right-column').scale.y, 12);
    rig.pose(pose(0, 0.2, 0.2), 0);
    expect(named('right-column').scale.y - named('left-column').scale.y).toBeCloseTo(0.2, 12);
  });

  it('shows the dialled liquid', () => {
    const { rig, named } = build();
    rig.pose(pose(0, 0, 0), 0);
    const water = named('liquid').material;
    rig.pose(pose(2, 0, 0), 0);
    expect(named('liquid').material).not.toBe(water);
  });
});
