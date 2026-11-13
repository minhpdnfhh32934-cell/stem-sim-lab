import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../core/math';
import { Registry } from '../core/Registry';
import { bundledContent } from '../content';
import { buildContent } from '../game/content';
import type { Game } from '../game/Game';
import type { GameEvents } from '../game/GameEvents';
import { bootTestGame, flush, placePlayer, untilIdle } from '../game/testing';
import { AWAY_M } from '../gameplay/door/DoorSystem';
import { BUILT_IN_BEHAVIORS } from '../gameplay/interaction/behaviors';
import { MemorySaveStorage } from '../persistence/SaveSystem';
import { BUILT_IN_MODELS } from '../simulation/models';
import { arrivalPose } from './arrival';
import { alongX, type DoorEnd, doorPairs } from './campus';

// Walk-through doors in the real game with real Rapier (Z1 §8): every pair of the shipped content,
// both ways. The player walks to a door, opens it, walks through into the next scene and on: no
// teleport — every frame the player moves at most one step of walking in the campus frame, the
// view untouched — and nothing is loaded; the door closes behind and the scene left is released.
// Scenes are reached with the developer jump (setup only).

const H = 1 / 60;
const LOADS = ['SceneLoading', 'SceneLoaded', 'SceneUnloaded'] as const;
/** How far (m) past the near leaf the far room's wall face is: 0.05 inset + a 0.25 m wall. */
const FAR_FACE = 0.3;
const TIMEOUT = 60_000;

const content = buildContent(bundledContent, {
  behaviors: new Registry('behaviour', BUILT_IN_BEHAVIORS),
  models: new Registry('simulation model', BUILT_IN_MODELS),
});
const itemOf = (id: string) => content.items.tryGet(id);
const pairs = doorPairs(content.scenes.all(), (id) => content.rooms.tryGet(id), itemOf).filter(
  ({ a, b }) => itemOf(a.door.item)?.door && itemOf(b.door.item)?.door,
);
const directions = pairs.flatMap(({ a, b }): [string, DoorEnd, DoorEnd][] => [
  [`${a.entityId} → ${b.sceneId}`, a, b],
  [`${b.entityId} → ${a.sceneId}`, b, a],
]);
const entry = content.procedures.get('cleanroom-entry');
const pairOf = (sceneA: string, sceneB: string) => {
  const pair = pairs.find(
    ({ a, b }) =>
      (a.sceneId === sceneA && b.sceneId === sceneB) ||
      (a.sceneId === sceneB && b.sceneId === sceneA),
  );
  if (!pair) throw new Error(`no walk-through pair ${sceneA} ⇄ ${sceneB}`);
  return pair.a.sceneId === sceneA ? ([pair.a, pair.b] as const) : ([pair.b, pair.a] as const);
};

const frames = (game: Game, count: number) => {
  for (let i = 0; i < count; i++) game.update(H);
};

/** A new game as the tallest character, jumped to `sceneId`, one frame run. */
async function start(sceneId: string, options: Parameters<typeof bootTestGame>[0] = {}) {
  const booted = await bootTestGame(options);
  await booted.game.newGame('researcher-male');
  await booted.game.scenes.load(sceneId);
  frames(booted.game, 1);
  return booted;
}

/** Everything a resident set gives back exactly. */
function counts(game: Game) {
  const { bodies, colliders } = game.physics.stats();
  return {
    bodies,
    colliders,
    entities: game.world.entityCount,
    interactables: game.interaction.count,
    residents: game.scenes.residentIds,
  };
}

function watch<K extends keyof GameEvents>(game: Game, types: readonly K[]) {
  const seen: { type: K; payload: GameEvents[K] }[] = [];
  for (const type of types) game.events.subscribe(type, (payload) => seen.push({ type, payload }));
  return seen;
}

/** The floor direction from a door into its room (unit: the arrival point is 1 m in front). */
function inward(end: DoorEnd): [number, number] {
  const pose = arrivalPose(end.room, end.door);
  if (typeof pose === 'string') throw new Error(pose);
  return [pose.position[0] - end.door.position[0], pose.position[2] - end.door.position[2]];
}

