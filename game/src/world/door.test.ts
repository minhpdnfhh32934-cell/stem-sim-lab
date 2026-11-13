import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../core/math';
import {
  capsuleInBox,
  createYawBox,
  leafOffset,
  type SlidingPair,
  sweptBox,
  type YawBox,
} from './door';

const LEAF: Vec3 = [1, 2.1, 0.08]; // the door item's box
// Two leaves 0.35 m apart through a 0.25 m wall (each 0.05 m inside its face), on a wall along x.
const PAIR: SlidingPair = {
  leaves: [
    { center: [0, 1.05, 0], size: LEAF },
    { center: [0, 1.05, -0.35], size: LEAF },
  ],
  rotationY: 0,
  travel: 1,
};
// The same pair on a wall along z (east/west wall): the leaves slide toward −z.
const TURNED: SlidingPair = {
  leaves: [
    { center: [5.95, 1.05, 0], size: LEAF },
    { center: [6.3, 1.05, 0], size: LEAF },
  ],
  rotationY: Math.PI / 2,
  travel: 1,
};

function expectBox(box: YawBox, center: Vec3, half: Vec3, rotationY: number) {
  for (let i = 0; i < 3; i++) {
    expect(box.center[i]).toBeCloseTo(center[i]!, 12);
    expect(box.halfExtents[i]).toBeCloseTo(half[i]!, 12);
  }
  expect(box.rotationY).toBe(rotationY);
}

describe('leafOffset', () => {
  const expectVec = (v: Readonly<Vec3>, expected: Vec3, digits = 12) => {
    for (let i = 0; i < 3; i++) expect(v[i]).toBeCloseTo(expected[i]!, digits);
  };

  it('slides a leaf f·travel along its local +x', () => {
    expectVec(leafOffset(0, 1, 0.5, [9, 9, 9]), [0.5, 0, 0]);
    expectVec(leafOffset(0, 1, 0, [9, 9, 9]), [0, 0, 0]);
    expectVec(leafOffset(0, 1.2, 1, [9, 9, 9]), [1.2, 0, 0]);
    expectVec(leafOffset(Math.PI / 2, 1, 1, [0, 0, 0]), [0, 0, -1]);
    // The content's rotationY 1.5708 is a hair off π/2.
    expectVec(leafOffset(1.5708, 1, 1, [0, 0, 0]), [-3.6732e-6, 0, -1], 9);
  });
});

