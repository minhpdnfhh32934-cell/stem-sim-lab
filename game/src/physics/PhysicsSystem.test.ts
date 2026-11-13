import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../core/config';
import { EventBus } from '../core/EventBus';
import type { Quat, Vec3 } from '../core/math';
import type { Game } from '../game/Game';
import type { GameEvents } from '../game/GameEvents';
import { createGameState } from '../game/GameState';
import { bootTestGame, captureLogger, placePlayer } from '../game/testing';
import { type ItemDefinition, ItemDefinitionSchema } from '../gameplay/item';
import { RoomDefinitionSchema } from '../world/definitions';
import { EntityStates } from '../world/EntityStates';
import { entityFromPlacement, World } from '../world/World';
import { headingOf, tiltOf } from '../gameplay/interaction/hold';
import { PhysicsSystem } from './PhysicsSystem';

// Rapier stores state as 32-bit floats: positions are compared to ~1e-4 m, not exactly.
const H = 1 / 60;
const BENCH_TOP = 0.9;
const BALL_R = 0.04;
const BALL_START = 1.4 + BALL_R; // placement base 1.4 m → centre 1.44 m

const item = (data: object): ItemDefinition => ItemDefinitionSchema.parse(data);
const bench = item({
  id: 'bench',
  displayName: 'Bench',
  category: 'furniture',
  physical: { massKg: 80 },
  visual: { shape: 'box', size: [2, 0.9, 0.8], color: '#cccccc' },
});
const ball = (restitution = 0.6) =>
  item({
    id: 'ball',
    displayName: 'Ball',
    category: 'equipment',
    physical: { massKg: 0.25, body: 'dynamic', friction: 0.4, restitution, ccd: true },
    visual: { shape: 'sphere', size: [0.08, 0.08, 0.08], color: '#bbbbbb' },
  });
const ghost = item({
  id: 'ghost',
  displayName: 'Hologram',
  category: 'equipment',
  physical: { massKg: 1, body: 'none' },
  visual: { shape: 'box', size: [0.5, 0.5, 0.5], color: '#00ffff' },
});

const room = RoomDefinitionSchema.parse({
  id: 'lab',
  displayName: 'Lab',
  bounds: { min: [-3, 0, -3], max: [3, 3, 3] },
  placements: [
    { id: 'bench', item: 'bench', position: [0, 0, -1] },
    { id: 'ball', item: 'ball', position: [0, 1.4, -1] },
    { id: 'ghost', item: 'ghost', position: [2, 0, 2] },
  ],
});

/** Physics alone: World + events + state, driven exactly the way SceneManager drives them. */
async function harness(
  options: {
    config?: object;
    ballRestitution?: number;
    /** More items and placements in the room (glassware, a seat stand). */
    extra?: { items: ItemDefinition[]; placements: object[] };
  } = {},
) {
  const { log, entries } = captureLogger();
  const events = new EventBus<GameEvents>(log);
  const state = createGameState();
  const world = new World(events);
  const config = resolveConfig(options.config ?? {});
  const entityStates = new EntityStates(state, events);
  const physics = new PhysicsSystem({ state, world, entityStates, events, config, log });
  physics.init();
  await physics.load();
  const items: Record<string, ItemDefinition> = {
    bench,
    ball: ball(options.ballRestitution),
    ghost,
  };
  for (const extra of options.extra?.items ?? []) items[extra.id] = extra;
  const scene = options.extra
    ? RoomDefinitionSchema.parse({
        ...room,
        placements: [...room.placements, ...options.extra.placements],
      })
    : room;
  const load = (playerAt: [number, number, number] = [0, 0, 1]) => {
    world.setRooms([scene]);
    for (const p of scene.placements) {
      const definition = items[p.item];
      if (definition) world.spawn(entityFromPlacement(scene.id, p, definition));
    }
    state.player.position = [...playerAt];
    events.publish('SceneLoaded', { sceneId: 'test', kind: 'world' });
    state.session.phase = 'playing';
  };
  const unload = () => {
    world.clear();
    events.publish('SceneUnloaded', { sceneId: 'test' });
  };
  const run = (seconds: number, onFrame?: () => void) => {
    for (let i = 0; i < Math.round(seconds / H); i++) {
      physics.update(H);
      onFrame?.();
    }
  };
  const ballBody = () => {
    const b = physics.body('lab/ball');
    if (!b) throw new Error('ball has no body');
    return b;
  };
  return { physics, world, events, state, entries, load, unload, run, ballBody };
}

describe('physics configuration', () => {
  it('defaults to 60 Hz with at most 5 steps per frame and Earth gravity', () => {
    expect(resolveConfig().physics).toEqual({ gravity: 9.81, fixedStep: 1 / 60, maxSubSteps: 6 });
  });

  it('rejects unusable values with their path', () => {
    expect(() => resolveConfig({ physics: { fixedStep: 0.5 } })).toThrow(
      /config\.physics\.fixedStep/,
    );
    expect(() => resolveConfig({ physics: { maxSubSteps: 0 } })).toThrow(/maxSubSteps/);
    expect(() => resolveConfig({ physics: { maxSubSteps: 2.5 } })).toThrow(/maxSubSteps/);
    expect(() => resolveConfig({ physics: { gravity: -9.81 } })).toThrow(/gravity/);
  });
});

