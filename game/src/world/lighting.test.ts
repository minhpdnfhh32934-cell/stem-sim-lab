import { describe, expect, it } from 'vitest';
import { Registry } from '../core/Registry';
import { bundledContent } from '../content';
import { buildContent } from '../game/content';
import { BUILT_IN_BEHAVIORS } from '../gameplay/interaction/behaviors';
import { BUILT_IN_MODELS } from '../simulation/models';
import { DEFAULT_LUX, roomLights } from './lighting';

// Room lights from the shipped content (world/lighting.ts): under the room's own fixtures, shining
// down, the key reaching the whole floor, the others kept inside the walls.

const content = buildContent(bundledContent, {
  behaviors: new Registry('behaviour', BUILT_IN_BEHAVIORS),
  models: new Registry('simulation model', BUILT_IN_MODELS),
});
const itemOf = (id: string) => content.items.tryGet(id);

describe('room lights', () => {
  it('hang just under their fixtures, aimed at the floor below, in the fixtures’ colour', () => {
    const room = content.rooms.get('preparation-room');
    const [key, fill] = roomLights(room, itemOf);
    expect(key).toMatchObject({ role: 'key', position: [0, 2.92, -1.2], target: [0, 0, -1.2] });
    expect(fill).toMatchObject({ role: 'fill', position: [0, 2.92, 1.6], target: [0, 0, 1.6] });
    expect(key!.color).toBe(content.items.get('ceiling-light').visual.color);
    // Candela: the role's floor illuminance times the height squared (three's decay 2).
    expect(key!.intensity).toBeCloseTo(DEFAULT_LUX.key * 2.92 ** 2, 9);
    expect(fill!.intensity).toBeCloseTo(DEFAULT_LUX.fill * 2.92 ** 2, 9);
  });

  it('keep a fill’s cone inside its room’s walls, and end past what it shines at', () => {
    for (const room of content.rooms.all()) {
      const { min, max } = room.bounds;
      for (const light of roomLights(room, itemOf).filter((l) => l.role !== 'key')) {
        const [x, y, z] = light.position;
        const radius = (y - min[1]) * Math.tan(light.angle);
        const inside = Math.min(x - min[0], max[0] - x, z - min[2], max[2] - z);
        // At least 20°: a fixture right by a wall still lights the floor below it.
        if (light.angle > (20 * Math.PI) / 180 + 1e-9) {
          expect(radius, room.id).toBeLessThanOrEqual(inside + 1e-9);
        }
        // Past the floor below it, or past its target (an accent on a whiteboard).
        const [tx, ty, tz] = light.target;
        expect(light.range, room.id).toBeGreaterThan(Math.hypot(x - tx, y - ty, z - tz));
      }
    }
  });

  it('give every room of every world scene exactly one key; a dark room none', () => {
    for (const scene of content.scenes.all()) {
      if (scene.kind !== 'world') continue;
      for (const id of scene.rooms) {
        const keys = roomLights(content.rooms.get(id), itemOf).filter((l) => l.role === 'key');
        // A darkened room (the optics room, Phase T-1a) is lit by its dim fill only.
        expect(keys, id).toHaveLength(content.rooms.get(id).dark ? 0 : 1);
      }
    }
  });

  it('reach a lab’s bench tops: the key’s cone covers every corner at its reachHeight (lighting polish)', () => {
    // Sized to the floor's corners, a 10 × 8 m lab's key left its bench-top corners outside its
    // cone (72.7° off its axis against 68.1°) and, with a 0.6 penumbra, faded well before them.
    const labs = [
      'physics-lab',
      'projectile-range',
      'chemistry-lab',
      'biology-lab',
      'pendulum-bay',
    ];
    for (const id of labs) {
      const room = content.rooms.get(id);
      const key = roomLights(room, itemOf).find((l) => l.role === 'key')!;
      expect(key.penumbra, id).toBe(0.25);
      const { min, max } = room.bounds;
      const bench = min[1] + 0.9;
      for (const cx of [min[0], max[0]]) {
        for (const cz of [min[2], max[2]]) {
          const off = Math.atan2(
            Math.hypot(cx - key.position[0], cz - key.position[2]),
            key.position[1] - bench,
          );
          expect(off, `${id} corner ${cx}, ${cz}`).toBeLessThanOrEqual(key.angle + 1e-9);
        }
      }
    }
  });

  it('fade at the cone’s edge by the content’s penumbra, 0.6 where it says none', () => {
    for (const room of content.rooms.all()) {
      for (const light of roomLights(room, itemOf)) {
        const own = room.lights.find((l) => l.role === light.role && l.fixture.length > 0);
        expect(light.penumbra, room.id).toBe(own?.penumbra ?? 0.6);
      }
    }
    // The lobby and the preparation area keep their light as it was.
    for (const id of ['simlab-hub', 'preparation-room', 'cleanroom-corridor', 'teacher-room']) {
      for (const light of roomLights(content.rooms.get(id), itemOf)) {
        expect(light.penumbra, id).toBe(0.6);
      }
    }
  });
});
