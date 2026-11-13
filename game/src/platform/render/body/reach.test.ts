import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Game } from '../../../game/Game';
import { bootTestGame, lookAt, placePlayer, untilIdle } from '../../../game/testing';
import { handPoint } from '../../../gameplay/action/handPoint';
import { leanDirection } from '../../../gameplay/player/lean';
import { PALM_DROP } from './BodyModel';
import type { WorldEntity } from '../../../world/World';
import { BodyView } from './BodyView';

/** A held object as the renderer draws it: its group, at its entity's pose. */
interface Held {
  group: THREE.Object3D;
  entity: WorldEntity;
}

const PREP = 'preparation-room';
const HALL = 'cleanroom-corridor';

/** The game and the body drawn as the renderer draws them: the eye leaned in, turned to the view. */
function drawn(game: Game, held: () => Held | null = () => null) {
  const view = new BodyView(game);
  view.attach({ add: () => undefined } as never);
  const camera = new THREE.PerspectiveCamera(game.config.graphics.fov, 16 / 9); // the e2e window's
  const hands = [new THREE.Object3D(), new THREE.Object3D()] as const;
  camera.add(...hands);
  camera.rotation.order = 'YXZ'; // as the renderer turns it
  const lean: [number, number, number] = [0, 0, 0];
  const frame = () => {
    game.update(1 / 60);
    const p = game.state.player;
    leanDirection(p.yaw, p.pitch, lean);
    camera.position.set(
      p.position[0] + lean[0] * p.lean,
      p.position[1] + p.eyeHeight + lean[1] * p.lean,
      p.position[2] + lean[2] * p.lean,
    );
    camera.rotation.set(p.pitch + p.glance, p.yaw, 0);
    camera.updateMatrixWorld(true);
    const h = held();
    if (h) {
      // Drawn where its pose is, as the renderer draws the held object.
      h.group.position.fromArray(h.entity.pose.position);
      h.group.quaternion.fromArray(h.entity.pose.rotation);
      h.group.updateMatrixWorld(true);
    }
    view.update(1 / 60, p.position, camera, hands, false, h);
  };
  /** A palm's centre (world). */
  const palm = (side: 'L' | 'R' = 'R') =>
    view.group.getObjectByName(`hand${side}`)!.localToWorld(new THREE.Vector3(0, -PALM_DROP, 0));
  /** Whether a point is in the view (within the camera's frustum, in front of it). */
  const seen = (point: THREE.Vector3) => {
    const p = point.clone().project(camera);
    return Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && p.z < 1;
  };
  return { view, frame, palm, seen };
}

const act = (game: Game, entity: string, action: string) => {
  expect(game.interaction.perform(entity, action)).toBe(true);
  untilIdle(game);
};

describe('a hand is at what it works when the action takes effect (Phú: no soap on a hand elsewhere)', () => {
  it.each([
    ['faucet', 'water-on'],
    ['soap-dispenser', 'take-soap'],
  ])('%s %s: the right palm is there, at the spot the player stood at', async (item, action) => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-male');
    act(game, `${PREP}/notice-board`, 'inspect');
    act(game, `${PREP}/wardrobe`, 'open');
    act(game, `${PREP}/lab-coat`, 'wear');
    act(game, `${PREP}/safety-goggles`, 'wear');
    // Where the e2e player stands at the basin: 0.8 m from the wall, the reach the game allows.
    placePlayer(game, [-0.45, 0, -7.6]);
    if (action === 'take-soap') {
      act(game, `${HALL}/faucet`, 'water-on');
      act(game, `${HALL}/wash-basin`, 'wash');
    }
    const entity = game.world.entity(`${HALL}/${item}`)!;
    const at = handPoint(entity, game.world, [0, 0, 0]);
    lookAt(game, at);
    const { view, frame, palm } = drawn(game);
    frame();
    expect(game.interaction.perform(entity.id, action)).toBe(true);
    let frames = 0;
    while (game.actions.busy && frames++ < 600) frame(); // until it takes effect
    expect(game.actions.current).not.toBeNull(); // still playing: it took effect just now
    expect(palm().distanceTo(new THREE.Vector3(...at))).toBeLessThan(0.06);
    view.dispose();
    game.dispose();
  });
});