describe('PhysicsSystem', () => {
  it('loads lazily: nothing until load(), then one shared load that never rebuilds the world', async () => {
    const { log } = captureLogger();
    const events = new EventBus<GameEvents>(log);
    const state = createGameState();
    const physics = new PhysicsSystem({
      state,
      world: new World(events),
      entityStates: new EntityStates(state, events),
      events,
      config: resolveConfig(),
      log,
    });
    physics.init();
    expect(physics.stats()).toMatchObject({ status: 'idle', active: false });
    const first = physics.load();
    const second = physics.load(); // concurrent caller
    expect(second).toBe(first);
    expect(physics.stats().status).toBe('loading');
    await first;
    expect(physics.stats()).toMatchObject({ status: 'ready', active: true, bodies: 0 });
    expect(physics.stats().loadMs).toBeGreaterThanOrEqual(0);
    await physics.load(); // already ready: same world, nothing recreated
    expect(physics.load()).toBe(first);
  });

  it('builds room slabs, item colliders and the player capsule from definitions', async () => {
    const h = await harness();
    expect(h.physics.stats()).toMatchObject({ active: true, bodies: 0, colliders: 0 });
    h.load();
    // room (1 body, 6 slabs) + bench + ball + player; the "none" hologram gets nothing
    expect(h.physics.stats()).toMatchObject({ bodies: 4, colliders: 9 });
    expect(h.physics.body('lab/ghost')).toBeNull();
    expect(h.physics.body('lab/ball')?.massKg).toBeCloseTo(0.25, 6);
    expect(h.physics.dynamicBodyIds()).toEqual(['lab/ball']);
  });

  it('accelerates a dynamic ball at g and mirrors its pose to the entity', async () => {
    const h = await harness();
    h.load();
    h.run(10 * H);
    const time = 10 * H;
    // Velocity is integrated exactly for constant g; position is first-order, so it is compared
    // with the continuous solution within the integrator's O(g·h·t) error.
    expect(h.ballBody().speed).toBeCloseTo(9.81 * time, 4);
    const analyticY = BALL_START - (9.81 * time * time) / 2;
    expect(Math.abs(h.ballBody().position[1] - analyticY)).toBeLessThan(9.81 * H * time);
    const pose = h.world.entity('lab/ball')?.pose.position;
    expect(pose?.[1]).toBeCloseTo(h.ballBody().position[1], 6);
  });

  it('drops the ball onto the bench, where it bounces, settles and sleeps', async () => {
    const h = await harness();
    h.load();
    let minY = Infinity;
    let maxAfterFirstImpact = -Infinity;
    let impacts = 0;
    let previousY = BALL_START;
    let falling = true;
    h.run(4, () => {
      const y = h.ballBody().position[1];
      minY = Math.min(minY, y);
      if (falling && y > previousY) {
        impacts++; // moving up again: it hit something
        falling = false;
      } else if (!falling && y < previousY) {
        falling = true;
      }
      if (impacts > 0) maxAfterFirstImpact = Math.max(maxAfterFirstImpact, y);
      previousY = y;
    });
    const rest = h.ballBody();
    expect(impacts).toBeGreaterThanOrEqual(1);
    expect(minY).toBeGreaterThan(BENCH_TOP + BALL_R - 0.005); // never sank into the bench
    expect(maxAfterFirstImpact).toBeLessThan(BALL_START); // bounces lose energy
    expect(rest.position[1]).toBeCloseTo(BENCH_TOP + BALL_R, 2);
    expect(Math.abs(rest.position[1] - (BENCH_TOP + BALL_R))).toBeLessThan(0.002);
    expect(rest.position[0]).toBeCloseTo(0, 3);
    expect(rest.position[2]).toBeCloseTo(-1, 3);
    expect(rest.speed).toBeLessThan(1e-3);
    expect(rest.sleeping).toBe(true);
    expect(h.world.entity('lab/ball')?.pose.position[1]).toBeCloseTo(rest.position[1], 6);
  });

  it('knocks when the dropped ball strikes the bench, at its speed, and falls quiet at rest', async () => {
    const h = await harness();
    const impacts: { entityId: string; speed: number; y: number; at: number }[] = [];
    let t = 0;
    h.events.subscribe('Impact', ({ entityId, speed, position }) =>
      impacts.push({ entityId, speed, y: position[1], at: t }),
    );
    h.load();
    h.run(4, () => (t += H));
    // Free fall from 1.44 m to the bench top: v = √(2·g·Δh) ≈ 2.97 m/s at the first knock, which
    // the bounce reverses (restitution), so the change is larger than the speed itself.
    const arrival = Math.sqrt(2 * 9.81 * (BALL_START - BENCH_TOP - BALL_R));
    const first = impacts[0];
    expect(first?.entityId).toBe('lab/ball');
    expect(first!.speed).toBeGreaterThan(arrival * 0.95);
    expect(first!.y).toBeCloseTo(BENCH_TOP + BALL_R, 1);
    // Fewer, weaker knocks as it bounces lower; none falling freely, none once it rests.
    for (let i = 1; i < impacts.length; i++) {
      expect(impacts[i]!.speed).toBeLessThan(impacts[i - 1]!.speed + 1e-9);
      expect(impacts[i]!.at - impacts[i - 1]!.at).toBeGreaterThanOrEqual(0.08 - 1e-9);
    }
    expect(impacts.length).toBeLessThan(10);
    expect(impacts.at(-1)!.at).toBeLessThan(3);
  });

  it('applies restitution from the item definition', async () => {
    const rebound = async (restitution: number) => {
      const h = await harness({ ballRestitution: restitution });
      h.load();
      let landed = false;
      let apex = 0;
      h.run(1.5, () => {
        const y = h.ballBody().position[1] - (BENCH_TOP + BALL_R);
        if (!landed && y < 0.002) landed = true;
        else if (landed) apex = Math.max(apex, y);
      });
      return apex;
    };
    const dead = await rebound(0);
    const lively = await rebound(1);
    expect(lively).toBeGreaterThan(0.05);
    expect(dead).toBeLessThan(lively / 5);
  });

  it('stops the player capsule at the bench and keeps it on the floor', async () => {
    const h = await harness();
    h.load([0, 0, 1]);
    h.state.player.moveIntent = [0, 0, -2.2]; // walk towards the bench (front face at z = −0.6)
    h.run(3);
    const [x, y, z] = h.state.player.position;
    expect(z).toBeCloseTo(-0.6 + 0.3 + 0.01, 3);
    expect(x).toBeCloseTo(0, 3);
    expect(Math.abs(y)).toBeLessThan(0.005);
    expect(h.state.player.grounded).toBe(true);
    h.run(2); // still holding forward: no creeping through
    expect(h.state.player.position[2]).toBeCloseTo(-0.29, 3);
  });

  it('sees colliders created this frame (no tunnelling on the first step after a load)', async () => {
    const h = await harness();
    h.load([0, 0, -0.29]); // already touching the bench's front face
    h.state.player.moveIntent = [0, 0, -4.5]; // running into it from the very first frame
    h.physics.update(H);
    expect(h.state.player.position[2]).toBeGreaterThan(-0.29 - 0.002);
  });

  it('stays on a flat floor without drifting while walking back and forth', async () => {
    const h = await harness();
    h.load([0, 0, 1.5]);
    let maxDrift = 0;
    for (let second = 0; second < 10; second++) {
      h.state.player.moveIntent = [second % 2 === 0 ? 2 : -2, 0, 0];
      h.run(1, () => (maxDrift = Math.max(maxDrift, Math.abs(h.state.player.position[1]))));
    }
    expect(maxDrift).toBeLessThan(0.005);
    expect(h.state.player.position[0]).toBeCloseTo(0, 2);
  });

  it('lets a player placed in the air fall and land on the floor', async () => {
    const h = await harness();
    h.load([1.5, 1.2, 1.5]);
    h.run(0.1);
    expect(h.state.player.grounded).toBe(false);
    expect(h.state.player.position[1]).toBeLessThan(1.2);
    h.run(1);
    expect(Math.abs(h.state.player.position[1])).toBeLessThan(0.005);
    expect(h.state.player.grounded).toBe(true);
  });

  it('treats an outside write to the player position as a teleport', async () => {
    const h = await harness();
    h.load([0, 0, 1]);
    h.run(0.1);
    h.state.player.position = [2, 0, 2];
    h.run(0.1);
    expect(h.state.player.position[0]).toBeCloseTo(2, 3);
    expect(h.state.player.position[2]).toBeCloseTo(2, 3);
    h.state.player.moveIntent = [-2.2, 0, 0]; // the capsule really moved: walls still apply
    h.run(3);
    // Contact stops are exact to about a millimetre (the controller's skin is approximate).
    expect(Math.abs(h.state.player.position[0] - (-3 + 0.31))).toBeLessThan(0.002);
  });

  it('steps on a fixed timestep regardless of frame times, and caps steps per frame', async () => {
    const regular = await harness();
    const irregular = await harness();
    regular.load();
    irregular.load();
    let regularSteps = 0;
    for (let i = 0; i < 60; i++) {
      regular.physics.update(H);
      regularSteps += regular.physics.stats().stepsLastFrame;
    }
    let irregularSteps = 0;
    const pattern = [0.004, 0.031, 0.0167, 0.009, 0.0223]; // sums to 0.083 s = 4.98 steps
    let elapsed = 0;
    for (let i = 0; elapsed < 1 - 1e-9; i++) {
      const dt = Math.min(pattern[i % pattern.length] ?? H, 1 - elapsed);
      elapsed += dt;
      irregular.physics.update(dt);
      irregularSteps += irregular.physics.stats().stepsLastFrame;
    }
    expect(regularSteps).toBe(60);
    expect(irregularSteps).toBe(60);
    // Identical step sequences give identical (deterministic) results.
    expect(irregular.ballBody().position).toEqual(regular.ballBody().position);

    regular.physics.update(2); // a two-second stall
    expect(regular.physics.stats().stepsLastFrame).toBe(6);
  });

  it('drives a body: out of the simulation while driven, back at its pose at rest after', async () => {
    const h = await harness();
    h.load();
    h.run(0.2);
    expect(h.physics.drive('lab/ball')).toBe(true);
    expect(h.physics.drive('lab/bench')).toBe(false); // only dynamic bodies
    const pose = h.world.entity('lab/ball')!.pose.position;
    pose[0] = 1.5; // the driver (an experiment) puts it somewhere in mid-air
    pose[1] = 2;
    pose[2] = 0;
    h.run(0.5);
    expect([...pose]).toEqual([1.5, 2, 0]); // physics neither moved nor overwrote it
    expect(h.physics.stats().driven).toBe(1);
    // It collides with nothing while driven: a ray through it reaches the wall behind.
    expect(h.physics.castRay([1.5, 2, 2.9], [0, 0, -1], 10)?.entityId).toBeNull();

    h.physics.stopDriving('lab/ball');
    expect(h.physics.stats().driven).toBe(0);
    const [x, y, z] = h.ballBody().position;
    expect([x, y, z]).toEqual([expect.closeTo(1.5, 4), expect.closeTo(2, 4), expect.closeTo(0, 4)]);
    h.run(1.5); // from rest at its pose: it falls to the floor there
    expect(h.ballBody().position[0]).toBeCloseTo(1.5, 3);
    expect(h.ballBody().position[1]).toBeCloseTo(BALL_R, 2);
  });

  it('does not step while not playing, and never after dispose', async () => {
    const h = await harness();
    h.load();
    h.state.session.phase = 'menu';
    h.run(0.5);
    expect(h.ballBody().position[1]).toBeCloseTo(BALL_START, 6);
    expect(h.physics.stats().stepsLastFrame).toBe(0);
    h.physics.dispose();
    h.state.session.phase = 'playing';
    expect(() => h.run(0.5)).not.toThrow();
    expect(h.physics.stats()).toMatchObject({ active: false, bodies: 0, colliders: 0 });
    expect(h.events.listenerCount()).toBe(0);
  });

  it('does not accumulate bodies, colliders or listeners over repeated scene loads', async () => {
    const h = await harness();
    const listeners = h.events.listenerCount();
    for (let i = 0; i < 5; i++) {
      h.load();
      h.run(0.2);
      expect(h.physics.stats()).toMatchObject({ bodies: 4, colliders: 9 });
      h.unload();
      expect(h.physics.stats()).toMatchObject({ bodies: 0, colliders: 0 });
    }
    expect(h.events.listenerCount()).toBe(listeners);
    expect(h.entries.filter((e) => e.level === 'warn' || e.level === 'error')).toEqual([]);
  });
});

