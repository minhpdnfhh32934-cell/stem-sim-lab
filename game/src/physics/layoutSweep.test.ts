import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../core/config';
import { containsXZ, type Vec3 } from '../core/math';
import { Registry } from '../core/Registry';
import { bundledContent } from '../content';
import { buildContent, type RawContent } from '../game/content';
import type { Game } from '../game/Game';
import { bootTestGame, placePlayer } from '../game/testing';
import { BUILT_IN_BEHAVIORS } from '../gameplay/interaction/behaviors';
import { BUILT_IN_MODELS } from '../simulation/models';
import { blockingPlacement, STAND_CLEARANCE, standsInside } from '../world/arrival';
import type { Opening, RoomDefinition } from '../world/definitions';
import { leadsInto, roomSlabs, WALL_THICKNESS as T } from '../world/roomGeometry';

// The shipped scenes in the real game, with real Rapier: where players stand, walk through
// doorways and meet walls, and what physics builds for each scene.

const H = 1 / 60;
/** The character controller's offset (PhysicsSystem): a stopped capsule is r + SKIN from a wall. */
const SKIN = 0.01;
/** Idle frames after placing the player, to settle the teleport. */
const SETTLE = 6;
/** A crossing starts this far (m) in front of the wall and ends at least as far past it. */
const INSIDE = 0.45;
/** Frames of walking that take a crossing from 0.45 m in front of the wall to 0.47 m past it. */
const CROSS = 32;
/** A wall probe starts this far (m) in front of the wall. */
const PROBE = 0.5;

const content = buildContent(bundledContent, {
  behaviors: new Registry('behaviour', BUILT_IN_BEHAVIORS),
  models: new Registry('simulation model', BUILT_IN_MODELS),
});
const itemOf = (id: string) => content.items.tryGet(id);
const tallest = content.characters
  .all()
  .reduce((a, b) => (b.appearance.heightM > a.appearance.heightM ? b : a)).id;
const worlds = content.scenes.all().flatMap((s) => (s.kind === 'world' ? [s] : []));
const roomsOf = (sceneId: string) =>
  worlds.find((s) => s.id === sceneId)!.rooms.map((id) => content.rooms.get(id));
/** The capsule radius the test game runs with (bootTestGame uses the default config). */
const { radius } = resolveConfig().player;

/** An opening into another room of its scene, seen from the room it belongs to. */
interface Doorway {
  readonly name: string;
  readonly scene: string;
  readonly room: RoomDefinition;
  readonly next: RoomDefinition;
  readonly opening: Opening;
  /** Its wall runs along x (north and south walls). */
  readonly alongX: boolean;
  /** Facing out through it (yaw 0 looks along −z). */
  readonly yaw: number;
  /** The floor point `along` its wall, `inside` m in front of the wall face (negative: past it). */
  at(along: number, inside: number): Vec3;
  /** How far `p` is in front of the wall face, and where it is along the wall. */
  read(p: Readonly<Vec3>): { inside: number; along: number };
}

function doorway(
  scene: string,
  room: RoomDefinition,
  next: RoomDefinition,
  opening: Opening,
): Doorway {
  const { min, max } = room.bounds;
  const alongX = opening.wall === 'north' || opening.wall === 'south';
  const outward = opening.wall === 'west' || opening.wall === 'north' ? -1 : 1;
  const face = { west: min[0], east: max[0], north: min[2], south: max[2] }[opening.wall];
  return {
    name: `${room.id} → ${next.id}`,
    scene,
    room,
    next,
    opening,
    alongX,
    yaw: Math.atan2(alongX ? 0 : -outward, alongX ? -outward : 0),
    at: (along, inside) => {
      const across = face - outward * inside;
      return alongX ? [along, min[1], across] : [across, min[1], along];
    },
    read: (p) => ({
      inside: outward * (face - (alongX ? p[2] : p[0])),
      along: alongX ? p[0] : p[2],
    }),
  };
}

