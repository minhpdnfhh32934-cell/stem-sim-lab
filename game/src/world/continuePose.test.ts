import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../core/math';
import type { Game } from '../game/Game';
import { bootTestGame, placePlayer } from '../game/testing';
import { type ItemDefinition, ItemDefinitionSchema } from '../gameplay/item';
import { MemorySaveStorage } from '../persistence/SaveSystem';
import { arrivalPose, continuePose, type StandPose } from './arrival';
import { type Placement, type RoomDefinition, RoomDefinitionSchema } from './definitions';

const H = 1 / 60;
const CAPSULE = { radius: 0.3, height: 1.75 };

const item = (id: string, size: Vec3, extra: object = {}): ItemDefinition =>
  ItemDefinitionSchema.parse({
    id,
    displayName: id,
    category: 'furniture',
    physical: { massKg: 10 },
    visual: { shape: 'box', size, color: '#888888' },
    ...extra,
  });
const ITEMS: Record<string, ItemDefinition> = {
  door: item('door', [1, 2.1, 0.08], { interactions: ['travel'] }),
  bench: item('bench', [2, 0.9, 0.8]),
  crate: item('crate', [0.5, 0.5, 0.5]),
  poster: item('poster', [2, 1, 0.04], { physical: { massKg: 1, body: 'none' } }),
};
const itemOf = (id: string) => ITEMS[id];

/** A 6 × 3 × 6 m room centred on the origin. */
const room = (placements: object[]): RoomDefinition =>
  RoomDefinitionSchema.parse({
    id: 'r',
    displayName: 'R',
    bounds: { min: [-3, 0, -3], max: [3, 3, 3] },
    placements,
  });
const NORTH = { id: 'north', item: 'door', position: [0, 0, -2.95] };
const EAST = { id: 'east', item: 'door', position: [2.95, 0, 0], rotationY: Math.PI / 2 };
const WEST = { id: 'west', item: 'door', position: [-2.95, 0, 0], rotationY: -Math.PI / 2 };
const BENCH = { id: 'bench', item: 'bench', position: [0, 0, 1] }; // x −1 … 1, z 0.6 … 1.4
const SPAWN: StandPose = { position: [1, 0, -1], yaw: 0.5 };

/** The arrival point of door `id` of `r`. */
function arrivalAt(r: RoomDefinition, id: string): StandPose {
  const pose = arrivalPose(r, r.placements.find((p) => p.id === id) as Placement);
  if (typeof pose === 'string') throw new Error(pose);
  return pose;
}

describe('continuePose', () => {
  const lab = room([BENCH, NORTH, { id: 'poster', item: 'poster', position: [1.5, 1, -1] }]);
  const at = (position: Vec3, rooms = [lab], capsule = CAPSULE) =>
    continuePose(rooms, SPAWN, itemOf, capsule, position);

  it('keeps a pose on the floor of a room, the capsule clear of its walls and solids', () => {
    expect(at([1.5, 0, -1])).toBeNull(); // the poster has no body
    // Nearer than the 0.4 m stand clearance, not than the 0.3 m radius: a wall, the bench.
    expect(at([2.65, 0, -1])).toBeNull();
    expect(at([0, 0, 0.25])).toBeNull();
    // Feet as physics writes them back on the floor (within 1 mm of it, measured).
    expect(at([1.5, -0.0007, -1])).toBeNull();
    expect(at([1.5, 0.001, -1])).toBeNull();
  });

  it('replaces a pose inside a solid, or with the capsule reaching into one', () => {
    expect(at([0, 0, 1])).toEqual(arrivalAt(lab, 'north'));
    expect(at([0, 0, 0.35])).toEqual(arrivalAt(lab, 'north')); // 0.25 m from the bench
  });

  it('replaces a pose outside every room, in a wall or doorway, below the floor or the ceiling', () => {
    for (const position of [
      [9, 0, 0], // outside every room
      [2.8, 0, -1], // the capsule in the east wall
      [0, 0, -2.9], // in the doorway, inside the door
      [0, 0, -3.1], // in the north wall
      [1.5, -0.05, -1], // below the floor
      [1.5, 1.5, -1], // the 1.75 m capsule through the 3 m ceiling
    ] satisfies Vec3[]) {
      expect(at(position), position.join(', ')).toEqual(arrivalAt(lab, 'north'));
    }
    expect(at([1.5, 1, -1])).toBeNull(); // above the floor, under the ceiling: it falls
  });

  it('measures the clearance with the radius it is given', () => {
    expect(at([2.65, 0, -1], [lab], { radius: 0.4, height: 1.75 })).toEqual(
      arrivalAt(lab, 'north'),
    );
  });

  it('uses the spawn in a scene without doors, or where no arrival point is free', () => {
    expect(at([0, 0, 1], [room([BENCH])])).toBe(SPAWN);
    const blocked = room([BENCH, NORTH, { id: 'crate', item: 'crate', position: [0, 0, -1.95] }]);
    expect(at([0, 0, 1], [blocked])).toBe(SPAWN);
  });

  it('takes the nearest door, the first in content order on a tie, skipping a blocked one', () => {
    const westFirst = room([WEST, EAST, BENCH]);
    const eastFirst = room([EAST, WEST, BENCH]);
    // In the bench, as far from either door: the first listed, the same every time.
    expect(at([0, 0, 1], [westFirst])).toEqual(arrivalAt(westFirst, 'west'));
    expect(at([0, 0, 1], [westFirst])).toEqual(at([0, 0, 1], [westFirst]));
    expect(at([0, 0, 1], [eastFirst])).toEqual(arrivalAt(eastFirst, 'east'));
    // Nearer the east door, in either order.
    expect(at([0.9, 0, 1], [westFirst])).toEqual(arrivalAt(westFirst, 'east'));
    expect(at([0.9, 0, 1], [eastFirst])).toEqual(arrivalAt(eastFirst, 'east'));
    // Its arrival point in a crate: the west door.
    const crated = room([
      EAST,
      WEST,
      BENCH,
      { id: 'crate', item: 'crate', position: [1.95, 0, 0] },
    ]);
    expect(at([0.9, 0, 1], [crated])).toEqual(arrivalAt(crated, 'west'));
  });
});

