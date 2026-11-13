import type { ItemDefinition } from '../gameplay/item';
import type { RoomDefinition } from './definitions';

/**
 * Where the player can walk in a scene's rooms, as a grid (Phase A contract A5): the floor of each
 * room, less every standing obstacle (static items between the ankles and the head: benches,
 * cabinets, stools…) grown by the player's radius and a margin, less a band along the walls. The
 * guided task's floor path is found on it. Pure and deterministic: no physics, no allocation per
 * query beyond the path written out.
 */
export interface NavGrid {
  readonly cell: number;
  readonly minX: number;
  readonly minZ: number;
  readonly cols: number;
  readonly rows: number;
  /** 1: blocked (outside every room, a wall band or an obstacle), 0: free. */
  readonly blocked: Uint8Array;
}

export interface NavOptions {
  /** Cell size (m). */
  readonly cell?: number;
  /** How far (m) the centre of the walker stays from any obstacle or wall. */
  readonly clearance?: number;
}

/** Below this height (m) an item is walked over (a mat); from this height up, walked under. */
const FLOOR_ITEM = 0.15;
const OVERHEAD = 1.9;
const SQRT2 = Math.SQRT2;

/** The grid of `rooms` (one scene's), their static items read through `itemOf`. */
export function buildNavGrid(
  rooms: readonly RoomDefinition[],
  itemOf: (id: string) => ItemDefinition | undefined,
  { cell = 0.1, clearance = 0.35 }: NavOptions = {},
): NavGrid {
  let [minX, minZ, maxX, maxZ] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const { bounds } of rooms) {
    minX = Math.min(minX, bounds.min[0]);
    minZ = Math.min(minZ, bounds.min[2]);
    maxX = Math.max(maxX, bounds.max[0]);
    maxZ = Math.max(maxZ, bounds.max[2]);
  }
  if (!Number.isFinite(minX))
    return { cell, minX: 0, minZ: 0, cols: 0, rows: 0, blocked: new Uint8Array() };
  const cols = Math.ceil((maxX - minX) / cell);
  const rows = Math.ceil((maxZ - minZ) / cell);
  const blocked = new Uint8Array(cols * rows).fill(1);
  const centre = (i: number, min: number) => min + (i + 0.5) * cell;
  // The floor: inside a room, at least `clearance` from its walls.
  for (const { bounds } of rooms) {
    for (let r = 0; r < rows; r++) {
      const z = centre(r, minZ);
      if (z < bounds.min[2] + clearance || z > bounds.max[2] - clearance) continue;
      for (let c = 0; c < cols; c++) {
        const x = centre(c, minX);
        if (x >= bounds.min[0] + clearance && x <= bounds.max[0] - clearance)
          blocked[r * cols + c] = 0;
      }
    }
  }
  // Standing obstacles, grown by the clearance.
  for (const room of rooms) {
    for (const p of room.placements) {
      const item = itemOf(p.item);
      if (!item || !stands(item, p.position[1])) continue;
      const [w, , d] = item.visual.size;
      const round = item.visual.shape !== 'box';
      const c = Math.cos(p.rotationY);
      const s = Math.sin(p.rotationY);
      const [px, , pz] = p.position;
      const hx = round ? w / 2 : Math.abs(c) * (w / 2) + Math.abs(s) * (d / 2);
      const hz = round ? w / 2 : Math.abs(s) * (w / 2) + Math.abs(c) * (d / 2);
      const c0 = Math.max(0, Math.floor((px - hx - clearance - minX) / cell));
      const c1 = Math.min(cols - 1, Math.floor((px + hx + clearance - minX) / cell));
      const r0 = Math.max(0, Math.floor((pz - hz - clearance - minZ) / cell));
      const r1 = Math.min(rows - 1, Math.floor((pz + hz + clearance - minZ) / cell));
      for (let r = r0; r <= r1; r++) {
        for (let k = c0; k <= c1; k++) {
          const dx = centre(k, minX) - px;
          const dz = centre(r, minZ) - pz;
          const gap = round
            ? Math.hypot(dx, dz) - w / 2
            : boxGap(dx * c - dz * s, dx * s + dz * c, w / 2, d / 2);
          if (gap < clearance) blocked[r * cols + k] = 1;
        }
      }
    }
  }
  return { cell, minX, minZ, cols, rows, blocked };
}

