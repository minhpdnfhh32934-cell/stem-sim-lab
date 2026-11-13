import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../core/math';
import { capsuleInSwing, type HingedLeaf, leafPose, swingAngle } from './hinge';

// The washroom door's leaf (items.json wc-door): 1.08 m wide, hinged on its +x edge at its front
// face, opening towards the item's +z; placed at (−1.5, 0, 2.45) turned π, so it opens north.
const WC: HingedLeaf = {
  center: [0, -0.03, -0.03],
  size: [1.08, 2.12, 0.04],
  hinge: [0.54, -0.01],
  opens: 1,
};
const AT: Vec3 = [-1.5, 1.1, 2.45]; // its box centre
const YAW = Math.PI;
const QUARTER = Math.PI / 2;
const R = 0.3;
const HALF = 0.85;

describe('hinged leaves', () => {
  it('ease in and out: none at 0, half at 0.5, all at 1', () => {
    expect(swingAngle(0, QUARTER)).toBe(0);
    expect(swingAngle(0.5, QUARTER)).toBeCloseTo(QUARTER / 2, 12);
    expect(swingAngle(1, QUARTER)).toBeCloseTo(QUARTER, 12);
    expect(swingAngle(0.1, QUARTER)).toBeLessThan(0.1 * QUARTER); // slow off the mark
  });

  it('stand where they are closed, and turned about their hinge open', () => {
    const at: Vec3 = [0, 0, 0];
    expect(leafPose(AT, YAW, WC, 0, at)).toBeCloseTo(YAW, 12);
    expect(at[0]).toBeCloseTo(-1.5, 9);
    expect(at[2]).toBeCloseTo(2.48, 9); // its back on the wall face (z 2.5)
    // Open 90°: along the west jamb (x −2.02), out into the Teacher Room (z 1.38 … 2.46).
    const yaw = leafPose(AT, YAW, WC, WC.opens * QUARTER, at);
    expect(at[0]).toBeCloseTo(-2.02, 9);
    expect(at[1]).toBeCloseTo(AT[1] - 0.03, 9);
    expect(at[2]).toBeCloseTo(1.92, 9);
    expect(yaw).toBeCloseTo(YAW + QUARTER, 12);
  });

  it('meet a player in what they still sweep, never one behind the face they leave', () => {
    const swing = (feet: Vec3, from: number, to: number) =>
      capsuleInSwing(AT, YAW, WC, QUARTER, from, to, 0.1, feet, R, HALF);
    expect(swing([-1.5, 0, 2.0], 0, 1)).toBe(true); // in front of it: opening hits them
    expect(swing([-1.5, 0, 1.0], 0, 1)).toBe(false); // beyond its reach (1.08 + 0.3 + margin)
    // In the washroom, pressed against its back: it opens away from them.
    expect(swing([-1.5, 0, 2.75 + R], 0, 1)).toBe(false);
    // Closing onto a player standing in the doorway's mouth on the Teacher Room side.
    expect(swing([-1.5, 0, 2.2], 1, 0)).toBe(true);
    expect(swing([-1.5, 0, 2.2], 1, 1)).toBe(false); // no motion left: nothing to meet
    // Only the rest of the motion counts: open more than half way, the start of the arc is past.
    expect(swing([-1.2, 0, 2.3], 0.7, 1)).toBe(false);
  });
});
