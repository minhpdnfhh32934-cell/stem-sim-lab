import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { fieldDisplay } from './field-display';

// The field display against its item: Q2 shown only when set, each charge in its sign's colour,
// field lines leaving a positive charge and ending on a negative one, the probe at its distance.
// (Freeing and fitting the room: registry.test.ts, apparatusExtents.test.ts.)

const item = ItemDefinitionSchema.parse(
  (bundledContent.items as { id: string }[]).find((i) => i.id === 'electric-field-display'),
);
const pose = (charge: number, secondCharge: number, probe = NaN): BenchPose => ({
  status: 'running',
  parameters: { charge, secondCharge, probeDistance: 0.1 },
  sample: { probe },
});

function build() {
  const rig = fieldDisplay.rig!(item);
  const named = (name: string) => rig.group.getObjectByName(name) as THREE.Mesh;
  const points = () => {
    const g = named('field-lines').geometry;
    const p = g.getAttribute('position');
    return Array.from(
      { length: g.drawRange.count },
      (_, i) => new THREE.Vector2(p.getX(i), p.getY(i)),
    );
  };
  return { rig, named, points };
}

describe('field display', () => {
  it('shows Q2 only when set, in its sign’s colour', () => {
    const { rig, named } = build();
    rig.pose(pose(5e-9, 0), 0);
    expect(named('q2').visible).toBe(false);
    rig.pose(pose(5e-9, -5e-9), 0);
    expect(named('q2').visible).toBe(true);
    expect(named('q2').material).not.toBe(named('q1').material);
  });

  it('draws one charge’s lines straight out, 16 for 5 nC, 6 for 2 nC', () => {
    const { rig, points } = build();
    rig.pose(pose(5e-9, 0), 0);
    const p = points();
    // Every segment points away from Q1 at the origin: radial lines.
    for (let i = 0; i < p.length; i += 2) {
      const a = p[i]!;
      const b = p[i + 1]!;
      expect(b.length()).toBeGreaterThan(a.length());
      expect(Math.abs(a.x * b.y - a.y * b.x)).toBeLessThan(1e-7); // float32 positions
    }
    const starts = (q: number) => {
      rig.pose(pose(q, 0), 0);
      return points().filter((v, i) => i % 2 === 0 && Math.abs(v.length() - 0.014) < 1e-6).length;
    };
    expect(starts(5e-9)).toBe(16);
    expect(starts(2e-9)).toBe(6);
  });

  it('ends lines from +Q1 on −Q2, 0.2 m to its left', () => {
    const { rig, points } = build();
    rig.pose(pose(5e-9, -5e-9), 0);
    const ends = points().filter((v) => Math.hypot(v.x + 0.2, v.y) < 0.015);
    expect(ends.length).toBeGreaterThan(8);
  });

  it('puts the probe r from Q1 along the axis', () => {
    const { rig, named } = build();
    rig.pose(pose(5e-9, 0, 0.12), 0);
    expect(named('probe').position.x - named('q1').position.x).toBeCloseTo(0.12, 12);
    expect(named('probe').position.y).toBe(0);
  });
});