/** An item the walker must go round: a body that stops it, between the ankles and the head. */
function stands(item: ItemDefinition, base: number): boolean {
  const { body } = item.physical;
  if (body === 'dynamic' || body === 'none' || item.door !== undefined) return false;
  const top = base + item.visual.size[1];
  return top > FLOOR_ITEM && base < OVERHEAD;
}

/** Distance from (u, v) in a box's own frame to the box of half sizes (hu, hv); 0 inside. */
function boxGap(u: number, v: number, hu: number, hv: number): number {
  return Math.hypot(Math.max(Math.abs(u) - hu, 0), Math.max(Math.abs(v) - hv, 0));
}

const cellOf = (g: NavGrid, x: number, z: number): number => {
  const c = Math.floor((x - g.minX) / g.cell);
  const r = Math.floor((z - g.minZ) / g.cell);
  return c < 0 || r < 0 || c >= g.cols || r >= g.rows ? -1 : r * g.cols + c;
};
const xOf = (g: NavGrid, i: number) => g.minX + ((i % g.cols) + 0.5) * g.cell;
const zOf = (g: NavGrid, i: number) => g.minZ + (Math.floor(i / g.cols) + 0.5) * g.cell;

/**
 * The free cell nearest (x, z) within `reach` m (an object on a bench: where to stand by it), as
 * its centre written into `out`; false if none.
 */
export function nearestFree(
  g: NavGrid,
  x: number,
  z: number,
  reach: number,
  out: [number, number],
): boolean {
  let best = -1;
  let bestD = Infinity;
  const n = Math.ceil(reach / g.cell);
  const c0 = Math.floor((x - g.minX) / g.cell);
  const r0 = Math.floor((z - g.minZ) / g.cell);
  for (let r = Math.max(0, r0 - n); r <= Math.min(g.rows - 1, r0 + n); r++) {
    for (let c = Math.max(0, c0 - n); c <= Math.min(g.cols - 1, c0 + n); c++) {
      const i = r * g.cols + c;
      if (g.blocked[i]) continue;
      const d = Math.hypot(xOf(g, i) - x, zOf(g, i) - z);
      if (d <= reach && d < bestD) [best, bestD] = [i, d];
    }
  }
  if (best < 0) return false;
  out[0] = xOf(g, best);
  out[1] = zOf(g, best);
  return true;
}

/**
 * A walkable path from (fx, fz) to (tx, tz): A* over the 8-connected free cells (no corner
 * cutting), then shortened to the turns a straight walk needs (each leg clear on the grid).
 * Writes x, z pairs into `out` (start first, goal last) and returns their count, 0 if there is no
 * way. A start inside a blocked cell (pressed against a bench) starts from the nearest free one.
 */