describe('drawing between steps (P3.12)', () => {
  const F = 1 / 300; // a 300 Hz display, five frames per step
  const drawnPlayer = (h: Awaited<ReturnType<typeof harness>>) => h.physics.renderPlayer([0, 0, 0]);

  it('draws the walking player moving evenly at 300 Hz, where the state moves in 1/60 s jumps', async () => {
    const h = await harness();
    h.load([-2, 0, 1]);
    h.state.player.moveIntent = [2.2, 0, 0];
    for (let i = 0; i < 30; i++) h.physics.update(F); // up to speed
    const drawn: number[] = [];
    const state: number[] = [];
    for (let i = 0; i < 60; i++) {
      h.physics.update(F);
      drawn.push(drawnPlayer(h)[0]);
      state.push(h.state.player.position[0]);
    }
    const steps = (xs: number[]) => xs.slice(1).map((x, i) => x - xs[i]!);
    // The state stands still four frames in five, then jumps a whole step (2.2 m/s × 1/60 s).
    expect(steps(state).filter((d) => d === 0).length).toBeGreaterThanOrEqual(45);
    // Drawn: every frame moves 2.2 m/s × 1/300 s (Rapier's float32: to 0.1 mm).
    for (const d of steps(drawn)) expect(Math.abs(d - 2.2 * F)).toBeLessThan(1e-4);
    // …one step behind the state at most, never ahead.
    drawn.forEach((x, i) => {
      expect(x).toBeLessThanOrEqual(state[i]! + 1e-9);
      expect(state[i]! - x).toBeLessThanOrEqual(2.2 * H + 1e-4);
    });
  });

  it('at 60 Hz frames draws exactly the step before the state: one step of delay, no blend', async () => {
    const h = await harness();
    h.load([-2, 0, 1]);
    h.state.player.moveIntent = [2.2, 0, 0];
    h.run(0.5);
    const before = h.state.player.position[0];
    h.physics.update(H);
    expect(drawnPlayer(h)[0]).toBeCloseTo(before, 6);
  });

  it('draws a teleport at once, and the state as it is while not playing', async () => {
    const h = await harness();
    h.load([-2, 0, 1]);
    h.state.player.moveIntent = [2.2, 0, 0];
    for (let i = 0; i < 37; i++) h.physics.update(F);
    h.state.player.position = [2, 0, 2]; // a door, a load, the developer jump
    h.physics.update(F);
    expect(drawnPlayer(h)).toEqual([...h.state.player.position]);
    expect(h.state.player.position[0]).toBeCloseTo(2, 6);

    h.state.session.phase = 'menu';
    h.state.player.position = [-1, 0, -2];
    h.physics.update(F);
    expect(drawnPlayer(h)).toEqual([-1, 0, -2]);
  });

  it('leaves a driven body to its driver, and draws it from where the driver left it after', async () => {
    const h = await harness();
    h.load();
    for (let i = 0; i < 37; i++) h.physics.update(F); // the ball is falling
    const position: Vec3 = [0, 0, 0];
    const rotation: Quat = [0, 0, 0, 1];
    expect(h.physics.renderPose('lab/ball', position, rotation)).toBe(true);
    expect(h.physics.renderPose('lab/bench', position, rotation)).toBe(false); // fixed: not moved
    h.physics.drive('lab/ball');
    expect(h.physics.renderPose('lab/ball', position, rotation)).toBe(false);
    const pose = h.world.entity('lab/ball')!.pose.position;
    pose[0] = 1.5;
    pose[1] = 2;
    pose[2] = 0;
    for (let i = 0; i < 7; i++) h.physics.update(F);
    h.physics.stopDriving('lab/ball');
    expect(h.physics.renderPose('lab/ball', position, rotation)).toBe(true);
    expect(position).toEqual([1.5, 2, 0]); // not slid from where it fell before it was driven
  });

  it('changes nothing physics computes: the same steps with and without drawing', async () => {
    const drawn = await harness();
    const plain = await harness();
    for (const h of [drawn, plain]) {
      h.load([-2, 0, 1]);
      h.state.player.moveIntent = [2.2, 0, 0.5];
    }
    const position: Vec3 = [0, 0, 0];
    const rotation: Quat = [0, 0, 0, 1];
    for (let i = 0; i < 300; i++) {
      drawn.physics.update(F);
      drawn.physics.renderPlayer(position);
      drawn.physics.renderPose('lab/ball', position, rotation);
      plain.physics.update(F);
    }
    expect(drawn.state.player.position).toEqual(plain.state.player.position);
    expect(drawn.ballBody().position).toEqual(plain.ballBody().position);
    expect(drawn.world.entity('lab/ball')!.pose).toEqual(plain.world.entity('lab/ball')!.pose);
  });

  // Frame times: a 300 Hz display; the 60 FPS cap with the browser's jitter (the step/frame
  // phase drifts); the 90 FPS cap on a 300 Hz display (3 and 4 refreshes alternating). Ranges of
  // the held object's bearing in the view, measured: drawn as stepped (before) 1.15°, 0.005° and
  // 1.18°. At 90 FPS the steps sample the turning view unevenly, so the held body's own lag
  // behind its hold point varies (physics, untouched here): drawing halves it, cannot remove it.
  it.each([
    ['300 Hz', [F], () => 0.1],
    ['the 60 FPS cap', [0.0166, 0.01673, 0.01667, 0.01662, 0.01671, 0.01669], () => 0.1],
    ['the 90 FPS cap', [0.01, 0.013333], (stepped: number) => 0.6 * stepped],
  ])('keeps a held object steady in the view while turning, at %s', async (_, frames, limit) => {
    const h = await harness();
    h.load([0, 0, 1]);
    h.run(0.5);
    expect(h.physics.grab('lab/ball')).toBe(true);
    const turn = 1.5; // rad/s, as the GPU probe turned
    const bearing = (ball: Readonly<Vec3>, feet: Readonly<Vec3>) => {
      const b = Math.atan2(-(ball[0] - feet[0]), -(ball[2] - feet[2]));
      const d = b - h.state.player.yaw;
      return (Math.atan2(Math.sin(d), Math.cos(d)) * 180) / Math.PI;
    };
    const position: Vec3 = [0, 0, 0];
    const rotation: Quat = [0, 0, 0, 1];
    const drawn: number[] = [];
    const stepped: number[] = [];
    let elapsed = 0;
    for (let i = 0; elapsed < 2.5; i++) {
      const dt = frames[i % frames.length]!;
      elapsed += dt;
      h.state.player.yaw -= turn * dt; // a smooth mouse, applied each frame as PlayerSystem does
      h.physics.update(dt);
      if (elapsed < 1) continue; // settled into the turn
      h.physics.renderPose('lab/ball', position, rotation);
      drawn.push(bearing(position, h.physics.renderPlayer([0, 0, 0])));
      stepped.push(bearing(h.world.entity('lab/ball')!.pose.position, h.state.player.position));
    }
    const range = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
    expect(range(drawn)).toBeLessThan(limit(range(stepped)));
  });

  it('draws a held object where it is, before any turn', async () => {
    const h = await harness();
    h.load([0, 0, 1]);
    h.run(0.5);
    h.physics.grab('lab/ball');
    h.run(1); // brought to the hold point and settled
    const position: Vec3 = [0, 0, 0];
    h.physics.renderPose('lab/ball', position, [0, 0, 0, 1]);
    const pose = h.world.entity('lab/ball')!.pose.position;
    for (let i = 0; i < 3; i++) expect(position[i]).toBeCloseTo(pose[i]!, 5); // float32 poses
  });
});

