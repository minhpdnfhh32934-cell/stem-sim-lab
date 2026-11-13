import { describe, expect, it, vi } from 'vitest';
import type { Vec3 } from '../core/math';
import type { Game } from '../game/Game';
import type { GameEvents } from '../game/GameEvents';
import { bootTestGame, flush, placePlayer, untilIdle } from '../game/testing';
import { MemorySaveStorage } from '../persistence/SaveSystem';
import { bundledContent } from '../content';
import { ATTACH_SLICE_MS } from './SceneManager';
import { entityFromPlacement } from './World';

// Residency (Z1 stage 1): a neighbour scene attached beside the current one in the one World,
// Rapier world and scene graph, at its campus place in the session frame; the player walks into
// it without a load. Real game, real Rapier. Scenes are reached by the developer jump (setup).

const H = 1 / 60;
/** Where the biology lab starts in the hub's frame, and the Physics Lab (campus.test.ts). */
const BIOLOGY: Vec3 = [-18.25, 0, -3];
const PHYSICS: Vec3 = [18.25, 0, -3];
const LOADS = ['SceneLoading', 'SceneLoaded', 'SceneUnloaded'] as const;

const frames = (game: Game, count: number) => {
  for (let i = 0; i < count; i++) game.update(H);
};

/** A new game as the tallest character, in `sceneId` (developer jump), one frame run. */
async function start(sceneId: string, storage = new MemorySaveStorage()) {
  const booted = await bootTestGame({ storage });
  await booted.game.newGame('researcher-male');
  await booted.game.scenes.load(sceneId);
  frames(booted.game, 1);
  return booted;
}

/** Every count residency must give back exactly. */
function counts(game: Game) {
  const { bodies, colliders } = game.physics.stats();
  return {
    bodies,
    colliders,
    entities: game.world.entityCount,
    interactables: game.interaction.count,
    listeners: game.events.listenerCount(),
    residents: game.scenes.residentIds,
    rooms: game.world.activeRooms.map((r) => r.id),
  };
}

/** Events of these types, in order, from now on. */
function watch<K extends keyof GameEvents>(game: Game, types: readonly K[]) {
  const seen: { type: K; payload: GameEvents[K] }[] = [];
  for (const type of types) game.events.subscribe(type, (payload) => seen.push({ type, payload }));
  return seen;
}

const plus = (a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];
/** To the millimetre (a placed capsule settles ~0.1 mm), without −0 (toEqual tells it from 0). */
const near = (v: number) => Math.round(v * 1e3) / 1e3 + 0;
/** x and z to the millimetre, and on the floor: the controller settles within ±1 mm of it. */
const onFloorAt = (p: Vec3) => [near(p[0]), Math.abs(p[1]) < 0.002, near(p[2])];

describe('attaching a neighbour scene a few placements at a time (frames go through)', () => {
  it('spawns all of it over several pauses, then SceneAttached; a load meanwhile leaves it out', async () => {
    let pauses = 0;
    const pause = async () => {
      pauses++;
      await flush();
    };
    // A clock that runs 5 ms a reading: past the slice at every placement.
    let now = 0;
    const clock = vi
      .spyOn(performance, 'now')
      .mockImplementation(() => (now += ATTACH_SLICE_MS + 1));
    const { game } = await bootTestGame({ pause });
    await game.newGame('researcher-male');
    await game.scenes.load('simlab-hub');
    const placements = game.content.rooms.get('biology-lab').placements.length;
    expect(await game.scenes.attach('biology-lab')).toBeNull();
    expect(pauses).toBeGreaterThan(1);
    expect(game.world.entityCount).toBeGreaterThan(placements);
    expect(game.scenes.residentIds).toContain('biology-lab');

    // A load while it is still spawning: it stops, and the scene is not resident.
    await game.scenes.load('simlab-hub');
    const attaching = game.scenes.attach('chemistry-lab');
    await flush();
    await game.scenes.load('simlab-hub');
    expect(await attaching).toBe('Another scene was loaded meanwhile.');
    expect(game.scenes.residentIds).toEqual(['simlab-hub']);
    clock.mockRestore();
    game.dispose();
  }, 20_000); // ~4 s alone (every placement its own slice): more under a full run

  it('its free bodies wait for its floors and furniture: the lab’s lamp stays on its desk', async () => {
    // Frames go on between the slices, as in the game (physics steps while the lab comes in).
    let game: Game | null = null;
    const pause = async () => {
      if (game) frames(game, 1);
      await flush();
    };
    let now = 0;
    const clock = vi
      .spyOn(performance, 'now')
      .mockImplementation(() => (now += ATTACH_SLICE_MS + 1));
    const booted = await bootTestGame({ pause });
    game = booted.game;
    await game.newGame('researcher-male');
    await game.scenes.load('simlab-hub');
    expect(await game.scenes.attach('physics-lab')).toBeNull();
    clock.mockRestore();
    frames(game, 120); // two seconds: anything unsupported would be far below by now
    const lamp = game.world.entity('physics-lab/lamp');
    // On the desk: placed with its base at 0.9 m, its centre (the pose) 0.2 m above.
    expect(lamp?.pose.position[1]).toBeCloseTo(1.1, 2);
    expect(booted.logs.filter((l) => l.level === 'error' || l.level === 'warn')).toEqual([]);
    game.dispose();
  }, 30_000);
});

