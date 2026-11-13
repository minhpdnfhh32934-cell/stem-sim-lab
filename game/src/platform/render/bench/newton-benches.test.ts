import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { airTrackPulley } from './air-track-pulley';
import { atwoodMachine } from './atwood-machine';
import type { BenchModel } from './registry';

// The air track with its pulley and the Atwood machine against their items: what moves follows the
// run — the glider and the hanging mass by the same distance, gate B at its distance; the two
// Atwood masses opposite ways, the right one never past its pad. (Freeing and fitting the room:
// registry.test.ts, apparatusExtents.test.ts.)

const itemOf = (id: string) =>
  ItemDefinitionSchema.parse((bundledContent.items as { id: string }[]).find((i) => i.id === id));

function build(model: BenchModel, id: string) {
  const item = itemOf(id);
  const painted = new THREE.MeshStandardMaterial();
  const frame = model.frame(item, painted);
  const rig = model.rig!(item);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(frame.body, painted), frame.parts, rig.group);
  const where = (name: string) => {
    root.updateMatrixWorld(true);
    return (root.getObjectByName(name) as THREE.Object3D).getWorldPosition(new THREE.Vector3());
  };
  return { rig, where, root };
}

const pose = (parameters: Record<string, number>, sample: Record<string, number>): BenchPose => ({
  status: 'running',
  parameters,
  sample,
});

describe('air track with pulley', () => {
  const settings = { hangingMass: 0.01, gliderMass: 0.2, gateB: 0.6, timerResolution: 0.001 };

  it('moves the glider along and the hanging mass down by the same distance', () => {
    const { rig, where, root } = build(airTrackPulley, 'air-track-pulley');
    rig.pose(pose(settings, { distance: 0, gateABlocked: 0, gateBBlocked: 0 }), 0);
    const glider = where('glider');
    const hanger = where('hanger');
    expect(where('gate-b').x - where('gate-a').x).toBeCloseTo(0.4, 9);
    rig.pose(pose(settings, { distance: 0.3, gateABlocked: 0, gateBBlocked: 0 }), 1 / 60);
    expect(where('glider').x - glider.x).toBeCloseTo(0.3, 9);
    expect(hanger.y - where('hanger').y).toBeCloseTo(0.3, 9);
    expect((root.getObjectByName('hanger') as THREE.Object3D).visible).toBe(true);
  });

  it('shows no string or hanger with nothing hanging, and the glider’s slotted masses', () => {
    const { rig, root } = build(airTrackPulley, 'air-track-pulley');
    rig.pose(pose({ ...settings, hangingMass: 0, gliderMass: 0.4 }, { distance: 0 }), 0);
    expect((root.getObjectByName('hanger') as THREE.Object3D).visible).toBe(false);
    expect((root.getObjectByName('string-down') as THREE.Object3D).visible).toBe(false);
    expect((root.getObjectByName('glider-mass-1') as THREE.Object3D).visible).toBe(true);
  });
});

describe('Atwood machine', () => {
  const settings = { mass: 0.2, extraMass: 0.02, dropHeight: 0.6, timerResolution: 0.001 };

  it('moves the right mass down and the left up by the fall, never past the pad', () => {
    const { rig, where } = build(atwoodMachine, 'atwood-machine');
    rig.pose(pose(settings, { fall: 0, gateBlocked: 0 }), 0);
    const right = where('mass-right');
    const left = where('mass-left');
    expect(right.y).toBeCloseTo(left.y, 9); // released level
    rig.pose(pose(settings, { fall: 0.25, gateBlocked: 0 }), 1 / 60);
    expect(right.y - where('mass-right').y).toBeCloseTo(0.25, 9);
    expect(where('mass-left').y - left.y).toBeCloseTo(0.25, 9);
    rig.pose(pose(settings, { fall: 0.9, gateBlocked: 0 }), 1 / 60);
    expect(right.y - where('mass-right').y).toBeCloseTo(0.6, 9); // landed on the pad
  });
});
