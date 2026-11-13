import { describe, expect, it } from 'vitest';
import { directionFromYawPitch, type Vec3 } from '../../core/math';
import { bundledContent } from '../../content';
import type { Game } from '../../game/Game';
import type { GameEvents } from '../../game/GameEvents';
import { bootTestGame, lookAt, placePlayer } from '../../game/testing';
import { holdPoint, tiltOf } from './hold';

// Real game + real Rapier in the Physics Lab. The steel ball (0.25 kg, r = 0.04 m) is placed
// above the teacher's bench (Phase T-1a) and settles on it at (−2.9, 0.94, −3.4). Rapier uses 32-bit floats, so positions
// are compared with millimetre tolerances.
const H = 1 / 60;
const BALL = 'physics-lab/steel-ball';
const BALL_REST: Vec3 = [-2.067, 0.94, -4.474];
const BENCH_TOP = 0.9;
const R = 0.04;
const WEST_WALL = -5;

function run(game: Game, seconds: number, eachFrame?: () => void): void {
  for (let i = 0; i < Math.round(seconds / H); i++) {
    game.update(H);
    eachFrame?.();
  }
}

const distance = (a: Readonly<Vec3>, b: Readonly<Vec3>) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

async function physicsLab(options: Parameters<typeof bootTestGame>[0] = {}) {
  const { game, logs } = await bootTestGame(options);
  await game.newGame('researcher-male');
  await game.scenes.load('physics-lab');
  run(game, 2); // the ball drops onto the bench and settles
  const released: GameEvents['ObjectReleased'][] = [];
  game.events.subscribe('ObjectReleased', (e) => released.push(e));
  const ball = () => {
    const body = game.physics.body(BALL);
    if (!body) throw new Error('steel ball has no body');
    return body;
  };
  return { game, logs, released, ball };
}

/** Stands in front of the bench, looks at the resting ball and presses E. */
function grabBall(game: Game): void {
  placePlayer(game, [-2.067, 0, -3.674]);
  lookAt(game, BALL_REST);
  game.update(H);
  game.input.press('interact');
  game.update(H);
  game.input.release('interact');
}

const target = (game: Game) =>
  holdPoint(game.state.player, game.config.player.holdDistance, [0, 0, 0]);

describe('grabbing', () => {
  it('grabs the grabbable object under the crosshair with E', async () => {
    const { game } = await physicsLab();
    const grabbed: string[] = [];
    game.events.subscribe('ObjectGrabbed', ({ entityId }) => grabbed.push(entityId));
    placePlayer(game, [-2.067, 0, -3.674]);
    lookAt(game, BALL_REST);
    game.update(H);
    expect(game.interaction.focused?.id).toBe(BALL);
    expect(game.interaction.primaryAction(BALL)?.label).toBe('Grab');

    game.input.press('interact');
    game.update(H);
    expect(game.interaction.heldId).toBe(BALL);
    expect(game.physics.stats().heldId).toBe(BALL);
    expect(grabbed).toEqual([BALL]);
    expect(game.interaction.focused).toBeNull(); // targeting pauses while holding
  });

  it('refuses static, non-grabbable and too-heavy objects, and a second object', async () => {
    const { game } = await physicsLab();
    const bench = game.world.entity('physics-lab/bench');
    const lamp = game.world.entity('physics-lab/lamp');
    const ball = game.world.entity(BALL);
    if (!bench || !lamp || !ball) throw new Error('missing entities');

    placePlayer(game, [-1.167, 0, -3.674]);
    lookAt(game, [-1.167, 0.45, -4.474]); // the bench
    game.update(H);
    expect(game.interaction.focused?.id).toBe('physics-lab/bench');
    expect(game.interaction.primaryAction('physics-lab/bench')?.label).toBe('Inspect');
    expect(game.interaction.grab(bench)).toBe(false);
    expect(game.physics.grab('physics-lab/bench')).toBe(false); // the physics side refuses too

    expect(game.interaction.grab(ball)).toBe(true);
    expect(game.interaction.canGrab(lamp)).toBe(false); // hands are full
    expect(game.interaction.grab(lamp)).toBe(false);

    const light = await physicsLab({ config: { player: { maxCarryMassKg: 0.1 } } });
    light.game.update(H);
    expect(light.game.interaction.canGrab(light.game.world.entity(BALL)!)).toBe(false);
    placePlayer(light.game, [-2.067, 0, -3.674]);
    lookAt(light.game, BALL_REST);
    light.game.update(H);
    expect(light.game.interaction.primaryAction(BALL)?.label).toBe('Inspect');
  });

  it('only allows "grab" on dynamic items (content validation)', async () => {
    const raw = structuredClone(bundledContent);
    const items = raw.items as { id: string; interactions: string[] }[];
    items.find((i) => i.id === 'lab-bench')!.interactions.push('grab');
    await expect(bootTestGame({ content: raw })).rejects.toThrow(
      'items.lab-bench.interactions: "grab" needs physical.body "dynamic"',
    );
  });
});

