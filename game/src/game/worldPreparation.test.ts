import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as RapierLoader from '../physics/rapier';
import type { Game } from './Game';
import { bootTestGame, flush } from './testing';

interface LoaderControl {
  calls: number;
  mode: 'real' | 'hold';
  release: () => void;
}

// A controllable stand-in for the Rapier loader (as in physicsLoading.test.ts): counts calls and
// can hold the load open, so a test sees what runs while physics is still loading.
const loader = vi.hoisted((): LoaderControl => ({
  calls: 0,
  mode: 'real',
  release: () => undefined,
}));

vi.mock('../physics/rapier', async (importOriginal) => {
  const actual = await importOriginal<typeof RapierLoader>();
  return {
    loadRapier: async () => {
      loader.calls++;
      if (loader.mode === 'hold') await new Promise<void>((resolve) => (loader.release = resolve));
      return actual.loadRapier();
    },
  };
});

/** A preparation step held open until the test releases it; counts its calls. */
function heldStep() {
  const held: { calls: number; release: () => void } = { calls: 0, release: () => undefined };
  const step = () => {
    held.calls++;
    return new Promise<void>((resolve) => (held.release = resolve));
  };
  return { held, step };
}

/** Scene and entity events, in order, from now on. */
function watchScene(game: Game): string[] {
  const seen: string[] = [];
  for (const type of [
    'SceneUnloaded',
    'EntitySpawned',
    'EntityDespawned',
    'SceneLoaded',
  ] as const) {
    game.events.subscribe(type, () => seen.push(type));
  }
  return seen;
}

describe('world preparation', () => {
  beforeEach(() => {
    loader.calls = 0;
    loader.mode = 'real';
  });

  it('finishes before the menu is torn down or anything of the new scene spawns', async () => {
    const { game } = await bootTestGame();
    const seen = watchScene(game);
    const { held, step } = heldStep();
    game.addWorldPreparation(() => step().then(() => void seen.push('prepared')));

    const started = game.newGame('researcher-male');
    await flush();
    expect(held.calls).toBe(1);
    expect(game.state.session).toEqual({ phase: 'loading', sceneId: 'main-menu', paused: false });
    expect(game.world.entityCount).toBe(0);
    expect(seen).toEqual([]);

    held.release();
    await started;
    expect(seen[0]).toBe('prepared');
    expect(seen.indexOf('SceneUnloaded')).toBeGreaterThan(0);
    expect(seen.indexOf('EntitySpawned')).toBeGreaterThan(seen.indexOf('SceneUnloaded'));
    expect(game.state.session).toEqual({
      phase: 'playing',
      sceneId: 'preparation-room',
      paused: false,
    });
    expect(game.world.entityCount).toBeGreaterThan(0);
  });

  it('runs alongside physics: both start before either finishes, and the scene waits for both', async () => {
    const { game } = await bootTestGame();
    const { held, step } = heldStep();
    game.addWorldPreparation(step);
    loader.mode = 'hold';

    const started = game.newGame('researcher-male');
    await flush();
    // Neither has finished, yet both have started: the step did not wait for physics.
    expect(loader.calls).toBe(1);
    expect(held.calls).toBe(1);
    expect(game.physics.stats().status).toBe('loading');

    held.release();
    await flush();
    // The step is done, physics is not: still the menu, nothing built.
    expect(game.state.session).toEqual({ phase: 'loading', sceneId: 'main-menu', paused: false });
    expect(game.world.entityCount).toBe(0);

    loader.release();
    await started;
    expect(game.state.session.sceneId).toBe('preparation-room');
    expect(game.physics.stats().status).toBe('ready');
  });

  it('is never run for the menu scene', async () => {
    const { game } = await bootTestGame();
    const step = vi.fn(() => Promise.resolve());
    game.addWorldPreparation(step);

    await game.scenes.load('main-menu');
    expect(step).not.toHaveBeenCalled();

    await game.newGame('researcher-male');
    expect(step).toHaveBeenCalledTimes(1);
    expect((await game.backToMenu()).ok).toBe(true);
    expect(game.state.session).toEqual({ phase: 'menu', sceneId: 'main-menu', paused: false });
    expect(step).toHaveBeenCalledTimes(1);
  });

  it('keeps the menu intact and leaves nothing loading when a step fails', async () => {
    const { game } = await bootTestGame();
    const seen = watchScene(game);
    game.addWorldPreparation(() =>
      Promise.reject(new Error('3D view could not be loaded: offline')),
    );

    await expect(game.newGame('researcher-male')).rejects.toThrow(
      '3D view could not be loaded: offline',
    );
    expect(game.state.session).toEqual({ phase: 'menu', sceneId: 'main-menu', paused: false });
    expect(game.scenes.isLoading).toBe(false);
    expect(game.world.entityCount).toBe(0);
    expect(seen).toEqual([]);
    expect(game.hasSavedGame()).toBe(false); // no world scene loaded, so nothing autosaved
  });

  it('calls a failed step again on the next world entry, which can then succeed', async () => {
    const { game } = await bootTestGame();
    let calls = 0;
    game.addWorldPreparation(() => {
      calls++;
      return calls === 1
        ? Promise.reject(new Error('3D view could not be loaded: offline'))
        : Promise.resolve();
    });

    await expect(game.newGame('researcher-male')).rejects.toThrow('offline');
    await game.newGame('researcher-male');
    expect(calls).toBe(2);
    expect(game.state.session).toEqual({
      phase: 'playing',
      sceneId: 'preparation-room',
      paused: false,
    });
    expect(game.world.entityCount).toBeGreaterThan(0);
  });

  it('no longer runs a step removed with the function its registration returned', async () => {
    const { game } = await bootTestGame();
    const step = vi.fn(() => Promise.resolve());
    const remove = game.addWorldPreparation(step);
    remove();

    await game.newGame('researcher-male');
    expect(step).not.toHaveBeenCalled();
    expect(game.state.session.sceneId).toBe('preparation-room');
  });
});
