import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../content';
import type { InputAction } from '../../core/config';
import type { Vec3 } from '../../core/math';
import type { Game } from '../../game/Game';
import type { GameEvents } from '../../game/GameEvents';
import { bootTestGame, flush, lookAt, placePlayer, untilIdle } from '../../game/testing';
import type { SaveData } from '../../persistence/saveData';
import { MemorySaveStorage } from '../../persistence/SaveSystem';
import { arrivalPose } from '../../world/arrival';
import { holdPoint } from '../interaction/hold';

// Real game + real Rapier, headless. The steel ball rests on the Physics Lab bench at
// (−0.4, 0.94, −2); the three projectile balls on the range's cart at y ≈ 0.83.
const H = 1 / 60;
const KEY = 'simlab.save.slot-1';
const BALL = 'physics-lab/steel-ball';
const BALL_REST: Vec3 = [-2.067, 0.94, -4.474]; // on the teacher's bench (Phase T-1a)
const LAMP = 'physics-lab/lamp';
const RANGE = 'projectile-range';
const LAUNCHER = `${RANGE}/launcher`;
const balls = [1, 2, 3].map((n) => `${RANGE}/ball-${n}`);
const WEST_WALL = -5;

const run = (game: Game, seconds: number, eachFrame?: () => void) => {
  for (let i = 0; i < Math.round(seconds / H); i++) {
    game.update(H);
    eachFrame?.();
  }
};

const press = (game: Game, key: InputAction) => {
  game.input.press(key);
  game.update(H);
  game.input.release(key);
};

const distance = (a: Readonly<Vec3>, b: Readonly<Vec3>) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** New game, then the Physics Lab (setup only); records inventory changes and refusals. */
/** What is carried, but for the phone (Phase E-2b: in every bag from the start). */
const bag = (game: Game) => game.inventory.stacks.filter((s) => s.item !== 'phone');

async function lab(options: Parameters<typeof bootTestGame>[0] = {}) {
  const booted = await bootTestGame(options);
  await booted.game.newGame('researcher-male');
  await booted.game.scenes.load('physics-lab');
  run(booted.game, 2); // the balls settle
  const changes: GameEvents['InventoryChanged']['cause'][] = [];
  const blocked: GameEvents['ActionBlocked'][] = [];
  booted.game.events.subscribe('InventoryChanged', ({ cause }) => changes.push(cause));
  booted.game.events.subscribe('ActionBlocked', (e) => blocked.push(e));
  return { ...booted, changes, blocked };
}

/** Stands in front of the bench, looks at the resting steel ball and grabs it with E. */
function grabBall(game: Game) {
  placePlayer(game, [-2.067, 0, -3.674]);
  lookAt(game, BALL_REST);
  game.update(H);
  press(game, 'interact');
  expect(game.interaction.heldId).toBe(BALL);
}

/** An instance is never in two places: nothing carried has a world entity. */
function expectNeverBoth(game: Game) {
  for (const stack of game.inventory.stacks) {
    for (const id of stack.placements) expect(game.world.entity(id), id).toBeUndefined();
  }
}

/**
 * Uses a door as the player does: in front of it (setup), opens it, walks through and on until it
 * has closed behind and the scene left is gone.
 */
async function through(game: Game, door: string, scene: string) {
  const [roomId, id] = door.split('/') as [string, string];
  const room = game.content.rooms.get(roomId);
  const placement = room.placements.find((p) => p.id === id)!;
  const pose = arrivalPose(room, placement);
  if (typeof pose === 'string') throw new Error(pose);
  const [x, , z] = placement.position;
  const [nx, nz] = [pose.position[0] - x, pose.position[2] - z];
  const [ox, , oz] = game.scenes.origin;
  placePlayer(game, [x + 1.5 * nx + ox, 0, z + 1.5 * nz + oz], Math.atan2(nx, nz));
  run(game, 0.1);
  expect(game.interaction.perform(door, 'travel')).toBe(true);
  untilIdle(game); // the key card on the reader: the door asked to open
  await flush();
  run(game, 0.9); // it slides open
  game.input.press('moveForward');
  run(game, 2); // through and some 2.9 m on
  game.input.release('moveForward');
  for (let i = 0; i < 300 && game.scenes.residentIds.length > 1; i++) game.update(H);
  expect(game.state.session.sceneId).toBe(scene);
  expect(game.scenes.residentIds).toEqual([scene]);
}