/** Prepared for the gated doors: the entrance lets a ready player in (the exit needs PPE off). */
function satisfyGates(game: Game, doorId: string) {
  if (doorId !== entry.entrance) return;
  game.state.progression.procedures[entry.id] = {
    completed: entry.steps.map((s) => s.id),
    entered: false,
  };
  for (const id of entry.requiredEquipment) game.equipment.wear(id);
}

/** In the current scene, `from`'s: 1.5 m in front of the door, facing it, settled (setup). */
function standBefore(game: Game, from: DoorEnd, distance = 1.5) {
  expect(game.state.session.sceneId).toBe(from.sceneId);
  const [nx, nz] = inward(from);
  const [x, , z] = plus(from.door.position, game.scenes.origin);
  placePlayer(game, [x + nx * distance, 0, z + nz * distance], Math.atan2(nx, nz));
  frames(game, 6);
}

/** Opens the door the player faces with its own action and waits until it stands open. */
async function open(game: Game, door: string) {
  expect(game.interaction.perform(door, 'travel')).toBe(true);
  untilIdle(game); // the key card on the reader: the door asked to open
  await flush(); // the far scene is attached (its preparation awaited)
  for (let i = 0; i < 120 && game.doors.state(door) !== 'open'; i++) game.update(H);
  expect(game.doors.state(door)).toBe('open');
}

interface Sample {
  readonly campus: Vec3;
  readonly drawn: Vec3;
  /** How far past door `from` along its way through (m), and where along its wall. */
  readonly progress: number;
  readonly along: number;
  readonly y: number;
  readonly yaw: number;
  readonly pitch: number;
  readonly grounded: boolean;
  readonly scene: string | null;
}

const plus = (a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];

/** Measures the player against door `from` (as placed in the frame: `origin` is its scene's). */
function sampler(game: Game, from: DoorEnd, origin: Readonly<Vec3>) {
  const [nx, nz] = inward(from);
  const [dx, , dz] = plus(from.door.position, origin);
  const wallAlongX = alongX(from.wall);
  return (): Sample => {
    const p = game.state.player.position;
    const offset = game.scenes.campusOffset;
    return {
      campus: plus(p, offset),
      drawn: plus(game.physics.renderPlayer([0, 0, 0]), offset),
      progress: -((p[0] - dx) * nx + (p[2] - dz) * nz),
      along: wallAlongX ? p[0] : p[2],
      y: p[1],
      yaw: game.state.player.yaw,
      pitch: game.state.player.pitch,
      grounded: game.state.player.grounded,
      scene: game.state.session.sceneId,
    };
  };
}

/**
 * Frames whose campus (or drawn) position moved more on the floor than a step of walking: a
 * teleport. (Height is bounded on its own: the controller settles the feet by a few mm.)
 */
function jumps(samples: readonly Sample[], speed: number): string[] {
  const limit = speed * H + 1e-4;
  const step = (a: Readonly<Vec3>, b: Readonly<Vec3>) => Math.hypot(b[0] - a[0], b[2] - a[2]);
  return samples.slice(1).flatMap((s, i) => {
    const before = samples[i]!;
    const moved = step(before.campus, s.campus);
    const drawn = step(before.drawn, s.drawn);
    return moved > limit || drawn > limit
      ? [`frame ${i + 1}: ${moved.toFixed(4)} m (drawn ${drawn.toFixed(4)} m)`]
      : [];
  });
}

/** Holds W, sampling every frame, until `done` (or `max` frames). */
function walk(game: Game, sample: () => Sample, done: (s: Sample) => boolean, max = 600) {
  const samples = [sample()];
  game.input.press('moveForward');
  for (let i = 0; i < max && !done(samples.at(-1)!); i++) {
    game.update(H);
    samples.push(sample());
  }
  game.input.release('moveForward');
  return samples;
}

/** Waits (standing) until only `sceneId` is resident: the door behind closed, the rest released. */
function waitReleased(game: Game, sceneId: string, max = 600) {
  for (let i = 0; i < max && game.scenes.residentIds.join() !== sceneId; i++) game.update(H);
  expect(game.scenes.residentIds).toEqual([sceneId]);
}

