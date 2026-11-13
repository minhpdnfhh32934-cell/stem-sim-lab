import type { Vec3 } from '../core/math';
import { type Opening, type RoomDefinition, type Wall, WALLS } from './definitions';

/**
 * Thickness (m) of the floor, ceiling and walls built just outside a room's bounds. Two rooms
 * joined by a doorway are exactly this far apart: the gap between them is their shared wall.
 */
export const WALL_THICKNESS = 0.25;

/** One axis-aligned box of a room's shell, in world space. */
export interface Slab {
  readonly part: 'floor' | 'ceiling' | 'wall';
  readonly center: Vec3;
  readonly halfExtents: Vec3;
}

type Range = readonly [number, number];

const OPPOSITE: Record<Wall, Wall> = { west: 'east', east: 'west', north: 'south', south: 'north' };
const EPS = 1e-6;
const near = (a: number, b: number) => Math.abs(a - b) < EPS;

const slab = (part: Slab['part'], x: Range, y: Range, z: Range): Slab => ({
  part,
  center: [(x[0] + x[1]) / 2, (y[0] + y[1]) / 2, (z[0] + z[1]) / 2],
  halfExtents: [(x[1] - x[0]) / 2, (y[1] - y[0]) / 2, (z[1] - z[0]) / 2],
});

/** Interior extent of a wall along its length: z for west/east walls, x for north/south. */
export function wallSpan(room: RoomDefinition, wall: Wall): Range {
  const { min, max } = room.bounds;
  return wall === 'west' || wall === 'east' ? [min[2], max[2]] : [min[0], max[0]];
}

/**
 * The boxes that close a room: floor, ceiling and four walls of `thickness` just outside its
 * bounds (inner faces exactly on the bounds), each opening left out of its wall — wall pieces
 * beside it and a lintel above. Physics builds its colliders and the renderer its meshes from
 * this one function, so what is drawn is what blocks.
 */
export function roomSlabs(room: RoomDefinition, thickness = WALL_THICKNESS): Slab[] {
  const { min, max } = room.bounds;
  const t = thickness;
  const outerX: Range = [min[0] - t, max[0] + t];
  const outerZ: Range = [min[2] - t, max[2] + t];
  const fullHeight: Range = [min[1], max[1]];
  const slabs = [
    slab('floor', outerX, [min[1] - t, min[1]], outerZ),
    slab('ceiling', outerX, [max[1], max[1] + t], outerZ),
  ];
  const across: Record<Wall, Range> = {
    west: [min[0] - t, min[0]],
    east: [max[0], max[0] + t],
    north: [min[2] - t, min[2]],
    south: [max[2], max[2] + t],
  };
  for (const wall of WALLS) {
    const alongX = wall === 'north' || wall === 'south';
    const piece = (along: Range, y: Range) =>
      alongX ? slab('wall', along, y, across[wall]) : slab('wall', across[wall], y, along);
    // West/east walls run the full outer length and close the corners; north/south fit between.
    const [start, end] = alongX ? wallSpan(room, wall) : outerZ;
    const openings = room.openings
      .filter((o) => o.wall === wall)
      .sort((a, b) => a.center - b.center);
    let from = start;
    for (const { center, width, height } of openings) {
      const lo = center - width / 2;
      const hi = center + width / 2;
      if (lo > from) slabs.push(piece([from, lo], fullHeight));
      if (min[1] + height < max[1]) slabs.push(piece([lo, hi], [min[1] + height, max[1]]));
      from = hi;
    }
    if (end > from) slabs.push(piece([from, end], fullHeight));
  }
  return slabs;
}

/** Coordinate of a wall's inner face on the axis it faces (x for west/east, z for north/south). */
function wallPlane(room: RoomDefinition, wall: Wall): number {
  const { min, max } = room.bounds;
  switch (wall) {
    case 'west':
      return min[0];
    case 'east':
      return max[0];
    case 'north':
      return min[2];
    case 'south':
      return max[2];
  }
}

/**
 * True if `opening` of `room` leads into `other`: the facing wall of `other` is one wall
 * thickness away, on the same floor level, and has the same opening — so both rooms leave the
 * same gap in their shared wall.
 */
export function leadsInto(room: RoomDefinition, opening: Opening, other: RoomDefinition): boolean {
  const facing = OPPOSITE[opening.wall];
  const outward = opening.wall === 'west' || opening.wall === 'north' ? -1 : 1;
  return (
    near(wallPlane(room, opening.wall) + outward * WALL_THICKNESS, wallPlane(other, facing)) &&
    near(room.bounds.min[1], other.bounds.min[1]) &&
    other.openings.some(
      (o) =>
        o.wall === facing &&
        near(o.center, opening.center) &&
        near(o.width, opening.width) &&
        near(o.height, opening.height),
    )
  );
}
