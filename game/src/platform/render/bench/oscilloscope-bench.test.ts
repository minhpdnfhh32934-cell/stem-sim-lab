import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { oscilloscopeBench } from './oscilloscope-bench';

// The oscilloscope bench against its item: the trace is the tone across the screen's 10 divisions
// at the time base, its height with the run's envelope, flat without a run.
// (Freeing and fitting the room: registry.test.ts, apparatusExtents.test.ts.)

const item = ItemDefinitionSchema.parse(
  (bundledContent.items as { id: string }[]).find((i) => i.id === 'oscilloscope-bench'),
);
const pose = (frequency: number, timeBase: number, envelope: number): BenchPose => ({
  status: 'running',
  parameters: { frequency, timeBase, periodResolution: 0.00005 },
  sample: { envelope },
});

/** How many times the trace crosses zero going up, across the screen. */
function upCrossings(line: THREE.Line): number {
  const p = line.geometry.getAttribute('position');
  let n = 0;
  for (let i = 1; i < p.count; i++) if (p.getY(i - 1) < 0 && p.getY(i) >= 0) n++;
  return n;
}

describe('oscilloscope bench', () => {
  it('draws f × 10 × time base periods across the screen', () => {
    const rig = oscilloscopeBench.rig!(item);
    const trace = rig.group.getObjectByName('trace') as THREE.Line;
    rig.pose(pose(440, 0.001, 2), 0); // 10 ms: 4.4 periods
    expect(upCrossings(trace)).toBe(4);
    rig.pose(pose(512, 0.002, 2), 0); // 20 ms: 10.24 periods
    expect(upCrossings(trace)).toBe(10);
  });

  it('scales the trace with the envelope, flat without a run', () => {
    const rig = oscilloscopeBench.rig!(item);
    const trace = rig.group.getObjectByName('trace') as THREE.Line;
    rig.pose(pose(440, 0.001, 2), 0);
    const full = trace.scale.y;
    rig.pose(pose(440, 0.001, 1), 0);
    expect(trace.scale.y).toBeCloseTo(full / 2, 12);
    rig.pose(pose(440, 0.001, NaN), 0);
    expect(trace.scale.y).toBeLessThan(1e-3);
  });
});
