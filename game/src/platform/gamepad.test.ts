import { describe, expect, it } from 'vitest';
import { bootTestGame, placePlayer } from '../game/testing';
import { GamepadInput, stick, type PadState } from './gamepad';

const H = 1 / 60;
const pad = (axes: number[], down: number[] = []): PadState => ({
  axes,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: down.includes(i) })),
});

async function setup() {
  const { game } = await bootTestGame();
  await game.newGame('researcher-male');
  await game.scenes.load('physics-lab');
  for (let i = 0; i < 30; i++) game.update(H);
  let now: PadState | null = null;
  const gamepad = new GamepadInput(game, () => [null, now]);
  const frame = (state: PadState | null) => {
    now = state;
    gamepad.update(H);
    game.update(H);
  };
  return { game, gamepad, frame };
}

describe('gamepad', () => {
  it('a stick: nothing in its dead zone, then as far as it is pushed, 1 at the edge', () => {
    expect(stick(0.1, 0.1)).toEqual([0, 0]);
    expect(stick(1, 0)).toEqual([1, 0]);
    const [x] = stick(0.59, 0);
    expect(x).toBeCloseTo(0.5, 2);
  });

  it('the left stick walks as far as pushed; let go, the player stops', async () => {
    const { game, frame } = await setup();
    placePlayer(game, [-1, 0, 0], 0, 0);
    const half = game.state.player.position[2];
    for (let i = 0; i < 60; i++) frame(pad([0, -0.59, 0, 0])); // half way up: forward (−z)
    const walkedHalf = half - game.state.player.position[2];
    const full = game.state.player.position[2];
    for (let i = 0; i < 60; i++) frame(pad([0, -1, 0, 0]));
    const walkedFull = full - game.state.player.position[2];
    expect(walkedHalf).toBeGreaterThan(0.3);
    expect(walkedFull / walkedHalf).toBeGreaterThan(1.6); // about twice as fast
    frame(pad([0, 0, 0, 0]));
    expect([game.input.stickX, game.input.stickY]).toEqual([0, 0]);
  });

  it('the right stick looks, scaled by the look sensitivity', async () => {
    const { game, frame } = await setup();
    const turn = () => {
      const before = game.state.player.yaw;
      for (let i = 0; i < 30; i++) frame(pad([0, 0, 1, 0]));
      frame(pad([0, 0, 0, 0]));
      return before - game.state.player.yaw;
    };
    const normal = turn();
    expect(normal).toBeCloseTo(2.6 * 0.5, 1); // 2.6 rad/s for half a second, to the right
    game.setControl('lookSensitivity', 2);
    expect(turn()).toBeCloseTo(2 * normal, 2);
  });

  it('buttons hold their actions; LB and the pressed stick both run; Start pauses', async () => {
    const { game, frame } = await setup();
    const presses: boolean[] = [];
    frame(pad([0, 0, 0, 0], [4, 10]));
    presses.push(game.input.isHeld('run'));
    frame(pad([0, 0, 0, 0], [10]));
    presses.push(game.input.isHeld('run'));
    frame(pad([0, 0, 0, 0]));
    presses.push(game.input.isHeld('run'));
    expect(presses).toEqual([true, true, false]);
    frame(pad([0, 0, 0, 0], [9]));
    expect(game.state.session.paused).toBe(true);
    frame(pad([0, 0, 0, 0]));
    frame(pad([0, 0, 0, 0], [9]));
    expect(game.state.session.paused).toBe(false);
  });

  it('a turn in radians (the gyroscope) turns the view as far, once', async () => {
    const { game } = await setup();
    const { yaw, pitch } = game.state.player;
    game.input.turnYaw = 0.2;
    game.input.turnPitch = -0.1;
    game.update(H);
    expect(game.state.player.yaw - yaw).toBeCloseTo(0.2, 6);
    expect(game.state.player.pitch - pitch).toBeCloseTo(-0.1, 6);
    game.update(H);
    expect(game.state.player.yaw - yaw).toBeCloseTo(0.2, 6); // used up
  });

  it('the pad unplugged: nothing it held stays held', async () => {
    const { game, frame } = await setup();
    frame(pad([0, -1, 0, 0], [5]));
    expect(game.input.isHeld('pour')).toBe(true);
    frame(null);
    expect(game.input.isHeld('pour')).toBe(false);
    expect([game.input.stickX, game.input.stickY]).toEqual([0, 0]);
  });
});