describe('attaching a neighbour scene', () => {
  it('spawns it beside the current scene at its campus offset: rooms, entities, bodies', async () => {
    const { game } = await start('biology-lab');
    const alone = game.physics.stats(); // biology by itself, with the player capsule
    await game.scenes.load('simlab-hub');
    frames(game, 1);
    const hub = counts(game);
    const seen = watch(game, ['SceneAttached', 'SceneEntered', ...LOADS]);

    expect(await game.scenes.attach('biology-lab')).toBeNull();
    expect(seen).toEqual([{ type: 'SceneAttached', payload: { sceneId: 'biology-lab' } }]);
    // The hub stays the current scene, at its own coordinates.
    expect(game.state.session).toEqual({ phase: 'playing', sceneId: 'simlab-hub', paused: false });
    expect(game.scenes.origin).toEqual([0, 0, 0]);
    expect(game.scenes.residentIds).toEqual(['simlab-hub', 'biology-lab']);
    expect(game.world.activeRooms.map((r) => r.id)).toEqual(['simlab-hub']);
    expect(game.world.roomsOf('biology-lab').map((r) => r.bounds)).toEqual([
      { min: [-33.25, 0, -10.5], max: [-13.25, 4.5, 4.5] }, // Phase U-2: 20 × 15 × 4.5 m
      { min: [-53.5, 0, -10.5], max: [-33.5, 4.5, 4.5] }, // Phase X: its practice room, west
    ]);
    expect(game.world.roomAt(-18, -3)?.id).toBe('biology-lab');

    const room = game.content.rooms.get('biology-lab');
    for (const p of room.placements) {
      const own = entityFromPlacement(room.id, p, game.content.items.get(p.item));
      expect(game.world.entity(own.id)?.pose.position, own.id).toEqual(
        plus(own.pose.position, BIOLOGY),
      );
    }
    const annex = game.content.rooms.get('biology-annex').placements.length;
    expect(game.world.entityCount).toBe(hub.entities + room.placements.length + annex);
    // Both scenes' bodies and colliders, one player capsule.
    expect(game.physics.stats()).toMatchObject({
      bodies: hub.bodies + alone.bodies - 1,
      colliders: hub.colliders + alone.colliders - 1,
    });
    // The biology door is where the hub's door to it stands, back to back through the wall.
    expect(game.world.entity('biology-lab/door-hub')?.pose.position[0]).toBeCloseTo(-13.3, 9);
    expect(game.world.entity('simlab-hub/door-biology')?.pose.position[0]).toBe(-12.95);
  });

  it('collides the player with its floor and walls where they now are', async () => {
    const { game } = await start('simlab-hub');
    expect(await game.scenes.attach('biology-lab')).toBeNull();
    // Inside biology (its own x −9, z 4.6: open floor, south of the transpiration island), facing
    // its west wall (frame x −33.25).
    placePlayer(game, plus([-9, 0, 4.6], BIOLOGY), Math.PI / 2);
    frames(game, 6);
    game.input.press('moveForward');
    frames(game, 240); // 5.75 m to the wall
    const [x, y, z] = game.state.player.position;
    expect(x).toBeCloseTo(-33.25 + 0.3 + 0.01, 3); // radius + the controller's skin
    expect(z).toBeCloseTo(1.6, 2); // pressed into the wall, the controller slides a little
    expect(Math.abs(y)).toBeLessThan(0.02);
    expect(game.state.player.grounded).toBe(true);
  });

  it('is undone exactly by a release, three times over', async () => {
    const { game } = await start('simlab-hub');
    const seen = watch(game, ['SceneAttached', 'SceneDetached', ...LOADS]);
    const before = counts(game);
    let attached: ReturnType<typeof counts> | null = null;
    for (let i = 0; i < 3; i++) {
      expect(await game.scenes.attach('biology-lab')).toBeNull();
      frames(game, 2);
      const now = counts(game);
      expect(now.residents).toEqual(['simlab-hub', 'biology-lab']);
      expect(now.listeners).toBe(before.listeners);
      attached ??= now;
      expect(now).toEqual(attached);
      expect(game.scenes.release('biology-lab')).toBe(true);
      frames(game, 2);
      expect(counts(game)).toEqual(before);
      expect(game.world.roomsOf('biology-lab')).toEqual([]);
      expect([...game.world.allEntities()].some((e) => e.id.startsWith('biology-lab/'))).toBe(
        false,
      );
    }
    expect(seen.map((e) => e.type)).toEqual([
      'SceneAttached',
      'SceneDetached',
      'SceneAttached',
      'SceneDetached',
      'SceneAttached',
      'SceneDetached',
    ]);
  });

  it('refuses what it cannot do, and never releases the current scene', async () => {
    const { game } = await start('simlab-hub');
    const before = counts(game);
    expect(await game.scenes.attach('teacher-room')).toBe(
      'No door leads from here to Teacher Room.',
    );
    expect(await game.scenes.attach('main-menu')).toBe('No door leads from here to Main Menu.');
    expect(await game.scenes.attach('simlab-hub')).toBeNull(); // it already is
    expect(game.scenes.release('simlab-hub')).toBe(false);
    expect(game.scenes.release('biology-lab')).toBe(false);
    expect(counts(game)).toEqual(before);
  });

  it('refuses while a scene loads; a failed preparation changes nothing and the next works', async () => {
    const { game } = await start('simlab-hub');
    let calls = 0;
    let release: () => void = () => undefined;
    game.addWorldPreparation(() => {
      calls++;
      if (calls === 1) return Promise.reject(new Error('3D view could not be loaded: offline'));
      if (calls === 2) return new Promise<void>((resolve) => (release = resolve));
      return Promise.resolve();
    });
    const seen = watch(game, ['SceneAttached', 'SceneDetached', 'EntitySpawned', ...LOADS]);
    const before = counts(game);

    expect(await game.scenes.attach('biology-lab')).toBe('3D view could not be loaded: offline');
    expect(counts(game)).toEqual(before);
    expect(seen).toEqual([]);
    expect(game.world.roomsOf('biology-lab')).toEqual([]);

    const loading = game.scenes.load('chemistry-lab'); // held by the second call
    expect(await game.scenes.attach('biology-lab')).toBe('Another scene is loading.');
    release();
    await loading;
    seen.length = 0;
    expect(await game.scenes.attach('simlab-hub')).toBeNull(); // the next one works
    expect(seen.filter((e) => e.type === 'SceneAttached')).toHaveLength(1);
    expect(game.scenes.residentIds).toEqual(['chemistry-lab', 'simlab-hub']);
    expect(calls).toBe(3);
  });

  it('is stale when a scene loads while it waits: nothing of the neighbour is spawned', async () => {
    const { game } = await start('simlab-hub');
    const { game: fresh } = await start('physics-lab');
    let calls = 0;
    let release: () => void = () => undefined;
    game.addWorldPreparation(() => {
      calls++;
      return calls === 1 ? new Promise<void>((resolve) => (release = resolve)) : Promise.resolve();
    });
    const seen = watch(game, ['SceneAttached', 'SceneDetached']);
    const attaching = game.scenes.attach('biology-lab'); // waits for its preparation
    await flush();
    await game.scenes.load('physics-lab'); // e.g. the developer jump
    frames(game, 1);
    release();
    expect(await attaching).toBe('Another scene was loaded meanwhile.');
    expect(seen).toEqual([]);
    expect([...game.world.allEntities()].some((e) => e.id.startsWith('biology-lab/'))).toBe(false);
    expect(game.world.roomsOf('biology-lab')).toEqual([]);
    expect(counts(game)).toEqual({ ...counts(fresh), listeners: counts(game).listeners });
    expect(game.scenes.residentIds).toEqual(['physics-lab']);
  });

  it('rolls back a failure while spawning to exactly the scenes there were', async () => {
    const { game, logs } = await start('simlab-hub');
    // The third entity of the neighbour fails to spawn, halfway through.
    const spawn = game.world.spawn.bind(game.world);
    let spawned = 0;
    game.world.spawn = (entity) => {
      if (entity.roomId === 'biology-lab' && ++spawned === 3) throw new Error('no memory left');
      spawn(entity);
    };
    const seen = watch(game, ['SceneAttached', 'SceneDetached']);
    const before = counts(game);

    expect(await game.scenes.attach('biology-lab')).toBe('no memory left');
    expect(seen).toEqual([{ type: 'SceneDetached', payload: { sceneId: 'biology-lab' } }]);
    expect(counts(game)).toEqual(before);
    expect(game.world.roomsOf('biology-lab')).toEqual([]);
    expect(logs.some((l) => l.level === 'error' && l.message.includes('rolled back'))).toBe(true);
  });

  it('goes with the current scene when another loads: detached first, then unloaded', async () => {
    const { game } = await start('simlab-hub');
    const { game: fresh } = await start('physics-lab');
    expect(await game.scenes.attach('biology-lab')).toBeNull();
    const seen = watch(game, ['SceneDetached', 'SceneUnloaded', 'SceneLoaded']);
    await game.scenes.load('physics-lab');
    frames(game, 1);
    expect(seen.map(({ type, payload }) => `${type} ${payload.sceneId}`)).toEqual([
      'SceneDetached biology-lab',
      'SceneUnloaded simlab-hub',
      'SceneLoaded physics-lab',
    ]);
    expect(counts(game)).toEqual({ ...counts(fresh), listeners: counts(game).listeners });
  });

  it('goes with everything else on the way back to the menu', async () => {
    const { game } = await start('simlab-hub');
    expect(await game.scenes.attach('biology-lab')).toBeNull();
    const seen = watch(game, ['SceneDetached', 'SceneUnloaded', 'SceneLoaded']);
    expect((await game.backToMenu()).ok).toBe(true);
    expect(seen.map(({ type, payload }) => `${type} ${payload.sceneId}`)).toEqual([
      'SceneDetached biology-lab',
      'SceneUnloaded simlab-hub',
      'SceneLoaded main-menu',
    ]);
    expect(game.world.entityCount).toBe(0);
    expect(game.world.roomsOf('biology-lab')).toEqual([]);
    expect(game.physics.stats()).toMatchObject({ bodies: 0, colliders: 0 });
    expect(game.scenes.residentIds).toEqual([]);
    expect(game.scenes.campusOffset).toEqual([0, 0, 0]);
  });
});