describe('walk-through doors in the shipped world', () => {
  it('joins the hub to every laboratory and the clean corridor, and the preparation room to the teacher room', () => {
    expect(pairs.map(({ a, b }) => `${a.entityId} ⇄ ${b.entityId}`)).toEqual([
      'preparation-room/door-teacher ⇄ teacher-room/door-preparation',
      'cleanroom-corridor/door-hub ⇄ simlab-hub/door-preparation',
      'simlab-hub/door-chemistry ⇄ chemistry-lab/door-hub',
      'simlab-hub/door-physics ⇄ physics-lab/door-hub',
      'simlab-hub/door-biology ⇄ biology-lab/door-hub',
    ]);
  });

  it.each(directions)(
    '%s: no teleport, nothing loaded; the door closes behind and the scene left goes',
    async (_name, from, to) => {
      const { game } = await start(from.sceneId);
      const { game: fresh } = await start(to.sceneId);
      const speed = game.config.player.walkSpeed;
      satisfyGates(game, from.entityId);
      standBefore(game, from);
      const events = watch(game, ['SceneEntered', 'ProcedureEntered', ...LOADS]);
      const listeners = game.events.listenerCount();
      await open(game, from.entityId);
      expect(game.scenes.residentIds).toEqual([from.sceneId, to.sceneId]);

      const sample = sampler(game, from, [0, 0, 0]);
      const first = sample();
      // Through the doorway and 1 m into the far room.
      const samples = walk(game, sample, (s) => s.progress > FAR_FACE + 1);
      expect(samples.at(-1)!.progress).toBeGreaterThan(FAR_FACE + 1);
      expect(jumps(samples, speed)).toEqual([]);
      // Not slowed by the jambs either: every step but the first a full one.
      const steps = samples.slice(2).map((s, i) => s.progress - samples[i + 1]!.progress);
      expect(Math.min(...steps)).toBeGreaterThan(0.97 * speed * H);
      for (const s of samples) {
        expect(Math.abs(s.along - first.along)).toBeLessThan(1e-3);
        expect(Math.abs(s.y)).toBeLessThan(5e-3);
        expect(s.grounded).toBe(true);
        expect(s.yaw).toBe(first.yaw); // bit-identical: nothing turned the view
        expect(s.pitch).toBe(0);
      }
      // The scene switched once, the frame after the capsule's centre passed the far wall face.
      const k = samples.findIndex((s) => s.scene === to.sceneId);
      expect(samples.slice(0, k).every((s) => s.scene === from.sceneId)).toBe(true);
      expect(samples.slice(k).every((s) => s.scene === to.sceneId)).toBe(true);
      expect(samples[k - 1]!.progress).toBeGreaterThanOrEqual(FAR_FACE);
      expect(samples[k - 2]!.progress).toBeLessThan(FAR_FACE);
      // Entered once (the procedure, entering with it, tells before this listener hears it).
      expect(events.map((e) => e.type).sort()).toEqual(
        from.entityId === entry.entrance ? ['ProcedureEntered', 'SceneEntered'] : ['SceneEntered'],
      );
      expect(events.find((e) => e.type === 'SceneEntered')?.payload).toEqual({
        sceneId: to.sceneId,
        previousSceneId: from.sceneId,
        through: from.entityId,
      });

      // On, away from the door: it closes behind the player and the scene left is released.
      walk(game, sample, (s) => s.progress > FAR_FACE / 2 + AWAY_M + 0.3);
      waitReleased(game, to.sceneId);
      expect(game.doors.state(from.entityId)).toBe('closed');
      expect(counts(game)).toEqual(counts(fresh));
      expect(game.events.listenerCount()).toBe(listeners);
      expect(events.filter((e) => (LOADS as readonly string[]).includes(e.type))).toEqual([]);
    },
    TIMEOUT,
  );
});

