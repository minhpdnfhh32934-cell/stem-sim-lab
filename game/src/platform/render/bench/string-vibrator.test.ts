import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { stringVibrator } from './string-vibrator';

// The string vibrator against its item: the string's band has n loops at the run's amplitude, its
// ends and nodes still; the hanging masses follow the dial.
// (Freeing and fitting the room: registry.test.ts, apparatusExtents.test.ts.)

const item = ItemDefinitionSchema.parse(
  (bundledContent.items as { id: string }[]).find((i) => i.id === 'string-vibrator'),
);
const pose = (loops: number, amplitude: number, hangingMass = 0.1): BenchPose => ({
  status: 'running',
  parameters: { loops, hangingMass, frequencyResolution: 0.1 },
  sample: { amplitude },
});

/** The band's half-height at each column, from its top vertices. */
function profile(band: THREE.Mesh): number[] {
  const p = band.geometry.getAttribute('position');
  const out: number[] = [];
  for (let i = 0; i < p.count; i += 2) out.push(p.getY(i));
  return out;
}

describe('string vibrator', () => {
  it('draws n loops at the amplitude: largest at the antinodes, still at the ends and nodes', () => {
    const rig = stringVibrator.rig!(item);
    const band = rig.group.getObjectByName('string') as THREE.Mesh;
    rig.pose(pose(2, 0.01), 0);
    const h = profile(band);
    const last = h.length - 1;
    expect(h[0]).toBeLessThan(0.001);
    expect(h[last / 2]).toBeLessThan(0.001); // the middle is a node with two loops
    expect(h[last / 4]).toBeCloseTo(0.01, 6);
    rig.pose(pose(3, 0.01), 0);
    expect(profile(band)[last / 2]).toBeCloseTo(0.01, 6); // with three, an antinode
  });

  it('hangs a 100 g slot for each 0.1 kg', () => {
    const rig = stringVibrator.rig!(item);
    rig.pose(pose(2, 0, 0.4), 0);
    const brass = rig.group.children.filter(
      (c) => (c as THREE.Mesh).geometry.type === 'CylinderGeometry' && c.visible,
    );
    expect(brass.length).toBe(1 + 4); // the thread and four slots
  });
});
