import type { Vec3 } from '../core/math';
import type { ItemDefinition } from '../gameplay/item';
import type { Placement, RoomDefinition } from './definitions';
import { leafPose } from './hinge';

/** Metres in front of a door where a player who comes through it stands. */
export const ARRIVAL_DISTANCE = 1;

/**
 * Free space the player's capsule needs around a point it is placed at (spawn or arrival).
 * shortcut: the default capsule radius (0.3 m) plus 0.1 m; derive it from the configured radius
 * once characters can differ in size.
 */
export const STAND_CLEARANCE = 0.4;

/**
 * How far (m) a saved position may lie below its floor: physics writes the feet back within 1 mm
 * of it (measured), and down to this the capsule, 0.01 m above its feet, stays out of the floor.
 */
const FLOOR_TOLERANCE = 0.01;

export interface StandPose {
  readonly position: Vec3;
  readonly yaw: number;
}

/** Inside the room's floor area with clearance `c` (default: the stand clearance) to every wall. */
export function standsInside(
  room: RoomDefinition,
  x: number,
  z: number,
  c = STAND_CLEARANCE,
): boolean {
  const { min, max } = room.bounds;
  return x >= min[0] + c && x <= max[0] - c && z >= min[2] + c && z <= max[2] - c;
}

/**
 * Where a player arriving through `door` stands: ARRIVAL_DISTANCE in front of it on the side
 * that faces into its room, looking into the room (away from the door, so it is not targeted).
 * A door's thin axis is its local z, so its faces point along ±(sin rotationY, cos rotationY).
 * Returns the problem when the side cannot be told (both or neither side is in the room).
 */
export function arrivalPose(room: RoomDefinition, door: Placement): StandPose | string {
  const nx = Math.sin(door.rotationY);
  const nz = Math.cos(door.rotationY);
  const [x, , z] = door.position;
  const d = ARRIVAL_DISTANCE;
  const sides = [1, -1].filter((s) => standsInside(room, x + s * nx * d, z + s * nz * d));
  const side = sides[0];
  if (sides.length !== 1 || side === undefined) {
    return sides.length === 0
      ? `no room to stand ${d} m in front of it`
      : 'it stands free in the room, so it has no inside face';
  }
  const fx = side * nx; // facing direction: away from the door, into the room
  const fz = side * nz;
  return { position: [x + fx * d, room.bounds.min[1], z + fz * d], yaw: Math.atan2(-fx, -fz) };
}

/**
 * The first solid placement (static or dynamic body) whose footprint lies within `clearance`
 * (default STAND_CLEARANCE) of (x, z), or null. Footprints are the item's box rotated by
 * rotationY — a hinged item's: its carcass and its leaves both closed and swung wide open (UX3.1:
 * what is solid of it whichever its saved state); height is ignored, so anything above the floor
 * area counts (conservative).
 */
export function blockingPlacement(
  room: RoomDefinition,
  itemOf: (id: string) => ItemDefinition | undefined,
  x: number,
  z: number,
  clearance = STAND_CLEARANCE,
): string | null {
  for (const p of room.placements) {
    const item = itemOf(p.item);
    if (!item || item.physical.body === 'none') continue;
    const dx = x - p.position[0];
    const dz = z - p.position[2];
    const cos = Math.cos(p.rotationY);
    const sin = Math.sin(p.rotationY);
    // Into the placement's frame (inverse of a rotation by rotationY about +y).
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    for (const [cx, cz, hx, hz, yaw] of footprints(item)) {
      // Into the box's own frame (turned by yaw within the placement's).
      const bx = lx - cx;
      const bz = lz - cz;
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      const ox = Math.max(Math.abs(bx * c - bz * s) - hx, 0);
      const oz = Math.max(Math.abs(bx * s + bz * c) - hz, 0);
      if (Math.hypot(ox, oz) < clearance) return p.id;
    }
  }
  return null;
}

/** An item's footprints in its own frame: centre x, z, half width, half depth, yaw. */
function footprints(item: ItemDefinition): [number, number, number, number, number][] {
  const { hinged } = item;
  if (!hinged) return [[0, 0, item.visual.size[0] / 2, item.visual.size[2] / 2, 0]];
  const open = (hinged.angleDeg * Math.PI) / 180;
  const at: Vec3 = [0, 0, 0];
  return [
    ...hinged.carcass.map(({ center, size }): [number, number, number, number, number] => [
      center[0],
      center[2],
      size[0] / 2,
      size[2] / 2,
      0,
    ]),
    ...hinged.leaves.flatMap((leaf): [number, number, number, number, number][] => {
      const yaw = leafPose([0, 0, 0], 0, leaf, leaf.opens * open, at);
      return [
        [leaf.center[0], leaf.center[2], leaf.size[0] / 2, leaf.size[2] / 2, 0],
        [at[0], at[2], leaf.size[0] / 2, leaf.size[2] / 2, yaw],
      ];
    }),
  ];
}

/**
 * Where Continue puts a player saved at `position` in a scene of `rooms`. null keeps the saved
 * pose: in one of the rooms with the capsule inside it (its radius to every wall, on the floor,
 * under the ceiling) and its radius clear of every solid placement. Otherwise the arrival point
 * of the door (a placement offering travel) nearest to it whose point passes the same test — the
 * first in content order on a tie — else the spawn.
 */
export function continuePose(
  rooms: readonly RoomDefinition[],
  spawn: StandPose,
  itemOf: (id: string) => ItemDefinition | undefined,
  capsule: { readonly radius: number; readonly height: number },
  position: Readonly<Vec3>,
): StandPose | null {
  const { radius, height } = capsule;
  const free = ([x, y, z]: Readonly<Vec3>) =>
    rooms.some(
      (room) =>
        standsInside(room, x, z, radius) &&
        y >= room.bounds.min[1] - FLOOR_TOLERANCE &&
        y + height <= room.bounds.max[1],
    ) && rooms.every((room) => blockingPlacement(room, itemOf, x, z, radius) === null);
  if (free(position)) return null;
  let stand = spawn;
  let nearest = Infinity;
  for (const room of rooms) {
    for (const door of room.placements) {
      if (!itemOf(door.item)?.interactions.includes('travel')) continue;
      const d = Math.hypot(door.position[0] - position[0], door.position[2] - position[2]);
      const pose = arrivalPose(room, door);
      if (d < nearest && typeof pose !== 'string' && free(pose.position)) {
        stand = pose;
        nearest = d;
      }
    }
  }
  return stand;
}