describe('walking into a neighbour scene', () => {
  it('makes it the current scene without a load; its stations, the save and the frame follow', async () => {
    const storage = new MemorySaveStorage();
    const { game } = await start('simlab-hub', storage);
    expect(await game.scenes.attach('physics-lab')).toBeNull();
    // The lab's stations are attached, but standing in the hub shows none of them.
    expect(game.stations.view('physics-lab/tower')).not.toBeNull();
    expect(game.stations.activeStation()).toBeNull();
    const seen = watch(game, ['SceneEntered', ...LOADS]);
    const yaw = game.state.player.yaw;

    placePlayer(game, plus([-1.5, 0, 0], PHYSICS), yaw); // setup: into the lab's own (−1.5, 0), its open aisle
    frames(game, 1);
    expect(seen).toEqual([
      {
        type: 'SceneEntered',
        payload: {
          sceneId: 'physics-lab',
          previousSceneId: 'simlab-hub',
          through: 'simlab-hub/door-physics',
        },
      },
    ]);
    expect(game.state.session).toEqual({ phase: 'playing', sceneId: 'physics-lab', paused: false });
    expect(game.scenes.origin).toEqual(PHYSICS);
    expect(game.world.activeRooms.map((r) => r.id)).toEqual([
      'physics-lab',
      'projectile-range',
      'pendulum-bay',
      'waves-optics',
    ]);
    expect(game.world.entity('simlab-hub/door-physics')).toBeDefined(); // nothing torn down
    expect(game.world.entity(game.stations.activeStation()?.id ?? '')?.roomId).toBe('physics-lab');

    // Saved on the way in, in the lab's own coordinates (no format change).
    const saved = JSON.parse(storage.read('simlab.save.slot-1') ?? 'null') as {
      player: { sceneId: string; position: Vec3 };
    };
    expect(saved.player.sceneId).toBe('physics-lab');
    expect(onFloorAt(saved.player.position)).toEqual([-1.5, true, 0]);
    expect(onFloorAt(game.saves.capture().player.position)).toEqual([-1.5, true, 0]);

    // Continue puts the player back there, in the lab loaded on its own.
    game.dispose();
    const { game: again } = await bootTestGame({ storage });
    expect((await again.continueGame()).ok).toBe(true);
    expect(again.state.session.sceneId).toBe('physics-lab');
    expect(onFloorAt(again.state.player.position)).toEqual([-1.5, true, 0]);
  });

  it('keeps the frame: the scene left can be released and attached again where it was', async () => {
    const { game } = await start('simlab-hub');
    const { game: fresh } = await start('physics-lab');
    expect(await game.scenes.attach('physics-lab')).toBeNull();
    placePlayer(game, plus([0, 0, 0], PHYSICS), -Math.PI / 2);
    frames(game, 60); // settled on the floor
    expect(game.state.session.sceneId).toBe('physics-lab');
    const at: Vec3 = [...game.state.player.position];

    expect(game.scenes.release('simlab-hub')).toBe(true);
    frames(game, 2);
    expect(game.state.player.position).toEqual(at); // nothing moved
    expect(counts(game)).toEqual({ ...counts(fresh), listeners: counts(game).listeners });
    expect(game.scenes.origin).toEqual(PHYSICS);

    expect(await game.scenes.attach('simlab-hub')).toBeNull();
    expect(game.world.roomsOf('simlab-hub').map((r) => r.bounds)).toEqual([
      game.content.rooms.get('simlab-hub').bounds,
    ]);
    expect(game.world.entity('simlab-hub/door-physics')?.pose.position[0]).toBe(12.95);
  });

  it('lets go of what the player holds, as a scene change does', async () => {
    const { game } = await start('simlab-hub');
    expect(await game.scenes.attach('physics-lab')).toBeNull();
    expect(game.interaction.perform('physics-lab/steel-ball', 'grab')).toBe(true);
    const released = watch(game, ['ObjectReleased']);
    placePlayer(game, plus([0, 0, 0], PHYSICS)); // setup: into the lab
    frames(game, 1);
    expect(game.state.session.sceneId).toBe('physics-lab');
    expect(released.map(({ payload }) => [payload.entityId, payload.reason])).toEqual([
      ['physics-lab/steel-ball', 'scene-change'],
    ]);
    expect(game.interaction.heldId).toBeNull();
  });

  it('runs the entered scene’s procedure: steps that already hold complete on the way in', async () => {
    const { game } = await start('simlab-hub');
    const p = game.content.procedures.get('cleanroom-entry');
    game.state.progression.procedures[p.id] = { completed: ['read-rules'], entered: false };
    game.equipment.wear('lab-coat'); // put on in the hub: the procedure is not done here
    expect(game.procedures.activeProcedure()).toBeNull();
    expect(game.state.progression.procedures[p.id]?.completed).toEqual(['read-rules']);
    expect(await game.scenes.attach('preparation-room')).toBeNull();
    const done = watch(game, ['ProcedureStepCompleted']);

    // Setup: into the corridor (its own z −7), 17.5 m south of the hub's origin.
    placePlayer(game, [0, 0, 17.5 - 7]);
    frames(game, 1);
    expect(game.state.session.sceneId).toBe('preparation-room');
    expect(game.procedures.activeProcedure()?.id).toBe(p.id);
    expect(done.map(({ payload }) => payload.stepId)).toEqual(['lab-coat']);
  });

  it('stops and records a neighbour’s running run when it is released, and drops its stations', async () => {
    const { game } = await start('simlab-hub');
    expect(await game.scenes.attach('physics-lab')).toBeNull();
    const PENDULUM = 'pendulum-bay/pendulum';
    expect(game.interaction.perform('pendulum-bay/button-run', 'run')).toBe(true);
    frames(game, 30);
    expect(game.experiments.find(PENDULUM)?.state).toBe('running');
    const recorded = watch(game, ['RunRecorded']);

    expect(game.scenes.release('physics-lab')).toBe(true);
    expect(game.experiments.find(PENDULUM)?.state).toBe('stopped');
    expect(recorded.map(({ payload }) => payload.record.status)).toEqual(['stopped']);
    expect(game.stations.view(PENDULUM)).toBeNull();
    expect(game.stations.view('physics-lab/tower')).toBeNull();
  });
});