const doorways = worlds.flatMap((scene) => {
  const rooms = scene.rooms.map((id) => content.rooms.get(id));
  return rooms.flatMap((room) =>
    room.openings.flatMap((opening) => {
      const next = rooms.find((other) => other !== room && leadsInto(room, opening, other));
      return next ? [doorway(scene.id, room, next, opening)] : [];
    }),
  );
});

/**
 * The wall on each side of each doorway, probed from where a player can stand: STAND_CLEARANCE
 * beside the opening, free of walls and objects where the probe starts and where it stops.
 */
const walls = doorways.flatMap((door) =>
  [-1, 1].flatMap((side) => {
    const { room, opening } = door;
    const along = opening.center + side * (opening.width / 2 + STAND_CLEARANCE);
    const [x, , z] = door.at(along, PROBE);
    const stop = door.at(along, radius + SKIN);
    const free = (px: number, pz: number) => blockingPlacement(room, itemOf, px, pz) === null;
    if (!standsInside(room, x, z) || !free(x, z) || !free(stop[0], stop[2])) return [];
    const beside = door.alongX ? (side < 0 ? 'west' : 'east') : side < 0 ? 'north' : 'south';
    return [{ name: `${room.id} ${opening.wall} wall, ${beside} of the doorway`, door, along }];
  }),
);

/** A new game as the tallest character, jumped to `sceneId` (setup only; doors: arrival.test). */
async function start(sceneId: string, raw?: RawContent): Promise<Game> {
  const { game } = await bootTestGame(raw ? { content: raw } : {});
  await game.newGame(tallest);
  await game.scenes.load(sceneId);
  return game;
}

/** Every hinged item of the scene swung open (from the spawn: clear of every swing). */
function openHinged(game: Game) {
  const hinged = [...game.world.allEntities()].filter((e) => e.item.hinged);
  for (const e of hinged) game.entityStates.set(e.id, 'open', true);
  frames(game, 90);
  for (const e of hinged) expect(game.hinges.fraction(e.id), e.id).toBe(1);
}

function frames(game: Game, count: number) {
  for (let i = 0; i < count; i++) game.update(H);
}

/** Holds forward for `count` frames, then lets go for one (the room is announced a frame late). */
function walk(game: Game, count: number) {
  game.input.press('moveForward');
  frames(game, count);
  game.input.release('moveForward');
  game.update(H);
}

describe('standing at each scene spawn', () => {
  it.each(worlds.map((scene) => [scene.id, scene] as const))('%s', async (sceneId, scene) => {
    const game = await start(sceneId);
    frames(game, 30);
    const [x, y, z] = scene.spawn.position;
    const { position, grounded, roomId } = game.state.player;
    expect(position[0]).toBeCloseTo(x, 4);
    expect(position[2]).toBeCloseTo(z, 4);
    expect(Math.abs(position[1] - y)).toBeLessThan(0.005);
    expect(grounded).toBe(true);
    expect(roomId).toBe(roomsOf(sceneId).find((r) => containsXZ(r.bounds, x, z))?.id);
    game.dispose();
  });
});

describe('walking straight through every doorway, both ways', () => {
  it.each(doorways.map((door) => [door.name, door] as const))('%s', async (_name, door) => {
    const { room, next, opening } = door;
    const from = door.at(opening.center, INSIDE);
    expect(standsInside(room, from[0], from[2])).toBe(true);
    expect(blockingPlacement(room, itemOf, from[0], from[2])).toBeNull();
    const game = await start(door.scene);
    openHinged(game); // walked through open (the washroom door; UX3.1)
    placePlayer(game, from, door.yaw);
    frames(game, SETTLE);
    const before = door.read(game.state.player.position);
    walk(game, CROSS);
    const { position, grounded, roomId } = game.state.player;
    const after = door.read(position);
    const travel = before.inside - after.inside;
    expect(-after.inside - T).toBeGreaterThanOrEqual(INSIDE); // that far into the next room
    expect(Math.abs(travel - CROSS * game.config.player.walkSpeed * H)).toBeLessThanOrEqual(0.002);
    expect(Math.abs(after.along - before.along)).toBeLessThan(1e-3); // not deflected by a jamb
    expect(Math.abs(position[1] - room.bounds.min[1])).toBeLessThan(0.005);
    expect(grounded).toBe(true);
    expect(roomId).toBe(next.id);
    game.dispose();
  });
});