describe('the hub ⇄ biology door', () => {
  const ends = () => pairOf('simlab-hub', 'biology-lab');

  it(
    'never closes on a player standing in its doorway, and does not move them',
    async () => {
      const [HUB] = ends();
      const { game } = await start('simlab-hub');
      standBefore(game, HUB);
      await open(game, HUB.entityId);
      const blocked = watch(game, ['ActionBlocked']);
      // Into the tunnel, mid-wall, and stop.
      walk(game, sampler(game, HUB, [0, 0, 0]), (s) => s.progress > FAR_FACE / 2);
      frames(game, 6);
      const at: Vec3 = [...game.state.player.position];
      expect(game.interaction.perform(HUB.entityId, 'close-door')).toBe(true);
      let lowest = 1;
      for (let i = 0; i < 300; i++) {
        game.update(H);
        lowest = Math.min(lowest, game.doors.fraction(HUB.entityId));
      }
      expect(lowest).toBe(1); // not a step closed
      expect(game.doors.state(HUB.entityId)).toBe('open');
      expect(game.state.player.position.map((v, i) => Math.abs(v - at[i]!))).toEqual([
        expect.closeTo(0, 6),
        expect.closeTo(0, 6),
        expect.closeTo(0, 6),
      ]);
      expect(blocked.map((e) => e.payload.reason)).toEqual(['The doorway is not clear.']);
    },
    TIMEOUT,
  );

  it(
    'stays closed with the reason when the far scene cannot be prepared; the next try opens',
    async () => {
      const [HUB] = ends();
      const { game } = await start('simlab-hub');
      let calls = 0;
      game.addWorldPreparation(() =>
        ++calls === 1
          ? Promise.reject(new Error('3D view could not be loaded: offline'))
          : Promise.resolve(),
      );
      standBefore(game, HUB);
      const before = { ...counts(game), stations: game.stations.activeStation() };
      const blocked = watch(game, ['ActionBlocked']);
      expect(game.interaction.perform(HUB.entityId, 'travel')).toBe(true);
      untilIdle(game); // the key card on the reader: the door asked to open
      await flush();
      frames(game, 30);
      expect(game.doors.state(HUB.entityId)).toBe('closed');
      expect(game.doors.fraction(HUB.entityId)).toBe(0);
      expect(blocked.map((e) => e.payload)).toEqual([
        {
          entityId: HUB.entityId,
          actionId: 'travel',
          reason: 'The way is not ready: 3D view could not be loaded: offline',
        },
      ]);
      expect({ ...counts(game), stations: game.stations.activeStation() }).toEqual(before);
      await open(game, HUB.entityId); // asked again: it opens
      expect(calls).toBe(2);
    },
    TIMEOUT,
  );

  it(
    'answers a press at once and moves only once the attached scene has settled',
    async () => {
      const [HUB] = ends();
      const { game } = await start('simlab-hub');
      let release: () => void = () => undefined;
      // The renderer's shader warm-up stands here: the far scene is attached but not yet drawn.
      game.addAttachSettle(() => new Promise<void>((resolve) => (release = resolve)));
      standBefore(game, HUB);
      expect(game.interaction.perform(HUB.entityId, 'travel')).toBe(true);
      untilIdle(game); // the key card on the reader: the door asked to open
      const label = () => game.interaction.primaryAction(HUB.entityId)?.label;
      expect(game.doors.state(HUB.entityId)).toBe('preparing');
      expect(label()).toBe('Opening…');
      await flush();
      frames(game, 30);
      expect(game.scenes.residentIds).toHaveLength(2); // attached…
      expect(game.doors.state(HUB.entityId)).toBe('preparing'); // …and still not moving
      expect(game.doors.fraction(HUB.entityId)).toBe(0);
      release();
      await flush();
      frames(game, 1);
      expect(game.doors.state(HUB.entityId)).toBe('opening');
      expect(game.doors.fraction(HUB.entityId)).toBeGreaterThan(0);
      expect(label()).toBe('Close the door');
    },
    TIMEOUT,
  );

  it(
    'spawns nothing of the far scene when a load comes while it is being prepared',
    async () => {
      const [HUB, BIO] = ends();
      const { game } = await start('simlab-hub');
      let calls = 0;
      let release: () => void = () => undefined;
      game.addWorldPreparation(() =>
        ++calls === 1 ? new Promise<void>((resolve) => (release = resolve)) : Promise.resolve(),
      );
      standBefore(game, HUB);
      expect(game.interaction.perform(HUB.entityId, 'travel')).toBe(true);
      untilIdle(game); // the key card on the reader: the door asked to open
      expect(game.doors.state(HUB.entityId)).toBe('preparing');
      await game.scenes.load('chemistry-lab'); // the developer jump
      release();
      await flush();
      frames(game, 60);
      expect(game.scenes.residentIds).toEqual(['chemistry-lab']);
      expect([...game.world.allEntities()].some((e) => e.roomId === BIO.room.id)).toBe(false);
      expect(game.doors.state(HUB.entityId)).toBe('closed');
    },
    TIMEOUT,
  );

  it(
    'repeats exactly over three round trips: the same counts at every arrival',
    async () => {
      const [HUB, BIO] = ends();
      const { game } = await start('simlab-hub');
      const seen: string[] = [];
      for (let trip = 0; trip < 3; trip++) {
        for (const [from, to] of [
          [HUB, BIO],
          [BIO, HUB],
        ] as const) {
          standBefore(game, from);
          await open(game, from.entityId);
          walk(game, sampler(game, from, game.scenes.origin), (s) => s.progress > 2.8);
          waitReleased(game, to.sceneId);
          seen.push(JSON.stringify({ ...counts(game), listeners: game.events.listenerCount() }));
        }
      }
      expect(new Set(seen.filter((_, i) => i % 2 === 0)).size).toBe(1);
      expect(new Set(seen.filter((_, i) => i % 2 === 1)).size).toBe(1);
    },
    TIMEOUT,
  );

  it(
    'saves at the crossing; Continue puts the player at the far door’s arrival point, standing',
    async () => {
      const [HUB, BIO] = ends();
      const storage = new MemorySaveStorage();
      const { game } = await start('simlab-hub', { storage });
      standBefore(game, HUB);
      await open(game, HUB.entityId);
      walk(game, sampler(game, HUB, [0, 0, 0]), () => game.state.session.sceneId === BIO.sceneId);
      const saved = JSON.parse(storage.read('simlab.save.slot-1') ?? 'null') as {
        player: { sceneId: string; position: Vec3 };
      };
      expect(saved.player.sceneId).toBe(BIO.sceneId);
      // In biology's own coordinates, in its doorway: no place to stand.
      expect(saved.player.position[0]).toBeGreaterThan(BIO.room.bounds.max[0] - 0.1);
      game.dispose();

      const { game: again } = await bootTestGame({ storage });
      expect((await again.continueGame()).ok).toBe(true);
      const arrival = arrivalPose(BIO.room, BIO.door);
      if (typeof arrival === 'string') throw new Error(arrival);
      expect(again.state.player.position).toEqual(arrival.position);
      expect(again.state.player.yaw).toBe(arrival.yaw);
      frames(again, 30);
      const [x, y, z] = again.state.player.position;
      expect([x, z]).toEqual([
        expect.closeTo(arrival.position[0], 4),
        expect.closeTo(arrival.position[2], 4),
      ]);
      expect(Math.abs(y)).toBeLessThan(0.02);
      expect(again.state.player.grounded).toBe(true);
    },
    TIMEOUT,
  );
});

