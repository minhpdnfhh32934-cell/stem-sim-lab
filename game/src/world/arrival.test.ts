import { describe, expect, it } from 'vitest';
import { directionFromYawPitch } from '../core/math';
import type { Game } from '../game/Game';
import { bundledContent } from '../content';
import type { RawContent } from '../game/content';
import { bootTestGame, flush, placePlayer, untilIdle } from '../game/testing';
import { type ItemDefinition, ItemDefinitionSchema } from '../gameplay/item';
import { arrivalPose, blockingPlacement, type StandPose } from './arrival';
import { type RoomDefinition, RoomDefinitionSchema } from './definitions';

const H = 1 / 60;

const room = (placements: object[]): RoomDefinition =>
  RoomDefinitionSchema.parse({
    id: 'r',
    displayName: 'R',
    bounds: { min: [-3, 0, -3], max: [3, 3, 3] },
    placements,
  });
const door = (position: number[], rotationY = 0) => ({
  id: 'door',
  item: 'door',
  position,
  rotationY,
});
const pose = (r: RoomDefinition): StandPose => {
  const p = arrivalPose(r, r.placements[0]!);
  if (typeof p === 'string') throw new Error(p);
  return p;
};
/** Facing direction on the floor for a yaw (the game's convention: yaw 0 looks along −z). */
const facing = (yaw: number) => {
  const d = directionFromYawPitch(yaw, 0, [0, 0, 0]);
  return [Math.round(d[0]) + 0, Math.round(d[2]) + 0]; // + 0 turns −0 into 0
};

describe('arrivalPose', () => {
  it('stands 1 m in front of a door, on the side inside the room, looking into the room', () => {
    // East wall, rotated like the shipped doors (rotationY ≈ π/2).
    const east = pose(room([door([2.95, 0, 1], 1.5708)]));
    expect(east.position[0]).toBeCloseTo(1.95, 6);
    expect(east.position[2]).toBeCloseTo(1, 4);
    expect(east.position[1]).toBe(0);
    expect(facing(east.yaw)).toEqual([-1, 0]); // west, away from the door
    // North wall (rotationY 0), south wall, west wall.
    expect(pose(room([door([0, 0, -2.95])])).position).toEqual([0, 0, expect.closeTo(-1.95, 9)]);
    expect(facing(pose(room([door([0, 0, -2.95])])).yaw)).toEqual([0, 1]);
    expect(facing(pose(room([door([0, 0, 2.95])])).yaw)).toEqual([0, -1]);
    expect(facing(pose(room([door([-2.95, 0, 0], -1.5708)])).yaw)).toEqual([1, 0]);
  });

  it('refuses a door whose inside face cannot be told', () => {
    expect(arrivalPose(room([door([0, 0, 0])]), door([0, 0, 0]) as never)).toMatch(
      /stands free in the room/,
    );
    const outside = room([door([0, 0, -2.95])]);
    expect(arrivalPose(outside, { ...outside.placements[0]!, position: [0, 0, -9] })).toMatch(
      /no room to stand/,
    );
  });
});

describe('blockingPlacement', () => {
  const items: Record<string, ItemDefinition> = {
    chair: ItemDefinitionSchema.parse({
      id: 'chair',
      displayName: 'Chair',
      category: 'furniture',
      physical: { massKg: 5 },
      visual: { shape: 'box', size: [2, 1, 0.4], color: '#888888' },
    }),
    poster: ItemDefinitionSchema.parse({
      id: 'poster',
      displayName: 'Poster',
      category: 'structure',
      physical: { massKg: 1, body: 'none' },
      visual: { shape: 'box', size: [2, 1, 0.4], color: '#888888' },
    }),
  };
  const itemOf = (id: string) => items[id];

  it('finds solid footprints within the clearance, rotated with the placement', () => {
    const r = room([{ id: 'c', item: 'chair', position: [0, 0, 0] }]);
    expect(blockingPlacement(r, itemOf, 0, 0.55)).toBe('c'); // 0.35 from its 0.2 m half-depth
    expect(blockingPlacement(r, itemOf, 0, 0.65)).toBeNull();
    expect(blockingPlacement(r, itemOf, 1.3, 0)).toBe('c'); // 0.3 beyond its 1 m half-width
    const turned = room([{ id: 'c', item: 'chair', position: [0, 0, 0], rotationY: Math.PI / 2 }]);
    expect(blockingPlacement(turned, itemOf, 1.3, 0)).toBeNull(); // now 2 m long along z
    expect(blockingPlacement(turned, itemOf, 0, 1.3)).toBe('c');
  });

  it('ignores objects without a body', () => {
    const r = room([{ id: 'p', item: 'poster', position: [0, 0, 0] }]);
    expect(blockingPlacement(r, itemOf, 0, 0)).toBeNull();
  });

  it('counts a hinged item by its solid parts, its leaves closed and swung open (UX3.1)', () => {
    // The washroom door as shipped: its casing and lever are not solid; its leaf is, closed in the
    // doorway or open along the west jamb (x −2.02, z 1.38 … 2.46), whichever state is saved.
    const raw = (bundledContent.items as { id: string }[]).find((i) => i.id === 'wc-door');
    const wc = ItemDefinitionSchema.parse(raw);
    const teacher = room([
      { id: 'door', item: 'wc-door', position: [-1.5, 0, 2.45], rotationY: Math.PI },
    ]);
    const of = () => wc;
    expect(blockingPlacement(teacher, of, -1.5, 2.05)).toBeNull(); // 0.41 m from the closed leaf
    expect(blockingPlacement(teacher, of, -1.75, 1.9)).toBe('door'); // where it stands open
    expect(blockingPlacement(teacher, of, -0.6, 1.6)).toBeNull(); // beside it, clear
  });
});