describe('holding', () => {
  it('keeps the held object steadily at the hold point and follows the aim', async () => {
    const { game, ball } = await physicsLab();
    grabBall(game);
    run(game, 0.6);
    expect(distance(ball().position, target(game))).toBeLessThan(0.01);

    game.state.player.yaw += 0.6; // turn left
    run(game, 0.6);
    expect(distance(ball().position, target(game))).toBeLessThan(0.01);

    const samples: Vec3[] = [];
    run(game, 0.3, () => samples.push([...ball().position]));
    const spread = Math.max(...samples.map((p) => distance(p, samples[0]!)));
    expect(spread).toBeLessThan(0.001); // no jitter while standing still
    expect(game.interaction.heldId).toBe(BALL);
  });

  it('stays the same world object: no copy, mass unchanged', async () => {
    const { game, ball } = await physicsLab();
    const entity = game.world.entity(BALL)!;
    grabBall(game);
    run(game, 0.5);
    expect(game.world.entityCount).toBe(569); // the Physics wing of Phase T-1a: its four rooms (T-2: + four stations, T-3: + seven, T-4: + seven, the ripple tank and the electric field: + ten each, the air track and the Atwood machine: + 13 each); Phase X: the AC generator (+ 12); Phase E-1: the circuit bench, its cabinet and 37 parts (+ 40); E-2: a 12 V battery and the CO₂ extinguisher (+ 2)
    expect(entity.pose.position[1]).toBeCloseTo(ball().position[1], 4); // pose mirrors the body
    expect(ball().massKg).toBeCloseTo(0.25, 6);
  });

  it('cannot push a held object through a wall or into the bench', async () => {
    const { game, ball } = await physicsLab();
    grabBall(game);
    // Turn to the west wall (x = −5) and walk into it carrying the ball, from 2.1 m west of the
    // teacher's bench's west end: once the player stops at the wall the hold point is behind it.
    placePlayer(game, [-2.9, 0, -3.674], Math.PI / 2, 0);
    run(game, 0.5);
    game.state.player.yaw = Math.PI / 2;
    game.state.player.pitch = 0;
    game.input.press('moveForward');
    let minX = Infinity;
    run(game, 3, () => (minX = Math.min(minX, ball().position[0])));
    game.input.release('moveForward');
    expect(target(game)[0]).toBeLessThan(WEST_WALL);
    // The ball pressed on the wall by the hold sinks up to 3 mm into the contact (measured 2.96 mm
    // after a 2 m walk from the teacher's bench), never through it.
    expect(minX).toBeGreaterThan(WEST_WALL + R - 0.004);
    expect(game.interaction.heldId).toBe(BALL);
    // The player reaches the wall exactly as without the ball: its own load never blocks it.
    expect(Math.abs(game.state.player.position[0] - (WEST_WALL + 0.31))).toBeLessThan(0.002);

    // Look steeply down at the bench: the hold point is inside the bench top. A new game: the
    // wall is now too far for the ball to follow a jump back to the bench. The hold stays in an
    // arm's reach (`holdReach`): a player with a lower eye reaches below the top.
    const bench = await physicsLab();
    bench.game.state.player.eyeHeight = 1.4;
    grabBall(bench.game);
    placePlayer(bench.game, [-2.9, 0, -2.6], 0, -1.2);
    let minY = Infinity;
    run(bench.game, 1.5, () => (minY = Math.min(minY, bench.ball().position[1])));
    expect(target(bench.game)[1]).toBeLessThan(BENCH_TOP);
    expect(minY).toBeGreaterThan(BENCH_TOP + R - 0.003);
  });

  it('never moves or slows the player who holds it', async () => {
    const { game } = await physicsLab();
    grabBall(game);
    placePlayer(game, [0, 0, 1], 0, -1.45); // looking straight down at the floor
    run(game, 1);
    expect(distance(game.state.player.position, [0, 0, 1])).toBeLessThan(0.002);
    game.input.press('moveForward');
    run(game, 1);
    game.input.release('moveForward');
    expect(game.state.player.position[2]).toBeCloseTo(1 - 2.2, 2);
    expect(Math.abs(game.state.player.position[1])).toBeLessThan(0.005);
  });

  it('keeps up with a running player: carried at their speed, never left in their face', async () => {
    const { game, ball } = await physicsLab();
    grabBall(game);
    placePlayer(game, [-2.067, 0, -3.674], Math.PI, 0); // turned south at the bench, the ball held level ahead
    run(game, 0.5);
    game.input.press('moveForward');
    game.input.press('run');
    let worst = 0;
    let steady = 0;
    let t = 0;
    run(game, 1, () => {
      const gap = distance(ball().position, target(game));
      worst = Math.max(worst, gap);
      if ((t += 1 / 60) > 0.2) steady = Math.max(steady, gap);
    });
    game.input.release('run');
    game.input.release('moveForward');
    expect(game.state.player.position[2]).toBeGreaterThan(-3.674 + 4); // it ran (4.5 m/s)
    expect(worst).toBeLessThan(0.1); // the first step's jump to a run
    expect(steady).toBeLessThan(0.02); // was 0.36 m behind, 9 cm from the eye
  });
});