describe('the Physics Lab ⇄ hub door with the steel ball in its doorway', () => {
  const BALL = 'physics-lab/steel-ball';

  it(
    'stays open while a dynamic body lies in its path (real Rapier query), then closes and saves',
    async () => {
      const [LAB] = pairOf('physics-lab', 'simlab-hub');
      const storage = new MemorySaveStorage();
      const { game } = await start('physics-lab', { storage });
      // The doorway as the door system asks about it: the opening, through both walls.
      const [cx, , cz] = plus(LAB.door.position, game.scenes.origin);
      const doorway = (): boolean =>
        game.physics.dynamicBodyIn([cx, 1, cz], [0.45, 1, 0.35], LAB.door.rotationY);
      expect(doorway()).toBe(false); // negative control: the ball rests on the bench

      // Carried to the door (setup), the door opened, the ball taken out at the hold distance in
      // front of the player standing that far from the door, so held in the doorway; let go there.
      expect(game.interaction.perform(BALL, 'grab')).toBe(true);
      expect(game.inventory.stow()).toBe(true);
      standBefore(game, LAB);
      // Closed, it offers to open; open, to close (the actions swap with the door's state).
      const offered = () => game.interaction.primaryAction(LAB.entityId)?.id;
      expect(offered()).toBe('travel');
      await open(game, LAB.entityId);
      expect(offered()).toBe('close-door');
      standBefore(game, LAB, game.config.player.holdDistance);
      expect(game.inventory.takeOut(game.inventory.selected)).toBe(true);
      frames(game, 30);
      game.interaction.drop();
      frames(game, 60);
      expect(doorway()).toBe(true);

      // Far from it and asked to close: it does not slide a step into the ball.
      standBefore(game, LAB, AWAY_M + 2);
      expect(game.interaction.perform(LAB.entityId, 'close-door')).toBe(true);
      let lowest = 1;
      for (let i = 0; i < 300; i++) {
        game.update(H);
        lowest = Math.min(lowest, game.doors.fraction(LAB.entityId));
      }
      expect(lowest).toBe(1);
      expect(game.doors.state(LAB.entityId)).not.toBe('closed');

      // The ball gone, it closes on its own and the game saves.
      storage.write('simlab.save.slot-1', 'none yet');
      game.world.despawn(BALL);
      for (let i = 0; i < 600 && game.doors.state(LAB.entityId) !== 'closed'; i++) game.update(H);
      expect(game.doors.state(LAB.entityId)).toBe('closed');
      expect(doorway()).toBe(false);
      expect(storage.read('simlab.save.slot-1')).not.toBe('none yet');
    },
    TIMEOUT,
  );
});

