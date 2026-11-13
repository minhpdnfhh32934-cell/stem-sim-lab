import { describe, expect, it } from 'vitest';
import { RoomDefinitionSchema } from './definitions';
import { roomSlabs, type Slab, WALL_THICKNESS } from './roomGeometry';

// A 6 × 3 × 4 m room: x −3 … 3, y 0 … 3, z −2 … 2 (north wall at z = −2, east wall at x = 3).
const room = (openings: object[] = []) =>
  RoomDefinitionSchema.parse({
    id: 'room',
    displayName: 'Room',
    bounds: { min: [-3, 0, -2], max: [3, 3, 2] },
    openings,
  });

/** A slab as [min, max] per axis, rounded to the millimetre. */
const box = ({ center, halfExtents }: Slab) =>
  [0, 1, 2].map((i) =>
    [center[i]! - halfExtents[i]!, center[i]! + halfExtents[i]!].map(
      (v) => Math.round(v * 1000) / 1000,
    ),
  );

const T = WALL_THICKNESS;

describe('room geometry', () => {
  it('closes a room without openings: floor, ceiling and four walls just outside its bounds', () => {
    const slabs = roomSlabs(room());
    expect(slabs.map((s) => s.part)).toEqual(['floor', 'ceiling', 'wall', 'wall', 'wall', 'wall']);
    expect(slabs.map(box)).toEqual([
      [
        [-3 - T, 3 + T],
        [-T, 0],
        [-2 - T, 2 + T],
      ], // floor, under the walls too
      [
        [-3 - T, 3 + T],
        [3, 3 + T],
        [-2 - T, 2 + T],
      ], // ceiling
      [
        [-3 - T, -3],
        [0, 3],
        [-2 - T, 2 + T],
      ], // west, closing the corners
      [
        [3, 3 + T],
        [0, 3],
        [-2 - T, 2 + T],
      ], // east
      [
        [-3, 3],
        [0, 3],
        [-2 - T, -2],
      ], // north, between west and east
      [
        [-3, 3],
        [0, 3],
        [2, 2 + T],
      ], // south
    ]);
  });

  it('leaves an opening out of its wall: wall pieces beside it and a lintel above', () => {
    const slabs = roomSlabs(room([{ wall: 'north', center: 1, width: 1.2, height: 2.2 }]));
    const north = slabs.filter((s) => s.center[2] < -2).map(box);
    expect(north).toEqual([
      [
        [-3, 0.4],
        [0, 3],
        [-2 - T, -2],
      ],
      [
        [0.4, 1.6],
        [2.2, 3],
        [-2 - T, -2],
      ], // lintel
      [
        [1.6, 3],
        [0, 3],
        [-2 - T, -2],
      ],
    ]);
    expect(slabs).toHaveLength(8); // the other walls, floor and ceiling are unchanged
  });

  it('handles several openings in one wall, including one as tall as the room (no lintel)', () => {
    const slabs = roomSlabs(
      room([
        { wall: 'east', center: 1, width: 0.8, height: 2 },
        { wall: 'east', center: -1, width: 1, height: 3 },
      ]),
    );
    const east = slabs.filter((s) => s.part === 'wall' && s.center[0] > 3).map(box);
    expect(east).toEqual([
      [
        [3, 3 + T],
        [0, 3],
        [-2 - T, -1.5],
      ],
      [
        [3, 3 + T],
        [0, 3],
        [-0.5, 0.6],
      ],
      [
        [3, 3 + T],
        [2, 3],
        [0.6, 1.4],
      ], // lintel of the 2 m opening
      [
        [3, 3 + T],
        [0, 3],
        [1.4, 2 + T],
      ],
    ]);
  });

  it('scales every slab with the thickness, keeping the inner faces on the bounds', () => {
    const half = roomSlabs(room([{ wall: 'north', center: 0, width: 1, height: 2 }]), T / 2);
    const full = roomSlabs(room([{ wall: 'north', center: 0, width: 1, height: 2 }]));
    expect(half.map((s) => s.part)).toEqual(full.map((s) => s.part));
    expect(box(half[4]!)).toEqual([
      [-3, -0.5],
      [0, 3],
      [-2 - T / 2, -2],
    ]);
  });
});