describe('dropping and throwing', () => {
  it('drops where it is held: it falls, lands on the bench and does not snap back', async () => {
    const { game, ball, released } = await physicsLab();
    grabBall(game);
    game.state.player.yaw = -0.3; // a little to the right
    game.state.player.pitch = -0.333; // hold point about 0.36 m above the bench top
    run(game, 0.8);
    const [heldX, heldY, heldZ] = ball().position;
    expect(heldY).toBeGreaterThan(BENCH_TOP + R + 0.25);

    game.input.press('interact');
    game.update(H);
    game.input.release('interact');
    expect(game.interaction.heldId).toBeNull();
    expect(game.physics.stats().heldId).toBeNull();
    expect(released.at(-1)).toMatchObject({ entityId: BALL, reason: 'drop', velocity: [0, 0, 0] });

    run(game, 0.15);
    expect(ball().position[1]).toBeLessThan(heldY - 0.05); // gravity acts again
    run(game, 3);
    const rest = ball();
    expect(rest.position[1]).toBeCloseTo(BENCH_TOP + R, 2);
    expect(Math.abs(rest.position[1] - (BENCH_TOP + R))).toBeLessThan(0.002);
    expect(rest.position[0]).toBeCloseTo(heldX, 1);
    expect(rest.position[2]).toBeCloseTo(heldZ, 1);
    expect(distance(rest.position, BALL_REST)).toBeGreaterThan(0.2); // not back at its spawn
    expect(rest.sleeping).toBe(true);
  });

  it('throws along the aim at impulse / mass, then it flies, hits the wall and bounces', async () => {
    const { game, ball, released } = await physicsLab();
    const counts = game.physics.stats();
    grabBall(game);
    placePlayer(game, [-2.067, 0, -3.674], Math.PI / 2, 0.1); // at the bench, facing the west wall, slightly up
    run(game, 0.6);

    game.input.press('throw');
    game.update(H);
    game.input.release('throw');
    const speed = 2.5 / 0.25; // throwImpulse / mass = 10 m/s (below the 12 m/s cap)
    const aim = directionFromYawPitch(Math.PI / 2, 0.1, [0, 0, 0]);
    const thrown = released.at(-1)!;
    expect(thrown.reason).toBe('throw');
    expect(Math.hypot(...thrown.velocity)).toBeCloseTo(speed, 9);
    expect(thrown.velocity[0] / speed).toBeCloseTo(aim[0], 9);
    expect(thrown.velocity[1] / speed).toBeCloseTo(aim[1], 9);
    expect(game.interaction.heldId).toBeNull();
    expect(ball().speed).toBeGreaterThan(speed - 0.3); // one step of gravity later

    let minX = Infinity;
    let bounced = false;
    let previousX = ball().position[0];
    run(game, 3, () => {
      const x = ball().position[0];
      minX = Math.min(minX, x);
      if (x > previousX + 1e-4 && minX < WEST_WALL + 0.5) bounced = true;
      previousX = x;
    });
    expect(minX).toBeLessThan(WEST_WALL + R + 0.01); // it reached the wall...
    // ...and did not pass it. A 10 m/s impact sinks ~5 mm into the contact for a step before the
    // bounce; tunnelling would put the centre past the wall plane.
    expect(minX).toBeGreaterThan(WEST_WALL + R - 0.01);
    expect(bounced).toBe(true);
    expect(ball().position[1]).toBeLessThan(R + 0.01); // down on the floor by now
    expect(game.physics.stats()).toMatchObject({
      bodies: counts.bodies,
      colliders: counts.colliders,
    });
  });

  it('does not throw objects that are not throwable; E still drops them', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-male');
    await game.scenes.load('biology-lab');
    run(game, 1);
    const scope = 'biology-lab/microscope';
    placePlayer(game, [-10.286, 0, -2.131]); // south-west of it: the photosynthesis lamp is east of it
    lookAt(game, game.world.entity(scope)!.pose.position);
    game.update(H);
    expect(game.interaction.primaryAction(scope)?.label).toBe('Grab');
    game.input.press('interact');
    game.update(H);
    game.input.release('interact');
    expect(game.interaction.heldId).toBe(scope);
    game.input.press('throw');
    game.update(H);
    game.input.release('throw');
    expect(game.interaction.heldId).toBe(scope);
    game.input.press('interact');
    game.update(H);
    expect(game.interaction.heldId).toBeNull();
  });
});