describe('the wall beside each doorway', () => {
  it('is probed from every side a player can stand on', () => {
    // Not probed: the corridor's west side (lockers), the teacher room's west side (0.1 m from
    // the west wall) and both sides in the bathroom (0.5 m wall pieces, narrower than the
    // capsule with its clearance; probed from the teacher room). Phase U-2: the larger Physics Lab
    // leaves room beside all its doorways (in T-1a benches stood against three of those walls).
    expect(walls.map((w) => w.name)).toEqual([
      'preparation-room north wall, west of the doorway',
      'preparation-room north wall, east of the doorway',
      'cleanroom-corridor south wall, east of the doorway',
      'teacher-room south wall, east of the doorway',
      'physics-lab south wall, west of the doorway',
      // Phase E-1: the circuit parts cabinet stands against the range doorway's east wall.
      'physics-lab north wall, west of the doorway',
      'physics-lab north wall, east of the doorway',
      'physics-lab east wall, north of the doorway',
      'physics-lab east wall, south of the doorway',
      'projectile-range north wall, west of the doorway',
      'projectile-range north wall, east of the doorway',
      'pendulum-bay south wall, west of the doorway',
      'pendulum-bay south wall, east of the doorway',
      'waves-optics west wall, north of the doorway',
      'waves-optics west wall, south of the doorway',
      // Phase X: the Chemistry Lab's practice room (a sink bench north of its doorway).
      'chemistry-lab west wall, south of the doorway',
      'chemistry-annex east wall, north of the doorway',
      'chemistry-annex east wall, south of the doorway',
      'biology-lab west wall, south of the doorway',
      'biology-annex east wall, north of the doorway',
      'biology-annex east wall, south of the doorway',
    ]);
  });

  it.each(walls.map((w) => [w.name, w] as const))('%s stops the player', async (_name, w) => {
    const { door, along } = w;
    const game = await start(door.scene);
    placePlayer(game, door.at(along, PROBE), door.yaw);
    frames(game, SETTLE);
    const before = door.read(game.state.player.position);
    walk(game, 60);
    const after = door.read(game.state.player.position);
    expect(Math.abs(after.inside - (game.config.player.radius + SKIN))).toBeLessThan(0.002);
    expect(Math.abs(after.along - before.along)).toBeLessThan(0.002);
    expect(game.state.player.roomId).toBe(door.room.id);
    game.dispose();
  });
});

