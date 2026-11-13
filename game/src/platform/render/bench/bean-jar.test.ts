import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { beanJar } from './bean-jar';

// The bean jar against its item: the catch is laid on the tray as drawn, R marked beans and
// n − R unmarked, and the tray is empty without a run; nothing of it reads the population's
// hidden size. (Freeing and fitting the room: registry.test.ts, apparatusExtents.test.ts.)

const item = ItemDefinitionSchema.parse(
  (bundledContent.items as { id: string }[]).find((i) => i.id === 'bean-jar'),
);
const pose = (caught: number, recaptured: number): BenchPose => ({
  status: 'running',
  parameters: { marked: 50, caught: 50, sample: 1 },
  sample: { caught, recaptured },
});

describe('bean jar', () => {
  it('lays the catch on the tray: R marked, n − R unmarked; empty without a run', () => {
    const rig = beanJar.rig!(item);
    const count = (name: string) => (rig.group.getObjectByName(name) as THREE.InstancedMesh).count;
    rig.pose(pose(NaN, NaN), 0);
    expect([count('marked'), count('unmarked')]).toEqual([0, 0]);
    rig.pose(pose(37, 6), 0);
    expect([count('marked'), count('unmarked')]).toEqual([6, 31]);
    rig.pose(pose(100, 18), 0);
    expect([count('marked'), count('unmarked')]).toEqual([18, 82]);
  });

  it('never puts two beans on one place', () => {
    const rig = beanJar.rig!(item);
    rig.pose(pose(100, 40), 0);
    const at = (name: string, i: number) =>
      new THREE.Vector3().setFromMatrixPosition(
        (rig.group.getObjectByName(name) as THREE.InstancedMesh).getMatrixAt(
          i,
          new THREE.Matrix4(),
        ),
      );
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++)
      seen.add(
        at('marked', i)
          .toArray()
          .map((v) => v.toFixed(4))
          .join(),
      );
    for (let i = 0; i < 60; i++)
      seen.add(
        at('unmarked', i)
          .toArray()
          .map((v) => v.toFixed(4))
          .join(),
      );
    expect(seen.size).toBe(100);
  });
});