describe('hold lifecycle', () => {
  it('lets go before a scene change and leaves no stale body or binding', async () => {
    const { game, released } = await physicsLab();
    const lab = game.physics.stats();
    const order: string[] = [];
    game.events.subscribe('ObjectReleased', ({ reason }) => order.push(`released:${reason}`));
    game.events.subscribe('SceneUnloaded', () => order.push('unloaded'));
    grabBall(game);
    await game.scenes.load('simlab-hub');
    expect(order).toEqual(['released:scene-change', 'unloaded']);
    expect(released.at(-1)?.entityId).toBe(BALL);
    expect(game.interaction.heldId).toBeNull();
    expect(game.physics.stats()).toMatchObject({ heldId: null, bodies: 41, colliders: 54 });
    run(game, 0.2);

    await game.scenes.load('physics-lab');
    run(game, 2);
    expect(game.physics.stats()).toMatchObject({ bodies: lab.bodies, colliders: lab.colliders });
    expect(game.physics.body(BALL)?.position[1]).toBeCloseTo(BALL_REST[1], 2); // fresh placement
    grabBall(game);
    expect(game.interaction.heldId).toBe(BALL);
  });

  it('clears the hold when the held object is despawned', async () => {
    const { game, released } = await physicsLab();
    grabBall(game);
    game.world.despawn(BALL);
    expect(game.interaction.heldId).toBeNull();
    expect(game.physics.stats().heldId).toBeNull();
    expect(released.at(-1)).toMatchObject({ entityId: BALL, reason: 'despawned' });
    expect(() => run(game, 0.2)).not.toThrow();
  });

  it('lets go of an object that cannot keep up with the hold point', async () => {
    const { game, released, ball } = await physicsLab();
    grabBall(game);
    run(game, 0.3);
    placePlayer(game, [-1.5, 0, 6.3], Math.PI); // by the range's doorway, facing away from the ball
    run(game, 1);
    expect(released.at(-1)).toMatchObject({ entityId: BALL, reason: 'out-of-reach' });
    expect(game.interaction.heldId).toBeNull();
    run(game, 3);
    expect(ball().position[1]).toBeLessThan(BENCH_TOP + R + 0.01); // fell like any dropped body
  });

  it('saving while holding writes no hold state and keeps holding', async () => {
    const { game } = await physicsLab();
    grabBall(game);
    const saved = game.save();
    expect(saved?.ok).toBe(true);
    expect(JSON.stringify(saved?.ok ? saved.value : null)).not.toContain('held');
    expect(game.interaction.heldId).toBe(BALL);
  });
});

