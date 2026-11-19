import type { ItemDefinition } from '../item';
import type { RoomDefinition } from '../../world/definitions';
import type { ResponderSquad } from './squad';

/** The cables holding after the blast before what hangs from them falls (s). */
export const HOLD_S = 0.25;
const G = 9.81;

/** A thing hung under the hole: its entity, its box's half height and largest side, its drop. */
export interface HungPlacement {
  readonly entityId: string;
  /** Where it hangs (its box's centre, in its scene's coordinates). */
  readonly position: readonly [number, number, number];
  /** Its box's half height (m): its origin is the box's centre. */
  readonly bottom: number;
  /** Its box's largest side (m). */
  readonly size: number;
  /** Seconds after the blast it strikes the floor (the cables' hold, then falling free). */
  readonly lands: number;
}

/**
 * What hangs from the ceiling (items `visual.hanging`) in `room` over the hole `squad` blows in
 * it (within the hole's radius and 1.2 m more, as the fittings it takes): it falls at the blast,
 * the picture shows it (render/emergency/fall.ts), the sound plays it striking (audio/cues.ts).
 */
export function hungUnder(
  room: RoomDefinition,
  itemOf: (id: string) => ItemDefinition | undefined,
  squad: ResponderSquad,
): HungPlacement[] {
  const [ax, az] = squad.arrival.at;
  return room.placements.flatMap((p) => {
    const visual = itemOf(p.item)?.visual;
    const near = Math.hypot(p.position[0] - ax, p.position[2] - az) < squad.arrival.radius + 1.2;
    if (!visual?.hanging || !near) return [];
    const [w, h, d] = visual.size;
    // Its bottom's height over the room's floor: the drop.
    const drop = Math.max(0, p.position[1] - h / 2 - room.bounds.min[1]);
    return [
      {
        entityId: `${room.id}/${p.id}`,
        position: p.position,
        bottom: h / 2,
        size: Math.max(w, h, d),
        lands: HOLD_S + Math.sqrt((2 * drop) / G),
      },
    ];
  });
}

/** The room of `rooms` the squad comes down into (its hole over it), or undefined. */
export function arrivalRoom(
  rooms: readonly (RoomDefinition | undefined)[],
  squad: ResponderSquad,
): RoomDefinition | undefined {
  const [ax, az] = squad.arrival.at;
  return rooms.find(
    (r) =>
      r !== undefined &&
      ax >= r.bounds.min[0] &&
      ax <= r.bounds.max[0] &&
      az >= r.bounds.min[2] &&
      az <= r.bounds.max[2],
  );
}
