import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import { Registry } from '../../../core/Registry';
import { buildContent } from '../../../game/content';
import { BUILT_IN_BEHAVIORS } from '../../../gameplay/interaction/behaviors';
import { BUILT_IN_MODELS } from '../../../simulation/models';
import { detectorSpots, fittings } from './fittings';
import { footprint } from './frame';

// Ultra's fittings: inside their room and on its walls or ceiling, out of its doorways, clear of
// what hangs from the ceiling, a draw per finish and a small triangle budget; none under glazing.

const content = buildContent(bundledContent, {
  behaviors: new Registry('behaviour', BUILT_IN_BEHAVIORS),
  models: new Registry('simulation model', BUILT_IN_MODELS),
});
const sizeOf = (id: string) => content.items.tryGet(id)?.visual.size;
const rooms = content.rooms.all();

describe("Ultra's fittings", { timeout: 30_000 }, () => {
  it.each(rooms.map((r) => [r.id, r] as const))(
    '%s: in its room, out of its doorways',
    (_, room) => {
      const parts = fittings(room, sizeOf);
      expect(new Set(parts.map((p) => p.finish)).size).toBe(parts.length);
      const triangles = parts.reduce((n, { geometry }) => n + (geometry.index?.count ?? 0) / 3, 0);
      expect(triangles).toBeLessThan(20_000);
      const { min, max } = room.bounds;
      const v = new THREE.Vector3();
      for (const { geometry } of parts) {
        const p = geometry.getAttribute('position');
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i);
          expect(v.x).toBeGreaterThanOrEqual(min[0] - 1e-6);
          expect(v.x).toBeLessThanOrEqual(max[0] + 1e-6);
          expect(v.y).toBeGreaterThanOrEqual(min[1] - 1e-6);
          expect(v.y).toBeLessThanOrEqual(max[1] + 1e-6);
          expect(v.z).toBeGreaterThanOrEqual(min[2] - 1e-6);
          expect(v.z).toBeLessThanOrEqual(max[2] + 1e-6);
          // Never in a doorway's clear passage (its width up to its height, near its wall).
          for (const o of room.openings) {
            const alongX = o.wall === 'north' || o.wall === 'south';
            const a = alongX ? v.x : v.z;
            const inside = Math.abs(a - o.center) < o.width / 2 - 1e-6 && v.y - min[1] < o.height;
            const wallAt = { north: min[2], south: max[2], west: min[0], east: max[0] }[o.wall];
            const near = Math.abs((alongX ? v.z : v.x) - wallAt) < 0.3;
            expect(inside && near).toBe(false);
          }
        }
      }
    },
  );

  it('dresses the labs and the teacher room; a greenhouse has no smoke detector under its glazing', () => {
    for (const id of ['physics-lab', 'chemistry-lab', 'teacher-room']) {
      expect(fittings(content.rooms.get(id), sizeOf).length, id).toBeGreaterThan(1);
    }
    expect(detectorSpots(content.rooms.get('physics-lab'), sizeOf).length).toBeGreaterThan(0);
    const biology = fittings(content.rooms.get('biology-lab'), sizeOf);
    const ceiling = content.rooms.get('biology-lab').bounds.max[1];
    for (const { geometry } of biology) {
      geometry.computeBoundingBox();
      expect(geometry.boundingBox!.max.y).toBeLessThan(ceiling - 0.3);
    }
  });

  it('puts no exit sign over a doorway into a room with no other way out', () => {
    const signs = (id: string, scene: readonly string[]) => {
      const parts = fittings(
        content.rooms.get(id),
        sizeOf,
        scene.map((r) => content.rooms.get(r)),
      );
      const green = parts.find((p) => p.finish === 'exit-green');
      return (green?.geometry.getAttribute('position').count ?? 0) / 24; // a box: 24 vertices
    };
    expect(signs('teacher-room', [])).toBe(2);
    expect(signs('teacher-room', ['teacher-room', 'teacher-bathroom'])).toBe(1);
    expect(signs('teacher-bathroom', ['teacher-room', 'teacher-bathroom'])).toBe(1); // its way out
  });

  it('keeps smoke detectors off what hangs from the ceiling', () => {
    for (const room of rooms) {
      const top = room.bounds.max[1];
      const hanging = room.placements
        .map((p) => footprint(p, sizeOf))
        .filter((b): b is NonNullable<typeof b> => b !== null && b[4] > top - 0.5);
      for (const [x, z] of detectorSpots(room, sizeOf)) {
        for (const [x0, , z0, x1, , z1] of hanging) {
          expect(x > x0 - 0.3 && x < x1 + 0.3 && z > z0 - 0.3 && z < z1 + 0.3, room.id).toBe(false);
        }
      }
    }
  });
});