const summary = (game: Game) => bag(game).map((s) => `${s.slot}:${s.item}×${s.placements.length}`);

describe('putting away and taking out', () => {
  it('Q puts the held object away: out of the world, into the first slot, selected', async () => {
    const { game, changes } = await lab();
    const released: GameEvents['ObjectReleased'][] = [];
    game.events.subscribe('ObjectReleased', (e) => released.push(e));
    const { bodies } = game.physics.stats();
    const interactables = game.interaction.count;
    game.inventory.select(4);
    grabBall(game);
    press(game, 'stow');
    expect(bag(game)).toEqual([{ slot: 0, item: 'steel-ball', placements: [BALL] }]);
    expect(game.inventory.selected).toBe(0); // Q again takes it straight back out
    expect(game.inventory.holds(BALL)).toBe(true);
    expect(game.interaction.heldId).toBeNull();
    expect(game.world.entity(BALL)).toBeUndefined();
    expect(game.physics.body(BALL)).toBeNull();
    expect(game.physics.stats()).toMatchObject({ bodies: bodies - 1, heldId: null });
    expect(game.interaction.count).toBe(interactables - 1);
    expect(released.at(-1)).toMatchObject({ entityId: BALL, reason: 'placed' });
    expect(changes).toEqual(['select', 'stow']);
    run(game, 0.5);
    expectNeverBoth(game);
  });

  it('Q with free hands takes it out into the hands: the same entity, carried to the hold point', async () => {
    const { game, changes } = await lab();
    const before = game.world.entity(BALL)!;
    grabBall(game);
    press(game, 'stow');
    placePlayer(game, [0, 0, 1], 0, 0);
    expect(game.inventory.takeOut(1)).toBe(false); // an empty slot: nothing happens
    press(game, 'stow');
    const ball = game.world.entity(BALL)!;
    expect(ball).not.toBe(before); // rebuilt from its placement…
    expect(ball).toMatchObject({ id: BALL, roomId: 'physics-lab', item: before.item });
    expect(ball.params).toBe(before.params); // …with the same data and behaviours
    expect(game.interaction.heldEntity).toBe(ball);
    expect(game.physics.stats().heldId).toBe(BALL);
    // Spawned on the capsule's axis, at the top of its straight part (feet + height − radius),
    // not yet moved by physics.
    const [x, y, z] = game.state.player.position;
    expect(game.physics.body(BALL)!.position).toEqual([
      expect.closeTo(x, 5),
      expect.closeTo(y + game.state.player.height - 0.3, 5),
      expect.closeTo(z, 5),
    ]);
    expect(bag(game)).toEqual([]);
    expect(changes).toEqual(['stow', 'take-out']);
    expect(game.inventory.takeOut(0)).toBe(false); // nothing left, and the hands are full

    // Whichever way the player faces, physics carries it out of the capsule to the hold point.
    for (let i = 0; i < 8; i++) {
      if (i > 0) {
        placePlayer(game, [0, 0, 1], (i * Math.PI) / 4, 0);
        press(game, 'stow');
        press(game, 'stow');
      }
      let reached = Infinity;
      let t = 0;
      run(game, 1, () => {
        t += H;
        const target = holdPoint(game.state.player, game.config.player.holdDistance, [0, 0, 0]);
        if (distance(game.physics.body(BALL)!.position, target) < 0.01) {
          reached = Math.min(reached, t);
        }
      });
      expect(reached, `facing ${i * 45}°`).toBeLessThan(0.5);
      expect(game.interaction.heldId, `facing ${i * 45}°`).toBe(BALL);
    }
    press(game, 'interact'); // E drops it, as any held object
    expect(game.interaction.heldId).toBeNull();
    expect(game.world.entity(BALL)?.id).toBe(BALL);
  });

  it('takes it out towards a wall without passing it: the ball stays on the near side', async () => {
    const { game } = await lab();
    grabBall(game);
    press(game, 'stow');
    placePlayer(game, [WEST_WALL + 0.5, 0, 2], Math.PI / 2, 0); // 0.5 m from the west wall, facing it
    run(game, 0.2);
    const start = [...game.state.player.position] as Vec3;
    press(game, 'stow');
    let minX = Infinity;
    run(game, 1, () => (minX = Math.min(minX, game.physics.body(BALL)!.position[0])));
    expect(holdPoint(game.state.player, 1, [0, 0, 0])[0]).toBeLessThan(WEST_WALL); // behind it
    expect(minX).toBeGreaterThan(WEST_WALL + 0.04 - 0.003); // the ball's radius off the wall
    expect(game.interaction.heldId).toBe(BALL);
    game.interaction.drop();
    run(game, 1);
    expect(distance(game.state.player.position, start)).toBeLessThan(0.001);
  });

  it('touching a wall there is no room: the ball goes back in the bag, the player is not pushed', async () => {
    const { game, blocked } = await lab();
    const released: string[] = [];
    game.events.subscribe('ObjectReleased', (e) => released.push(e.reason));
    grabBall(game);
    press(game, 'stow');
    placePlayer(game, [WEST_WALL + 0.31, 0, 2], Math.PI / 2, 0); // touching the west wall, facing it
    run(game, 0.2);
    const start = [...game.state.player.position] as Vec3;
    press(game, 'stow');
    expect(game.interaction.heldId).toBe(BALL); // on its way out…
    run(game, 1.5);
    expect(game.interaction.heldId).toBeNull(); // …it could not come clear of the player
    expect(game.world.entity(BALL)).toBeUndefined();
    expect(bag(game)).toEqual([{ slot: 0, item: 'steel-ball', placements: [BALL] }]);
    expect(blocked.at(-1)).toEqual({
      entityId: BALL,
      actionId: 'take-out',
      reason: 'It cannot be taken out now.',
    });
    expect(released).toEqual(['placed', 'placed']); // put away twice, never let go in the capsule
    expect(distance(game.state.player.position, start)).toBeLessThan(0.001);
  });

  it('keeps entity states keyed by the instance: a lamp put away on is still on', async () => {
    const raw = structuredClone(bundledContent);
    const items = raw.items as { id: string; inventory?: object }[];
    items.find((i) => i.id === 'desk-lamp')!.inventory = { stack: 2 };
    const { game } = await lab({ content: raw });
    expect(game.interaction.perform(LAMP, 'activate')).toBe(true);
    expect(game.interaction.perform(LAMP, 'grab')).toBe(true);
    press(game, 'stow');
    expect(game.world.entity(LAMP)).toBeUndefined();
    expect(game.entityStates.get(LAMP, 'active')).toBe(true);
    press(game, 'stow');
    expect(game.interaction.heldId).toBe(LAMP);
    game.interaction.drop();
    expect(game.interaction.primaryAction(LAMP)?.label).toBe('Turn off'); // the new entity reads it
  });
});

