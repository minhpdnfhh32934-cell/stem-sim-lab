import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bootTestGame, flush } from '../game/testing';
import type * as RapierLoader from './rapier';

interface LoaderControl {
  calls: number;
  mode: 'real' | 'fail' | 'hold';
  release: () => void;
}

// A controllable stand-in for the Rapier loader: counts calls, can fail like a browser without
// WebAssembly, or hold the load open to observe the game while physics is still loading.
const loader = vi.hoisted((): LoaderControl => ({
  calls: 0,
  mode: 'real',
  release: () => undefined,
}));

vi.mock('./rapier', async (importOriginal) => {
  const actual = await importOriginal<typeof RapierLoader>();
  return {
    loadRapier: async () => {
      loader.calls++;
      if (loader.mode === 'fail') throw new Error('WebAssembly is not available');
      if (loader.mode === 'hold') await new Promise<void>((resolve) => (loader.release = resolve));
      return actual.loadRapier();
    },
  };
});

describe('lazy physics loading in the game', () => {
  beforeEach(() => {
    loader.calls = 0;
    loader.mode = 'real';
  });

  it('boots to the menu without loading Rapier', async () => {
    const { game } = await bootTestGame();
    expect(game.state.session).toEqual({ phase: 'menu', sceneId: 'main-menu', paused: false });
    expect(loader.calls).toBe(0);
    expect(game.physics.stats()).toMatchObject({ status: 'idle', active: false });
  });

  it('loads Rapier once, before the first room is built, and never again', async () => {
    const { game } = await bootTestGame();
    loader.mode = 'hold';
    const started = game.newGame('researcher-male');
    await flush();

    // Physics is loading: still on the menu scene, nothing spawned, nothing simulated.
    expect(game.physics.stats().status).toBe('loading');
    expect(game.state.session).toEqual({ phase: 'loading', sceneId: 'main-menu', paused: false });
    expect(game.world.entityCount).toBe(0);
    game.input.press('moveForward');
    for (let i = 0; i < 10; i++) game.update(1 / 60);
    expect(game.state.player.position).toEqual([0, 0, 0]);
    expect(game.physics.stats().stepsLastFrame).toBe(0);
    game.input.release('moveForward');

    loader.release();
    await started;
    expect(game.state.session).toEqual({
      phase: 'playing',
      sceneId: 'preparation-room',
      paused: false,
    });
    expect(game.physics.stats()).toMatchObject({ status: 'ready', active: true });
    expect(game.physics.stats().bodies).toBeGreaterThan(0);

    await game.scenes.load('simlab-hub');
    await game.scenes.load('physics-lab');
    await game.newGame('researcher-female');
    expect(loader.calls).toBe(1);
  });

  it('keeps the menu and reports the error when Rapier cannot load, and can retry', async () => {
    const { game, logs } = await bootTestGame();
    loader.mode = 'fail';
    await expect(game.newGame('researcher-male')).rejects.toThrow(
      'Physics engine could not be loaded: WebAssembly is not available',
    );
    expect(game.state.session).toEqual({ phase: 'menu', sceneId: 'main-menu', paused: false });
    expect(game.world.entityCount).toBe(0);
    expect(game.physics.stats()).toMatchObject({ status: 'failed', active: false });
    expect(game.hasSavedGame()).toBe(false);
    expect(logs.some((l) => l.level === 'error' && l.channel === 'Physics')).toBe(true);

    loader.mode = 'real';
    await game.newGame('researcher-male');
    expect(game.state.session.sceneId).toBe('preparation-room');
    expect(game.physics.stats().status).toBe('ready');
    expect(loader.calls).toBe(2);
  });

  it('does not create a world when the game is disposed while Rapier is loading', async () => {
    const { game } = await bootTestGame();
    loader.mode = 'hold';
    const loading = game.physics.load();
    await flush();
    game.dispose();
    loader.release();
    await loading;
    expect(game.physics.stats()).toMatchObject({ status: 'disposed', active: false, bodies: 0 });
    await expect(game.physics.load()).rejects.toThrow('Physics has been disposed');
  });
});
