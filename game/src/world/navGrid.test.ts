import { describe, expect, it } from 'vitest';
import { bundledContent } from '../content';
import { type ItemDefinition, ItemDefinitionSchema } from '../gameplay/item';
import { type RoomDefinition, RoomDefinitionSchema } from './definitions';
import { buildNavGrid, findPath, type NavGrid, nearestFree } from './navGrid';

// The floor path's grid (Phase A contract A5): a room's floor less its standing obstacles grown by
// the walker's clearance; A* round them; legs straightened only where the floor allows.

const BENCH: ItemDefinition = ItemDefinitionSchema.parse({
  id: 'bench',
  displayName: 'Bench',
  category: 'furniture',
  physical: { massKg: 80 },
  interactions: [],
  visual: { shape: 'box', size: [4, 0.9, 0.8], color: '#cccccc' },
});
const MAT: ItemDefinition = ItemDefinitionSchema.parse({
  ...BENCH,
  id: 'mat',
  visual: { shape: 'box', size: [2, 0.01, 2], color: '#cccccc' },
});
const items = new Map([BENCH, MAT].map((i) => [i.id, i]));

function room(placements: object[]): RoomDefinition {
  return RoomDefinitionSchema.parse({
    id: 'r',
    displayName: 'R',
    bounds: { min: [-5, 0, -5], max: [5, 3, 5] },
    floorColor: '#888888',
    wallColor: '#aaaaaa',
    placements,
  });
}

const free = (g: NavGrid, x: number, z: number) => {
  const c = Math.floor((x - g.minX) / g.cell);
  const r = Math.floor((z - g.minZ) / g.cell);
  return g.blocked[r * g.cols + c] === 0;
};

/** Every point of every leg is on free floor (sampled every 2 cm). */
function walkable(g: NavGrid, path: readonly number[]): boolean {
  for (let k = 0; k + 3 < path.length; k += 2) {
    const [ax, az, bx, bz] = [path[k] ?? 0, path[k + 1] ?? 0, path[k + 2] ?? 0, path[k + 3] ?? 0];
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.02);
    for (let i = 0; i <= steps; i++) {
      if (!free(g, ax + ((bx - ax) * i) / steps, az + ((bz - az) * i) / steps)) return false;
    }
  }
  return true;
}

describe('the navigation grid', () => {
  it('keeps the walker off the walls and a bench, by its clearance; a mat is walked over', () => {
    const g = buildNavGrid(
      [
        room([
          { id: 'b', item: 'bench', position: [0, 0, 0] },
          { id: 'm', item: 'mat', position: [0, 0, 3] },
        ]),
      ],
      (id) => items.get(id),
      { clearance: 0.35 },
    );
    expect(free(g, 0, 0)).toBe(false); // on the bench
    expect(free(g, 0, 0.65)).toBe(false); // 0.25 from its side: within the clearance
    expect(free(g, 0, 0.85)).toBe(true);
    expect(free(g, -4.8, 0)).toBe(false); // against the wall
    expect(free(g, 0, 3)).toBe(true); // on the mat
  });

  it('goes round a bench, never through it, and turns only where it must', () => {
    const g = buildNavGrid([room([{ id: 'b', item: 'bench', position: [0, 0, 0] }])], (id) =>
      items.get(id),
    );
    const path: number[] = [];
    const n = findPath(g, 0, -2, 0, 2, path);
    expect(n).toBeGreaterThanOrEqual(3); // a straight line would cross the bench
    expect(walkable(g, path)).toBe(true);
    expect(n).toBeLessThanOrEqual(5);
    const straight: number[] = [];
    expect(findPath(g, -3, -2, 3, -2, straight)).toBe(2); // in the open: one leg
  });

  it('finds no way into an enclosed space, and starts beside an obstacle it is pressed against', () => {
    const walls = [
      { id: 'n', item: 'bench', position: [3, 0, 1.5] },
      { id: 's', item: 'bench', position: [3, 0, 4.5] },
      { id: 'w', item: 'bench', position: [1.5, 0, 3], rotationY: Math.PI / 2 },
    ];
    const g = buildNavGrid([room(walls)], (id) => items.get(id));
    expect(findPath(g, -3, -3, 3.5, 3, [])).toBe(0); // boxed in by the benches and the wall
    const beside: [number, number] = [0, 0];
    expect(nearestFree(g, 3, 1.5, 1.5, beside)).toBe(true); // an object on a bench: stand by it
    expect(free(g, beside[0], beside[1])).toBe(true);
    const path: number[] = [];
    expect(findPath(g, 3, 0.95, -3, -3, path)).toBeGreaterThan(0); // pressed against the bench
  });

  it('is the same grid and path every time (deterministic)', () => {
    const build = () =>
      buildNavGrid([room([{ id: 'b', item: 'bench', position: [0, 0, 0] }])], (id) =>
        items.get(id),
      );
    const [a, b] = [build(), build()];
    expect(a.blocked).toEqual(b.blocked);
    const pa: number[] = [];
    const pb: number[] = [];
    findPath(a, 0, -2, 0, 2, pa);
    findPath(b, 0, -2, 0, 2, pb);
    expect(pa).toEqual(pb);
  });

  it('leads through the shipped Chemistry Lab from its door to the reagent cabinet, round every bench', () => {
    const lab = bundledContent.rooms as { id: string }[];
    const raw = lab.find((r) => r.id === 'chemistry-lab');
    const chem = RoomDefinitionSchema.parse(raw);
    const all = new Map(
      (bundledContent.items as unknown[]).map((i) => {
        const item = ItemDefinitionSchema.parse(i);
        return [item.id, item] as const;
      }),
    );
    const g = buildNavGrid([chem], (id) => all.get(id));
    const stand: [number, number] = [0, 0];
    expect(nearestFree(g, 2.7, -1.3, 1.5, stand)).toBe(true); // in front of the cabinet
    const path: number[] = [];
    expect(findPath(g, 0, 3.2, stand[0], stand[1], path)).toBeGreaterThan(1);
    expect(walkable(g, path)).toBe(true);
  });
});