describe('the clean-area entrance', () => {
  it(
    'stays shut while the procedure is not done, and keeps PPE on while it is not closed',
    async () => {
      const [CORRIDOR] = pairOf('preparation-room', 'simlab-hub');
      const { game } = await start('preparation-room');
      const blocked = watch(game, ['ActionBlocked']);
      standBefore(game, CORRIDOR);
      expect(game.interaction.perform(CORRIDOR.entityId, 'travel')).toBe(false);
      await flush();
      frames(game, 60);
      expect(game.doors.state(CORRIDOR.entityId)).toBe('closed');
      expect(game.scenes.residentIds).toEqual(['preparation-room']);
      expect(blocked[0]?.payload.reason).toMatch(/^Entry blocked/);

      satisfyGates(game, CORRIDOR.entityId);
      await open(game, CORRIDOR.entityId);
      const bin = 'cleanroom-corridor/waste-bin'; // used gloves go into it
      expect(game.interaction.perform(bin, 'discard')).toBe(false);
      expect(blocked.at(-1)?.payload.reason).toBe(
        'Close the door to the clean area before taking off your nitrile gloves.',
      );
      expect(game.equipment.isWearing('nitrile-gloves')).toBe(true);
      // Closed behind a player who stayed: now they may.
      expect(game.interaction.perform(CORRIDOR.entityId, 'close-door')).toBe(true);
      untilIdle(game); // the key card on the reader: the door asked to close
      for (let i = 0; i < 120 && game.doors.state(CORRIDOR.entityId) !== 'closed'; i++) {
        game.update(H);
      }
      expect(game.doors.state(CORRIDOR.entityId)).toBe('closed');
      expect(game.interaction.perform(bin, 'discard')).toBe(true);
    },
    TIMEOUT,
  );
});

describe('a teleport door (negative control)', () => {
  it(
    'fails the same check: one jump where the door loads its scene',
    async () => {
      // The preparation ⇄ teacher pair as teleport doors, their walls closed again.
      const raw = structuredClone(bundledContent);
      const rooms = raw.rooms as {
        id: string;
        openings?: { wall: string }[];
        placements: { id: string; item: string }[];
      }[];
      for (const [roomId, doorId, wall] of [
        ['preparation-room', 'door-teacher', 'east'],
        ['teacher-room', 'door-preparation', 'west'],
      ] as const) {
        const room = rooms.find((r) => r.id === roomId)!;
        room.placements.find((p) => p.id === doorId)!.item = 'door';
        room.openings = room.openings?.filter((o) => o.wall !== wall) ?? [];
      }
      const { game } = await start('preparation-room', { content: raw });
      const [PREP] = pairOf('preparation-room', 'teacher-room');
      standBefore(game, PREP);
      const samples = [sampler(game, PREP, [0, 0, 0])()];
      const sample = sampler(game, PREP, [0, 0, 0]);
      expect(game.interaction.perform(PREP.entityId, 'travel')).toBe(true);
      untilIdle(game); // the key card on the reader: the door asked to open
      await flush();
      for (let i = 0; i < 3; i++) {
        game.update(H);
        samples.push(sample());
      }
      expect(game.state.session.sceneId).toBe('teacher-room');
      expect(jumps(samples, game.config.player.walkSpeed)).toHaveLength(1);
    },
    TIMEOUT,
  );
});