describe('physics in the game', () => {
  it('blocks the player at the Physics Lab bench and settles the steel ball on it', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-male');
    await game.scenes.load('physics-lab');
    // The teacher's demonstration bench (Phase U-2): its front face at z = −4.074.
    placePlayer(game, [-1.667, 0, -2.474]); // facing −Z
    game.input.press('moveForward');
    for (let i = 0; i < 180; i++) game.update(H);
    expect(game.state.player.position[2]).toBeCloseTo(-4.074 + 0.31, 3);

    const steelBall = game.physics.body('physics-lab/steel-ball');
    expect(steelBall?.position[1]).toBeCloseTo(BENCH_TOP + BALL_R, 2);
    expect(steelBall?.sleeping).toBe(true);
  });

  it('keeps physics counts and listeners stable across scene changes', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-male');
    await game.scenes.load('physics-lab');
    game.update(H);
    const lab = game.physics.stats();
    const listeners = game.events.listenerCount();
    for (let i = 0; i < 3; i++) {
      await game.scenes.load('simlab-hub');
      game.update(H);
      await game.scenes.load('physics-lab');
      game.update(H);
      expect(game.physics.stats()).toMatchObject({ bodies: lab.bodies, colliders: lab.colliders });
    }
    expect(game.events.listenerCount()).toBe(listeners);
    // Lab: room (6 slabs + 6 for the three openings' wall pieces) + bench, ball, lamp, door,
    // free-fall tower, its desk, spring stand, its desk; projectile range: room (8 slabs) +
    // launcher, cart, desk, 3 balls, the refraction board and its desk, the circuit board and its
    // desk, the incline's bench, ramp and desk, the seven later benches' apparatus and desks and
    // the four benches under them; pendulum bay: room (8 slabs) + pendulum stand, desk; + player
    // capsule. Phase T-1a: the wing rebuilt (layoutSweep.test.ts counts it the same).
    expect(lab).toMatchObject({ bodies: 177, colliders: 232 }); // Phase E: the circuit bench
  });
});

