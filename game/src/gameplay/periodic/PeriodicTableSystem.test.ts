import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../core/math';
import { bootTestGame, lookAt, placePlayer } from '../../game/testing';
import type { Game } from '../../game/Game';
import { CARD, cardPlace, cellCentre, cellSize, placeOf } from './layout';
import { AWAY_S, FAR_M } from './PeriodicTableSystem';

const BOARD = 'simlab-hub/periodic-table';
const H = 1 / 60;

/** A point on the hub's display (board coordinates), in the world: on its face, or `out` before it. */
function onBoard(game: Game, x: number, y: number, out = 0): Vec3 {
  const board = game.world.entity(BOARD);
  if (!board) throw new Error('no display');
  const d = board.item.visual.size[2];
  const [px, py, pz] = board.pose.position;
  // The display hangs facing +z, unturned (rooms.json).
  expect(board.pose.rotation).toEqual([0, 0, 0, 1]);
  return [px + x, py + y, pz - d / 2 + 0.03 + out];
}

function tile(game: Game, z: number): Vec3 {
  const [w, h] = game.world.entity(BOARD)?.item.visual.size ?? [0, 0];
  const [x, y] = cellCentre(placeOf(z), cellSize(w, h));
  return onBoard(game, x, y);
}

/** The game in the hub, the player 1.5 m before element `z`'s tile, looking at it. */
async function before(z: number) {
  const { game } = await bootTestGame();
  await game.scenes.load('simlab-hub');
  const at = tile(game, z);
  placePlayer(game, [at[0], 0, at[2] + 1.5]);
  lookAt(game, at);
  game.update(H);
  return game;
}

describe('the hub’s periodic table display (no key: the aim shows it)', () => {
  it('shows the element whose tile the centre of the screen is on, and the next one looked at', async () => {
    const game = await before(26); // iron
    expect(game.periodic.view()).toEqual({ boardId: BOARD, z: 26 });
    // Chromium, two tiles left of iron, not under iron's card (which stands right, towards the
    // middle).
    lookAt(game, tile(game, 24));
    game.update(H);
    expect(game.periodic.view()?.z).toBe(24);
    // Zinc, past the end of chromium's card.
    lookAt(game, tile(game, 30));
    game.update(H);
    expect(game.periodic.view()?.z).toBe(30);
  });

  it('keeps it while the aim is on its card (over other tiles) or between tiles', async () => {
    const game = await before(26);
    // Copper is under iron's card (on its right, towards the middle): the card is what is seen.
    lookAt(game, tile(game, 29));
    game.update(H);
    expect(game.periodic.view()?.z).toBe(26);
    const [w, h] = game.world.entity(BOARD)?.item.visual.size ?? [0, 0];
    const card = cardPlace(26, w, h);
    // The card's middle and a corner: tiles of other elements lie under them.
    for (const [dx, dy] of [
      [0, 0],
      [CARD.w / 2 - 0.05, -CARD.h / 2 + 0.05],
    ] as const) {
      lookAt(game, onBoard(game, card.x + dx, card.y + dy, CARD.out));
      game.update(H);
      expect(game.periodic.view()?.z).toBe(26);
    }
    // Between iron's tile and cobalt's.
    const [x, y] = cellCentre(placeOf(26), cellSize(w, h));
    lookAt(game, onBoard(game, x + cellSize(w, h) / 2, y));
    for (let i = 0; i < 60; i++) game.update(H);
    expect(game.periodic.view()?.z).toBe(26);
  });

  it('goes once the aim has been off the display a moment, or from farther than it reads', async () => {
    const game = await before(26);
    lookAt(game, onBoard(game, 0, 3)); // above the board
    for (let t = 0; t < AWAY_S - 0.1; t += H) game.update(H);
    expect(game.periodic.view()?.z).toBe(26); // a glance away keeps it
    for (let t = 0; t < 0.2; t += H) game.update(H);
    expect(game.periodic.view()).toBeNull();
    // Back on iron from farther than it reads: nothing.
    const at = tile(game, 26);
    placePlayer(game, [at[0], 0, at[2] + FAR_M + 0.5]);
    lookAt(game, at);
    game.update(H);
    expect(game.periodic.view()).toBeNull();
  });
});
