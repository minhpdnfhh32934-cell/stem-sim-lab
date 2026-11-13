import { describe, expect, it } from 'vitest';
import { bootTestGame, placePlayer } from '../../game/testing';
import { doingOf } from './doing';

const H = 1 / 60;

// What the others see this player doing (2026-11-12): the pose's `doing`.
describe('doingOf', () => {
  it('nothing; the hands looked at; the phone dialling, then a call; a test paper', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-male');
    await game.scenes.load('physics-lab');
    for (let i = 0; i < 30; i++) game.update(H);
    placePlayer(game, [-1, 0, 0], 0, 0);
    expect(doingOf(game)).toBeNull();
    placePlayer(game, [-1, 0, 0], 0, -1);
    expect(doingOf(game)).toBe('hands');
    // Holding something, looking down is looking at it, not at the hands.
    expect(game.interaction.grab(game.world.entity('physics-lab/steel-ball')!)).toBe(true);
    expect(doingOf(game)).toBeNull();
    expect(game.interaction.drop()).toBe(true);
    expect(game.phone.takeOut()).toBe(true);
    expect(doingOf(game)).toBe('dial');
    game.phone.call = { state: 'ringing', seconds: 0 };
    expect(doingOf(game)).toBe('call');
    game.state.session.paper = 'a-test';
    expect(doingOf(game)).toBe('paper');
  });

  it('talking with the teacher', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-male');
    await game.scenes.load('simlab-hub');
    for (let i = 0; i < 30; i++) game.update(H);
    expect(game.npcs.open('teacher')).toBe(true);
    expect(doingOf(game)).toBe('talk');
  });
});