describe('doorways: Preparation Room ⇄ cleanroom corridor', () => {
  // Preparation Room x −3 … 3, z −3 … 3; corridor x −1.5 … 1.5, z −11.25 … −3.25. The 0.25 m
  // wall between them (z −3.25 … −3) has a 1.2 m × 2.2 m doorway centred on x = 0.
  const frames = (game: Game, seconds: number) => {
    for (let i = 0; i < Math.round(seconds / H); i++) game.update(H);
  };
  const walk = (game: Game, action: 'moveForward' | 'moveBack', seconds: number) => {
    game.input.press(action);
    frames(game, seconds);
    game.input.release(action);
    game.update(H);
  };

  it('lets the player walk through the doorway into the corridor and back', async () => {
    const { game } = await bootTestGame();
    const entered: GameEvents['PlayerEnteredRoom'][] = [];
    game.events.subscribe('PlayerEnteredRoom', (e) => entered.push(e));
    await game.newGame('researcher-male'); // spawn (0, 0, 1) facing north, at the doorway
    walk(game, 'moveForward', 3); // 6.6 m at 2.2 m/s
    const [x, , z] = game.state.player.position;
    expect(z).toBeLessThan(-5.5); // through the wall, not slowed by it
    expect(Math.abs(x)).toBeLessThan(1e-3); // not deflected by the door jambs
    expect(game.state.player.roomId).toBe('cleanroom-corridor');

    walk(game, 'moveBack', 3);
    expect(game.state.player.position[2]).toBeGreaterThan(0.9);
    expect(game.state.player.roomId).toBe('preparation-room');
    // Crossing the wall gap does not count as leaving: each event names the room left.
    expect(entered).toEqual([
      { roomId: 'preparation-room', previousRoomId: null },
      { roomId: 'cleanroom-corridor', previousRoomId: 'preparation-room' },
      { roomId: 'preparation-room', previousRoomId: 'cleanroom-corridor' },
    ]);
  });

  it('stops the player at the wall beside the doorway, from both sides', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-male');
    placePlayer(game, [-1.5, 0, 0]); // facing north, west of the doorway (x −0.6 … 0.6)
    walk(game, 'moveForward', 3);
    expect(game.state.player.position[2]).toBeCloseTo(-3 + 0.31, 3); // radius 0.3 + skin 0.01
    expect(game.state.player.roomId).toBe('preparation-room');

    placePlayer(game, [1, 0, -3.8], Math.PI); // in the corridor facing south, east of the doorway
    walk(game, 'moveForward', 2);
    expect(game.state.player.position[2]).toBeCloseTo(-3.25 - 0.31, 3);
  });

  it('leaves the doorway open to line of sight and closed beside and above it', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-male');
    game.update(H);
    const north: Vec3 = [0, 0, -1];
    // Through the doorway: the hub door at the far end of the corridor (front face z = −11.16).
    const through = game.physics.castRay([0, 1.6, 1], north, 20);
    expect(through?.entityId).toBe('cleanroom-corridor/door-hub');
    expect(through?.distance).toBeCloseTo(12.16, 3);
    // Beside the doorway and above it (lintel from 2.2 m): the wall at z = −3.
    for (const origin of [[1, 1.6, 1] as Vec3, [0, 2.5, 1] as Vec3]) {
      const hit = game.physics.castRay(origin, north, 20);
      expect(hit?.distance).toBeCloseTo(4, 3);
      expect(hit?.entityId).toBeNull();
    }
  });

  // The cabinet stands against the west wall (x −3), its front at x −2.4, spanning z −1.8 … −0.6
  // (UX3.1): a fixed carcass (sides, back, top, floor) and two hinged leaves, each its own
  // kinematic body turned about its hinge by the hinge system. Its pose never moves.
  const CABINET = 'preparation-room/wardrobe';
  const west: Vec3 = [-1, 0, 0];

  it('is solid closed (its leaves), open at its mouth (its back), and never moves', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-male');
    game.update(H);
    const look = (z: number) => game.physics.castRay([-1, 1, z], west, 5);
    // Closed: the leaves' fronts at x −2.428, on both halves and on the seam between them.
    for (const z of [-1.5, -1.2, -0.9]) {
      expect(look(z)).toMatchObject({ entityId: CABINET });
      expect(look(z)?.distance).toBeCloseTo(1.428, 3);
    }
    const placed = game.world.entity(CABINET)?.pose.position.slice();

    game.entityStates.set(CABINET, 'open', true);
    game.update(H);
    expect(look(-1.2)?.distance).toBeLessThan(1.5); // a step later the leaves have barely turned
    for (let i = 0; i < 40; i++) game.update(H); // its 0.5 s swing
    expect(game.hinges.fraction(CABINET)).toBe(1);
    // Open: through the mouth onto its back panel (x −2.982): no wall at the mouth.
    expect(look(-1.2)).toMatchObject({ entityId: CABINET });
    expect(look(-1.2)?.distance).toBeCloseTo(1.982, 3);
    // The sides stay solid: along the cabinet's north side, its side panel is hit.
    const side = game.physics.castRay([-2.7, 1, 0.5], [0, 0, -1], 5);
    expect(side).toMatchObject({ entityId: CABINET });
    expect(side?.distance).toBeCloseTo(0.5 + 0.6, 1); // the open leaf on that side, or the panel
    expect(game.world.entity(CABINET)?.pose.position).toEqual(placed);

    game.entityStates.set(CABINET, 'open', false);
    for (let i = 0; i < 40; i++) game.update(H);
    expect(look(-1.2)?.distance).toBeCloseTo(1.428, 3);
  });

  it('turns its leaf bodies where the swing is, a step behind like door leaves', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-male');
    game.update(H);
    game.entityStates.set(CABINET, 'open', true);
    // 0.2 m into the south leaf from the seam: hit while the leaf has barely turned; once it has
    // turned half way (55°, its free edge 0.34 m from its hinge across), the ray reaches the back.
    const seam = () => game.physics.castRay([-1, 1, -1.4], west, 5)?.distance;
    expect(seam()).toBeCloseTo(1.428, 3);
    const seen: [number, number | undefined][] = [];
    for (let i = 0; i < 31; i++) {
      game.update(H);
      seen.push([game.hinges.fraction(CABINET), seam()]);
    }
    const early = seen.filter(([f]) => f > 0 && f < 0.1);
    const late = seen.filter(([f]) => f >= 0.5);
    expect(early.length).toBeGreaterThan(0);
    expect(late.length).toBeGreaterThan(0);
    for (const [, d] of early) expect(d).toBeLessThan(1.5); // the leaves still in the way
    for (const [, d] of late) expect(d).toBeCloseTo(1.982, 3); // the back panel
  });

  it('builds an already-open PPE cabinet open', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-male');
    game.entityStates.set(CABINET, 'open', true);
    await game.scenes.load('simlab-hub');
    await game.scenes.load('preparation-room');
    game.update(H);
    expect(game.hinges.fraction(CABINET)).toBe(1);
    const hit = game.physics.castRay([-1, 1, -1.2], west, 5);
    expect(hit).toMatchObject({ entityId: CABINET });
    expect(hit?.distance).toBeCloseTo(1.982, 3);
  });

  it('keeps body and collider counts stable across scene changes', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-male');
    game.update(H);
    const prep = game.physics.stats();
    // 2 room bodies (8 slabs each: the doorway wall is 2 pieces + a lintel, + 2 for the door
    // opening in each), 12 furniture and equipment bodies, the player capsule; UX3.1: the PPE
    // cabinet's carcass is 5 colliders, not 1, and its 2 leaves 2 kinematic bodies.
    expect(prep).toMatchObject({ bodies: 17, colliders: 39 });
    for (let i = 0; i < 3; i++) {
      await game.scenes.load('simlab-hub');
      game.update(H);
      expect(game.physics.stats()).toMatchObject({ bodies: 42, colliders: 55 });
      await game.scenes.load('preparation-room');
      game.update(H);
      expect(game.physics.stats()).toMatchObject({ bodies: 17, colliders: 39 });
    }
  });
});