describe('physics bodies and colliders of each world scene', () => {
  const counts: [string, number, number][] = [
    ['preparation-room', 17, 39], // UX3.1: the PPE cabinet's 5 carcass colliders and 2 leaves
    // UX3.1: the washroom door (its body, no collider; its leaf); Phase F-1: its cabinet opens
    // (two leaves, a carcass of seven)
    ['teacher-room', 16, 38],
    ['simlab-hub', 42, 55], // Phase Y: + the teacher's capsule; F-2: + the laptop
    // 14C+: the range's refraction, Ohm's law and incline stations; + 7 benches: 7 apparatus,
    // 7 desks and 4 benches under them. Phase T-1a: the wing rebuilt — every bench station on a
    // lab bench (5 more), 19 benches kept for the planned experiments, the teacher's cabinets and
    // sink.
    ['physics-lab', 177, 232], // Phase U: six sliding door leaves; T-2: speed, forces, lever, pressure; T-3: seven more; T-4: six more; the ripple tank, the electric field; the air track, the Atwood machine; Phase X: the AC generator; Phase E-1: the circuit bench, board, parts cabinet (carcass and two leaves) and its 37 parts (+42 bodies, +49 colliders); E-2: the 12 V battery and the CO₂ extinguisher (+2); F-1: its two cabinets open (+4 bodies, +18 colliders)
    // The titration, reaction-rate and heating stations: no desks (the heating plate stands on a
    // bench). The dilution slice adds 19 bodies and 26 colliders: the reagent cabinet (8 carcass
    // boxes, 2 leaves), its 13 dynamic glass items, the colorimeter, the white tile and the pipette
    // rack (a collider each).
    // Phase B's titration bench: the retort stand (3 colliders: foot, tile, rod) in place of the 2D
    // rig, 11 dynamic glass items and a pipette rack: +12 bodies, +14 colliders.
    ['chemistry-lab', 109, 134], // + the light switch; T-5: the solubility station's bench, desk and apparatus; Phase X: the practice room's stations (3 each)
    ['biology-lab', 72, 88], // four stations: their apparatus and the benches under them (the enzyme rig's own since Phase L), no desks (they work in workspaces); T-6: the transpiration station's bench, desk and potometer; T-6b: each new station's bench, desk and apparatus (respiration, pea cross, mark and recapture, food tests); Phase X: the practice room (its walls, door and twelve stations)
  ];

  it.each(counts)('%s: %i bodies, %i colliders', async (sceneId, bodies, colliders) => {
    // A fixed body per room holding its shell slabs, a body per solid (a hinged one: its carcass,
    // a collider per box, and a kinematic body per leaf), and the player's capsule.
    const rooms = roomsOf(sceneId);
    const solids = rooms
      .flatMap((r) => r.placements)
      .map((p) => itemOf(p.item))
      .filter((item) => item && item.physical.body !== 'none');
    const own = solids.reduce((sum, i) => sum + 1 + (i?.hinged?.leaves.length ?? 0), 0);
    const shapes = solids.reduce(
      (sum, i) =>
        sum +
        (i?.hinged
          ? i.hinged.carcass.length + i.hinged.leaves.length
          : (i?.colliders?.length ?? 1)),
      0,
    );
    const slabs = rooms.reduce((sum, r) => sum + roomSlabs(r).length, 0);
    // Phase Y: a capsule (a body, a collider) for each person who lives in the scene.
    const people = ((bundledContent.npcs ?? []) as { scene: string }[]).filter(
      (npc) => npc.scene === sceneId,
    ).length;
    expect([rooms.length + own + 1 + people, slabs + shapes + 1 + people]).toEqual([
      bodies,
      colliders,
    ]);
    const game = await start(sceneId);
    game.update(H);
    expect(game.physics.stats()).toMatchObject({ bodies, colliders });
    game.dispose();
  });
});

describe('a doorway too small for the tallest character keeps it out', () => {
  const door = doorways.find((d) => d.room.id === 'preparation-room')!;

  it.each<[string, Partial<Opening>]>([
    ['0.5 m wide', { width: 0.5 }],
    ['1.7 m high', { height: 1.7 }],
  ])('%s', async (_name, change) => {
    const raw = structuredClone(bundledContent);
    for (const room of raw.rooms as { id: string; openings?: object[] }[]) {
      if (room.id === door.room.id || room.id === door.next.id) {
        Object.assign(room.openings![0]!, change);
      }
    }
    const game = await start(door.scene, raw);
    placePlayer(game, door.at(door.opening.center, INSIDE), door.yaw);
    frames(game, SETTLE);
    let entered = false;
    game.input.press('moveForward');
    for (let i = 0; i < CROSS; i++) {
      game.update(H);
      const [x, , z] = game.state.player.position;
      entered ||= containsXZ(door.next.bounds, x, z) || game.state.player.roomId === door.next.id;
    }
    game.input.release('moveForward');
    game.update(H);
    expect(entered).toBe(false);
    expect(game.state.player.roomId).toBe(door.room.id);
    game.dispose();
  });
});