/** Opens the hub's door to biology with its own action; the far scene comes with it. */
async function openBiologyDoor(game: Game): Promise<void> {
  expect(game.interaction.perform('simlab-hub/door-biology', 'travel')).toBe(true);
  untilIdle(game); // the key card on the reader: the door asked to open
  await flush();
  frames(game, 90); // 0.6 + 0.2 + 0.6 s: one leaf, then the other (UX3.1): it stands open
  expect(game.doors.state('simlab-hub/door-biology')).toBe('open');
}

interface Sample {
  readonly frame: Vec3;
  readonly campus: Vec3;
  readonly drawn: Vec3;
  readonly yaw: number;
  readonly pitch: number;
  readonly grounded: boolean;
  readonly scene: string | null;
}

function sample(game: Game): Sample {
  const p = game.state.player;
  return {
    frame: [...p.position],
    campus: plus(p.position, game.scenes.campusOffset),
    drawn: plus(game.physics.renderPlayer([0, 0, 0]), game.scenes.campusOffset),
    yaw: p.yaw,
    pitch: p.pitch,
    grounded: p.grounded,
    scene: game.state.session.sceneId,
  };
}

/** Frames whose campus position (or drawn position) moved more than walking covers in a step. */
function jumps(samples: readonly Sample[], speed: number): string[] {
  // A step's length, plus 0.5 mm: crossing from the hub's floor onto a lab's, the capsule rises
  // 3 mm for a frame at the seam (Phase U-2: 0.0368 m against 0.0367 m).
  const limit = speed * H + 5e-4;
  const step = (a: Readonly<Vec3>, b: Readonly<Vec3>) =>
    Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  return samples.slice(1).flatMap((s, i) => {
    const before = samples[i]!;
    const moved = step(before.campus, s.campus);
    const drawn = step(before.drawn, s.drawn);
    return moved > limit || drawn > limit
      ? [`frame ${i + 1}: ${moved.toFixed(4)} m (drawn ${drawn.toFixed(4)} m)`]
      : [];
  });
}