// The microscope (0.25 × 0.4 × 0.3 m, half its diagonal 0.28 m) on the Biology Lab bench: back
// (north side) at z = −3, top 0.9 m — its front, z = −2.2, is 0.4 m from the photosynthesis
// desk, too narrow to stand in; the lab's north wall at z = −5.7.
const MICROSCOPE = 'biology-lab/microscope';

/** A new game carrying the microscope in slot 5, standing in the Biology Lab at `at`. */
async function carryingMicroscope(at: Vec3, pitch: number, yaw = 0) {
  const { game } = await bootTestGame();
  await game.newGame('researcher-male');
  game.state.player.inventory.stacks = [{ slot: 4, item: 'microscope', placements: [MICROSCOPE] }];
  await game.scenes.load('biology-lab');
  placePlayer(game, at, yaw, pitch); // yaw 0 faces north, π south
  run(game, 0.3); // the capsule settles where it stands
  const blocked: GameEvents['ActionBlocked'][] = [];
  const released: string[] = [];
  game.events.subscribe('ActionBlocked', (e) => blocked.push(e));
  game.events.subscribe('ObjectReleased', (e) => released.push(e.reason));
  return { game, blocked, released, start: [...game.state.player.position] as Vec3 };
}

describe('taking out where there is little room (the player is never pushed)', () => {
  it('the microscope against a wall goes back to its slot with the reason, also if dropped at once', async () => {
    for (const dropAtOnce of [false, true]) {
      const { game, blocked, released, start } = await carryingMicroscope(
        [-1.6, 0, -7.5 + 0.31], // between the wall bench and the enzyme bench (U-2)
        0,
      );
      expect(game.inventory.takeOut(4)).toBe(true);
      expect(game.interaction.heldId).toBe(MICROSCOPE);
      if (dropAtOnce) game.interaction.drop();
      run(game, 1.5);
      expect(game.interaction.heldId).toBeNull();
      expect(game.world.entity(MICROSCOPE)).toBeUndefined();
      expect(bag(game)).toEqual([{ slot: 4, item: 'microscope', placements: [MICROSCOPE] }]);
      expect(blocked).toEqual([
        { entityId: MICROSCOPE, actionId: 'take-out', reason: 'It cannot be taken out now.' },
      ]);
      expect(released).toEqual([dropAtOnce ? 'drop' : 'placed']); // never out-of-reach
      expect(distance(game.state.player.position, start)).toBeLessThan(0.001);
    }
  });

  it('the microscope at the bench comes out over it, clear of the player; dropped, it pushes nothing', async () => {
    for (const pitch of [-0.6, 0]) {
      // Touching the bench's north side, facing south, looking at its top or level.
      const { game, released, start } = await carryingMicroscope(
        [-5, 0, -3 - 0.31],
        pitch,
        Math.PI,
      );
      expect(game.inventory.takeOut(4)).toBe(true);
      run(game, 1);
      expect(game.interaction.heldId, `pitch ${pitch}`).toBe(MICROSCOPE);
      const [x, , z] = game.physics.body(MICROSCOPE)!.position;
      const [px, , pz] = game.state.player.position;
      expect(Math.hypot(x - px, z - pz), `pitch ${pitch}`).toBeGreaterThan(0.3 + 0.28);
      game.interaction.drop();
      run(game, 1);
      expect(released).toEqual(['drop']);
      expect(game.world.entity(MICROSCOPE)).toBeDefined();
      expect(distance(game.state.player.position, start), `pitch ${pitch}`).toBeLessThan(0.001);
    }
  });
});

