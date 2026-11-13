import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { decayCounterBench } from './decay-counter-bench';
import { boyleSyringe, gasColumn } from './gas-benches';
import { currentBalance, inductionCoil } from './magnet-benches';
import { iceFunnels, joulemeterCalorimeter } from './thermal-benches';

// The grade 12 benches against their items: each rig follows the run's own values at their real
// size. (Freeing and fitting the room: registry.test.ts, apparatusExtents.test.ts.)

const itemOf = (id: string) =>
  ItemDefinitionSchema.parse((bundledContent.items as { id: string }[]).find((i) => i.id === id));
const pose = (
  sample: Record<string, number>,
  parameters: Record<string, number> = {},
): BenchPose => ({
  status: 'running',
  parameters,
  sample,
});
const part = (rig: { group: THREE.Object3D }, name: string) =>
  rig.group.getObjectByName(name) as THREE.Mesh;

describe('grade 12 benches', () => {
  it('raises the calorimeter thermometer with the temperature', () => {
    const rig = joulemeterCalorimeter.rig!(itemOf('joulemeter-calorimeter'));
    rig.pose(pose({ temperature: 20 }), 0);
    const low = part(rig, 'thermometer').scale.y;
    rig.pose(pose({ temperature: 70 }), 0);
    expect(part(rig, 'thermometer').scale.y - low).toBeCloseTo(0.24 * 0.5, 12); // 50 K of 100 over 0.24 m
  });

  it('fills each beaker with its meltwater at its real volume', () => {
    const rig = iceFunnels.rig!(itemOf('ice-funnels'));
    rig.pose(pose({ meltHeated: 0.02, meltControl: 0.003 }), 0);
    const area = Math.PI * 0.028 ** 2;
    expect(part(rig, 'melt-heated').scale.y).toBeCloseTo(0.02 / 1000 / area, 9);
    expect(part(rig, 'melt-control').scale.y).toBeCloseTo(0.003 / 1000 / area, 9);
  });

  it('moves the syringe plunger with the volume and the gauge needle with the pressure', () => {
    const rig = boyleSyringe.rig!(itemOf('boyle-syringe'));
    rig.pose(pose({ volume: 60e-6, pressure: 101325 }), 0);
    const [y60, a1] = [part(rig, 'plunger').position.y, part(rig, 'needle').rotation.z];
    rig.pose(pose({ volume: 30e-6, pressure: 202650 }), 0);
    expect(y60 - part(rig, 'plunger').position.y).toBeCloseTo(30e-6 / (Math.PI * 0.0145 ** 2), 9);
    expect(part(rig, 'needle').rotation.z).toBeLessThan(a1); // further clockwise
  });

  it('moves the index with the air column, 1:1', () => {
    const rig = gasColumn.rig!(itemOf('gas-column'));
    rig.pose(pose({ length: 0.1, temperature: 20 }), 0);
    const y = part(rig, 'index').position.y;
    rig.pose(pose({ length: 0.12, temperature: 80 }), 0);
    expect(part(rig, 'index').position.y - y).toBeCloseTo(0.02, 12);
  });

  it('turns the magnet to the dialled angle and the ammeter with the current', () => {
    const rig = currentBalance.rig!(itemOf('current-balance'));
    rig.pose(pose({ current: 0 }, { angle: 90 }), 0);
    expect(part(rig, 'magnet').rotation.y).toBeCloseTo(0, 12);
    const a0 = part(rig, 'needle').rotation.z;
    rig.pose(pose({ current: 2 }, { angle: 30 }), 0);
    expect(part(rig, 'magnet').rotation.y).toBeCloseTo(Math.PI / 3, 12);
    expect(part(rig, 'needle').rotation.z).toBeLessThan(a0);
  });

  it('carries the magnet along the coil’s axis, turned by the pole first, the needle about zero', () => {
    const rig = inductionCoil.rig!(itemOf('induction-coil'));
    rig.pose(pose({ magnetPosition: -0.1, current: 0 }, { polarity: 1 }), 0);
    expect(part(rig, 'magnet').position.x).toBeCloseTo(-0.1, 12);
    expect(part(rig, 'needle').rotation.z).toBeCloseTo(0, 12); // centre zero
    rig.pose(pose({ magnetPosition: 0.05, current: -0.005 }, { polarity: -1 }), 0);
    expect(part(rig, 'magnet').rotation.y).toBeCloseTo(Math.PI, 12);
    expect(part(rig, 'needle').rotation.z).toBeGreaterThan(0); // the other way
  });

  it('lights the counter’s lamp with the count rate', () => {
    const rig = decayCounterBench.rig!(itemOf('decay-counter'));
    const glow = () => (part(rig, 'lamp').material as THREE.MeshStandardMaterial).emissiveIntensity;
    rig.pose(pose({ countRate: 0 }), 0);
    expect(glow()).toBe(0);
    rig.pose(pose({ countRate: 25 }), 0);
    expect(glow()).toBeCloseTo(0.75, 12);
  });
});
