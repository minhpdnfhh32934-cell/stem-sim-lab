import { beforeEach, describe, expect, it } from 'vitest';
import type { Game } from '../../game/Game';
import type { GameEvents } from '../../game/GameEvents';
import { bootTestGame, placePlayer } from '../../game/testing';

// Rapier stores positions as 32-bit floats, so positions are compared to ~1e-4 m.
const run = (game: Game, seconds: number, dt = 1 / 60) => {
  for (let t = 0; t < seconds - 1e-9; t += dt) game.update(dt);
};

describe('PlayerSystem', () => {
  let game: Game;

  beforeEach(async () => {
    ({ game } = await bootTestGame());
  });

  it('does not move the player outside of play', () => {
    game.input.press('moveForward');
    run(game, 1);
    expect(game.state.player.position).toEqual([0, 0, 0]);
  });

  it('walks forward at the configured speed and runs faster', async () => {
    await game.newGame('researcher-male');
    game.input.press('moveForward');
    run(game, 1);
    expect(game.state.player.position[2]).toBeCloseTo(1 - 2.2, 3);
    expect(game.state.player.position[1]).toBeCloseTo(0, 2); // feet stay on the floor (± 5 mm)
    game.input.release('moveForward');

    placePlayer(game, [0, 0, 2]);
    game.input.press('moveForward');
    game.input.press('run');
    run(game, 0.5);
    expect(game.state.player.position[2]).toBeCloseTo(2 - 4.5 * 0.5, 3);
  });

  it('moves relative to where the player looks', async () => {
    await game.newGame('researcher-male');
    placePlayer(game, [0, 0, 0], Math.PI / 2); // facing -X
    game.input.press('moveForward');
    run(game, 0.5);
    const [x, , z] = game.state.player.position;
    expect(x).toBeCloseTo(-1.1, 3);
    expect(z).toBeCloseTo(0, 3);
  });

  it('stops at walls (capsule radius + skin) and slides along them', async () => {
    await game.newGame('researcher-male');
    placePlayer(game, [0, 0, 0], -Math.PI / 2); // facing +X, towards the east wall at x = 3
    game.input.press('moveForward');
    run(game, 3);
    expect(game.state.player.position[0]).toBeCloseTo(3 - 0.3 - 0.01, 3);

    game.input.press('moveLeft'); // still pushing into the wall while strafing along it
    // Every 1/60 s step slides the full 2.2/√2 m/s along the wall, except that Rapier's character
    // controller can drop the slide of one step entirely (its snap-to-ground and normal nudge
    // against a wall it touches: measured on walls with and without doorways, docs/physics.md).
    // Which step it drops follows the wall collider's exact size, so this test allows one such step
    // and nothing in between: no slowing down, no catching on the wall.
    const step = 2.2 / Math.SQRT2 / 60;
    let dropped = 0;
    for (let i = 0; i < 30; i++) {
      const before = game.state.player.position[2];
      game.update(1 / 60);
      const moved = before - game.state.player.position[2];
      if (Math.abs(moved - step) < 1e-3) continue;
      expect(Math.abs(moved)).toBeLessThan(1e-3);
      dropped++;
    }
    expect(dropped).toBeLessThanOrEqual(1);
    const [x, y, z] = game.state.player.position;
    expect(z).toBeCloseTo(-step * (30 - dropped), 2);
    expect(x).toBeCloseTo(2.69, 3);
    expect(y).toBeCloseTo(0, 2);
  });

  it('applies mouse look with clamped pitch', async () => {
    await game.newGame('researcher-male');
    game.input.addLook(100, 10_000);
    game.update(0.016);
    expect(game.state.player.yaw).toBeCloseTo(-0.25, 9);
    expect(game.state.player.pitch).toBeCloseTo(-1.45, 9);
  });

  it('publishes PlayerEnteredRoom when the room changes', async () => {
    const entered: GameEvents['PlayerEnteredRoom'][] = [];
    game.events.subscribe('PlayerEnteredRoom', (e) => entered.push(e));
    await game.newGame('researcher-male');
    game.update(0.016);
    game.update(0.016);
    expect(entered).toEqual([{ roomId: 'preparation-room', previousRoomId: null }]);
  });
});