describe('carrying across scenes', () => {
  it('travels with the player: its placement is not spawned; one left elsewhere goes home', async () => {
    const { game } = await lab();
    grabBall(game);
    press(game, 'stow');
    await through(game, 'physics-lab/door-hub', 'simlab-hub');
    expectNeverBoth(game);
    await through(game, 'simlab-hub/door-physics', 'physics-lab');
    expect(game.world.entity(BALL)).toBeUndefined(); // still carried, not back on the bench
    expect(game.inventory.holds(BALL)).toBe(true);
    expectNeverBoth(game);

    await through(game, 'physics-lab/door-hub', 'simlab-hub');
    press(game, 'stow'); // out in the hub
    expect(game.interaction.heldId).toBe(BALL);
    expect(game.world.entity(BALL)?.roomId).toBe('physics-lab');
    run(game, 0.5);
    game.interaction.drop();
    run(game, 1);
    expect(bag(game)).toEqual([]);
    await through(game, 'simlab-hub/door-physics', 'physics-lab');
    run(game, 2);
    // Left in the hub, it is back at its placement: dynamic poses are not saved (as before).
    expect(distance(game.physics.body(BALL)!.position, BALL_REST)).toBeLessThan(0.01);
  });
});

describe('refusals', () => {
  it('refuses what does not go in the inventory, and a full inventory: it stays in the hands', async () => {
    const { game, blocked } = await lab();
    expect(game.interaction.perform(LAMP, 'grab')).toBe(true);
    press(game, 'stow');
    expect(blocked.at(-1)).toEqual({
      entityId: LAMP,
      actionId: 'stow',
      reason: 'This does not go in the inventory.',
    });
    expect(game.interaction.heldId).toBe(LAMP);
    expect(bag(game)).toEqual([]);
    game.interaction.drop();

    const full = Array.from({ length: 27 }, (_, slot) => ({
      slot,
      item: 'projectile-ball',
      placements: Array.from({ length: 8 }, (_, i) => `seeded/${slot}-${i}`),
    }));
    game.state.player.inventory.stacks = full;
    grabBall(game);
    press(game, 'stow');
    expect(blocked.at(-1)).toMatchObject({ entityId: BALL, reason: 'The inventory is full.' });
    expect(game.interaction.heldId).toBe(BALL);
    expect(game.world.entity(BALL)).toBeDefined();
    expect(game.inventory.stacks).toBe(full);
    expect(game.inventory.stacks.every((s) => s.placements.length === 8)).toBe(true);
  });

  it('refuses to take out what the hands cannot hold, and the bag stays as it was', async () => {
    const { game, blocked } = await lab({ config: { player: { maxCarryMassKg: 0.1 } } });
    game.state.player.inventory.stacks = [{ slot: 0, item: 'steel-ball', placements: [BALL] }];
    await game.scenes.load('physics-lab'); // the carried ball is not placed
    expect(game.world.entity(BALL)).toBeUndefined();
    press(game, 'stow');
    expect(blocked.at(-1)).toEqual({
      entityId: BALL,
      actionId: 'take-out',
      reason: 'It cannot be taken out now.',
    });
    expect(bag(game)).toEqual([{ slot: 0, item: 'steel-ball', placements: [BALL] }]);
    expect(game.world.entity(BALL)).toBeUndefined();
    expect(game.physics.body(BALL)).toBeNull();
  });

  it('does nothing on Q or 1–9 while paused or while a scene loads', async () => {
    const { game } = await lab();
    grabBall(game);
    game.pause();
    press(game, 'stow');
    press(game, 'hotbar4');
    expect(game.inventory.stow()).toBe(false);
    expect(game.interaction.heldId).toBe(BALL);
    expect(bag(game)).toEqual([]);
    expect(game.inventory.selected).toBe(0);
    game.resume();
    press(game, 'stow');
    expect(game.inventory.holds(BALL)).toBe(true);

    const loading = game.scenes.load('simlab-hub');
    expect(game.state.session.phase).toBe('loading');
    press(game, 'stow');
    press(game, 'hotbar4');
    expect(game.inventory.takeOut(0)).toBe(false);
    await loading;
    expect(game.inventory.selected).toBe(0);
    expect(game.inventory.holds(BALL)).toBe(true);
    expect(game.world.entity(BALL)).toBeUndefined();
  });
});