describe('targeting with line of sight', () => {
  it('does not target an object hidden behind a solid that is not interactable', async () => {
    const raw = structuredClone(bundledContent);
    (raw.items as object[]).push({
      id: 'screen',
      displayName: 'Screen',
      category: 'structure',
      physical: { massKg: 3 },
      visual: { shape: 'box', size: [1, 0.6, 0.04], color: '#445566' },
    });
    const room = (raw.rooms as { id: string; placements: object[] }[]).find(
      (r) => r.id === 'physics-lab',
    )!;
    room.placements.push({ id: 'screen', item: 'screen', position: [-2.067, 0.9, -4.224] });
    const { game } = await physicsLab({ content: raw });
    placePlayer(game, [-2.067, 0, -3.674]);
    lookAt(game, BALL_REST);
    game.update(H);
    expect(game.interaction.focused).toBeNull(); // the screen stands between eye and ball

    const open = await physicsLab();
    placePlayer(open.game, [-2.067, 0, -3.674]);
    lookAt(open.game, BALL_REST);
    open.game.update(H);
    expect(open.game.interaction.focused?.id).toBe(BALL);
  });
});

// ---- Glassware (items whose physical.handling is not "free") --------------------------------
// A test flask (6 × 14 cm cylinder, `upright`) stands on the teacher’s bench at (−1.267, −4.474).
const FLASK = 'physics-lab/test-flask';
const FLASK_SPOT: Vec3 = [-1.267, BENCH_TOP + 0.07, -4.474];
const DEG = Math.PI / 180;

async function flaskLab() {
  const raw = structuredClone(bundledContent);
  (raw.items as object[]).push({
    id: 'test-flask',
    displayName: 'Test flask',
    category: 'equipment',
    tags: ['test-flask'],
    physical: { massKg: 0.1, body: 'dynamic', ccd: true, handling: 'upright' },
    interactions: ['grab'],
    visual: { shape: 'cylinder', size: [0.06, 0.14, 0.06], color: '#ddeeff' },
  });
  const room = (raw.rooms as { id: string; placements: object[] }[]).find(
    (r) => r.id === 'physics-lab',
  )!;
  room.placements.push({ id: 'test-flask', item: 'test-flask', position: [-1.267, 0.9, -4.474] });
  const lab = await physicsLab({ content: raw });
  const blocked: GameEvents['ActionBlocked'][] = [];
  lab.game.events.subscribe('ActionBlocked', (e) => blocked.push(e));
  const { game } = lab;
  placePlayer(game, [-1.267, 0, -3.674]);
  lookAt(game, FLASK_SPOT);
  game.update(H);
  press(game, 'interact');
  expect(game.interaction.heldId).toBe(FLASK);
  game.state.player.pitch = -0.2;
  run(game, 1);
  const tilt = () => tiltOf(game.world.entity(FLASK)!.pose.rotation);
  return { ...lab, blocked, tilt };
}

function press(game: Game, action: 'interact' | 'pour'): void {
  game.input.press(action);
  game.update(H);
  game.input.release(action);
}