/**
 * Every save pose the existing tests Continue from or keep in a save, by scene, with where. Saves
 * the game itself makes (autosaves at spawns and arrivals, saves after physics frames) are
 * covered by the spawn and arrival checks below and by the unit suite itself.
 */
const SAVED: [string, Vec3, string][] = [
  // The Physics wing of Phase T-1a: in front of each station's desk or board.
  [
    'physics-lab',
    [12.417, 0, -5.35],
    'e2e analysis, hooke, oscillation, pause, progress, pointer-lock, settings',
  ],
  ['physics-lab', [2.017, 0, -5.35], 'e2e free-fall, settings, vietnamese'],
  ['physics-lab', [6.967, 0, -5.65], 'pause.test'],
  ['physics-lab', [3.967, 0, 0], 'e2e canvas, draw-calls lab-ceiling'],
  ['physics-lab', [3.967, 0, -3.632], 'e2e settings (lab ceiling)'],
  ['physics-lab', [11.05, 0, 1.132], 'e2e inclined-plane'],
  ['physics-lab', [3.583, 0, 5.6], 'e2e ohms-law'],
  ['physics-lab', [27.35, 0, -3.15], 'e2e refraction'],
  ['physics-lab', [15.217, 0, -5.6], 'e2e physics-benches (buoyancy)'],
  ['physics-lab', [5.717, 0, 1.132], 'e2e physics-benches (energy)'],
  ['physics-lab', [9.35, 0, -1.132], 'e2e physics-benches (collisions)'],
  ['physics-lab', [-2.95, 0, -13.35], 'e2e physics-benches (circular motion)'],
  ['physics-lab', [27.35, 0, 1.45], 'e2e physics-benches (reflection)'],
  ['physics-lab', [27.05, 0, 3.8], 'e2e physics-benches (lens)'],
  ['physics-lab', [7.05, 0, 5.6], 'e2e physics-benches (power)'],
  ['physics-lab', [-2.067, 0, -3.574], 'e2e inventory (the teacher’s bench)'],
  [
    'physics-lab',
    [-1.2, 0, 13.1],
    'e2e history, measurement, results-view, run-history, draw-calls; bench',
  ],
  ['physics-lab', [2.4, 0, -8.4], 'e2e draw-calls pendulum; bench; PendulumStation.test'],
  ['physics-lab', [0, 0, -8.7], 'e2e settings, draw-calls bay-wall'],
  ['physics-lab', [3.6, 0, -8.7], 'e2e history, measurement, results-view; bench'],
  ['physics-lab', [-2.167, 0, -5.474], 'e2e pendulum'],
  ['physics-lab', [-3.95, 0, 0], 'e2e resources'],
  ['physics-lab', [0.6, 0, 14.5], 'bench'],
  ['physics-lab', [-3.85, 0, 10.5], 'StationHistory.test'],
  ['physics-lab', [-1.5, 0, 0], 'Game.test; continuePose.test'],
  ['physics-lab', [0, 0, 0], 'Game.test; e2e topics'],
  ['simlab-hub', [11.2, 0, -3], 'e2e topics'],
  ['simlab-hub', [0, 0, 4.95], 'e2e preparation'],
  ['simlab-hub', [0, 0, 0], 'Game.test; e2e topics'],
];