describe('the hotbar and the slots', () => {
  it('selects slots with 1–9 and steps round them (the wheel); the selection is saved', async () => {
    const { game, storage, changes } = await lab();
    press(game, 'hotbar3');
    expect(game.inventory.selected).toBe(2);
    press(game, 'hotbar9');
    expect(game.inventory.selected).toBe(8);
    expect(game.inventory.step(1)).toBe(true);
    expect(game.inventory.selected).toBe(0);
    expect(game.inventory.step(-1)).toBe(true);
    expect(game.inventory.selected).toBe(8);
    expect(game.inventory.select(8)).toBe(false); // already selected
    expect(game.inventory.select(9)).toBe(false); // not a hotbar slot
    expect(game.inventory.select(-1)).toBe(false);
    expect(changes).toEqual(['select', 'select', 'select', 'select']);
    press(game, 'hotbar5');
    expect(game.save()?.ok).toBe(true);
    const { game: again } = await bootTestGame({ storage });
    expect((await again.continueGame()).ok).toBe(true);
    expect(again.inventory.selected).toBe(4);
  });

  it('moves, merges up to the stack size, splits (the larger half), swaps whole stacks', async () => {
    const { game } = await bootTestGame();
    await game.loadLab(); // the balls and the microscope are the lab pack's items
    const changes: string[] = [];
    game.events.subscribe('InventoryChanged', ({ cause }) => changes.push(cause));
    const ids = (from: number, n: number) => Array.from({ length: n }, (_, i) => `r/b${from + i}`);
    game.state.player.inventory.stacks = [
      { slot: 0, item: 'projectile-ball', placements: ids(0, 5) },
      { slot: 1, item: 'projectile-ball', placements: ids(5, 6) },
      { slot: 4, item: 'microscope', placements: ['biology-lab/microscope'] },
    ];
    const inv = game.inventory;
    expect(inv.move(0, 1)).toBe(true); // room for 2 of 5: the last two move, three stay
    expect(summary(game)).toEqual(['0:projectile-ball×3', '1:projectile-ball×8', '4:microscope×1']);
    expect(inv.at(0)?.placements).toEqual(['r/b0', 'r/b1', 'r/b2']);
    expect(inv.at(1)?.placements.slice(-2)).toEqual(['r/b3', 'r/b4']);
    expect(inv.move(0, 1)).toBe(false); // full

    expect(inv.split(1, 9)).toBe(true); // 8 → 4 + 4
    expect(inv.at(9)?.placements).toEqual(['r/b9', 'r/b10', 'r/b3', 'r/b4']);
    expect(inv.split(0, 18)).toBe(true); // 3 → the larger half (2) moves
    expect(summary(game)).toEqual([
      '0:projectile-ball×1',
      '1:projectile-ball×4',
      '4:microscope×1',
      '9:projectile-ball×4',
      '18:projectile-ball×2',
    ]);

    expect(inv.move(9, 4, 1)).toBe(false); // part of a stack onto another item
    expect(inv.move(9, 4)).toBe(true); // the whole stack: swapped
    expect(summary(game)).toEqual([
      '0:projectile-ball×1',
      '1:projectile-ball×4',
      '4:projectile-ball×4',
      '9:microscope×1',
      '18:projectile-ball×2',
    ]);
    expect(inv.move(18, 26, 1)).toBe(true); // one to an empty slot: the last one
    expect(inv.at(26)?.placements).toEqual(['r/b2']);
    expect(inv.move(26, 7)).toBe(true); // a whole stack to an empty slot
    expect(inv.at(26)).toBeNull();
    expect(inv.at(7)?.placements).toEqual(['r/b2']);
    expect(inv.move(0, 1, 99)).toBe(true); // more than there is: all of it, merged
    expect(inv.at(0)).toBeNull();

    const before = structuredClone(inv.stacks);
    const count = changes.length;
    for (const [from, to, n] of [
      [4, 4, undefined], // onto itself
      [4, 27, undefined], // not a slot
      [4, -1, undefined],
      [4, 1.5, undefined],
      [5, 6, undefined], // nothing there
      [4, 5, 0], // nothing to move
      [4, 5, 1.5],
      [4, 5, -2],
    ] as const) {
      expect(inv.move(from, to, n), `${from} → ${to} ×${n}`).toBe(false);
    }
    expect(inv.stacks).toEqual(before);
    expect(changes.length).toBe(count);
    expect(changes.every((c) => c === 'move')).toBe(true);
  });
});

