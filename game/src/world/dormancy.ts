import type { RoomDefinition } from './definitions';
import { WALL_THICKNESS, leadsInto } from './roomGeometry';

/**
 * Which rooms are drawn (Phú, 2026-11-06: rooms the player cannot see are neither loaded nor run,
 * and come back before they can be seen, without a hitch). A room is seen only through a passage
 * from a room that is seen: a doorless opening always shows it, a closed door never does. So the
 * player's room is awake, and so is every room reached from it through doorless openings, open
 * doors, or doors the player is within `wakeM` of — early enough for it to be ready before the
 * door opens (`near`, 2.2 m for the Physics wing's sliding doors). A room stays awake until the
 * player is `sleepM` from that door (the gap keeps it from flickering at the edge). Pure: the
 * renderer asks it a few times a second and draws what it says.
 */
export const DORMANCY = { wakeM: 7, sleepM: 9 } as const;

/** A doorway between two rooms: its middle on the floor, and the door leaves that close it. */
export interface Passage {
  readonly rooms: readonly [string, string];
  readonly x: number;
  readonly z: number;
  /** Entity ids of the leaves that close it (none: a doorless opening, always open). */
  readonly closers: readonly string[];
}

/** A door leaf where it stands (its placement). */
export interface Closer {
  readonly id: string;
  readonly x: number;
  readonly z: number;
}

/** In no room, a doorway this near (m) is the one the player stands in. */
const DOORWAY_M = 1.5;

/** How far past a doorway's edges (m) a closed leaf may stand and still close it. */
const LEAF_REACH_M = 0.6;

/**
 * Every doorway between two of `rooms` (both rooms leave the same gap in their shared wall,
 * `leadsInto`), with the leaves standing in it.
 */
export function passagesBetween(
  rooms: readonly RoomDefinition[],
  closers: readonly Closer[],
): Passage[] {
  const passages: Passage[] = [];
  rooms.forEach((room, i) => {
    for (const opening of room.openings) {
      for (const other of rooms.slice(i + 1)) {
        if (!leadsInto(room, opening, other)) continue;
        const { min, max } = room.bounds;
        // The middle of the shared wall, half a wall thick outside `room`.
        const half = WALL_THICKNESS / 2;
        const [x, z] =
          opening.wall === 'west'
            ? [min[0] - half, opening.center]
            : opening.wall === 'east'
              ? [max[0] + half, opening.center]
              : opening.wall === 'north'
                ? [opening.center, min[2] - half]
                : [opening.center, max[2] + half];
        const alongX = opening.wall === 'north' || opening.wall === 'south';
        const leaves = closers.filter((c) => {
          const along = alongX ? c.x - x : c.z - z;
          const across = alongX ? c.z - z : c.x - x;
          return (
            Math.abs(along) <= opening.width / 2 + LEAF_REACH_M &&
            Math.abs(across) <= WALL_THICKNESS / 2 + LEAF_REACH_M
          );
        });
        passages.push({ rooms: [room.id, other.id], x, z, closers: leaves.map((c) => c.id) });
      }
    }
  });
  return passages;
}

/**
 * The rooms to draw: the player's, and those reached from it through passages that let the
 * player see (or soon see) through them. `opening` is how far a leaf is open (0 shut);
 * `previous` the rooms awake before (they stay so out to `sleepM`). With no room under the
 * player (in a doorway's wall), the rooms of the doorways at hand and those awake before; every
 * room only when there are neither (placed in a wall by a load).
 */
export function awakeRooms(
  rooms: readonly string[],
  passages: readonly Passage[],
  player: { readonly x: number; readonly z: number; readonly room: string | null },
  opening: (closerId: string) => number,
  previous: ReadonlySet<string>,
  limits: { readonly wakeM: number; readonly sleepM: number } = DORMANCY,
): Set<string> {
  let start: string[];
  if (player.room !== null && rooms.includes(player.room)) start = [player.room];
  else {
    // In a doorway's wall: the rooms on both sides of the doorways at hand, and those awake
    // before (waking every room there woke rooms far off, and put them back to sleep a step later).
    const near = passages.filter((p) => Math.hypot(p.x - player.x, p.z - player.z) <= DOORWAY_M);
    if (near.length === 0 && previous.size === 0) return new Set(rooms);
    start = [...new Set([...near.flatMap((p) => p.rooms), ...previous])].filter((id) =>
      rooms.includes(id),
    );
    if (start.length === 0) return new Set(rooms);
  }
  const awake = new Set(start);
  const queue = [...start];
  for (let room = queue.shift(); room !== undefined; room = queue.shift()) {
    for (const p of passages) {
      const [a, b] = p.rooms;
      const far = a === room ? b : b === room ? a : null;
      if (far === null || awake.has(far) || !rooms.includes(far)) continue;
      const d = Math.hypot(p.x - player.x, p.z - player.z);
      const through =
        p.closers.length === 0 ||
        p.closers.some((id) => opening(id) > 0) ||
        d <= limits.wakeM ||
        (previous.has(far) && d <= limits.sleepM);
      if (!through) continue;
      awake.add(far);
      queue.push(far);
    }
  }
  return awake;
}