describe('no teleport: walking from the hub into biology through a doorway', () => {
  it('moves the player continuously, the view untouched, entering biology once', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-male'); // the taller character
    await game.scenes.load('simlab-hub');
    const speed = game.config.player.walkSpeed;
    // In the hub, 1.5 m in front of its west wall, on the doorway's line, facing west.
    placePlayer(game, [-11.5, 0, -3], Math.PI / 2);
    frames(game, 6);
    await openBiologyDoor(game);
    expect(game.scenes.residentIds).toEqual(['simlab-hub', 'biology-lab']);
    const entered = watch(game, ['SceneEntered', ...LOADS]);
    const samples = [sample(game)];
    game.input.press('moveForward');
    for (let i = 0; i < 200 && game.state.player.position[0] > -14.5; i++) {
      game.update(H);
      samples.push(sample(game));
    }
    game.input.release('moveForward');

    expect(game.state.player.position[0]).toBeLessThan(-14.5); // 1.25 m into biology
    expect(jumps(samples, speed)).toEqual([]);
    // Not slowed at the doorway either: every step close to a full one.
    const steps = samples
      .slice(1)
      .map((s, i) => Math.abs(s.frame[0] - samples[i]!.frame[0]))
      .slice(1);
    expect(Math.min(...steps)).toBeGreaterThan(0.97 * speed * H);
    for (const s of samples) {
      expect(s.yaw).toBe(Math.PI / 2);
      expect(s.pitch).toBe(0);
      expect(s.grounded).toBe(true);
      expect(Math.abs(s.frame[2] + 3)).toBeLessThan(1e-3);
      expect(Math.abs(s.frame[1])).toBeLessThan(5e-3);
    }
    expect(entered).toEqual([
      {
        type: 'SceneEntered',
        payload: {
          sceneId: 'biology-lab',
          previousSceneId: 'simlab-hub',
          through: 'simlab-hub/door-biology',
        },
      },
    ]);
    // The scene switched once, the frame after the capsule's centre passed biology's wall face.
    const k = samples.findIndex((s) => s.scene === 'biology-lab');
    expect(samples.slice(0, k).every((s) => s.scene === 'simlab-hub')).toBe(true);
    expect(samples.slice(k).every((s) => s.scene === 'biology-lab')).toBe(true);
    expect(samples[k - 1]!.frame[0]).toBeLessThanOrEqual(-13.25);
    expect(samples[k - 2]!.frame[0]).toBeGreaterThan(-13.25);
    expect(game.scenes.origin).toEqual(BIOLOGY);
  });

  it('attaches the neighbour mid-walk without a hitch: the capsule walks on, full steps, grounded', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-male');
    await game.scenes.load('simlab-hub');
    const speed = game.config.player.walkSpeed;
    placePlayer(game, [-9, 0, -3], Math.PI / 2);
    frames(game, 6);
    const samples = [sample(game)];
    game.input.press('moveForward');
    for (let i = 0; i < 160 && game.state.player.position[0] > -14.5; i++) {
      if (i === 20) {
        // Asked to open on the way (perform: reach is not the point here): biology is attached
        // between frames, and the door is open before the player is there.
        expect(game.interaction.perform('simlab-hub/door-biology', 'travel')).toBe(true);
        untilIdle(game); // the key card on the reader: the door asked to open
        await flush();
        expect(game.scenes.isResident('biology-lab')).toBe(true);
      }
      game.update(H);
      samples.push(sample(game));
    }
    expect(game.state.session.sceneId).toBe('biology-lab');
    expect(jumps(samples, speed)).toEqual([]);
    const steps = samples.slice(2).map((s, i) => Math.abs(s.frame[0] - samples[i + 1]!.frame[0]));
    expect(Math.min(...steps)).toBeGreaterThan(0.97 * speed * H);
    expect(samples.every((s) => s.grounded)).toBe(true);
  });

  it('catches a teleport: the same check fails across a door that loads its scene', async () => {
    // The preparation ⇄ teacher pair as teleport doors (item "door"), their walls closed again.
    const raw = structuredClone(bundledContent);
    for (const [roomId, doorId, wall] of [
      ['preparation-room', 'door-teacher', 'east'],
      ['teacher-room', 'door-preparation', 'west'],
    ] as const) {
      const room = (
        raw.rooms as {
          id: string;
          openings?: { wall: string }[];
          placements: { id: string; item: string }[];
        }[]
      ).find((r) => r.id === roomId)!;
      room.placements.find((p) => p.id === doorId)!.item = 'door';
      room.openings = room.openings?.filter((o) => o.wall !== wall) ?? [];
    }
    const { game } = await bootTestGame({ content: raw });
    await game.newGame('researcher-male');
    const speed = game.config.player.walkSpeed;
    placePlayer(game, [1.5, 0, 1], -Math.PI / 2); // facing the Teacher Room door
    frames(game, 6);
    const samples = [sample(game)];
    expect(game.interaction.perform('preparation-room/door-teacher', 'travel')).toBe(true);
    untilIdle(game); // the key card on the reader: the door asked to open
    await flush();
    for (let i = 0; i < 3; i++) {
      game.update(H);
      samples.push(sample(game));
    }
    expect(game.state.session.sceneId).toBe('teacher-room');
    expect(jumps(samples, speed)).toHaveLength(1);
  });
});