// ---- Glassware: held orientation, set-down, seats, upright lock --------------------------------
// The flask is a 6 × 14 cm cylinder standing on the bench (top 0.9 m) at x 0.5; the stand at x
// −0.6 is one static item with two collider boxes: a 1 cm tile (top 0.91 m, seat "tile") beside a
// 12 cm block (top 1.02 m). The bottle is the same cylinder without the tag the tile accepts.
const DEG = Math.PI / 180;
const flaskItem = (id: string, tags: string[]) =>
  item({
    id,
    displayName: id,
    category: 'equipment',
    tags,
    physical: { massKg: 0.1, body: 'dynamic', ccd: true, friction: 0.6, handling: 'upright' },
    visual: { shape: 'cylinder', size: [0.06, 0.14, 0.06], color: '#ddeeff' },
  });
const stand = item({
  id: 'stand',
  displayName: 'Stand',
  category: 'equipment',
  physical: { massKg: 5 },
  colliders: [
    { center: [-0.1, -0.055, 0], size: [0.16, 0.01, 0.16] },
    { center: [0.1, 0, 0], size: [0.2, 0.12, 0.3] },
  ],
  seats: [{ id: 'tile', center: [-0.1, -0.05, 0], radius: 0.05, accepts: ['flask'] }],
  visual: { shape: 'box', size: [0.4, 0.12, 0.3], color: '#ffffff' },
});
const FLASK = 'lab/flask';
const BOTTLE = 'lab/bottle';
const FLASK_HALF = 0.07;
const TILE_CENTRE: Vec3 = [-0.7, 0.91, -1];

const glassware = () =>
  harness({
    extra: {
      items: [flaskItem('flask', ['flask']), flaskItem('bottle', ['bottle']), stand],
      placements: [
        { id: 'flask', item: 'flask', position: [0.5, 0.9, -1] },
        { id: 'bottle', item: 'bottle', position: [0.75, 0.9, -1.2] },
        { id: 'stand', item: 'stand', position: [-0.6, 0.9, -1] },
      ],
    },
  });
