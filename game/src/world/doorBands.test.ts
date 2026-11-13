import { describe, expect, it } from 'vitest';
import { bundledContent } from '../content';
import { type ItemDefinition, ItemDefinitionSchema } from '../gameplay/item';
import { arrivalPose } from './arrival';
import { type Placement, RoomDefinitionSchema } from './definitions';

/** Every item and room, the lab pack's included. */
const itemsJson = bundledContent.items as unknown[];
const roomsJson = bundledContent.rooms as unknown[];

// Doors become sliding pairs (card WX-D2): kinematic leaves the size of the door item that slide
// up to TRAVEL along the wall, within LEAF_BAND of its face. Nothing may stand where a leaf slides
// or in the door's way: the band DOOR_BAND either side of the door's centre along the wall, from
// inside the wall to FRONT in front of it, from the floor to above the leaf.

const TRAVEL = 1;
const LEAF_BAND = 0.15;
/** Half the wall band kept free along the wall, from the door's centre (m). */
const DOOR_BAND = 2;
/** How far in front of the wall the door's way stays free (m). */
const FRONT = 1.2;
/** Free height above the leaf (m). */
const HEAD = 0.1;
/**
 * Door hardware flat on the wall beside or above a leaf (its jamb, track rail, wall plates, card
 * UX3): the one exception to the band, as long as it stays within TRIM_DEPTH of the wall face and
 * SWEEP_MARGIN clear of the space the leaf sweeps from closed to open (the last test).
 */
const TRIM = 'door-trim';
const TRIM_DEPTH = 0.05;
const SWEEP_MARGIN = 0.01;
/** Touching counts as clear, up to what the content's rounded turns (1.5708) move a 1 m end by. */
const TOLERANCE = 1e-4;

const items = new Map(
  itemsJson.map((raw) => {
    const item = ItemDefinitionSchema.parse(raw);
    return [item.id, item] as const;
  }),
);
const itemOf = (id: string) => items.get(id);
const rooms = roomsJson.map((raw) => RoomDefinitionSchema.parse(raw));
const isDoor = (p: Placement) => itemOf(p.item)?.interactions.includes('travel') ?? false;

/** The corners of a placement's footprint (its box turned by its yaw; a cylinder's square). */
function corners(p: Placement, item: ItemDefinition): [number, number][] {
  const [w, , d] = item.visual.size;
  const c = Math.cos(p.rotationY);
  const s = Math.sin(p.rotationY);
  const [x, , z] = p.position;
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([u = 0, v = 0]) => {
    const [lx, lz] = [(u * w) / 2, (v * d) / 2];
    return [x + lx * c + lz * s, z - lx * s + lz * c];
  });
}

/** A box in a door's frame: its range along the wall, off the wall face and up (m). */
type Box = [[number, number], [number, number], [number, number]];

const doors = rooms.flatMap((room) =>
  room.placements.filter(isDoor).map((door) => ({ room, door })),
);

/** A door's frame: `along` its wall (its leaf's +x) and `off` the wall face into the room (m). */
function frameOf(room: (typeof rooms)[number], door: Placement) {
  const pose = arrivalPose(room, door);
  if (typeof pose === 'string') throw new Error(pose);
  // Into the room (f) and along the wall (a), from the door's centre.
  const [fx, fz] = [pose.position[0] - door.position[0], pose.position[2] - door.position[2]];
  const [ax, az] = [Math.cos(door.rotationY), -Math.sin(door.rotationY)];
  const { min, max } = room.bounds;
  // Where the wall's face lies along f (the room's bound behind the door).
  const face = Math.abs(fx) > 0.5 ? (fx > 0 ? min[0] : max[0]) : fz > 0 ? min[2] : max[2];
  const off = (x: number, z: number) => (Math.abs(fx) > 0.5 ? (x - face) * fx : (z - face) * fz);
  const along = (x: number, z: number) => (x - door.position[0]) * ax + (z - door.position[2]) * az;
  return { off, along, min };
}