describe('glassware', () => {
  it('E sets it down at the aim, never drops it', async () => {
    const { game, released, tilt } = await flaskLab();
    const spot: Vec3 = [-1.467, BENCH_TOP, -4.374];
    lookAt(game, spot);
    press(game, 'interact');
    expect(game.interaction.heldId).toBeNull();
    expect(released.at(-1)).toMatchObject({ entityId: FLASK, reason: 'set-down' });
    run(game, 2);
    const p = game.world.entity(FLASK)!.pose.position;
    expect(Math.hypot(p[0] - spot[0], p[2] - spot[2])).toBeLessThan(0.005);
    expect(Math.abs(p[1] - 0.07 - BENCH_TOP)).toBeLessThan(0.002);
    expect(tilt()).toBeLessThan(0.5 * DEG);
  });

  it('a refused set-down keeps it in hand and says why', async () => {
    const { game, blocked } = await flaskLab();
    lookAt(game, [-1.267, 0.5, -4.074]); // the bench's front face
    press(game, 'interact');
    expect(game.interaction.heldId).toBe(FLASK);
    expect(blocked.at(-1)).toEqual({
      entityId: FLASK,
      actionId: 'set-down',
      reason: 'That surface is not level.',
    });
    lookAt(game, [-1.267, 0, -3.774]); // the floor at the player's feet
    press(game, 'interact');
    expect(blocked.at(-1)?.reason).toBe('No room to set it down there.');
    expect(game.interaction.heldId).toBe(FLASK);
  });

  it('asks the set-down rule once per press: its refusal keeps it in hand, its yes commits', async () => {
    const { game, blocked } = await flaskLab();
    const asked: [string, string | null, string | null][] = [];
    let answer: string | null = 'Not this step.';
    const remove = game.interaction.setSetDownRule((held, surfaceId, seat) => {
      asked.push([held.id, surfaceId, seat]);
      return answer;
    });
    lookAt(game, [-1.467, BENCH_TOP, -4.374]);
    press(game, 'interact');
    expect(asked).toEqual([[FLASK, 'physics-lab/bench', null]]);
    expect(blocked.at(-1)).toMatchObject({ actionId: 'set-down', reason: 'Not this step.' });
    expect(game.interaction.heldId).toBe(FLASK);
    answer = null;
    press(game, 'interact');
    expect(asked).toHaveLength(2);
    expect(game.interaction.heldId).toBeNull();
    remove();
  });

  it('the held pour input tilts it as the pour rule says, the same at 30, 60 and 300 Hz', async () => {
    const after: number[] = [];
    for (const rate of [30, 60, 300]) {
      const { game, tilt } = await flaskLab();
      game.input.press('pour');
      game.update(1 / rate);
      expect(tilt()).toBeLessThan(0.5 * DEG); // no pour rule: the input does nothing
      game.interaction.setPourTilt(() => 115 * DEG);
      for (let i = 0; i < rate; i++) game.update(1 / rate); // held for 1 s
      after.push(tilt());
      game.input.release('pour');
      for (let i = 0; i < rate; i++) game.update(1 / rate);
      expect(tilt()).toBeLessThan(2 * DEG); // let go of the input: back upright
      expect(game.interaction.heldId).toBe(FLASK);
    }
    for (const a of after) expect(Math.abs(a - 115 * DEG)).toBeLessThan(2 * DEG);
  });

  it('content: glassware handling needs a dynamic body; seats sit on the item’s colliders', async () => {
    const raw = structuredClone(bundledContent);
    const items = raw.items as {
      id: string;
      physical: Record<string, unknown>;
      seats?: object[];
      colliders?: object[];
    }[];
    items.find((i) => i.id === 'lab-bench')!.physical.handling = 'upright';
    await expect(bootTestGame({ content: raw })).rejects.toThrow(
      /physical.handling: "upright" needs a dynamic, unthrowable body/,
    );
    const seated = structuredClone(bundledContent);
    const bench = (seated.items as typeof items).find((i) => i.id === 'lab-bench')!;
    bench.colliders = [{ center: [0, 0, 0], size: [2, 0.9, 0.8] }];
    bench.seats = [{ id: 'tile', center: [0, 0.4, 0], radius: 0.05, accepts: ['x'] }];
    await expect(bootTestGame({ content: seated })).rejects.toThrow(
      /seats.0.center: a seat needs the top face of one of "colliders"/,
    );
  });
});