/**
 * The shipped world with every door a teleport door again (item "door", the doorways behind them
 * walled up): the path content without walk-through doors still takes. The shipped doors are
 * walked through: doors.test.ts.
 */
function teleportWorld(): RawContent {
  const raw = structuredClone(bundledContent);
  for (const room of raw.rooms as {
    openings?: { width: number }[];
    placements: { item: string }[];
  }[]) {
    const doors = room.placements.filter((p) => p.item === 'sliding-door');
    for (const door of doors) door.item = 'door';
    if (doors.length > 0) room.openings = room.openings?.filter((o) => o.width !== 0.9) ?? [];
  }
  return raw;
}

/** Every door: travelling through a teleport door lands at its arrival point, free and walkable. */
describe('door travel', () => {
  const frames = (game: Game, seconds: number) => {
    for (let i = 0; i < Math.round(seconds / H); i++) game.update(H);
  };

  /** Lets the gated doors through: preparation done, PPE on (or off for the Teacher Room). */
  function satisfyGates(game: Game, doorId: string) {
    const p = game.content.procedures.get('cleanroom-entry');
    if (doorId === p.entrance) {
      game.state.progression.procedures[p.id] = {
        completed: p.steps.map((s) => s.id),
        entered: false,
      };
      for (const id of p.requiredEquipment) game.equipment.wear(id);
    }
  }

  async function travel(game: Game, doorId: string) {
    expect(game.interaction.perform(doorId, 'travel')).toBe(true);
    untilIdle(game); // the key card on the reader: the door asked to open
    await flush();
  }

  /** The arrival point the content names for a door, resolved from the target scene's data. */
  function expectedArrival(game: Game, doorId: string): StandPose & { scene: string } {
    const [roomId, placementId] = doorId.split('/') as [string, string];
    const params = game.content.rooms.get(roomId).placements.find((p) => p.id === placementId)!
      .params as { targetScene: string; arrival: string };
    const [toRoom, toDoor] = params.arrival.split('/') as [string, string];
    const target = game.content.rooms.get(toRoom);
    const p = arrivalPose(
      target,
      target.placements.find((d) => d.id === toDoor)!,
    );
    if (typeof p === 'string') throw new Error(p);
    return { ...p, scene: params.targetScene };
  }

  it('arrives in front of the destination door for all teleport doors, both directions', async () => {
    const { game, logs } = await bootTestGame({ content: teleportWorld() });
    await game.newGame('researcher-male');
    const doors = game.content.rooms
      .all()
      .flatMap((r) => r.placements.filter((p) => p.item === 'door').map((p) => `${r.id}/${p.id}`));
    expect(doors).toHaveLength(10);
    for (const doorId of doors) {
      const scene = game.content.scenes
        .all()
        .find((s) => s.kind === 'world' && s.rooms.includes(doorId.split('/')[0]!))!;
      await game.scenes.load(scene.id); // developer jump to the door's scene (setup only)
      game.state.player.equipment.length = 0;
      satisfyGates(game, doorId);
      const want = expectedArrival(game, doorId);
      await travel(game, doorId);
      expect(game.state.session.sceneId, doorId).toBe(want.scene);
      expect(game.state.player.position, doorId).toEqual(want.position);
      expect(game.state.player.yaw, doorId).toBe(want.yaw);
      expect(game.state.player.pitch).toBe(0);

      // Physics took the teleport: standing still keeps the player exactly there (no push out of
      // a collider), on the floor, and the door just come through is behind, not targeted.
      frames(game, 0.5);
      const [x, y, z] = game.state.player.position;
      expect([x, z], doorId).toEqual([
        expect.closeTo(want.position[0], 4),
        expect.closeTo(want.position[2], 4),
      ]);
      expect(Math.abs(y), doorId).toBeLessThan(0.02);
      expect(game.state.player.grounded, doorId).toBe(true);
      const arrivalDoor = (
        game.content.rooms
          .get(doorId.split('/')[0]!)
          .placements.find((p) => p.id === doorId.split('/')[1])!.params as { arrival: string }
      ).arrival;
      expect(game.interaction.focused?.id).not.toBe(arrivalDoor);

      // Walking forward works straight away (not stuck in anything).
      game.input.press('moveForward');
      frames(game, 0.4);
      game.input.release('moveForward');
      const moved = Math.hypot(
        game.state.player.position[0] - x,
        game.state.player.position[2] - z,
      );
      expect(moved, doorId).toBeGreaterThan(0.6);
    }
    expect(logs.filter((l) => l.level === 'warn' || l.level === 'error')).toEqual([]);
  });

  /** Opens a walk-through door and waits until it stands open. */
  async function open(game: Game, doorId: string) {
    expect(game.interaction.perform(doorId, 'travel')).toBe(true);
    untilIdle(game); // the key card on the reader: the door asked to open
    await flush();
    for (let i = 0; i < 120 && game.doors.state(doorId) !== 'open'; i++) game.update(H);
    expect(game.doors.state(doorId)).toBe('open');
  }
  /** Holds a key for a number of frames. */
  const hold = (game: Game, key: 'moveForward' | 'moveBack', count: number) => {
    game.input.press(key);
    for (let i = 0; i < count; i++) game.update(H);
    game.input.release(key);
  };
  const waitFor = (game: Game, residents: string[]) => {
    for (let i = 0; i < 300 && game.scenes.residentIds.join() !== residents.join(); i++) {
      game.update(H);
    }
    expect(game.scenes.residentIds).toEqual(residents);
  };

  it('repeats every walk-through round trip exactly (no drift)', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-female');
    placePlayer(game, [0.9, 0, 1], -Math.PI / 2); // facing the Teacher Room door (setup)
    frames(game, 0.1);
    const campus = () => game.state.player.position.map((v, k) => v + game.scenes.campusOffset[k]!);
    const start = campus();
    const ends: number[][] = [];
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      // Through, 3.7 m on into the Teacher Room, the door closed behind and the room left gone;
      // then back through its own door, walking backwards the same way.
      await open(game, 'preparation-room/door-teacher');
      hold(game, 'moveForward', 165);
      waitFor(game, ['teacher-room']);
      await open(game, 'teacher-room/door-preparation');
      hold(game, 'moveBack', 165);
      waitFor(game, ['preparation-room']);
      ends.push(campus());
      const { bodies, colliders } = game.physics.stats();
      seen.push(JSON.stringify({ bodies, colliders, entities: game.world.entityCount }));
    }
    // Every trip ends where the walk began, in the campus frame, and leaves the same world: to
    // 0.5 mm (Rapier: 32-bit floats; the controller settles the capsule by ~0.1 mm a step), so a
    // shift of the same size every trip cannot add up unseen.
    for (const end of ends) {
      for (const k of [0, 1, 2]) expect(Math.abs(end[k]! - start[k]!)).toBeLessThan(5e-4);
    }
    expect(new Set(seen).size).toBe(1);
    expect(game.state.session.sceneId).toBe('preparation-room');
  });

  it('uses the scene spawn when no arrival is named (developer scene jump)', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-male');
    game.events.publish('SceneChangeRequested', { sceneId: 'simlab-hub' });
    await flush();
    expect(game.state.session.sceneId).toBe('simlab-hub');
    expect(game.state.player.position).toEqual([0, 0, 4.5]);
  });

  it('autosaves at the crossing, and Continue puts the player at the arrival point there', async () => {
    const { game, storage } = await bootTestGame();
    await game.newGame('researcher-male');
    placePlayer(game, [1.5, 0, 1], -Math.PI / 2); // facing the Teacher Room door (setup)
    frames(game, 0.1);
    await open(game, 'preparation-room/door-teacher');
    game.input.press('moveForward');
    for (let i = 0; i < 120 && game.state.session.sceneId !== 'teacher-room'; i++) game.update(H);
    game.dispose(); // saved on the way in, in the doorway
    const { game: again } = await bootTestGame({ storage });
    expect((await again.continueGame()).ok).toBe(true);
    expect(again.state.session.sceneId).toBe('teacher-room');
    // Not the doorway: the arrival point in front of the Teacher Room door, (−1.45, 0, 0).
    const teacher = again.content.rooms.get('teacher-room');
    const want = arrivalPose(
      teacher,
      teacher.placements.find((p) => p.id === 'door-preparation')!,
    );
    expect(again.state.player.position).toEqual(typeof want === 'string' ? want : want.position);
    expect(again.state.player.position[0]).toBeCloseTo(-1.45, 6);
  });
});