describe('the doors’ leaf bands and ways', () => {
  it('cover every door, and each leaf’s whole travel', () => {
    expect(doors.length).toBe(10);
    for (const { door } of doors) {
      const [w] = itemOf(door.item)!.visual.size;
      expect(w / 2 + TRAVEL).toBeLessThanOrEqual(DOOR_BAND); // the leaf open on either side
    }
  });

  it.each(doors.map(({ room, door }) => [`${room.id}/${door.id}`, room, door] as const))(
    '%s: nothing stands in its leaf band or in front of it',
    (_, room, door) => {
      const { off, along, min } = frameOf(room, door);
      const top = min[1] + itemOf(door.item)!.visual.size[1] + HEAD;
      expect(LEAF_BAND).toBeLessThan(FRONT);

      const inTheWay = room.placements
        .filter((p) => p !== door && !itemOf(p.item)!.tags.includes(TRIM))
        .filter((p) => {
          const item = itemOf(p.item)!;
          const y0 = p.position[1];
          if (y0 >= top || y0 + item.visual.size[1] <= min[1]) return false;
          const at = corners(p, item);
          const u = at.map(([x, z]) => along(x, z));
          const v = at.map(([x, z]) => off(x, z));
          return (
            Math.max(...u) > -DOOR_BAND && Math.min(...u) < DOOR_BAND && Math.min(...v) < FRONT
          );
        })
        .map((p) => p.id);
      expect(inTheWay).toEqual([]);
    },
  );

  it.each(doors.map(({ room, door }) => [`${room.id}/${door.id}`, room, door] as const))(
    '%s: its door trim stays flat on the wall and clear of the leaf’s sweep',
    (_, room, door) => {
      const { off, along, min } = frameOf(room, door);
      const leaf = itemOf(door.item)!;
      const [w, h, d] = leaf.visual.size;
      const travel = leaf.door?.travel ?? TRAVEL;
      const inset = off(door.position[0], door.position[2]);
      // The leaf's box from closed to fully open, grown by the margin: along, off, up.
      const swept: Box = [
        [-w / 2 - SWEEP_MARGIN, w / 2 + travel + SWEEP_MARGIN],
        [inset - d / 2 - SWEEP_MARGIN, inset + d / 2 + SWEEP_MARGIN],
        [door.position[1] - SWEEP_MARGIN, door.position[1] + h + SWEEP_MARGIN],
      ];
      const trims = room.placements
        .filter((p) => itemOf(p.item)!.tags.includes(TRIM))
        .map((p) => {
          const item = itemOf(p.item)!;
          const at = corners(p, item);
          const u = at.map(([x, z]) => along(x, z));
          const v = at.map(([x, z]) => off(x, z));
          const box: Box = [
            [Math.min(...u), Math.max(...u)],
            [Math.min(...v), Math.max(...v)],
            [p.position[1], p.position[1] + item.visual.size[1]],
          ];
          return { id: p.id, box };
        })
        // This door's: in its band along the wall, in front of its wall.
        .filter(({ box: [u, v] }) => u[1] > -DOOR_BAND && u[0] < DOOR_BAND && v[0] < FRONT);
      expect(min[1]).toBe(door.position[1]);
      const proud = trims.filter(
        ({ box: [, v] }) => v[0] < -TOLERANCE || v[1] > TRIM_DEPTH + TOLERANCE,
      );
      expect(proud.map((t) => t.id)).toEqual([]);
      const inSweep = trims.filter(({ box }) =>
        box.every(([lo, hi], k) => lo < swept[k]![1] - TOLERANCE && swept[k]![0] + TOLERANCE < hi),
      );
      expect(inSweep.map((t) => t.id)).toEqual([]);
    },
  );

  it('door trim is used only at doors', () => {
    const stray = rooms.flatMap((room) =>
      room.placements
        .filter((p) => itemOf(p.item)?.tags.includes(TRIM))
        .filter((p) =>
          room.placements.filter(isDoor).every((door) => {
            const { off, along } = frameOf(room, door);
            const u = along(p.position[0], p.position[2]);
            return Math.abs(u) > DOOR_BAND || off(p.position[0], p.position[2]) > FRONT;
          }),
        )
        .map((p) => `${room.id}/${p.id}`),
    );
    expect(stray).toEqual([]);
  });
});