describe('what a released scene takes with it', () => {
  const BALL = 'physics-lab/steel-ball';
  const BALL_REST: Vec3 = [-2.067, 0.94, -4.474]; // on the teacher's bench (Phase T-1a), in the lab's own coordinates
  const into = (game: Game, local: Vec3, origin: Readonly<Vec3>) => {
    placePlayer(game, plus(local, origin)); // setup: walk-throughs are tested in doors.test.ts
    frames(game, 2);
  };

  it('never spawns a placement twice: an object left in the next scene goes home when that one goes', async () => {
    const { game } = await start('physics-lab');
    const balls = () => [...game.world.allEntities()].filter((e) => e.id === BALL);
    // Put away in the lab, taken out and dropped in the hub; the lab released meanwhile.
    expect(game.interaction.perform(BALL, 'grab')).toBe(true);
    expect(game.inventory.stow()).toBe(true);
    expect(await game.scenes.attach('simlab-hub')).toBeNull();
    const hub = game.scenes.offsetOf('simlab-hub')!;
    into(game, [-8, 0, -3], hub);
    expect(game.state.session.sceneId).toBe('simlab-hub');
    expect(game.scenes.release('physics-lab')).toBe(true);
    expect(game.inventory.takeOut(game.inventory.selected)).toBe(true);
    frames(game, 30); // out to the hold point first: one let go inside the capsule goes back
    game.interaction.drop();
    frames(game, 90);
    expect(balls()).toHaveLength(1);
    const left = balls()[0]!.pose.position[1];
    expect(left).toBeGreaterThan(-0.01); // on the hub's floor

    // The lab comes back beside the hub: everything but the ball, which is still in the hub.
    expect(await game.scenes.attach('physics-lab')).toBeNull();
    expect(balls()).toHaveLength(1);
    expect(game.world.entity('physics-lab/bench')).toBeDefined();
    // Into the lab, the hub released behind: the ball does not fall into the void, it goes home.
    into(game, [-1.5, 0, 0], game.scenes.offsetOf('physics-lab')!);
    expect(game.state.session.sceneId).toBe('physics-lab');
    expect(game.scenes.release('simlab-hub')).toBe(true);
    frames(game, 120);
    expect(balls()).toHaveLength(1);
    const rest = plus(BALL_REST, game.scenes.origin);
    const at = game.physics.body(BALL)!.position;
    expect(Math.hypot(at[0] - rest[0], at[1] - rest[1], at[2] - rest[2])).toBeLessThan(0.01);
  });

  it('keeps what is in a scene that stays: an object thrown into the hub stays there', async () => {
    const { game } = await start('simlab-hub');
    expect(await game.scenes.attach('physics-lab')).toBeNull();
    const lab = game.scenes.offsetOf('physics-lab')!;
    // The lab's lamp, put down in the hub (setup: moved there) while the lab is resident.
    const lamp = game.world.entity('physics-lab/lamp')!;
    expect(lab[0]).toBeGreaterThan(13); // the lab lies east of the hub, past x 13
    const physics = game.physics as unknown as {
      bodies: Map<string, { body: { setTranslation(v: object, wake: boolean): void } }>;
    };
    physics.bodies.get(lamp.id)!.body.setTranslation({ x: 2, y: 0.3, z: 0 }, true); // in the hub
    frames(game, 90);
    expect(game.scenes.release('physics-lab')).toBe(true);
    expect(game.world.entity(lamp.id)).toBeDefined(); // it is in the hub, which stays
    expect(game.world.entity('physics-lab/steel-ball')).toBeUndefined(); // the lab's own went
    frames(game, 60);
    expect(game.physics.body(lamp.id)!.position[1]).toBeGreaterThan(0); // on the hub's floor
  });
});

