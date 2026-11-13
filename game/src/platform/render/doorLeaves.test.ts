import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { Disposables } from '../../core/EventBus';
import type { Game } from '../../game/Game';
import { bootTestGame, flush, placePlayer, untilIdle } from '../../game/testing';
import type { WorldEntity } from '../../world/World';
import { WorldRenderer } from './WorldRenderer';

// Walk-through doors as drawn, without WebGL (init() is never called; private members are read
// on purpose, as in WorldRenderer.test.ts): a leaf slides with its pair's fraction, and walking
// through the hub's door into the Physics Lab lights the lab as a load of it does.

const H = 1 / 60;
const PHYSICS = [18.25, 0, -3] as const; // the Physics Lab's start in the hub's frame

interface Drawn {
  followScenes(s: Disposables): void;
  addEntity(entity: WorldEntity): void;
  slideLeaves(): void;
  readonly views: ReadonlyMap<string, { mesh: THREE.Mesh; group: THREE.Group }>;
  readonly roomLights: { readonly slots: readonly THREE.SpotLight[] };
}

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const done of cleanup.splice(0)) done();
});

async function hub(): Promise<{ game: Game; view: Drawn }> {
  const { game } = await bootTestGame();
  await game.newGame('researcher-male');
  const renderer = new WorldRenderer({} as HTMLElement, game, {} as HTMLCanvasElement);
  const subscriptions = new Disposables();
  const view = renderer as unknown as Drawn;
  view.followScenes(subscriptions);
  cleanup.push(() => {
    subscriptions.dispose();
    renderer.dispose();
    game.dispose();
  });
  await game.scenes.load('simlab-hub');
  game.update(H);
  return { game, view };
}

async function open(game: Game, door: string) {
  expect(game.interaction.perform(door, 'travel')).toBe(true);
  untilIdle(game); // the key card on the reader: the door asked to open
  await flush();
}

describe('walk-through doors, drawn', () => {
  it('slides a leaf along its own +x, by its fraction, along the wall', async () => {
    const { game, view } = await hub();
    const id = 'simlab-hub/door-biology'; // west wall, turned π/2: its +x points along −z
    view.addEntity(game.world.entity(id)!);
    const { mesh } = view.views.get(id)!;
    const at = () => {
      view.slideLeaves();
      mesh.updateWorldMatrix(true, false);
      return mesh.getWorldPosition(new THREE.Vector3());
    };
    expect(at().z).toBeCloseTo(-3, 6);
    placePlayer(game, [-11.5, 0, -3], Math.PI / 2);
    await open(game, id);
    for (let i = 0; i < 18; i++) game.update(H); // half open: the hub's leaf moves first, openS 0.6 s
    expect(game.doors.fraction(id)).toBeCloseTo(0.5, 9);
    expect(mesh.position.x).toBe(0); // drawn when the frame is drawn
    expect(at().z).toBeCloseTo(-3.5, 4);
    expect(at().x).toBeCloseTo(-12.95, 4);
    for (let i = 0; i < 30; i++) game.update(H);
    expect(at().z).toBeCloseTo(-4, 4); // fully open: 1 m along the wall
  });

  it('lights the hub and the lab walked into as one while both are there', async () => {
    const { game, view } = await hub();
    placePlayer(game, [11.5, 0, -3], -Math.PI / 2); // 1.5 m before the hub's east door
    for (let i = 0; i < 6; i++) game.update(H);
    await open(game, 'simlab-hub/door-physics');
    for (let i = 0; i < 50; i++) game.update(H);
    game.input.press('moveForward');
    for (let i = 0; i < 120 && game.state.session.sceneId !== 'physics-lab'; i++) game.update(H);
    expect(game.state.session.sceneId).toBe('physics-lab');
    // Both scenes' room lights stay lit (residencyRooms.test.ts): the hub's key and the lab's
    // three, each in the slot it had; nothing changed at the threshold.
    expect(PHYSICS).toEqual([18.25, 0, -3]);
    const keys = view.roomLights.slots.filter((s) => s.intensity > 0 && s.castShadow);
    expect(keys.map((s) => +s.position.x.toFixed(3))).toEqual([0, 25.25, 24.25, 18.25]);
  });
});
