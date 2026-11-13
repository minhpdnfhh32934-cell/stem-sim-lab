import { describe, expect, it } from 'vitest';
import type { Game } from '../../game/Game';
import { bootTestGame, lookAt, placePlayer } from '../../game/testing';

// The washroom door (teacher-room/door, items.json wc-door): one leaf hinged on the west jamb at
// (−2.04, 2.46), 1.08 m wide, opening 90° out into the Teacher Room in 1 s.
const DOOR = 'teacher-room/door';
const H = 1 / 60;
const CLEAR = [-0.6, 0, 1.6] as const; // beside it, out of its swing
const IN_SWING = [-1.5, 0, 2.0] as const; // in front of it, where the leaf swings through

async function teacherRoom(): Promise<{ game: Game; blocked: string[] }> {
  const { game } = await bootTestGame();
  await game.newGame('researcher-male');
  await game.scenes.load('teacher-room');
  placePlayer(game, [...CLEAR]);
  const blocked: string[] = [];
  game.events.subscribe('ActionBlocked', ({ reason }) => blocked.push(reason));
  return { game, blocked };
}
const run = (game: Game, frames: number, dt = H) => {
  for (let i = 0; i < frames; i++) game.update(dt);
};

describe('HingeSystem', () => {
  it('swings open in swingS and shut again, linear in time (the easing is the angle’s)', async () => {
    const { game } = await teacherRoom();
    expect(game.hinges.fraction(DOOR)).toBe(0);
    expect(game.interaction.perform(DOOR, 'open')).toBe(true);
    run(game, 30);
    expect(game.hinges.fraction(DOOR)).toBeCloseTo(0.5, 9);
    run(game, 30);
    expect(game.hinges.fraction(DOOR)).toBe(1);
    expect(game.interaction.perform(DOOR, 'close')).toBe(true);
    run(game, 60);
    expect(game.hinges.fraction(DOOR)).toBe(0);
  });

  it('turns back from where it is when asked mid-swing', async () => {
    const { game } = await teacherRoom();
    game.interaction.perform(DOOR, 'open');
    run(game, 24); // 0.4
    expect(game.interaction.perform(DOOR, 'close')).toBe(true);
    run(game, 6);
    expect(game.hinges.fraction(DOOR)).toBeCloseTo(0.3, 9);
    run(game, 18);
    expect(game.hinges.fraction(DOOR)).toBe(0);
  });

  it('refuses to swing into the player, and says why', async () => {
    const { game, blocked } = await teacherRoom();
    placePlayer(game, [...IN_SWING]);
    expect(game.interaction.perform(DOOR, 'open')).toBe(false);
    expect(blocked).toEqual(['Step back to open it.']);
    expect(game.entityStates.get(DOOR, 'open')).not.toBe(true);
    placePlayer(game, [...CLEAR]);
    expect(game.interaction.perform(DOOR, 'open')).toBe(true);
    run(game, 70);
    placePlayer(game, [-1.5, 0, 2.2]); // in its doorway's mouth: closing would sweep through
    expect(game.interaction.perform(DOOR, 'close')).toBe(false);
    expect(blocked.at(-1)).toBe('Step back to close it.');
  });

  it('refuses to close onto a dynamic body in its swing (glass would be shoved), and says why', async () => {
    const { game, blocked } = await teacherRoom();
    expect(game.interaction.perform(DOOR, 'open')).toBe(true);
    run(game, 70);
    // A body standing where the leaf sweeps on its way shut (the query stands in for physics: a
    // real body there would be shoved by the kinematic leaf).
    const asked: number[] = [];
    const query = game.physics.dynamicBodyIn.bind(game.physics);
    game.physics.dynamicBodyIn = (center, halfExtents, rotationY) => {
      asked.push(rotationY);
      return (
        Math.hypot(center[0] + 1.5, center[2] - 2.2) < 0.4 || query(center, halfExtents, rotationY)
      );
    };
    expect(game.interaction.perform(DOOR, 'close')).toBe(false);
    expect(blocked).toEqual(['Something is in the way of the door.']);
    expect(game.entityStates.get(DOOR, 'open')).toBe(true);
    expect(asked.length).toBeGreaterThan(1); // the remaining swing, sampled
    game.physics.dynamicBodyIn = query; // taken away
    expect(game.interaction.perform(DOOR, 'close')).toBe(true);
    run(game, 70);
    expect(game.hinges.fraction(DOOR)).toBe(0);
  });

  it('holds where it is while the player steps into its way, and goes on once they are clear', async () => {
    const { game } = await teacherRoom();
    game.interaction.perform(DOOR, 'open');
    run(game, 12); // 0.2
    placePlayer(game, [...IN_SWING]);
    run(game, 60);
    expect(game.hinges.fraction(DOOR)).toBeCloseTo(0.2, 9); // held at once, never through them
    placePlayer(game, [...CLEAR]);
    run(game, 60);
    expect(game.hinges.fraction(DOOR)).toBe(1);
  });

  it('stands still while paused (dt 0)', async () => {
    const { game } = await teacherRoom();
    game.interaction.perform(DOOR, 'open');
    run(game, 12);
    const f = game.hinges.fraction(DOOR);
    run(game, 120, 0);
    expect(game.hinges.fraction(DOOR)).toBe(f);
  });

  it('is aimed at by its leaf where it stands: closed in the doorway, open along the jamb', async () => {
    const { game } = await teacherRoom();
    const aimAt = (from: [number, number, number], at: [number, number, number]) => {
      placePlayer(game, from);
      lookAt(game, at);
      game.update(H);
      return game.interaction.focused?.id ?? null;
    };
    expect(aimAt([-1.5, 0, 1.4], [-1.5, 1.1, 2.48])).toBe(DOOR); // closed: the leaf in the doorway
    placePlayer(game, [...CLEAR]);
    game.interaction.perform(DOOR, 'open');
    run(game, 70);
    expect(aimAt([-1.2, 0, 1.6], [-2.02, 1.1, 1.92])).toBe(DOOR); // the open leaf by the jamb
    expect(game.interaction.primaryAction(DOOR)?.id).toBe('close');
    // Through the open doorway: the washroom beyond, not the door.
    expect(aimAt([-1.5, 0, 2.2], [-1.5, 1.1, 3.4])).not.toBe(DOOR);
  });
});
