import { describe, expect, it } from 'vitest';
import type { Game } from '../../game/Game';
import type { GameEvents } from '../../game/GameEvents';
import { bootTestGame, lookAt, placePlayer } from '../../game/testing';
import { FALL_ASLEEP_S, RISE_S } from './RestSystem';

const H = 1 / 60;
const run = (game: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / H); i++) game.update(H);
};

async function scene(id: string) {
  const { game } = await bootTestGame();
  await game.newGame('researcher-male');
  await game.scenes.load(id); // developer jump (setup only)
  const changes: GameEvents['RestChanged'][] = [];
  game.events.subscribe('RestChanged', (e) => changes.push(e));
  return { game, changes };
}

describe('resting on furniture', () => {
  it('sits on a hub bench: the view from the seat, no walking; a step gets up, easing back', async () => {
    const { game, changes } = await scene('simlab-hub');
    placePlayer(game, [-3.394 + 0.9, 0, 0.394 - 0.9]); // before ring-bench-4
    lookAt(game, [-3.394, 0.3, 0.394]);
    game.update(H);
    expect(game.interaction.primaryAction('simlab-hub/ring-bench-4')?.label).toBe('Sit down');
    expect(game.interaction.perform('simlab-hub/ring-bench-4', 'rest')).toBe(true);
    const rest = game.state.player.rest!;
    expect(rest.kind).toBe('sit');
    expect(rest.eye[1]).toBeCloseTo(0.45 + 0.74, 3); // over the 45 cm seat
    const before = [...game.state.player.position];
    game.input.press('moveForward');
    game.update(H);
    expect(game.state.player.rest).toBeNull(); // a step gets up
    game.input.release('moveForward');
    expect(game.state.player.rising?.t).toBe(0); // eased from the next frame
    run(game, RISE_S);
    expect(game.state.player.rising).toBeNull();
    expect(
      Math.hypot(
        before[0]! - game.state.player.position[0],
        before[2]! - game.state.player.position[2],
      ),
    ).toBeLessThan(0.3);
    expect(changes.map((c) => c.kind)).toEqual(['sit', null]);
  });

  it('lies on the teacher’s bed, falls asleep, and a hit wakes them with a start', async () => {
    const { game, changes } = await scene('teacher-room');
    placePlayer(game, [1.95, 0, -0.4]);
    lookAt(game, [1.95, 0.4, 0.8]);
    game.update(H);
    expect(game.interaction.perform('teacher-room/bed', 'rest')).toBe(true);
    expect(game.state.player.rest?.kind).toBe('lie');
    expect(game.state.player.pitch).toBeGreaterThan(1); // looking up at the ceiling
    run(game, FALL_ASLEEP_S + 0.2);
    expect(game.state.player.rest?.asleep).toBe(true);
    // Nothing is taken in hand meanwhile: E gets up, nothing else.
    expect(game.interaction.perform('teacher-room/bed', 'rest')).toBe(true); // refused inside
    game.events.publish('PlayerHit', { entityId: 'x', speed: 4 });
    expect(game.state.player.rest).toBeNull();
    expect(changes.at(-1)).toEqual({ kind: null, asleep: false, jolted: true });
    expect(game.state.player.rising?.t).toBeCloseTo(0.3, 6); // a start: part way up at once
  });
});

describe('being hit', () => {
  it('a ball thrown up comes down on the player standing under it: hit once', async () => {
    const { game } = await scene('physics-lab');
    const hits: GameEvents['PlayerHit'][] = [];
    game.events.subscribe('PlayerHit', (e) => hits.push(e));
    run(game, 1);
    const ball = game.world.entity('physics-lab/steel-ball')!;
    placePlayer(game, [-1, 0, 0], 0, 1.45); // the middle of the floor, looking straight up
    expect(game.interaction.grab(ball)).toBe(true);
    run(game, 0.4);
    game.input.press('throw');
    game.update(H);
    game.input.release('throw');
    // The hold cannot point straight up: it flies up and on, coming down ~2.5 m ahead. Someone
    // standing there (the thrower, stepped under it) is hit as it comes down.
    run(game, 0.6);
    expect(hits).toHaveLength(0); // rising, from the hand: no hit
    placePlayer(game, [-1.26, 0, -2.45], 0, 1.4);
    run(game, 2);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.speed).toBeGreaterThan(1.5);
  });
});
