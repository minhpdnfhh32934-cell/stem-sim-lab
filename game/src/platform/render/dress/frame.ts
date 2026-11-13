import * as THREE from 'three';
import { type RoomDefinition, type Wall, WALLS } from '../../../world/definitions';
import type { Finish } from '../palette';
import { part } from '../props/parts';

/** One finish of a room's dressing, in world coordinates: merged, one draw. */
export interface DressPart {
  readonly finish: Finish;
  readonly geometry: THREE.BufferGeometry;
}

/** An item's box [w, h, d], or undefined if unknown. */
export type SizeOf = (itemId: string) => readonly number[] | undefined;

/**
 * A wall seen from inside its room: `a` runs along it (x on north/south walls, z on east/west),
 * `d` is the distance from its inner face into the room, `y` the height above the floor.
 */
export interface WallFrame {
  readonly wall: Wall;
  readonly alongX: boolean;
  /** The inner face's world coordinate across the wall (z on north/south, x on east/west). */
  readonly at: number;
  /** +1 if the room lies towards larger coordinates. */
  readonly inward: 1 | -1;
  readonly span: readonly [number, number];
  /** The floor's height (the room's min y). */
  readonly floor: number;
}

export function wallFrames(room: RoomDefinition): WallFrame[] {
  const { min, max } = room.bounds;
  const floor = min[1];
  return WALLS.map((wall): WallFrame => {
    if (wall === 'north')
      return { wall, alongX: true, at: min[2], inward: 1, span: [min[0], max[0]], floor };
    if (wall === 'south')
      return { wall, alongX: true, at: max[2], inward: -1, span: [min[0], max[0]], floor };
    if (wall === 'west')
      return { wall, alongX: false, at: min[0], inward: 1, span: [min[2], max[2]], floor };
    return { wall, alongX: false, at: max[0], inward: -1, span: [min[2], max[2]], floor };
  });
}

/** A rectangle on a wall: along a0…a1, up y0…y1 (above the floor). */
export interface Patch {
  readonly a0: number;
  readonly a1: number;
  readonly y0: number;
  readonly y1: number;
}

const overlaps = (p: Patch, q: Patch) => p.a0 < q.a1 && q.a0 < p.a1 && p.y0 < q.y1 && q.y0 < p.y1;

/** The world box of a placement: [x0, y0, z0] … [x1, y1, z1], or null if its item is unknown. */
export function footprint(
  p: RoomDefinition['placements'][number],
  sizeOf: SizeOf,
): readonly [number, number, number, number, number, number] | null {
  const size = sizeOf(p.item);
  if (!size) return null;
  const [w = 0, h = 0, d = 0] = size;
  const c = Math.abs(Math.cos(p.rotationY));
  const s = Math.abs(Math.sin(p.rotationY));
  const hx = (w * c + d * s) / 2;
  const hz = (w * s + d * c) / 2;
  const [x, y, z] = p.position;
  return [x - hx, y, z - hz, x + hx, y + h, z + hz];
}

/**
 * What a wall's dressing has to keep clear of: its openings and everything standing within
 * `reach` of it (a board, a monitor, a sign, a bench against it, a ceiling light near it).
 */
export class WallPlan {
  /** Openings, from the floor to their height. */
  readonly openings: Patch[];
  /** What stands against the wall, and how far it comes into the room. */
  readonly occupants: (Patch & { readonly out: number })[] = [];

  constructor(
    readonly room: RoomDefinition,
    readonly frame: WallFrame,
    sizeOf: SizeOf,
    reach = 0.35,
  ) {
    this.openings = room.openings
      .filter((o) => o.wall === frame.wall)
      .map((o) => ({
        a0: o.center - o.width / 2,
        a1: o.center + o.width / 2,
        y0: -1,
        y1: o.height,
      }));
    for (const p of room.placements) {
      const box = footprint(p, sizeOf);
      if (!box) continue;
      const [x0, y0, z0, x1, y1, z1] = box;
      const [n0, n1] = frame.alongX ? [z0, z1] : [x0, x1];
      const near = frame.inward > 0 ? n0 - frame.at : frame.at - n1;
      const out = frame.inward > 0 ? n1 - frame.at : frame.at - n0;
      if (near > reach || out < 0) continue;
      const [a0, a1] = frame.alongX ? [x0, x1] : [z0, z1];
      this.occupants.push({ a0, a1, y0: y0 - frame.floor, y1: y1 - frame.floor, out });
    }
  }

  /** Whether a patch is clear of the openings (widened by `margin`, raised by `above`) and of what stands there. */
  clear(patch: Patch, margin = 0.35, above = 0.9): boolean {
    const widened = (o: Patch): Patch => ({
      a0: o.a0 - margin,
      a1: o.a1 + margin,
      y0: o.y0,
      y1: o.y1 + above,
    });
    return (
      !this.openings.some((o) => overlaps(widened(o), patch)) &&
      !this.occupants.some((o) => overlaps(o, patch))
    );
  }