describe('projectile balls', () => {
  it('stack, and one taken out loads the launcher and flies the run', async () => {
    const { game } = await lab();
    balls.forEach((id, i) => {
      const x = -3.85 + 0.25 * i;
      placePlayer(game, [x, 0, 10.5]);
      lookAt(game, [x, 0.83, 9.5]);
      game.update(H);
      expect(game.interaction.focused?.id).toBe(id);
      press(game, 'interact');
      press(game, 'stow');
    });
    expect(bag(game)).toEqual([{ slot: 0, item: 'projectile-ball', placements: balls }]);
    expectNeverBoth(game);
    expect(game.inventory.split(0, 1)).toBe(true); // 3 → 1 + 2, the last two moved
    expect(bag(game)).toEqual([
      { slot: 0, item: 'projectile-ball', placements: [balls[0]] },
      { slot: 1, item: 'projectile-ball', placements: [balls[1], balls[2]] },
    ]);

    press(game, 'hotbar2');
    press(game, 'stow'); // the last one in comes out first
    expect(game.interaction.heldId).toBe(balls[2]);
    placePlayer(game, [-2.3, 0, 11.75]);
    lookAt(game, [-1, 0.2, 11.75]);
    game.update(H);
    expect(game.interaction.primaryAction(LAUNCHER)?.label).toBe('Load into the launcher');
    press(game, 'interact');
    expect(game.interaction.heldId).toBeNull();
    expect(game.entityStates.get(LAUNCHER, 'loaded')).toBe(balls[2]);
    expect(game.interaction.perform(`${RANGE}/button-run`, 'run')).toBe(true);
    run(game, 3);
    expect(game.stations.view(LAUNCHER)?.session.state).toBe('completed');
    expect(game.state.progression.completedExperiments).toContain('projectile-motion');
    expect(game.physics.stats().driven).toBe(0); // landed: physics owns the ball again
    expect(game.world.entity(balls[2]!)).toBeDefined();
    expect(summary(game)).toEqual(['0:projectile-ball×1', '1:projectile-ball×1']);
    expectNeverBoth(game);
  });
});

