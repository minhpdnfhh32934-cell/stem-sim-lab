import { describe, expect, it } from 'vitest';
import { MemorySaveStorage } from '../persistence/SaveSystem';
import { parseSave } from '../persistence/saveData';
import type { Game } from './Game';
import type { GameEvents } from './GameEvents';
import { bootTestGame } from './testing';

const H = 1 / 60;
const LAB = 'physics-lab';
const STAND = `${LAB}/spring`;
const SLOT = 'simlab.save.slot-1';

const frames = (game: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / H); i++) game.update(H);
};
const run = (game: Game) => game.experiments.find(STAND)?.run ?? null;
const runToEnd = (game: Game) => {
  for (let i = 0; run(game)?.status === 'running' && i < 100_000; i++) game.update(H);
};
/** The completed experiments in what storage holds now (not in memory). */
const stored = (storage: MemorySaveStorage): string[] => {
  const text = storage.read(SLOT);
  if (text === null) return [];
  const save = parseSave(text);
  if (!save.ok) throw new Error(save.error);
  return save.value.progression.completedExperiments;
};

/** New game, the developer jump to the Physics Lab (which saves, as any scene load does). */
async function lab() {
  const storage = new MemorySaveStorage();
  const booted = await bootTestGame({ storage });
  await booted.game.newGame('researcher-male');
  await booted.game.scenes.load(LAB);
  frames(booted.game, 0.5);
  const recorded: string[] = [];
  const failed: GameEvents['SaveFailed'][] = [];
  booted.game.events.subscribe('ProgressionRecorded', ({ experimentId }) =>
    recorded.push(experimentId),
  );
  booted.game.events.subscribe('SaveFailed', (e) => failed.push(e));
  return { ...booted, storage, recorded, failed };
}

describe('completion is saved when it happens', () => {
  it('a run ending by itself counts once, and is in storage at once — no door needed', async () => {
    const { game, storage, recorded } = await lab();
    expect(stored(storage)).toEqual([]);
    expect(game.interaction.perform(`${LAB}/spring-run`, 'run')).toBe(true);
    runToEnd(game);
    expect(run(game)?.status).toBe('completed');
    expect(recorded).toEqual(['hookes-law']);
    expect(stored(storage)).toEqual(['hookes-law']);
    // Another run to its end: already completed, nothing new is recorded.
    game.interaction.perform(`${LAB}/spring-reset`, 'reset');
    game.interaction.perform(`${LAB}/spring-run`, 'run');
    runToEnd(game);
    expect(recorded).toEqual(['hookes-law']);
    expect(stored(storage)).toEqual(['hookes-law']);
  });

  it('a run cut off by the time limit is neither recorded nor saved as completed', async () => {
    const { game, storage, recorded } = await lab();
    let saves = 0;
    game.events.subscribe('GameSaved', () => saves++);
    game.events.publish('ExperimentCompleted', {
      runId: 'r',
      experimentId: 'pendulum',
      sessionId: 'pendulum-bay/pendulum',
      endReason: 'time-limit',
      results: {},
    });
    expect(recorded).toEqual([]);
    expect(saves).toBe(0);
    expect(stored(storage)).toEqual([]);
    expect(game.state.progression.completedExperiments).toEqual([]);
  });

  it('a stopped run is not completed, in memory or in storage', async () => {
    const { game, storage, recorded } = await lab();
    game.interaction.perform(`${LAB}/spring-run`, 'run');
    frames(game, 0.5);
    game.interaction.perform(`${LAB}/spring-stop`, 'stop');
    expect(run(game)?.status).toBe('stopped');
    frames(game, 1);
    game.save(); // even saved afterwards
    expect(recorded).toEqual([]);
    expect(stored(storage)).toEqual([]);
  });

  it('a paused run never completes, so nothing is saved for it', async () => {
    const { game, storage, recorded } = await lab();
    game.interaction.perform(`${LAB}/spring-run`, 'run');
    frames(game, 0.5);
    game.pause();
    frames(game, 60);
    expect(recorded).toEqual([]);
    expect(stored(storage)).toEqual([]);
  });

  it('a failed save is reported and loses nothing: the next save writes the completion', async () => {
    const { game, storage, recorded, failed } = await lab();
    const write = storage.write.bind(storage);
    storage.write = () => {
      throw new Error('quota exceeded');
    };
    game.interaction.perform(`${LAB}/spring-run`, 'run');
    runToEnd(game);
    expect(recorded).toEqual(['hookes-law']);
    expect(failed).toEqual([{ slot: 'slot-1', reason: 'quota exceeded' }]);
    expect(game.state.progression.completedExperiments).toEqual(['hookes-law']); // kept
    expect(stored(storage)).toEqual([]); // not claimed as saved
    storage.write = write; // storage works again: the next save point writes it
    expect(game.save()?.ok).toBe(true);
    expect(stored(storage)).toEqual(['hookes-law']);
  });
});

describe('old and incomplete saves still load', () => {
  it('a version-1 save (no procedures, no equipment) upgrades and keeps its completions', () => {
    const v1 = {
      version: 1,
      savedAt: '2026-01-01T00:00:00.000Z',
      player: {
        characterId: 'researcher-male',
        sceneId: LAB,
        position: [0, 0, 0],
        yaw: 0,
        pitch: 0,
      },
      world: { entityStates: {} },
      progression: { completedExperiments: ['free-fall'] },
    };
    const save = parseSave(JSON.stringify(v1));
    expect(save.ok && save.value.progression).toEqual({
      completedExperiments: ['free-fall'],
      procedures: {},
      tasks: { active: null, done: [] }, // v5: no guided task
      papers: [], // v11: no test papers, no marks
      scores: [],
    });
  });

  it('a save missing its progression is refused with a reason, not taken as empty', () => {
    const broken = {
      version: 2,
      savedAt: '2026-01-01T00:00:00.000Z',
      player: {
        characterId: 'researcher-male',
        sceneId: LAB,
        position: [0, 0, 0],
        yaw: 0,
        pitch: 0,
        equipment: [],
      },
      world: { entityStates: {} },
    };
    const save = parseSave(JSON.stringify(broken));
    expect(save.ok).toBe(false);
  });
});
