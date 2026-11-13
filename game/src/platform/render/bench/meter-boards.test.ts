import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { cellBoard, rcBoard } from './meter-boards';

// The meter boards against their items: each needle turns with its reading (the RC ammeter about
// a centre zero), the switch's lever with its position. (Freeing and fitting the room:
// registry.test.ts, apparatusExtents.test.ts.)

const itemOf = (id: string) =>
  ItemDefinitionSchema.parse((bundledContent.items as { id: string }[]).find((i) => i.id === id));
const pose = (sample: Record<string, number>): BenchPose => ({
  status: 'running',
  parameters: {},
  sample,
});

describe('meter boards', () => {
  it('turns the RC board’s needles: the voltmeter from its left end, the ammeter about its centre', () => {
    const rig = rcBoard.rig!(itemOf('rc-board'));
    const turn = (name: string) => (rig.group.getObjectByName(name) as THREE.Object3D).rotation.z;
    rig.pose(pose({ voltage: 0, current: 0, switchPosition: 1 }), 0);
    const [v0, a0] = [turn('voltmeter'), turn('ammeter')];
    expect(a0).toBeCloseTo(0, 12); // centre zero: upright at no current
    rig.pose(pose({ voltage: 5, current: -0.005, switchPosition: -1 }), 0);
    expect(turn('voltmeter')).toBeLessThan(v0); // further right (clockwise)
    expect(turn('ammeter')).toBeGreaterThan(0); // reversed current: to the left
    expect(turn('lever')).toBeGreaterThan(0);
  });

  it('turns the cell board’s needles from their left ends', () => {
    const rig = cellBoard.rig!(itemOf('cell-board'));
    const turn = (name: string) => (rig.group.getObjectByName(name) as THREE.Object3D).rotation.z;
    rig.pose(pose({ voltage: 1.5, current: 0, switch: 0 }), 0);
    const a0 = turn('ammeter');
    rig.pose(pose({ voltage: 1.3, current: 0.65, switch: 1 }), 0);
    expect(turn('ammeter')).toBeLessThan(a0);
  });
});
