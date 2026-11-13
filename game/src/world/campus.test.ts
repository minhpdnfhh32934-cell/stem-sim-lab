import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../core/math';
import { Registry } from '../core/Registry';
import { bundledContent } from '../content';
import { buildContent } from '../game/content';
import { BUILT_IN_BEHAVIORS } from '../gameplay/interaction/behaviors';
import { ItemDefinitionSchema } from '../gameplay/item';
import { BUILT_IN_MODELS } from '../simulation/models';
import { campusOffsets, doorPairs, pairOffset, translateRoom } from './campus';
import { RoomDefinitionSchema, SceneDefinitionSchema } from './definitions';
import { WALL_THICKNESS as T } from './roomGeometry';

const content = buildContent(bundledContent, {
  behaviors: new Registry('behaviour', BUILT_IN_BEHAVIORS),
  models: new Registry('simulation model', BUILT_IN_MODELS),
});
const scenes = content.scenes.all();
const worldIds = scenes.flatMap((s) => (s.kind === 'world' ? [s.id] : []));
const pairs = doorPairs(
  scenes,
  (id) => content.rooms.tryGet(id),
  (id) => content.items.tryGet(id),
);
const campus = campusOffsets(worldIds, pairs);
const offsetOf = (sceneId: string): Vec3 => {
  const offset = campus.get(sceneId);
  if (!offset) throw new Error(`${sceneId} has no campus offset`);
  return offset;
};
const minus = (a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];

describe('the campus frame of the shipped world', () => {
  it('joins the scenes through the five travel-door pairs, back to back', () => {
    expect(pairs.map(({ a, b }) => [a.entityId, a.wall, b.entityId, b.wall])).toEqual([
      ['preparation-room/door-teacher', 'east', 'teacher-room/door-preparation', 'west'],
      ['cleanroom-corridor/door-hub', 'north', 'simlab-hub/door-preparation', 'south'],
      ['simlab-hub/door-chemistry', 'north', 'chemistry-lab/door-hub', 'south'],
      ['simlab-hub/door-physics', 'east', 'physics-lab/door-hub', 'west'],
      ['simlab-hub/door-biology', 'west', 'biology-lab/door-hub', 'east'],
    ]);
  });

  it('places every scene relative to the hub as Z3 computed (multiples of 0.25 m: exact)', () => {
    const hub = offsetOf('simlab-hub');
    const fromHub = Object.fromEntries(worldIds.map((id) => [id, minus(offsetOf(id), hub)]));
    expect(fromHub).toEqual({
      'preparation-room': [0, 0, 17.5],
      'teacher-room': [5.75, 0, 18.5],
      'simlab-hub': [0, 0, 0],
      'physics-lab': [18.25, 0, -3],
      'chemistry-lab': [0, 0, -16.25],
      'biology-lab': [-18.25, 0, -3],
    });
  });

  it('has its origin at the first world scene in content order', () => {
    expect(worldIds[0]).toBe('preparation-room');
    expect(Object.fromEntries(campus)).toEqual({
      'preparation-room': [0, 0, 0],
      'teacher-room': [5.75, 0, 1],
      'simlab-hub': [0, 0, -17.5],
      'physics-lab': [18.25, 0, -20.5],
      'chemistry-lab': [0, 0, -33.75],
      'biology-lab': [-18.25, 0, -20.5],
    });
  });

  it('gives each pair the same relative offset from both ends, and the frame agrees with it', () => {
    for (const { a, b } of pairs) {
      const there = pairOffset(a, b);
      const back = pairOffset(b, a);
      expect(
        back.map((v) => -v + 0),
        a.entityId,
      ).toEqual(there);
      expect(minus(offsetOf(b.sceneId), offsetOf(a.sceneId)), a.entityId).toEqual(there);
    }
  });

  it('overlaps no two rooms of different scenes; some touch, exactly one wall apart', () => {
    const rooms = worldIds.flatMap((sceneId) => {
      const scene = content.scenes.get(sceneId);
      if (scene.kind !== 'world') return [];
      return scene.rooms.map((id) => ({
        sceneId,
        room: translateRoom(content.rooms.get(id), offsetOf(sceneId)),
      }));
    });
    const closer: string[] = [];
    const touching: string[] = [];
    rooms.forEach(({ sceneId, room: a }, i) => {
      for (const { sceneId: other, room: b } of rooms.slice(i + 1)) {
        if (other === sceneId) continue;
        const gap = (k: 0 | 1 | 2) =>
          Math.max(b.bounds.min[k] - a.bounds.max[k], a.bounds.min[k] - b.bounds.max[k]);
        const apart = Math.max(gap(0), gap(1), gap(2));
        if (apart < T - 1e-9) closer.push(`${a.id} | ${b.id}: ${apart}`);
        else if (apart < T + 1e-9) touching.push(`${a.id} | ${b.id}`);
      }
    });
    expect(closer).toEqual([]);
    // The hub's east wall also backs onto the projectile range and the pendulum bay (no door).
    expect(touching).toEqual([
      'preparation-room | teacher-room',
      'cleanroom-corridor | simlab-hub',
      'simlab-hub | physics-lab',
      'simlab-hub | projectile-range',
      'simlab-hub | pendulum-bay',
      'simlab-hub | chemistry-lab',
      'simlab-hub | chemistry-annex',
      'simlab-hub | biology-lab',
    ]);
  });
});

