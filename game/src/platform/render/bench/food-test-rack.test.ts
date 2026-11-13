import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { COLOURS, TESTS } from '../../../simulation/models/foodTests';
import { foodTestRack } from './food-test-rack';

// The food-test rack against its item: the tube holds the reagent's own colour before a run and
// turns to the outcome as the run develops; Sudan III's red layer shows only on a lipid; the hot
// plate glows while the bath is on. (Freeing and fitting the room: registry.test.ts,
// apparatusExtents.test.ts.)

const item = ItemDefinitionSchema.parse(
  (bundledContent.items as { id: string }[]).find((i) => i.id === 'food-test-rack'),
);
const pose = (test: number, heated: number, colour: number, development: number): BenchPose => ({
  status: 'running',
  parameters: { sample: 0, test, heated },
  sample: { colour, development },
});

function build() {
  const rig = foodTestRack.rig!(item);
  const named = (name: string) => rig.group.getObjectByName(name) as THREE.Mesh;
  const hex = () => (named('liquid').material as THREE.MeshStandardMaterial).color.getHexString();
  return { rig, named, hex };
}

describe('food-test rack', () => {
  it('shows the reagent’s colour without a run, the outcome when developed', () => {
    const { rig, hex } = build();
    rig.pose(pose(TESTS.biuret, 0, NaN, NaN), 0);
    expect(hex()).toBe('5f8fd6');
    rig.pose(pose(TESTS.biuret, 0, COLOURS.violet, 1), 0);
    expect(hex()).toBe('7a3fa0');
    rig.pose(pose(TESTS.biuret, 0, COLOURS.none, 1), 0);
    expect(hex()).toBe('5f8fd6'); // nothing found: the reagent's own colour
  });

  it('takes Benedict’s through green and yellow to brick red', () => {
    const { rig, hex } = build();
    rig.pose(pose(TESTS.benedict, 1, COLOURS.brickRed, 0.25), 0);
    expect(hex()).toBe('4f9e5a');
    rig.pose(pose(TESTS.benedict, 1, COLOURS.brickRed, 0.5), 0);
    expect(hex()).toBe('d6c53a');
    rig.pose(pose(TESTS.benedict, 1, COLOURS.brickRed, 1), 0);
    expect(hex()).toBe('a8401f');
  });

  it('floats a red layer only on a lipid, and glows the hot plate only while the bath is on', () => {
    const { rig, named } = build();
    rig.pose(pose(TESTS.sudan, 0, COLOURS.none, 1), 0);
    expect(named('layer').visible).toBe(false);
    rig.pose(pose(TESTS.sudan, 0, COLOURS.redLayer, 0.5), 0);
    expect(named('layer').visible).toBe(true);
    expect(named('layer').scale.y).toBe(0.5);
    const off = named('ring').material;
    rig.pose(pose(TESTS.sudan, 1, COLOURS.redLayer, 1), 0);
    expect(named('ring').material).not.toBe(off);
  });
});