describe('sweptBox', () => {
  const box = createYawBox();

  it('covers the whole doorway, both leaves and the tunnel when closing from open', () => {
    // x: the leading edges sweep −0.5 … 0.5; z: leaf B's back face −0.39 … leaf A's front 0.04;
    // y: floor … 2.1 m; all grown by the 0.1 m margin.
    expectBox(sweptBox(PAIR, 1, 0, 0.1, box), [0, 1.05, -0.175], [0.6, 1.15, 0.315], 0);
  });

  it('shrinks to what is still ahead of the leading edges while closing', () => {
    // At f 0.5 the leading edges are at x 0: only −0.5 … 0 (−0.6 … 0.1 with the margin) is left.
    expectBox(sweptBox(PAIR, 0.5, 0, 0.1, box), [-0.25, 1.05, -0.175], [0.35, 1.15, 0.315], 0);
  });

  it('covers the pockets beside the doorway when opening, not what stands in front of the leaves', () => {
    // z: leaf B's back face −0.39 … leaf A's front 0.04 exactly: a leaf slides along its face.
    expectBox(sweptBox(PAIR, 0, 1, 0.1, box), [1, 1.05, -0.175], [0.6, 1.15, 0.215], 0);
    // From f 0.25 the leading edges are at 0.75: 0.75 … 1.5 is left (0.65 … 1.6 with the margin).
    expectBox(sweptBox(PAIR, 0.25, 1, 0.1, box), [1.125, 1.05, -0.175], [0.475, 1.15, 0.215], 0);
  });

  it('turns with the leaves', () => {
    const r = Math.PI / 2;
    expectBox(sweptBox(TURNED, 1, 0, 0.1, box), [6.125, 1.05, 0], [0.6, 1.15, 0.315], r);
    expectBox(sweptBox(TURNED, 0, 1, 0.1, box), [6.125, 1.05, -1], [0.6, 1.15, 0.215], r);
  });

  it('lets a leaf open past a player pressed against its face by its leading edge', () => {
    // Feet 0.31 m in front of leaf A (radius + skin), 0.2 m from its leading edge at x 0.5: the
    // capsule never meets the leaf at any fraction, so it is not in the opening path.
    const feet: Vec3 = [0.3, 0, 0.04 + 0.31];
    const opening = sweptBox(PAIR, 0, 1, 0.1, createYawBox());
    expect(capsuleInBox(opening, feet, 0.3, 0.85)).toBe(false);
    // Standing in the pocket against the wall face (z −0.05) it is.
    expect(capsuleInBox(opening, [1, 0, -0.05 + 0.31], 0.3, 0.85)).toBe(true);
    // Closing keeps its margin all round: the same player holds a closing pair open.
    expect(capsuleInBox(sweptBox(PAIR, 1, 0, 0.1, createYawBox()), feet, 0.3, 0.85)).toBe(true);
  });

  it('is the bounding box of both leaves when they differ', () => {
    const uneven: SlidingPair = {
      leaves: [
        { center: [0.2, 1, 0], size: [1, 2, 0.1] },
        { center: [0, 1.05, -0.35], size: LEAF },
      ],
      rotationY: 0,
      travel: 1,
    };
    // x: −0.3 … 0.7 and −0.5 … 0.5 → −0.5 … 0.7; y: 0 … 2.1; z: −0.39 … 0.05; no margin.
    expectBox(sweptBox(uneven, 1, 0, 0, box), [0.1, 1.05, -0.17], [0.6, 1.05, 0.22], 0);
  });
});

describe('capsuleInBox', () => {
  const box = sweptBox(PAIR, 1, 0, 0.1, createYawBox()); // x ±0.6, y −0.1 … 2.2, z −0.49 … 0.14
  const r = 0.3;
  const half = 0.85;

  it('grows the footprint by the radius', () => {
    expect(capsuleInBox(box, [0, 0, 0.43], r, half)).toBe(true); // 0.29 m from the face
    expect(capsuleInBox(box, [0, 0, 0.45], r, half)).toBe(false); // 0.31 m
    expect(capsuleInBox(box, [0, 0, -0.175], r, half)).toBe(true); // inside
    expect(capsuleInBox(box, [-0.89, 0, 0], r, half)).toBe(true);
    expect(capsuleInBox(box, [-0.91, 0, 0], r, half)).toBe(false);
  });

  it('rounds the corners', () => {
    expect(capsuleInBox(box, [0.8, 0, 0.34], r, half)).toBe(true); // 0.283 m from the corner
    // 0.354 m from the corner, though within 0.3 m of both edge lines.
    expect(capsuleInBox(box, [0.85, 0, 0.39], r, half)).toBe(false);
  });

  it('needs the heights to overlap', () => {
    expect(capsuleInBox(box, [0, 2.15, 0], r, half)).toBe(true); // feet below the top 2.2
    expect(capsuleInBox(box, [0, 2.25, 0], r, half)).toBe(false);
    expect(capsuleInBox(box, [0, -1.75, 0], r, half)).toBe(true); // head at −0.05
    expect(capsuleInBox(box, [0, -1.85, 0], r, half)).toBe(false); // head at −0.15
  });

  it('works in the turned frame', () => {
    const turned = sweptBox(TURNED, 1, 0, 0.1, createYawBox()); // x 5.81 … 6.44, z ±0.6
    expect(capsuleInBox(turned, [6.73, 0, 0], r, half)).toBe(true); // 0.29 m past x 6.44
    expect(capsuleInBox(turned, [6.75, 0, 0], r, half)).toBe(false);
    expect(capsuleInBox(turned, [6.125, 0, -0.89], r, half)).toBe(true);
    expect(capsuleInBox(turned, [6.125, 0, -0.91], r, half)).toBe(false);
  });
});