describe('saving and continuing', () => {
  it('round-trips what is carried; a version 2 save continues carrying nothing', async () => {
    const storage = new MemorySaveStorage();
    const { game } = await lab({ storage });
    grabBall(game);
    press(game, 'stow');
    expect(game.save()?.ok).toBe(true);
    game.dispose();

    const { game: again, logs } = await bootTestGame({ storage });
    expect((await again.continueGame()).ok).toBe(true);
    expect(bag(again)).toEqual([{ slot: 0, item: 'steel-ball', placements: [BALL] }]);
    expect(again.world.entity(BALL)).toBeUndefined();
    expect(logs.filter((l) => l.level === 'warn')).toEqual([]);
    run(again, 0.2);
    press(again, 'stow');
    expect(again.interaction.heldId).toBe(BALL);
    again.dispose();

    const v2 = JSON.parse(storage.read(KEY)!) as { player: Record<string, unknown> };
    delete v2.player.inventory;
    storage.write(KEY, JSON.stringify({ ...v2, version: 2 }));
    const { game: old } = await bootTestGame({ storage });
    expect((await old.continueGame()).ok).toBe(true);
    // Carrying nothing but the phone every bag has (Phase E-2b).
    expect(old.state.player.inventory).toEqual({
      stacks: [{ slot: 8, item: 'phone', placements: ['phone'] }],
      selected: 0,
    });
    expect(old.world.entity(BALL)).toBeDefined();
  });

  it('drops what a save cannot carry (logged), keeps the rest; what is dropped spawns at home', async () => {
    const raw = structuredClone(bundledContent);
    const items = raw.items as { id: string; inventory?: object }[];
    items.find((i) => i.id === 'projectile-ball')!.inventory = { stack: 2 };
    const storage = new MemorySaveStorage();
    const { game } = await lab({ storage, content: raw });
    expect(game.save()?.ok).toBe(true);
    game.dispose();
    const data = JSON.parse(storage.read(KEY)!) as SaveData;
    data.player.inventory = {
      selected: 9,
      stacks: [
        { slot: 0, item: 'gone', placements: [LAMP] },
        { slot: 1, item: 'desk-lamp', placements: [LAMP] },
        {
          slot: 2,
          item: 'steel-ball',
          placements: [balls[0]!, 'physics-lab/nowhere', 'nowhere', BALL],
        },
        {
          slot: 3,
          item: 'projectile-ball',
          placements: [balls[0]!, balls[0]!, balls[1]!, balls[2]!],
        },
        { slot: 3, item: 'microscope', placements: ['biology-lab/microscope'] },
        { slot: 27, item: 'projectile-ball', placements: [balls[2]!] },
        { slot: -1, item: 'steel-ball', placements: [] },
      ],
    };
    storage.write(KEY, JSON.stringify(data));

    const { game: again, logs } = await bootTestGame({ storage, content: raw });
    expect((await again.continueGame()).ok).toBe(true);
    expect(bag(again)).toEqual([
      { slot: 0, item: 'microscope', placements: ['biology-lab/microscope'] },
      { slot: 1, item: 'projectile-ball', placements: [balls[2]] },
      { slot: 2, item: 'steel-ball', placements: [BALL] },
      { slot: 3, item: 'projectile-ball', placements: [balls[0], balls[1]] },
    ]);
    expect(again.inventory.selected).toBe(0);
    expect(logs.filter((l) => l.level === 'warn').map((l) => `${l.channel}: ${l.message}`)).toEqual(
      [
        'Inventory: Dropped the stack in slot 0: "gone" is not an item that is carried',
        'Inventory: Dropped the stack in slot 1: "desk-lamp" is not an item that is carried',
        `Inventory: Dropped "${RANGE}/ball-1" from slot 2: it is not a placement of "steel-ball"`,
        'Inventory: Dropped "physics-lab/nowhere" from slot 2: it is not a placement of "steel-ball"',
        'Inventory: Dropped "nowhere" from slot 2: it is not a placement of "steel-ball"',
        `Inventory: Dropped "${RANGE}/ball-1" from slot 3: it is carried twice`,
        `Inventory: Dropped "${RANGE}/ball-3" from slot 3: more than 2 in a stack`,
        'Inventory: Dropped the stack in slot -1: nothing left in it',
        'Inventory: Moved the stack in slot 3 to the free slot 0',
        'Inventory: Moved the stack in slot 27 to the free slot 1',
        'Inventory: Selected slot 9 is not in the hotbar; selecting slot 0',
      ],
    );
    expect(again.world.entity(LAMP)).toBeDefined(); // dropped from the bag: at home again
    expectNeverBoth(again);
  });
});
