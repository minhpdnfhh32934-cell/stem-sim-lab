import { describe, expect, it } from 'vitest';
import { MemorySaveStorage } from '../persistence/SaveSystem';
import type { Game } from './Game';
import type { GameEvents } from './GameEvents';
import { bootTestGame } from './testing';

const H = 1 / 60;
const LAB = 'physics-lab';
const STAND = `${LAB}/spring`;

const frames = (game: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / H); i++) game.update(H);
};
const run = (game: Game) => game.experiments.find(STAND)?.run ?? null;

/** New game, then the developer jump to the Physics Lab (setup only). */
async function lab(storage = new MemorySaveStorage()) {
  const booted = await bootTestGame({ storage });
  await booted.game.newGame('researcher-male');
  await booted.game.scenes.load(LAB);
  const completed: GameEvents['ExperimentCompleted'][] = [];
  booted.game.events.subscribe('ExperimentCompleted', (e) => completed.push(e));
  return { ...booted, completed };
}

describe('pause: nothing advances, and play resumes where it stopped', () => {
  it('freezes physics: no step, the falling steel ball stays where it was', async () => {
    const { game } = await lab();
    const before = game.physics.body(`${LAB}/steel-ball`)!.position[1];
    game.pause();
    expect(game.state.session.paused).toBe(true);
    frames(game, 1);
    expect(game.physics.stats().stepsLastFrame).toBe(0);
    expect(game.physics.body(`${LAB}/steel-ball`)!.position[1]).toBe(before);
    game.resume();
    frames(game, 1);
    expect(game.physics.body(`${LAB}/steel-ball`)!.position[1]).toBeLessThan(before - 0.1); // it fell
  });

  it('freezes a running experiment: its clock, its state, and no completion however long', async () => {
    const { game, completed } = await lab();
    frames(game, 0.5);
    expect(game.interaction.perform(`${LAB}/spring-run`, 'run')).toBe(true);
    frames(game, 0.5);
    const paused = run(game)!;
    const [time, state] = [paused.time, paused.status];
    expect(state).toBe('running');
    game.pause();
    frames(game, 60); // far longer than the run takes to come to rest
    expect(run(game)!.time).toBe(time);
    expect(run(game)!.status).toBe('running');
    expect(completed).toEqual([]);
    expect(game.state.progression.completedExperiments).toEqual([]);
    // Resumed: one frame advances it by that frame, not by the pause.
    game.resume();
    game.update(H);
    // (fixed 1 ms model steps: a frame of H advances it by H to within one step)
    expect(Math.abs(run(game)!.time - (time + H))).toBeLessThanOrEqual(0.001 + 1e-9);
    // It still ends by itself, and only then counts as completed.
    for (let i = 0; run(game)!.status === 'running' && i < 100_000; i++) game.update(H);
    expect(completed.map((c) => c.endReason)).toEqual(['model']);
    expect(game.state.progression.completedExperiments).toEqual(['hookes-law']);
  });

  it('drops held keys and moves no one while paused', async () => {
    const { game } = await lab();
    frames(game, 0.5);
    const at = [...game.state.player.position];
    game.input.press('moveForward');
    game.pause();
    expect(game.input.isHeld('moveForward')).toBe(false);
    game.input.press('moveForward'); // even if a key reached the game
    frames(game, 1);
    expect(game.state.player.position).toEqual(at);
  });

  it('pauses only while playing, and a scene change ends a pause', async () => {
    const { game } = await bootTestGame();
    game.pause(); // on the main menu
    expect(game.state.session.paused).toBe(false);
    await game.newGame('researcher-male');
    const changes: boolean[] = [];
    game.events.subscribe('PauseChanged', ({ paused }) => changes.push(paused));
    game.pause();
    game.pause(); // once
    await game.scenes.load(LAB);
    expect(game.state.session.paused).toBe(false);
    expect(changes).toEqual([true, false]);
  });
});

describe('back to the main menu', () => {
  it('saves first, ends the run still running, and Continue restores the save', async () => {
    const storage = new MemorySaveStorage();
    const { game } = await lab(storage);
    frames(game, 0.5);
    game.state.progression.completedExperiments.push('free-fall');
    game.state.player.position = [4.3, 0, -3.85];
    game.interaction.perform(`${LAB}/spring-run`, 'run');
    frames(game, 0.5);
    expect(game.experiments.activeCount).toBe(1);
    game.pause();

    const result = await game.backToMenu();
    expect(result.ok).toBe(true);
    expect(game.state.session).toEqual({ phase: 'menu', sceneId: 'main-menu', paused: false });
    expect(game.experiments.activeCount).toBe(0);
    expect(game.experiments.find(STAND)).toBeUndefined(); // the running run ended unrecorded
    expect(game.savedScene()).toBe(LAB);
    expect([...(await game.savedCompletedExperiments())]).toEqual(['free-fall']);

    const resumed = await game.continueGame();
    expect(resumed.ok).toBe(true);
    expect(game.state.session.phase).toBe('playing');
    game.state.player.position.forEach((v, i) => expect(v).toBeCloseTo([4.3, 0, -3.85][i]!, 3));
    expect(game.state.progression.completedExperiments).toEqual(['free-fall']);
  });

  it('leaves nothing when the save fails, unless told to leave anyway', async () => {
    const storage = new MemorySaveStorage();
    const { game } = await lab(storage);
    storage.write = () => {
      throw new Error('quota exceeded');
    };
    const refused = await game.backToMenu();
    expect(refused.ok).toBe(false);
    expect(game.state.session.phase).toBe('playing');
    const forced = await game.backToMenu(true);
    expect(forced.ok).toBe(true);
    expect(game.state.session.phase).toBe('menu');
  });
});
