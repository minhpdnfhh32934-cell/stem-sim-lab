import { beforeEach, describe, expect, it } from 'vitest';
import type { Game } from '../../game/Game';
import { bootTestGame } from '../../game/testing';
import { INSPECT_ZOOM } from './inspect';

const frames = (game: Game, n: number, dt = 1 / 60) => {
  for (let i = 0; i < n; i++) game.update(dt);
};

describe('PlayerSystem close-inspection view', () => {
  let game: Game;

  beforeEach(async () => {
    ({ game } = await bootTestGame());
    await game.newGame('researcher-male');
    frames(game, 2);
  });

  it('eases in while the input is held, turns the view less, and eases out on release', () => {
    expect(game.player.inspectAmount).toBe(0);
    game.input.press('inspect');
    frames(game, 30);
    expect(game.player.inspectAmount).toBe(1);

    const yaw = game.state.player.yaw;
    game.input.addLook(100, 0);
    game.update(1 / 60);
    // 100 px × 0.0025 rad/px at the base view; the close view turns by the zoom ratio of that.
    expect(yaw - game.state.player.yaw).toBeCloseTo(0.25 * INSPECT_ZOOM, 9);

    game.input.release('inspect');
    frames(game, 60);
    expect(game.player.inspectAmount).toBe(0);
    const before = game.state.player.yaw;
    game.input.addLook(100, 0);
    game.update(1 / 60);
    expect(before - game.state.player.yaw).toBeCloseTo(0.25, 9);
  });

  it('is never on while a workspace is open: it ends at once', () => {
    game.input.press('inspect');
    frames(game, 30);
    expect(game.player.inspectAmount).toBe(1);
    game.state.session.workspace = 'some/station';
    game.update(1 / 60);
    expect(game.player.inspectAmount).toBe(0);
    frames(game, 5);
    expect(game.player.inspectAmount).toBe(0); // still held, still off
    game.state.session.workspace = null;
  });
});
