import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { doubleSlitBench } from './double-slit-bench';

// The double-slit bench against its item: the screen at D beyond the slits, the fringes at their
// real spacing λD/a, brightest in the middle, the light's colour with λ, the sensor at its position.
// (Freeing and fitting the room: registry.test.ts, apparatusExtents.test.ts.)

const item = ItemDefinitionSchema.parse(
  (bundledContent.items as { id: string }[]).find((i) => i.id === 'double-slit-bench'),
);
const pose = (wavelength: number, D: number, sensor = NaN): BenchPose => ({
  status: 'running',
  parameters: { wavelength, slitSeparation: 0.3e-3, screenDistance: D, rulerResolution: 0.001 },
  sample: { sensor },
});

function build() {
  const rig = doubleSlitBench.rig!(item);
  const named = (name: string) => rig.group.getObjectByName(name) as THREE.Object3D;
  return { rig, named };
}

describe('double-slit bench', () => {
  it('stands the screen D beyond the slits and spaces the fringes λD/a', () => {
    const { rig, named } = build();
    rig.pose(pose(650e-9, 1), 0);
    const at1 = named('screen').position.x;
    rig.pose(pose(650e-9, 1.5), 0);
    expect(named('screen').position.x - at1).toBeCloseTo(0.5, 12);
    const fringes = named('fringes') as THREE.InstancedMesh;
    const m = new THREE.Matrix4();
    const z = (k: number) => {
      fringes.getMatrixAt(k, m);
      return new THREE.Vector3().setFromMatrixPosition(m).z;
    };
    expect(z(21) - z(20)).toBeCloseTo((650e-9 * 1.5) / 0.3e-3, 9);
    expect(z(20)).toBeCloseTo(0, 12); // the central fringe
  });

  it('draws the light in the laser’s colour and the sensor where it is', () => {
    const { rig, named } = build();
    rig.pose(pose(650e-9, 1, 0.004), 0);
    const red = (named('fringes') as THREE.Mesh).material;
    expect(named('sensor').position.z).toBeCloseTo(0.004, 12);
    rig.pose(pose(532e-9, 1, 0.004), 0);
    expect((named('fringes') as THREE.Mesh).material).not.toBe(red);
  });
});