describe('the eyes go down to the hands working in front of the body (Phú: every action seen)', () => {
  it('buttoning the coat: both hands are in the view, and the view comes back up after', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-female');
    act(game, `${PREP}/notice-board`, 'inspect');
    act(game, `${PREP}/wardrobe`, 'open');
    const { view, frame, palm, seen } = drawn(game);
    const coat = game.world.entity(`${PREP}/lab-coat`)!;
    lookAt(game, coat.pose.position);
    const pitch = game.state.player.pitch;
    expect(game.interaction.perform(coat.id, 'wear')).toBe(true);
    let frames = 0;
    while ((game.actions.current?.t ?? 9) < 2.22 && frames++ < 900) frame(); // buttoning
    expect(game.state.player.pitch).toBe(pitch); // the player's own look is theirs
    expect(game.state.player.glance).toBeLessThan(-0.3); // the eyes are down
    expect([seen(palm('L')), seen(palm('R'))]).toEqual([true, true]);
    while (game.actions.current && frames++ < 900) frame();
    for (let i = 0; i < 60; i++) frame();
    expect(Math.abs(game.state.player.glance)).toBeLessThan(0.01);
    view.dispose();
    game.dispose();
  });
});

describe('every glance shows the hands it is for', () => {
  // Each sequence that looks down, played on its item from 0.6 m away, facing it.
  it.each([
    ['coat-on', `${PREP}/lab-coat`, 'wear'],
    ['coat-off', `${PREP}/lab-coat`, 'take-off'],
    ['gloves-on', `${HALL}/glove-dispenser`, 'wear'],
    ['gloves-off', `${HALL}/waste-bin`, 'discard'],
    ['dry-hands', `${HALL}/paper-towels`, 'dry-hands'],
  ])(
    '%s: at each key it looks at, the hands keyed in front of the body are in the view',
    async (id, entityId, action) => {
      const { game } = await bootTestGame();
      await game.newGame('researcher-male');
      const entity = game.world.entity(entityId)!;
      const at = handPoint(entity, game.world, [0, 0, 0]);
      placePlayer(game, [at[0] + 0.6, 0, at[2]]); // its wall is to the west
      lookAt(game, at);
      const { view, frame, palm, seen } = drawn(game);
      frame();
      game.events.publish('InteractionPerformed', { entityId, actionId: action });
      expect(game.actions.current?.sequence.id).toBe(id);
      const sequence = game.actions.current!.sequence;
      let frames = 0;
      for (const key of sequence.keys) {
        if (key.look === undefined) continue;
        while ((game.actions.current?.t ?? 99) < key.t && frames++ < 900) frame();
        for (const side of ['left', 'right'] as const) {
          const hand = key[side];
          // A hand in front of the body (one behind it, pulling a sleeve off, is not to be seen).
          if (!hand || hand.at !== 'body' || hand.offset[2] < 0.12) continue;
          expect([key.t, side, seen(palm(side === 'left' ? 'L' : 'R'))]).toEqual([
            key.t,
            side,
            true,
          ]);
        }
      }
      view.dispose();
      game.dispose();
    },
  );
});

describe('a pick-up from the floor ends in the grip (Phú: the hand drew back, then reached again)', () => {
  it('from the moment it is taken until long after, the right palm stays at what it holds', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-male');
    const lamp = game.world.entity(`${PREP}/desk-lamp`)!;
    placePlayer(game, [lamp.pose.position[0], 0, lamp.pose.position[2] + 1]);
    expect(game.interaction.perform(lamp.id, 'grab')).toBe(true); // on the desk: at once
    game.state.player.yaw = Math.PI; // the open floor
    game.state.player.pitch = -0.5;
    for (let t = 0; t < 0.5; t += 1 / 60) game.update(1 / 60);
    game.interaction.drop();
    untilIdle(game);
    for (let t = 0; t < 2; t += 1 / 60) game.update(1 / 60);
    expect(lamp.pose.position[1]).toBeLessThan(0.45);
    lookAt(game, lamp.pose.position);
    const heldView: Held = { group: new THREE.Object3D(), entity: lamp };
    const { view, frame, palm } = drawn(game, () =>
      game.interaction.heldId === lamp.id ? heldView : null,
    );
    frame();
    expect(game.interaction.perform(lamp.id, 'grab')).toBe(true);
    expect(game.actions.current?.sequence.id).toBe('pick-up-from-floor');
    let frames = 0;
    while (game.interaction.heldId !== lamp.id && frames++ < 600) frame();
    const away: number[] = [];
    while (game.actions.current && frames++ < 900) {
      frame();
      away.push(palm().distanceTo(heldView.group.position));
    }
    for (let i = 0; i < 60; i++) {
      frame();
      away.push(palm().distanceTo(heldView.group.position));
    }
    const held = away.at(-1)!; // its grip, at rest
    expect(held).toBeLessThan(0.15);
    // Never drawn back towards the side on the way: at most a hand's width from its grip.
    expect(Math.max(...away)).toBeLessThan(held + 0.1);
    view.dispose();
    game.dispose();
  });
});