type Lab = Awaited<ReturnType<typeof glassware>>;

const aimAt = (h: Lab, target: Readonly<Vec3>) => {
  const p = h.state.player;
  const dx = target[0] - p.position[0];
  const dy = target[1] - (p.position[1] + p.eyeHeight);
  const dz = target[2] - p.position[2];
  p.yaw = Math.atan2(-dx, -dz);
  p.pitch = Math.atan2(dy, Math.hypot(dx, dz));
};
const poseOf = (h: Lab, id: string) => h.world.entity(id)!.pose;
const tilt = (h: Lab, id: string) => tiltOf(poseOf(h, id).rotation);

/** Loads the lab with the player in front of the bench and the flask (or `id`) in hand. */
async function holding(id = FLASK, playerAt: Vec3 = [0.3, 0, 0]) {
  const h = await glassware();
  h.load(playerAt);
  h.run(0.5);
  aimAt(h, poseOf(h, id).position);
  expect(h.physics.grab(id)).toBe(true);
  h.state.player.pitch = -0.3;
  h.run(1);
  return h;
}

describe('glassware: held orientation', () => {
  it('holds it upright and keeps its heading relative to the view as the view turns', async () => {
    const h = await holding();
    const offset = headingOf(poseOf(h, FLASK).rotation) - h.state.player.yaw;
    expect(tilt(h, FLASK)).toBeLessThan(0.5 * DEG);
    h.state.player.yaw += 0.8;
    h.run(1);
    expect(tilt(h, FLASK)).toBeLessThan(0.5 * DEG);
    const turned = headingOf(poseOf(h, FLASK).rotation) - h.state.player.yaw - offset;
    expect(Math.abs(Math.atan2(Math.sin(turned), Math.cos(turned)))).toBeLessThan(0.5 * DEG);
  });

  it('tilts at most 4 rad/s, reaches the tilt asked for and holds it at 30, 60 and 300 Hz', async () => {
    const target = 115 * DEG;
    const finals: number[] = [];
    for (const rate of [30, 60, 300]) {
      const h = await holding();
      let t = 0;
      let reached: number | null = null;
      let most = 0;
      const series: number[] = [];
      while (t < 1.5 - 1e-9) {
        h.physics.setHoldTilt(target); // asked every frame, as the pour input does
        h.physics.update(1 / rate);
        t += 1 / rate;
        const now = tilt(h, FLASK);
        series.push(now);
        most = Math.max(most, now);
        expect(now).toBeLessThanOrEqual(4 * (t + H) + 0.01); // never faster than the cap
        if (reached === null && Math.abs(now - target) < 2 * DEG) reached = t;
      }
      // 2.0 rad at 4 rad/s is 0.5 s, plus the drive's exponential tail.
      expect(reached).not.toBeNull();
      expect(reached!).toBeGreaterThan(0.45);
      expect(reached!).toBeLessThan(0.8);
      expect(most).toBeLessThan(target + 1 * DEG); // no overshoot
      const last = series.slice(-Math.round(rate / 4)); // the last 0.25 s: steady
      expect(Math.max(...last) - Math.min(...last)).toBeLessThan(0.1 * DEG);
      finals.push(series.at(-1)!);
      h.physics.setHoldTilt(0);
      h.run(1);
      expect(tilt(h, FLASK)).toBeLessThan(2 * DEG); // back upright
    }
    for (const f of finals) expect(Math.abs(f - finals[0]!)).toBeLessThan(0.2 * DEG);
  });

  it('draws the turn smoothly at 300 Hz: it turns every frame, never stands then jumps', async () => {
    const h = await holding();
    const drawn: Quat[] = [];
    const state: number[] = [];
    const position: Vec3 = [0, 0, 0];
    for (let i = 0; i < 60; i++) {
      h.physics.setHoldTilt(90 * DEG);
      h.physics.update(1 / 300);
      const rotation: Quat = [0, 0, 0, 1];
      expect(h.physics.renderPose(FLASK, position, rotation)).toBe(true);
      drawn.push(rotation);
      state.push(tilt(h, FLASK));
    }
    const angle = (a: Quat, b: Quat) =>
      2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])));
    // The state turns in 1/60 s jumps: four frames in five it stands still…
    const still = state.slice(11, 50).filter((s, i) => s === state[10 + i]).length;
    expect(still).toBeGreaterThanOrEqual(28);
    // …drawn, every frame at the 4 rad/s cap (frames 10–50) turns about 4/300 rad.
    for (let i = 10; i < 50; i++) {
      const s = angle(drawn[i - 1]!, drawn[i]!);
      expect(s).toBeGreaterThan(0.5 * (4 / 300));
      expect(s).toBeLessThan(1.5 * (4 / 300));
    }
  });

  it('is not turned into the bench at 10 fps or slower (the turn rate cap and contacts)', async () => {
    for (const dt of [0.1, 0.25]) {
      const h = await holding();
      aimAt(h, [0.3, 0.9, -1]); // the hold point is inside the bench top: swept to rest on it
      h.run(1);
      let lowest = Infinity;
      for (let t = 0; t < 2; t += dt) {
        h.physics.setHoldTilt(115 * DEG);
        h.physics.update(dt);
        const { position, rotation } = poseOf(h, FLASK);
        const a = tiltOf(rotation);
        // The cylinder's lowest point: half its height along its axis, its radius across.
        lowest = Math.min(
          lowest,
          position[1] - (FLASK_HALF * Math.abs(Math.cos(a)) + 0.03 * Math.sin(a)),
        );
      }
      expect(lowest).toBeGreaterThan(BENCH_TOP - 0.004);
      expect(h.physics.stats().heldId).toBe(FLASK);
    }
  });
});

