import { describe, expect, it } from 'vitest';
import { EventBus } from '../../core/EventBus';
import type { Vec3 } from '../../core/math';
import type { GameEvents } from '../../game/GameEvents';
import { bootTestGame, placePlayer } from '../../game/testing';
import type { WorldEntity } from '../../world/World';
import { ItemDefinitionSchema } from '../item';
import { HOLD_S } from './DoorSystem';
import { SlidingSystem } from './SlidingSystem';

const H = 1 / 60;
const A = 'physics-lab/door-optics-leaf-a';
const B = 'physics-lab/door-optics-leaf-b';
/** The optics room's doorway: its middle, in the wall between the lab and the room. */
const MIDDLE: Vec3 = [19.125, 0, 0];

async function lab() {
  const { game } = await bootTestGame();
  await game.newGame('researcher-male');
  await game.scenes.load('physics-lab');
  placePlayer(game, [4, 0, 0]);
  const slid: GameEvents['DoorSlid'][] = [];
  game.events.subscribe('DoorSlid', (e) => slid.push(e));
  const run = (seconds: number) => {
    for (let t = 0; t < seconds - 1e-9; t += H) game.update(H);
  };
  run(0.2);
  return { game, slid, run };
}

describe('the starship doors between the Physics wing’s rooms (Phase U)', () => {
  it('stands shut until the player comes near; parts from the middle; shuts once they have gone', async () => {
    const { game, slid, run } = await lab();
    const leaf = (id: string) => game.physics.body(id)!.position;
    expect([game.sliders.fraction(A), game.sliders.fraction(B)]).toEqual([0, 0]);
    expect(leaf(A)[2]).toBeCloseTo(0.5, 6);
    expect(leaf(B)[2]).toBeCloseTo(-0.5, 6);

    placePlayer(game, [17.2, 0, 0]); // 1.9 m from the doorway's middle
    run(0.6); // opened in 0.45 s
    expect([game.sliders.fraction(A), game.sliders.fraction(B)]).toEqual([1, 1]);
    expect(leaf(A)[2]).toBeCloseTo(1.5, 3); // each leaf into its pocket in the wall
    expect(leaf(B)[2]).toBeCloseTo(-1.5, 3);
    expect(slid.map((e) => [e.entityId, e.open])).toEqual([
      [A, true],
      [B, true],
    ]);
    expect(slid[0]!.position[0]).toBeCloseTo(MIDDLE[0], 4);
    expect(slid[0]!.position[2]).toBeCloseTo(MIDDLE[2], 4);

    placePlayer(game, [21.5, 0, 0]); // through, in the optics room, still near: open
    run(1);
    expect(game.sliders.fraction(A)).toBe(1);
    placePlayer(game, [24, 0, 0]); // gone
    run(HOLD_S - 0.1);
    expect(game.sliders.fraction(A)).toBe(1); // it waits a moment
    run(0.8);
    expect([game.sliders.fraction(A), game.sliders.fraction(B)]).toEqual([0, 0]);
    expect(leaf(A)[2]).toBeCloseTo(0.5, 3);
    expect(slid.slice(2).map((e) => e.open)).toEqual([false, false]);
    game.dispose();
  });

  it('walking up to it, the player is never stopped: it has opened before they reach it', async () => {
    const { game, run } = await lab();
    expect(game.sliders.fraction(A)).toBe(0);
    placePlayer(game, [16, 0, 0.3], -Math.PI / 2); // facing east, 3.1 m from the doorway
    game.input.press('moveForward');
    let least = 1;
    for (let t = 0; t < 2.5; t += H) {
      game.update(H);
      // The leaves' inner edges never stand in the way of a player at the doorway's mouth.
      if (game.state.player.position[0] > 18.4) least = Math.min(least, game.sliders.fraction(A));
    }
    game.input.release('moveForward');
    run(0.2);
    expect(least).toBeGreaterThan(0.9);
    expect(game.state.player.position[0]).toBeGreaterThan(20.5); // through, in the optics room
    game.dispose();
  });
});

describe('a sliding leaf never shuts on the player or an object (SlidingSystem)', () => {
  function rig(bodyInDoorway: () => boolean) {
    const item = ItemDefinitionSchema.parse({
      id: 'leaf',
      displayName: 'Door',
      category: 'structure',
      physical: { massKg: 60, body: 'kinematic' },
      slider: { travel: 1, openS: 0.5, closeS: 0.5, near: 2 },
      visual: { shape: 'box', size: [1, 2.6, 0.08], color: '#ffffff' },
    });
    // Its meeting edge at the origin, sliding along +x.
    const entity = {
      id: 'room/leaf',
      item,
      pose: { position: [0.5, 1.3, 0], rotation: [0, 0, 0, 1] },
    } as unknown as WorldEntity;
    const player = { position: [3, 0, 0] as Vec3, radius: 0.3, halfHeight: 0.9 };
    const sent: number[] = [];
    const system = new SlidingSystem({
      events: new EventBus<GameEvents>({ debug() {}, info() {}, warn() {}, error() {} } as never),
      driver: { setDoorOpening: (_, f) => sent.push(f), dynamicBodyIn: bodyInDoorway },
      player,
      entities: () => [entity],
    });
    system.init();
    const run = (seconds: number) => {
      for (let t = 0; t < seconds - 1e-9; t += H) system.update(H);
    };
    return { system, player, run, sent };
  }

  it('opens near, holds open while something is in the doorway, then shuts', () => {
    let blocked = false;
    const { system, player, run } = rig(() => blocked);
    player.position = [1.5, 0, 0];
    run(0.6);
    expect(system.fraction('room/leaf')).toBe(1);
    blocked = true; // a ball rolled into the doorway
    player.position = [5, 0, 0];
    run(HOLD_S + 1);
    expect(system.fraction('room/leaf')).toBe(1);
    blocked = false;
    run(0.6);
    expect(system.fraction('room/leaf')).toBe(0);
  });

  it('shutting, it goes back open the moment the player steps into the doorway', () => {
    const { system, player, run } = rig(() => false);
    player.position = [1.5, 0, 0];
    run(0.6);
    player.position = [5, 0, 0];
    run(HOLD_S + 0.25); // half shut
    const f = system.fraction('room/leaf');
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThan(1);
    // The near distance is 2 m: standing in the doorway is nearer; it opens again.
    player.position = [0, 0, 0.1];
    run(0.1);
    expect(system.fraction('room/leaf')).toBeGreaterThan(f);
  });

  it('spawned with the player at it (a load in the doorway), it stands open', () => {
    const item = ItemDefinitionSchema.parse({
      id: 'leaf',
      displayName: 'Door',
      category: 'structure',
      physical: { massKg: 60, body: 'kinematic' },
      slider: { travel: 1, openS: 0.5, closeS: 0.5 },
      visual: { shape: 'box', size: [1, 2.6, 0.08], color: '#ffffff' },
    });
    const entity = {
      id: 'room/leaf',
      item,
      pose: { position: [0.5, 1.3, 0], rotation: [0, 0, 0, 1] },
    } as unknown as WorldEntity;
    const sent: [string, number][] = [];
    const system = new SlidingSystem({
      events: new EventBus<GameEvents>({ debug() {}, info() {}, warn() {}, error() {} } as never),
      driver: { setDoorOpening: (id, f) => sent.push([id, f]), dynamicBodyIn: () => false },
      player: { position: [0, 0, 0.5], radius: 0.3, halfHeight: 0.9 },
      entities: () => [entity],
    });
    system.init();
    expect(system.fraction('room/leaf')).toBe(1);
    expect(sent).toEqual([['room/leaf', 1]]);
  });
});