describe('per-scene stations and the frame', () => {
  const PENDULUM = 'pendulum-bay/pendulum';

  it('leaves the current scene’s stations alone when a neighbour comes and goes', async () => {
    const { game } = await start('physics-lab');
    expect(game.interaction.perform('pendulum-bay/button-run', 'run')).toBe(true);
    frames(game, 30);
    expect(game.experiments.find(PENDULUM)?.state).toBe('running');
    const changed = watch(game, ['ExperimentStationChanged']);
    expect(await game.scenes.attach('simlab-hub')).toBeNull();
    expect(changed).toEqual([]); // attaching the hub touched none of the lab's stations
    expect(game.scenes.release('simlab-hub')).toBe(true);
    expect(game.experiments.find(PENDULUM)?.state).toBe('running'); // not stopped with the hub
    expect(game.stations.view(PENDULUM)).not.toBeNull();
    expect(game.stations.view('physics-lab/tower')).not.toBeNull();
  });

  it('starts the frame again at a later load: origin zero, saves in that scene’s coordinates', async () => {
    const { game } = await start('simlab-hub');
    expect(await game.scenes.attach('physics-lab')).toBeNull();
    placePlayer(game, plus([-1.5, 0, 0], PHYSICS)); // setup: into the lab
    frames(game, 1);
    expect(game.scenes.origin).toEqual(PHYSICS);
    await game.scenes.load('simlab-hub');
    frames(game, 1);
    expect(game.scenes.origin).toEqual([0, 0, 0]);
    expect(game.saves.capture().player.position).toEqual(game.state.player.position);
  });
});