describe('campus helpers', () => {
  const door = ItemDefinitionSchema.parse({
    id: 'door',
    displayName: 'Door',
    category: 'furniture',
    physical: { massKg: 30 },
    visual: { shape: 'box', size: [1, 2.1, 0.08], color: '#8a6a4a' },
    interactions: ['travel'],
  });
  const room = (id: string, min: Vec3, max: Vec3, placements: object[] = []) =>
    RoomDefinitionSchema.parse({ id, displayName: id, bounds: { min, max }, placements });
  const doorAt = (id: string, position: Vec3, targetScene: string, arrival: string) => ({
    id,
    item: 'door',
    position,
    rotationY: Math.PI / 2,
    params: { targetScene, arrival },
  });
  const scene = (id: string, rooms: string[]) =>
    SceneDefinitionSchema.parse({
      kind: 'world',
      id,
      displayName: id,
      rooms,
      spawn: { position: [0, 0, 0] },
    });

  it('moves a room with its openings and placements; ids and the rest stay', () => {
    const r = RoomDefinitionSchema.parse({
      id: 'r',
      displayName: 'R',
      bounds: { min: [-2, 0, -3], max: [2, 3, 3] },
      openings: [
        { wall: 'north', center: 0.5, width: 1, height: 2 },
        { wall: 'east', center: -1, width: 1, height: 2 },
      ],
      placements: [{ id: 'p', item: 'door', position: [1, 0.5, 2], rotationY: 1 }],
    });
    const moved = translateRoom(r, [10, 0, -4]);
    expect(moved.bounds).toEqual({ min: [8, 0, -7], max: [12, 3, -1] });
    expect(moved.openings.map((o) => [o.wall, o.center])).toEqual([
      ['north', 10.5],
      ['east', -5],
    ]);
    expect(moved.placements).toEqual([{ ...r.placements[0], position: [11, 0.5, -2] }]);
    expect({ ...moved, bounds: r.bounds, openings: r.openings, placements: r.placements }).toEqual(
      r,
    );
    expect(translateRoom(r, [0, 0, 0])).toEqual(r);
    expect(r.bounds.min).toEqual([-2, 0, -3]); // the content is not touched
  });

  it('moves a glass floor with its room (the hub reached through a door: Phase V-2)', () => {
    const r = RoomDefinitionSchema.parse({
      id: 'r',
      displayName: 'R',
      bounds: { min: [-4, 0, -3], max: [4, 3, 3] },
      glassFloor: { x: [-2, 2], z: [-1, 1] },
    });
    expect(translateRoom(r, [10, 0, -4]).glassFloor).toEqual({ x: [8, 12], z: [-5, -3] });
    expect(r.glassFloor).toEqual({ x: [-2, 2], z: [-1, 1] }); // the content is not touched
  });

  it('pairs only mutual doors of different scenes on facing walls; a lone scene keeps its origin', () => {
    const rooms = new Map(
      [
        room('a', [-2, 0, -2], [2, 3, 2], [doorAt('d', [1.95, 0, 1], 'b', 'b/d')]),
        room(
          'b',
          [-1, 0, -1],
          [1, 3, 1],
          [
            doorAt('d', [-0.95, 0, 0], 'a', 'a/d'),
            doorAt('e', [0.95, 0, 0], 'c', 'c/d'), // c's door names a, not this one
          ],
        ),
        room('c', [-1, 0, -1], [1, 3, 1], [doorAt('d', [0.95, 0, 0], 'a', 'a/d')]),
        room('s', [-1, 0, -1], [1, 3, 1]),
        // One door per rule, each would be a pair but for that rule:
        // not named back (facing walls, other scenes): n1 → n2, n2 → a.
        room('n1', [-1, 0, -1], [1, 3, 1], [doorAt('d', [0.95, 0, 0], 'n2', 'n2/d')]),
        room('n2', [-1, 0, -1], [1, 3, 1], [doorAt('d', [-0.95, 0, 0], 'a', 'a/d')]),
        // named back, other scenes, but on walls that do not face each other (both east).
        room('w1', [-1, 0, -1], [1, 3, 1], [doorAt('d', [0.95, 0, 0], 'w2', 'w2/d')]),
        room('w2', [-1, 0, -1], [1, 3, 1], [doorAt('d', [0.95, 0, 0], 'w1', 'w1/d')]),
        // named back, facing walls, but two rooms of one scene (a doorway is not a door pair).
        room('m1', [-1, 0, -1], [1, 3, 1], [doorAt('d', [0.95, 0, 0], 'm', 'm2/d')]),
        room('m2', [1.25, 0, -1], [3.25, 3, 1], [doorAt('d', [1.3, 0, 0], 'm', 'm1/d')]),
      ].map((r) => [r.id, r]),
    );
    const list = [
      scene('a', ['a']),
      scene('b', ['b']),
      scene('c', ['c']),
      scene('s', ['s']),
      scene('n1', ['n1']),
      scene('n2', ['n2']),
      scene('w1', ['w1']),
      scene('w2', ['w2']),
      scene('m', ['m1', 'm2']),
    ];
    const found = doorPairs(
      list,
      (id) => rooms.get(id),
      () => door,
    );
    expect(found.map(({ a, b }) => `${a.entityId} ${a.wall} ⇄ ${b.entityId} ${b.wall}`)).toEqual([
      'a/d east ⇄ b/d west',
    ]);
    // a's east face 2, + one wall, = b's west face −1 + offset: offset x 3.25; doors along z 1 − 0.
    expect(
      Object.fromEntries(
        campusOffsets(
          list.map((s) => s.id),
          found,
        ),
      ),
    ).toEqual({
      a: [0, 0, 0],
      b: [3.25, 0, 1],
      c: [0, 0, 0],
      s: [0, 0, 0],
      n1: [0, 0, 0],
      n2: [0, 0, 0],
      w1: [0, 0, 0],
      w2: [0, 0, 0],
      m: [0, 0, 0],
    });
  });
});
