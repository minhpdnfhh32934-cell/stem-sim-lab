import type { Vec3 } from '../core/math';
import type { ItemDefinition } from '../gameplay/item';
import {
  type Placement,
  type RoomDefinition,
  type SceneDefinition,
  type Wall,
  WALLS,
} from './definitions';
import { WALL_THICKNESS } from './roomGeometry';

// The campus frame. Each scene keeps its own coordinates; where scenes lie relative to each other
// follows from their travel doors, so it is derived, never stored. Two doors that name each other
// as their arrival stand back to back through one wall: door A against a wall of its room, door B
// against the opposite wall of its room, at the same point along that wall, the two wall faces one
// wall thickness apart. That fixes where B's scene lies seen from A's.

/** One end of a door pair: a travel door, the wall it stands against, its room and scene. */
export interface DoorEnd {
  readonly sceneId: string;
  readonly room: RoomDefinition;
  readonly door: Placement;
  /** `<room id>/<placement id>`, the door's entity id. */
  readonly entityId: string;
  /** The wall whose inner face is nearest the door. */
  readonly wall: Wall;
}

/** Two travel doors of different scenes that name each other as arrival, back to back. */
export interface DoorPair {
  readonly a: DoorEnd;
  readonly b: DoorEnd;
}

const OPPOSITE: Record<Wall, Wall> = { west: 'east', east: 'west', north: 'south', south: 'north' };
/** The wall runs along x (north and south walls); else along z. */
export const alongX = (wall: Wall) => wall === 'north' || wall === 'south';

/** Coordinate of a wall's inner face on the axis it faces (x for west/east, z for north/south). */
export const faceOf = ({ bounds: { min, max } }: RoomDefinition, wall: Wall) =>
  ({ west: min[0], east: max[0], north: min[2], south: max[2] })[wall];

/** The wall of `room` whose inner face is nearest the floor point (the first in WALLS on a tie). */
export function wallOf(room: RoomDefinition, [x, , z]: Readonly<Vec3>): Wall {
  const { min, max } = room.bounds;
  const gap = { west: x - min[0], east: max[0] - x, north: z - min[2], south: max[2] - z };
  return WALLS.reduce((best, wall) => (gap[wall] < gap[best] ? wall : best));
}

/**
 * Every door pair of the world scenes, each once (in content order): a placement whose item
 * offers `travel` names a door of another scene as its arrival, that door names it back, and
 * the two stand against opposite walls. Doors that are not such a pair (the arrival is in the
 * same scene, or not mutual, or the walls do not face each other) join no scenes.
 */
export function doorPairs(
  scenes: readonly SceneDefinition[],
  roomOf: (id: string) => RoomDefinition | undefined,
  itemOf: (id: string) => ItemDefinition | undefined,
): DoorPair[] {
  const ends = new Map<string, DoorEnd>();
  for (const scene of scenes) {
    if (scene.kind !== 'world') continue;
    for (const room of scene.rooms.flatMap((id) => roomOf(id) ?? [])) {
      for (const door of room.placements) {
        if (!itemOf(door.item)?.interactions.includes('travel')) continue;
        const entityId = `${room.id}/${door.id}`;
        ends.set(entityId, {
          sceneId: scene.id,
          room,
          door,
          entityId,
          wall: wallOf(room, door.position),
        });
      }
    }
  }
  const order = [...ends.keys()];
  const pairs: DoorPair[] = [];
  for (const a of ends.values()) {
    const b = ends.get(String(a.door.params.arrival));
    if (
      b &&
      b.sceneId !== a.sceneId &&
      b.door.params.arrival === a.entityId &&
      b.wall === OPPOSITE[a.wall] &&
      order.indexOf(a.entityId) < order.indexOf(b.entityId)
    ) {
      pairs.push({ a, b });
    }
  }
  return pairs;
}

/**
 * Where `to`'s scene lies seen from `from`'s (campus[to] − campus[from]): the wall faces one wall
 * thickness apart, the doors at the same point along the wall, the floors level.
 */
export function pairOffset(from: DoorEnd, to: DoorEnd): Vec3 {
  const outward = from.wall === 'west' || from.wall === 'north' ? -1 : 1;
  const across = faceOf(from.room, from.wall) + outward * WALL_THICKNESS - faceOf(to.room, to.wall);
  const y = from.room.bounds.min[1] - to.room.bounds.min[1];
  return alongX(from.wall)
    ? [from.door.position[0] - to.door.position[0], y, across]
    : [across, y, from.door.position[2] - to.door.position[2]];
}

/**
 * Each scene's local origin in the campus frame (campus = scene-local + offset). Scenes joined
 * through door pairs share one frame, whose origin is the first of them in `sceneIds`; a scene no
 * pair joins is alone at its own origin. Where a loop of pairs would place a scene twice, the
 * first way found counts (the content checks report the disagreement).
 */
export function campusOffsets(
  sceneIds: readonly string[],
  pairs: readonly DoorPair[],
): Map<string, Vec3> {
  const offsets = new Map<string, Vec3>();
  for (const root of sceneIds) {
    if (offsets.has(root)) continue;
    offsets.set(root, [0, 0, 0]);
    const queue = [root];
    // An array iterator also visits what is pushed while it runs: a breadth-first walk.
    for (const at of queue) {
      const base = offsets.get(at) ?? [0, 0, 0];
      for (const { a, b } of pairs) {
        const [from, to] = a.sceneId === at ? [a, b] : b.sceneId === at ? [b, a] : [];
        if (!from || !to || offsets.has(to.sceneId)) continue;
        const d = pairOffset(from, to);
        offsets.set(to.sceneId, [base[0] + d[0], base[1] + d[1], base[2] + d[2]]);
        queue.push(to.sceneId);
      }
    }
  }
  return offsets;
}

/**
 * The room moved by `offset`: its bounds, its openings along their walls and its placements. The
 * same id and everything else as it is (an offset never turns anything).
 */
export function translateRoom(room: RoomDefinition, offset: Readonly<Vec3>): RoomDefinition {
  const [dx, dy, dz] = offset;
  const move = ([x, y, z]: Readonly<Vec3>): Vec3 => [x + dx, y + dy, z + dz];
  return {
    ...room,
    bounds: { min: move(room.bounds.min), max: move(room.bounds.max) },
    openings: room.openings.map((o) => ({ ...o, center: o.center + (alongX(o.wall) ? dx : dz) })),
    placements: room.placements.map((p) => ({ ...p, position: move(p.position) })),
    lights: room.lights.map((l) => (l.target ? { ...l, target: move(l.target) } : l)),
    ...(room.glassFloor
      ? {
          glassFloor: {
            x: [room.glassFloor.x[0] + dx, room.glassFloor.x[1] + dx],
            z: [room.glassFloor.z[0] + dz, room.glassFloor.z[1] + dz],
          },
        }
      : {}),
  };
}