describe('continuePose in the shipped world', () => {
  async function shipped() {
    const { game } = await bootTestGame();
    await game.loadLab(); // the labs' placements, as Continue has them
    const { content } = game;
    const height = Math.max(...content.characters.all().map((c) => c.appearance.heightM));
    const capsule = { radius: game.config.player.radius, height };
    const pose = (sceneId: string, position: Readonly<Vec3>) => {
      const scene = content.scenes.get(sceneId);
      if (scene.kind !== 'world') throw new Error(`"${sceneId}" is not a world scene`);
      const rooms = scene.rooms.map((id) => content.rooms.get(id));
      return continuePose(rooms, scene.spawn, (id) => content.items.tryGet(id), capsule, position);
    };
    const door = (entityId: string) => {
      const [roomId, id] = entityId.split('/') as [string, string];
      return arrivalAt(content.rooms.get(roomId), id);
    };
    return { content, pose, door };
  }

  it('keeps every save pose the tests use, every spawn and every door arrival point', async () => {
    const { content, pose, door } = await shipped();
    for (const [sceneId, position, where] of SAVED) {
      expect(pose(sceneId, position), `${where}: ${sceneId} ${position.join(', ')}`).toBeNull();
    }
    let doors = 0;
    for (const scene of content.scenes.all()) {
      if (scene.kind !== 'world') continue;
      expect(pose(scene.id, scene.spawn.position), `${scene.id} spawn`).toBeNull();
      for (const room of scene.rooms.map((id) => content.rooms.get(id))) {
        for (const p of room.placements) {
          if (!content.items.get(p.item).interactions.includes('travel')) continue;
          const id = `${room.id}/${p.id}`;
          expect(pose(scene.id, door(id).position), `${id} arrival`).toBeNull();
          doors++;
        }
      }
    }
    expect(doors).toBeGreaterThan(0);
  });

  it('puts a save in a doorway or in a solid in front of the nearest door', async () => {
    const { pose, door } = await shipped();
    // Inside the closed door to the hub; in the hub's east doorway; in the teacher's bench.
    expect(pose('physics-lab', [-4.98, 0, 0])).toEqual(door('physics-lab/door-hub'));
    expect(pose('simlab-hub', [12.98, 0, -3])).toEqual(door('simlab-hub/door-physics'));
    expect(pose('physics-lab', [-1.667, 0, -4.474])).toEqual(door('physics-lab/door-hub'));
    // In the opening from the lab to the projectile range (in no room's bounds).
    expect(pose('physics-lab', [-2, 0, 7.6])).toEqual(door('physics-lab/door-hub'));
  });

  it('counts a closed door leaf (a kinematic body) as solid; the doorway behind it is no room', async () => {
    const { content, pose, door } = await shipped();
    expect(content.items.get('sliding-door').physical.body).toBe('kinematic');
    // 0.35 m from the lab's west wall: clear of it, but the capsule reaches into the leaf
    // (its face at x −4.91), so every load, which starts with closed doors, would push it out.
    expect(pose('physics-lab', [-4.65, 0, 0])).toEqual(door('physics-lab/door-hub'));
    expect(pose('physics-lab', [-4.65, 0, -1.2])).toBeNull(); // beside it: free
    // Through the doorway, in the wall between the hub and the lab (a crossing autosave).
    expect(pose('physics-lab', [-5.1, 0, 0])).toEqual(door('physics-lab/door-hub'));
  });
});

describe('Continue in the real game', () => {
  const frames = (game: Game, seconds: number) => {
    for (let i = 0; i < Math.round(seconds / H); i++) game.update(H);
  };

  /** A game saved in the Physics Lab at `position` (yaw 0.5, pitch −0.2), then continued. */
  async function continueFrom(position: Vec3) {
    const storage = new MemorySaveStorage();
    const first = await bootTestGame({ storage });
    await first.game.newGame('researcher-female');
    await first.game.scenes.load('physics-lab'); // developer jump (setup only)
    placePlayer(first.game, position, 0.5, -0.2);
    expect(first.game.save()?.ok).toBe(true);
    first.game.dispose();
    const again = await bootTestGame({ storage });
    expect((await again.game.continueGame()).ok).toBe(true);
    return again;
  }

  it('puts a save inside a solid at the nearest door: on the floor, still, warned', async () => {
    const { game, logs } = await continueFrom([-1.667, 0, -4.474]); // inside the teacher's bench
    const lab = game.content.rooms.get('physics-lab');
    const want = arrivalAt(lab, 'door-hub');
    const { player } = game.state;
    expect(player.position).toEqual(want.position);
    expect([player.yaw, player.pitch]).toEqual([want.yaw, 0]);
    expect(logs.filter((l) => l.level === 'warn' || l.level === 'error')).toEqual([
      {
        level: 'warn',
        channel: 'SIMLAB',
        message: expect.stringContaining(
          'Saved position -1.667, 0, -4.474 in "physics-lab" is not free',
        ) as string,
      },
    ]);
    frames(game, 0.5);
    const [x, y, z] = player.position;
    expect([x, z]).toEqual([
      expect.closeTo(want.position[0], 4),
      expect.closeTo(want.position[2], 4),
    ]);
    expect(Math.abs(y)).toBeLessThan(0.02);
    expect(player.grounded).toBe(true);
  });

  it('keeps a valid save exactly: position, yaw and pitch, without a warning', async () => {
    const { game, logs } = await continueFrom([-1.5, 0, 0]);
    expect(game.state.player).toMatchObject({ position: [-1.5, 0, 0], yaw: 0.5, pitch: -0.2 });
    expect(logs.filter((l) => l.level === 'warn' || l.level === 'error')).toEqual([]);
  });
});
