import type { Vec3 } from '../../core/math';
import type { World, WorldEntity } from '../../world/World';
import { pointOf } from '../lab/pour';

/**
 * A walk-through door's card reader (Phú, 2026-11-04: a card is tapped on a reader beside the door
 * to open it): on the wall beside the leaf, away from the pocket it slides into (its −x), at
 * READER_HEIGHT above the floor, READER_OUT in front of the wall on the door's room side.
 */
export const READER_ASIDE = 0.25;
export const READER_HEIGHT = 1.1;
export const READER_OUT = 0.065;

/**
 * Where a hand works `entity` (world, into `out`): its item's `handAt` (its own frame); a
 * walk-through door's card reader; else its centre. A door's room side is the side of it that is
 * in its room (`world.roomAt` half a metre out).
 */
export function handPoint(
  entity: Pick<WorldEntity, 'item' | 'pose' | 'roomId'>,
  world: Pick<World, 'roomAt'>,
  out: Vec3,
): Vec3 {
  const { item, pose } = entity;
  if (item.handAt) return pointOf(pose.position, pose.rotation, item.handAt, out);
  if (!item.door) {
    out[0] = pose.position[0];
    out[1] = pose.position[1];
    out[2] = pose.position[2];
    return out;
  }
  const [w, h, d] = item.visual.size;
  // The leaf's own +z (its thin axis) in the world, and which side of it is its room.
  const [x, y, z, ww] = pose.rotation;
  const nx = 2 * (x * z + ww * y);
  const nz = 1 - 2 * (x * x + y * y);
  const [px, , pz] = pose.position;
  const side = world.roomAt(px + nx * 0.5, pz + nz * 0.5)?.id === entity.roomId ? 1 : -1;
  local[0] = -(w / 2 + READER_ASIDE);
  local[1] = READER_HEIGHT - h / 2;
  local[2] = side * (d / 2 + READER_OUT);
  return pointOf(pose.position, pose.rotation, local, out);
}

const local: Vec3 = [0, 0, 0];
