import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import { Registry } from '../../../core/Registry';
import { buildContent } from '../../../game/content';
import { BUILT_IN_BEHAVIORS } from '../../../gameplay/interaction/behaviors';
import { BUILT_IN_MODELS } from '../../../simulation/models';
import type { RoomDefinition } from '../../../world/definitions';
import { onWall, wallFrames, WallPlan } from './frame';
import { dressRoom } from './index';

// Room styles (Phase U): the dressing stays inside its room, out of its doorways, behind or clear
// of what stands at its walls, and within a triangle budget (decoration, drawn every frame).

const content = buildContent(bundledContent, {
  behaviors: new Registry('behaviour', BUILT_IN_BEHAVIORS),
  models: new Registry('simulation model', BUILT_IN_MODELS),
});
const sizeOf = (id: string) => content.items.tryGet(id)?.visual.size;
const styled = content.rooms.all().filter((room) => room.style !== 'plain');

/** How far a point is from the nearest wall's inner face. */
const offWalls = (room: RoomDefinition, v: THREE.Vector3) => {
  const { min, max } = room.bounds;
  return Math.min(v.x - min[0], max[0] - v.x, v.z - min[2], max[2] - v.z);
};

/** Every vertex of a room's dressing, in world coordinates. */
function vertices(room: RoomDefinition): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (const { geometry } of dressRoom(room, sizeOf)) {
    const p = geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) out.push(new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)));
  }
  return out;
}

describe('room dressing', { timeout: 30_000 }, () => {
  it('dresses the Physics wing as a starship deck; a plain room has none', () => {
    expect(styled.map((r) => [r.id, r.style])).toEqual(
      expect.arrayContaining([
        ['physics-lab', 'starship-deck'],
        ['pendulum-bay', 'starship-deck'],
        ['projectile-range', 'starship-deck'],
        ['chemistry-lab', 'orbital-module'],
        ['biology-lab', 'greenhouse'],
      ]),
    );
    expect(dressRoom(content.rooms.get('teacher-room'), sizeOf)).toEqual([]);
  });

  it.each(styled.map((r) => [r.id, r] as const))(
    '%s: inside its room, a draw per finish, in budget',
    (_, room) => {
      const parts = dressRoom(room, sizeOf);
      expect(parts.length).toBeGreaterThan(3);
      expect(new Set(parts.map((p) => p.finish)).size).toBe(parts.length);
      const triangles = parts.reduce((n, { geometry }) => n + (geometry.index?.count ?? 0) / 3, 0);
      expect(triangles).toBeLessThan(60_000);
      const { min, max } = room.bounds;
      for (const v of vertices(room)) {
        expect(v.x).toBeGreaterThanOrEqual(min[0] - 1e-6);
        expect(v.x).toBeLessThanOrEqual(max[0] + 1e-6);
        expect(v.y).toBeGreaterThanOrEqual(min[1] - 1e-6);
        expect(v.y).toBeLessThanOrEqual(max[1] + 1e-6);
        expect(v.z).toBeGreaterThanOrEqual(min[2] - 1e-6);
        expect(v.z).toBeLessThanOrEqual(max[2] + 1e-6);
      }
    },
  );

  it.each(styled.map((r) => [r.id, r] as const))('%s: nothing in its doorways', (_, room) => {
    const all = vertices(room);
    for (const frame of wallFrames(room)) {
      for (const o of room.openings.filter((o) => o.wall === frame.wall)) {
        const inside = all.filter((v) => {
          const a = frame.alongX ? v.x : v.z;
          const d = frame.inward * ((frame.alongX ? v.z : v.x) - frame.at);
          const y = v.y - frame.floor;
          return (
            Math.abs(a - o.center) < o.width / 2 - 0.01 &&
            d < 0.3 &&
            y > 0.01 &&
            y < o.height - 0.01
          );
        });
        expect(inside, `${frame.wall} opening at ${o.center}`).toEqual([]);
      }
    }
  });

  it.each(styled.map((r) => [r.id, r] as const))(
    '%s: what stands out off the wall keeps clear of what stands at it (a board, a monitor, a sign)',
    (_, room) => {
      const all = vertices(room);
      for (const frame of wallFrames(room)) {
        const plan = new WallPlan(room, frame, sizeOf);
        for (const o of plan.occupants) {
          const hits = all.filter((v) => {
            const a = frame.alongX ? v.x : v.z;
            const d = frame.inward * ((frame.alongX ? v.z : v.x) - frame.at);
            const y = v.y - frame.floor;
            // Flat cladding (≤ 14 mm off any wall) lies behind; nothing else may reach into the occupant.
            return (
              offWalls(room, v) > 0.015 &&
              a > o.a0 + 0.01 &&
              a < o.a1 - 0.01 &&
              y > o.y0 + 0.01 &&
              y < o.y1 - 0.01 &&
              d < o.out
            );
          });
          expect(hits.length, `${frame.wall} occupant ${o.a0.toFixed(2)}…${o.a1.toFixed(2)}`).toBe(
            0,
          );
        }
      }
    },
  );

  it('cuts a band at an opening and, unless flat, at what stands in front of it', () => {
    const room = content.rooms.get('physics-lab');
    const north = wallFrames(room).find((f) => f.wall === 'north')!;
    const plan = new WallPlan(room, north, sizeOf);
    const flat = plan.runs(0.45, 1.02, true, 0);
    const opening = plan.openings[0]!;
    expect(flat.some(([a0, a1]) => a0 < opening.a1 && opening.a0 < a1)).toBe(false);
    expect(plan.runs(1.0, 2.6).length).toBeGreaterThan(flat.length);
  });

  it('places wall pieces by a rotation, never a mirror', () => {
    const room = content.rooms.get('physics-lab');
    for (const frame of wallFrames(room)) {
      expect(onWall(frame, 0, 1, 0).determinant()).toBeCloseTo(1, 9);
    }
  });
});