export function findPath(
  g: NavGrid,
  fx: number,
  fz: number,
  tx: number,
  tz: number,
  out: number[],
): number {
  out.length = 0;
  const near: [number, number] = [0, 0];
  let start = cellOf(g, fx, fz);
  if (start < 0 || g.blocked[start]) {
    if (!nearestFree(g, fx, fz, 1, near)) return 0;
    start = cellOf(g, near[0], near[1]);
  }
  const goal = cellOf(g, tx, tz);
  if (goal < 0 || g.blocked[goal]) return 0;
  const n = g.cols * g.rows;
  const cost = new Float64Array(n).fill(Infinity);
  const from = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const heap = new Heap();
  const h = (i: number) => {
    const dx = Math.abs((i % g.cols) - (goal % g.cols));
    const dz = Math.abs(Math.floor(i / g.cols) - Math.floor(goal / g.cols));
    return Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz);
  };
  cost[start] = 0;
  heap.push(start, h(start));
  while (heap.size > 0) {
    const i = heap.pop();
    if (i === goal) break;
    if (closed[i]) continue;
    closed[i] = 1;
    const c = i % g.cols;
    const r = Math.floor(i / g.cols);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (
          (dr === 0 && dc === 0) ||
          c + dc < 0 ||
          r + dr < 0 ||
          c + dc >= g.cols ||
          r + dr >= g.rows
        ) {
          continue;
        }
        const j = (r + dr) * g.cols + (c + dc);
        if (g.blocked[j] || closed[j]) continue;
        // Diagonals only where both sides are free: no squeezing past a corner.
        if (
          dr !== 0 &&
          dc !== 0 &&
          (g.blocked[r * g.cols + c + dc] || g.blocked[(r + dr) * g.cols + c])
        )
          continue;
        const next = (cost[i] ?? Infinity) + (dr !== 0 && dc !== 0 ? SQRT2 : 1);
        if (next < (cost[j] ?? Infinity)) {
          cost[j] = next;
          from[j] = i;
          heap.push(j, next + h(j));
        }
      }
    }
  }
  if (start !== goal && from[goal] === -1) return 0;
  const cells: number[] = [];
  for (let i = goal; i !== -1; i = i === start ? -1 : (from[i] ?? -1)) cells.push(i);
  cells.reverse();
  // String pulling: keep a turn only where the straight leg past it would cross a blocked cell.
  out.push(xOf(g, start), zOf(g, start));
  let anchor = start;
  cells.forEach((cell, k) => {
    const next = cells[k + 1];
    if (k === 0 || (next !== undefined && clear(g, anchor, next))) return;
    anchor = cell;
    out.push(xOf(g, anchor), zOf(g, anchor));
  });
  return out.length / 2;
}

/** Whether the straight segment between two cells' centres crosses only free cells. */
function clear(g: NavGrid, a: number, b: number): boolean {
  const ax = xOf(g, a);
  const az = zOf(g, a);
  const bx = xOf(g, b);
  const bz = zOf(g, b);
  const steps = Math.ceil((Math.hypot(bx - ax, bz - az) / g.cell) * 2);
  for (let k = 1; k < steps; k++) {
    const t = k / steps;
    const i = cellOf(g, ax + (bx - ax) * t, az + (bz - az) * t);
    if (i < 0 || g.blocked[i]) return false;
  }
  return true;
}

/** A binary min-heap of cell indices by priority (typed arrays: no allocation once grown). */
class Heap {
  private items = new Int32Array(256);
  private keys = new Float64Array(256);
  size = 0;

  push(item: number, key: number): void {
    if (this.size === this.items.length) this.grow();
    const { items, keys } = this;
    let i = this.size++;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const up = keys[parent] ?? 0;
      if (up <= key) break;
      items[i] = items[parent] ?? 0;
      keys[i] = up;
      i = parent;
    }
    items[i] = item;
    keys[i] = key;
  }

  pop(): number {
    const { items, keys } = this;
    const top = items[0] ?? -1;
    const n = --this.size;
    const lastItem = items[n] ?? 0;
    const lastKey = keys[n] ?? 0;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      if (l >= n) break;
      const m = l + 1 < n && (keys[l + 1] ?? 0) < (keys[l] ?? 0) ? l + 1 : l;
      if ((keys[m] ?? 0) >= lastKey) break;
      items[i] = items[m] ?? 0;
      keys[i] = keys[m] ?? 0;
      i = m;
    }
    items[i] = lastItem;
    keys[i] = lastKey;
    return top;
  }

  private grow(): void {
    const items = new Int32Array(this.items.length * 2);
    const keys = new Float64Array(this.keys.length * 2);
    items.set(this.items);
    keys.set(this.keys);
    [this.items, this.keys] = [items, keys];
  }
}