  /**
   * The pieces of a band y0…y1 along the whole wall that stay: cut at the openings it crosses and,
   * unless `flat`, at what stands in front of it (flat cladding lies behind everything).
   */
  runs(y0: number, y1: number, flat = false, gap = 0.02): [number, number][] {
    const band: Patch = { a0: this.frame.span[0], a1: this.frame.span[1], y0, y1 };
    const cuts = [...this.openings, ...(flat ? [] : this.occupants)]
      .filter((o) => overlaps(o, band))
      .map((o) => [o.a0 - gap, o.a1 + gap] as const)
      .sort((p, q) => p[0] - q[0]);
    const pieces: [number, number][] = [];
    let from = band.a0;
    for (const [c0, c1] of cuts) {
      if (c0 > from) pieces.push([from, Math.min(c0, band.a1)]);
      from = Math.max(from, c1);
    }
    if (from < band.a1) pieces.push([from, band.a1]);
    return pieces.filter(([p0, p1]) => p1 - p0 > 0.05);
  }

  /** The highest top of what stands in front of a1…a0 (0: nothing), up to `below`. */
  topOf(a0: number, a1: number, below = Infinity): number {
    let top = 0;
    for (const o of this.occupants) {
      if (o.a0 < a1 && a0 < o.a1 && o.y0 < below) top = Math.max(top, Math.min(o.y1, below));
    }
    return top;
  }
}

/** A box on a wall, in world coordinates: along a0…a1, up y0…y1, out d0…d1 from the face. */
export function wallBox(
  f: WallFrame,
  a0: number,
  a1: number,
  y0: number,
  y1: number,
  d0: number,
  d1: number,
): THREE.BufferGeometry {
  const [a, y, d] = [(a0 + a1) / 2, f.floor + (y0 + y1) / 2, f.at + f.inward * ((d0 + d1) / 2)];
  const [la, ly, ld] = [a1 - a0, y1 - y0, d1 - d0];
  return f.alongX
    ? new THREE.BoxGeometry(la, ly, ld).translate(a, y, d)
    : new THREE.BoxGeometry(ld, ly, la).translate(d, y, a);
}

/** The point at (a, y, d) of a wall, in world coordinates. */
export function wallPoint(f: WallFrame, a: number, y: number, d: number): THREE.Vector3 {
  const across = f.at + f.inward * d;
  return f.alongX
    ? new THREE.Vector3(a, f.floor + y, across)
    : new THREE.Vector3(across, f.floor + y, a);
}

/**
 * Places a piece modelled flat on a wall — x along it, y up, z out into the room — at (a, y, d).
 * Always a rotation (never a mirror), so its faces keep their winding; x may run either way along.
 */
export function onWall(f: WallFrame, a: number, y: number, d: number): THREE.Matrix4 {
  const n = f.alongX ? new THREE.Vector3(0, 0, f.inward) : new THREE.Vector3(f.inward, 0, 0);
  const up = new THREE.Vector3(0, 1, 0);
  const x = new THREE.Vector3().crossVectors(up, n); // x × y = z: a right-handed frame
  return new THREE.Matrix4().makeBasis(x, up, n).setPosition(wallPoint(f, a, y, d));
}

/** Which way a piece placed by `onWall` runs along its wall: +1 if its x is the wall's +a. */
export const alongSign = (f: WallFrame): 1 | -1 => ((f.alongX ? f.inward : -f.inward) > 0 ? 1 : -1);

/** Pieces gathered by finish, merged into one geometry each. */
export class Pieces {
  private readonly byFinish = new Map<Finish, THREE.BufferGeometry[]>();

  add(finish: Finish, ...geometries: THREE.BufferGeometry[]): void {
    const list = this.byFinish.get(finish) ?? [];
    list.push(...geometries);
    this.byFinish.set(finish, list);
  }

  parts(): DressPart[] {
    const out: DressPart[] = [];
    for (const [finish, list] of this.byFinish) {
      if (list.length === 0) continue;
      const { geometry } = part(finish, false, list);
      for (const piece of list) piece.dispose();
      out.push({ finish, geometry });
    }
    return out;
  }
}

/** The module cladding is laid in along a wall (m): panels, ribs and vents keep to it. */
export const MODULE = 1.2;

/** Module edges of a span: s0, s0 + M, …, s1 (the last module may be short). */
export function moduleEdges(span: readonly [number, number], module = MODULE): number[] {
  const edges: number[] = [];
  for (let a = span[0]; a < span[1] - 1e-6; a += module) edges.push(a);
  edges.push(span[1]);
  return edges;
}
