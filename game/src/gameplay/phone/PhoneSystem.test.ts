import { describe, expect, it } from 'vitest';
import type { InputAction } from '../../core/config';
import type { Game } from '../../game/Game';
import { bootTestGame } from '../../game/testing';
import { PHONE_ID, RING_S } from './PhoneSystem';

const H = 1 / 60;
const run = (game: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / H); i++) game.update(H);
};
/** One press of `action`, read in a frame of its own. */
const press = (game: Game, action: InputAction) => {
  game.input.press(action);
  game.update(H);
  game.input.release(action);
  game.update(H);
};

async function lab() {
  const { game } = await bootTestGame();
  await game.newGame('researcher-male');
  await game.scenes.load('physics-lab');
  return game;
}

describe('the phone', () => {
  it('is in the bag from the start, in the last hotbar slot, and nowhere in the world', async () => {
    const game = await lab();
    expect(game.inventory.at(8)?.placements).toEqual([PHONE_ID]);
    expect(game.inventory.selected).toBe(0); // the selection left as it was
    expect(game.world.entity(PHONE_ID)).toBeUndefined();
  });

  it('chosen, Q takes it out and puts it away; out, the number keys dial and E calls', async () => {
    const game = await lab();
    press(game, 'hotbar9');
    expect(game.phone.selected).toBe(true);
    press(game, 'stow');
    expect(game.phone.out).toBe(true);
    expect(game.inventory.holds(PHONE_ID)).toBe(true); // still in the bag: never in the world
    expect(game.interaction.heldId).toBeNull();
    for (const key of ['hotbar1', 'hotbar1', 'hotbar4', 'hotbar5'] as const) press(game, key);
    expect(game.inventory.selected).toBe(8); // the digits dialled, not chose slots
    press(game, 'secondary');
    expect(game.phone.number).toBe('114');
    press(game, 'interact');
    expect(game.phone.call.state).toBe('ringing');
    run(game, RING_S + 0.1);
    expect(game.phone.call).toMatchObject({ state: 'talking', outcome: 'false-alarm' });
    press(game, 'stow');
    expect(game.phone.out).toBe(false);
    expect(game.phone.call.state).toBe('idle');
  });

  it('a digit pressed in the very next frame after P is dialled (none swallowed)', async () => {
    const game = await lab();
    game.input.press('phone');
    game.update(H);
    game.input.release('phone');
    expect(game.phone.out).toBe(true);
    game.input.press('hotbar1');
    game.update(H);
    game.input.release('hotbar1');
    expect(game.phone.number).toBe('1');
  });

  it('P takes it out from any slot, but not with the hands full', async () => {
    const game = await lab();
    expect(game.interaction.grab(game.world.entity('physics-lab/co2-extinguisher')!)).toBe(true);
    press(game, 'phone');
    expect(game.phone.out).toBe(false);
    game.interaction.place();
    press(game, 'phone');
    expect(game.phone.out).toBe(true);
    press(game, 'phone');
    expect(game.phone.out).toBe(false);
  });

  it('comes back with a game saved before it existed', async () => {
    const game = await lab();
    game.state.player.inventory.stacks = [];
    game.save();
    const loaded = await game.continueGame();
    expect(loaded.ok).toBe(true);
    expect(game.inventory.holds(PHONE_ID)).toBe(true);
  });
});