describe('glassware: set-down', () => {
  it('sets it down where aimed: upright, resting on the bench, then asleep', async () => {
    const h = await holding();
    const spot: Vec3 = [0.1, BENCH_TOP, -0.9];
    aimAt(h, spot);
    expect(h.physics.planSetDown()).toEqual({ ok: true, surfaceId: 'lab/bench', seat: null });
    expect(h.physics.setDown()).toBe(true);
    expect(h.physics.stats().heldId).toBeNull();
    expect(h.physics.setDown()).toBe(false); // a plan is used once
    h.run(3);
    const { position } = poseOf(h, FLASK);
    expect(Math.hypot(position[0] - spot[0], position[2] - spot[2])).toBeLessThan(0.005);
    expect(Math.abs(position[1] - FLASK_HALF - BENCH_TOP)).toBeLessThan(0.002);
    expect(tilt(h, FLASK)).toBeLessThan(0.5 * DEG);
    expect(h.physics.body(FLASK)?.sleeping).toBe(true);
  });

  it('refuses with a reason and keeps holding: no surface, too far, not level, no room', async () => {
    const h = await holding();
    const refused = (reason: string) => {
      expect(h.physics.planSetDown()).toEqual({ ok: false, reason });
      expect(h.physics.setDown()).toBe(false);
      expect(h.physics.stats().heldId).toBe(FLASK);
    };
    const p = h.state.player;
    p.yaw = Math.PI / 2; // west: the wall 3.3 m away, beyond reach + 1 m
    p.pitch = 0;
    refused('no-surface');
    p.pitch = -0.6; // the floor 2.84 m away along the aim
    refused('too-far');
    aimAt(h, [0.3, 0.5, -0.6]); // the bench's front face
    refused('not-level');
    aimAt(h, [-0.385, BENCH_TOP, -1]); // the bench beside the block: it would rest on the block
    refused('no-room');
    aimAt(h, [0.3, 0, -0.1]); // the floor at the player's own feet: the capsule is there
    refused('no-room');
    aimAt(h, [0.75, BENCH_TOP, -1.2]); // the bottle (dynamic): the ray passes it to the bench
    refused('no-room');
    h.run(1);
    expect(h.physics.stats().heldId).toBe(FLASK);
  });

  it('snaps into a seat that takes it, on the stand’s own colliders; refuses one that does not', async () => {
    const h = await holding();
    // The tile is a real surface beside the taller block (the stand's colliders, not its box).
    const down = h.physics.castRay([TILE_CENTRE[0], 2, TILE_CENTRE[2]], [0, -1, 0], 2);
    expect(down?.entityId).toBe('lab/stand');
    expect(down?.distance).toBeCloseTo(2 - TILE_CENTRE[1], 3);
    expect(down?.normal[1]).toBeCloseTo(1, 3);
    // Aimed 3 cm off the tile's centre, within its 5 cm radius.
    h.state.player.position = [-0.7, 0, 0];
    h.run(0.3);
    aimAt(h, [TILE_CENTRE[0] - 0.03, TILE_CENTRE[1], TILE_CENTRE[2]]);
    expect(h.physics.planSetDown()).toEqual({ ok: true, surfaceId: 'lab/stand', seat: 'tile' });
    expect(h.physics.setDown()).toBe(true);
    h.run(3);
    const { position } = poseOf(h, FLASK);
    const off = Math.hypot(position[0] - TILE_CENTRE[0], position[2] - TILE_CENTRE[2]);
    expect(off).toBeLessThan(0.002);
    expect(Math.abs(position[1] - FLASK_HALF - TILE_CENTRE[1])).toBeLessThan(0.002);

    const other = await holding(BOTTLE, [0.6, 0, 0]);
    other.state.player.position = [-0.7, 0, 0];
    other.run(0.3);
    aimAt(other, TILE_CENTRE);
    expect(other.physics.planSetDown()).toEqual({ ok: false, reason: 'wrong-seat' });
    expect(other.physics.stats().heldId).toBe(BOTTLE);
  });
});

describe('glassware: upright at rest', () => {
  it('slides but never tips when the ball hits it', async () => {
    const h = await glassware();
    h.load([0.5, 0, 0.3]);
    h.run(1);
    const before: Vec3 = [...poseOf(h, FLASK).position];
    aimAt(h, poseOf(h, 'lab/ball').position);
    expect(h.physics.grab('lab/ball')).toBe(true);
    aimAt(h, before);
    h.run(1);
    const ballAt = poseOf(h, 'lab/ball').position;
    const d: Vec3 = [before[0] - ballAt[0], before[1] - ballAt[1], before[2] - ballAt[2]];
    const n = Math.hypot(...d) / 6;
    h.physics.release([d[0] / n, d[1] / n, d[2] / n]); // at 6 m/s, straight at it
    let most = 0;
    h.run(2, () => (most = Math.max(most, tilt(h, FLASK))));
    const after = poseOf(h, FLASK).position;
    expect(Math.hypot(after[0] - before[0], after[2] - before[2])).toBeGreaterThan(0.01); // hit
    expect(most).toBeLessThan(1 * DEG);
  });

  it('let go tipped (mid-pour), it falls as it will, then is stood up and locked at rest', async () => {
    // Close to the bench: the hold (an arm's reach) is over it.
    const h = await holding(FLASK, [0.3, 0, -0.25]);
    aimAt(h, [0.3, 1.1, -1]);
    for (let i = 0; i < 90; i++) {
      h.physics.setHoldTilt(115 * DEG);
      h.physics.update(H);
    }
    expect(tilt(h, FLASK)).toBeGreaterThan(110 * DEG);
    h.physics.release([0, 0, 0]); // as an out-of-reach release does
    h.run(8);
    expect(tilt(h, FLASK)).toBeLessThan(1 * DEG);
    expect(poseOf(h, FLASK).position[1]).toBeGreaterThan(BENCH_TOP); // still on the bench
    expect(h.physics.body(FLASK)?.sleeping).toBe(true);
  });

  it('leaves free items as they were: held as grabbed, never turned by the tilt', async () => {
    const h = await harness();
    h.load([0, 0, 0]);
    h.run(1);
    expect(h.physics.grab('lab/ball')).toBe(true);
    const start = [...h.world.entity('lab/ball')!.pose.rotation];
    h.physics.setHoldTilt(1); // not glassware: ignored
    h.state.player.yaw += 0.5;
    h.run(1);
    const now = h.world.entity('lab/ball')!.pose.rotation;
    for (let i = 0; i < 4; i++) expect(now[i]).toBeCloseTo(start[i]!, 4);
    h.physics.release([0, 0, 0]);
    expect(h.physics.setDown()).toBe(false); // nothing held, no plan
  });
});
