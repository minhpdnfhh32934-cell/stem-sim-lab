import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Unsubscribe } from '../../core/EventBus';
import type { Game } from '../../game/Game';
import { bootTestGame, flush } from '../../game/testing';
import { RendererHost, type RendererModule } from './RendererHost';

/** The boot's WebGL check without a browser: its canvas gives a WebGL 2 context, or none. */
function stubWebGL(available: boolean) {
  const released = { count: 0 };
  vi.stubGlobal('document', {
    createElement: () => ({
      getContext: (id: string) =>
        available && id === 'webgl2'
          ? {
              getExtension: () => ({
                loseContext: () => {
                  released.count++;
                },
              }),
            }
          : null,
    }),
  });
  return released;
}

/**
 * A stand-in for the renderer's chunk: counts imports and renderers; an import can fail or be held
 * open, a renderer can fail to start. Each renderer notes how many entities existed when it
 * started, and counts the spawns it hears afterwards.
 */
function fakeChunk() {
  const chunk = {
    imports: 0,
    built: 0,
    disposed: 0,
    updates: 0,
    entitiesAtStart: [] as number[],
    spawnsHeard: 0,
    failImport: false,
    failStart: false,
    hold: false,
    release: () => undefined as unknown,
  };
  class FakeRenderer {
    readonly id = 'renderer';
    private off: Unsubscribe | null = null;
    constructor(
      _host: unknown,
      private readonly game: Game,
    ) {
      chunk.built++;
    }
    init(): void {
      chunk.entitiesAtStart.push(this.game.world.entityCount);
      if (chunk.failStart) throw new Error('WebGL is not available in this browser');
      this.off = this.game.events.subscribe('EntitySpawned', () => {
        chunk.spawnsHeard++;
      });
    }
    update(): void {
      chunk.updates++;
    }
    /** Under Ultra the real one waits for its chunk and surfaces; nothing here. */
    ultraReady(): Promise<void> {
      return Promise.resolve();
    }
    dispose(): void {
      chunk.disposed++;
      this.off?.();
    }
  }
  const module = { WorldRenderer: FakeRenderer } as unknown as RendererModule;
  const importRenderer = (): Promise<RendererModule> => {
    chunk.imports++;
    if (chunk.failImport) {
      return Promise.reject(new Error('Failed to fetch dynamically imported module'));
    }
    if (!chunk.hold) return Promise.resolve(module);
    return new Promise((resolve) => (chunk.release = () => resolve(module)));
  };
  return { chunk, importRenderer };
}

/** Boots the real game with the host as its renderer system, as main.ts does. */
async function bootWithHost(importRenderer: () => Promise<RendererModule>) {
  const made: { host?: RendererHost } = {};
  const booted = await bootTestGame({
    platformSystems: (g) => [
      (made.host = new RendererHost({} as HTMLElement, g, {} as HTMLCanvasElement, importRenderer)),
    ],
  });
  if (!made.host) throw new Error('the renderer host was not created');
  return { ...booted, host: made.host };
}

describe('renderer host', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('boots to the menu after checking WebGL 2 and releasing the check, loading nothing', async () => {
    const released = stubWebGL(true);
    const { chunk, importRenderer } = fakeChunk();
    const { game, host } = await bootWithHost(importRenderer);
    expect(game.state.session).toEqual({ phase: 'menu', sceneId: 'main-menu', paused: false });
    expect(released.count).toBe(1);
    expect(chunk.imports).toBe(0);
    host.update(1 / 60); // nothing to draw yet
    expect(chunk.updates).toBe(0);
  });

  it('stops the boot at the systems stage without WebGL 2', async () => {
    stubWebGL(false);
    const { chunk, importRenderer } = fakeChunk();
    await expect(bootWithHost(importRenderer)).rejects.toMatchObject({
      stage: 'systems',
      message:
        'Boot failed during systems: System "renderer" failed to initialize: WebGL is not available in this browser',
    });
    expect(chunk.imports).toBe(0);
  });

  it('starts the renderer before the first world scene is built, and keeps it for later scenes', async () => {
    stubWebGL(true);
    const { chunk, importRenderer } = fakeChunk();
    const { game, host } = await bootWithHost(importRenderer);

    await game.newGame('researcher-male');
    expect(chunk.imports).toBe(1);
    expect(chunk.built).toBe(1);
    expect(chunk.entitiesAtStart).toEqual([0]); // started before anything spawned...
    expect(chunk.spawnsHeard).toBe(game.world.entityCount); // ...so it heard every spawn
    host.update(1 / 60);
    expect(chunk.updates).toBe(1);

    expect((await game.backToMenu()).ok).toBe(true);
    await game.newGame('researcher-female');
    expect(chunk.imports).toBe(1);
    expect(chunk.built).toBe(1);
    expect(game.state.session.sceneId).toBe('preparation-room');
  });

  it('keeps the menu and says why when the chunk cannot load, and the next world entry retries', async () => {
    stubWebGL(true);
    const { chunk, importRenderer } = fakeChunk();
    const { game, logs } = await bootWithHost(importRenderer);
    chunk.failImport = true;

    await expect(game.newGame('researcher-male')).rejects.toThrow(
      '3D view could not be loaded: Failed to fetch dynamically imported module',
    );
    expect(game.state.session).toEqual({ phase: 'menu', sceneId: 'main-menu', paused: false });
    expect(game.world.entityCount).toBe(0);
    expect(logs.some((l) => l.level === 'error' && l.channel === 'Renderer')).toBe(true);

    chunk.failImport = false;
    await game.newGame('researcher-male');
    expect(chunk.imports).toBe(2);
    expect(chunk.built).toBe(1);
    expect(game.state.session.sceneId).toBe('preparation-room');
  });

  it('disposes a renderer that fails to start, and the next world entry starts a new one', async () => {
    stubWebGL(true);
    const { chunk, importRenderer } = fakeChunk();
    const { game } = await bootWithHost(importRenderer);
    chunk.failStart = true;

    await expect(game.newGame('researcher-male')).rejects.toThrow(
      '3D view could not be loaded: WebGL is not available in this browser',
    );
    expect(chunk.built).toBe(1);
    expect(chunk.disposed).toBe(1);
    expect(game.state.session.sceneId).toBe('main-menu');

    chunk.failStart = false;
    await game.newGame('researcher-male');
    expect(chunk.built).toBe(2);
    expect(chunk.disposed).toBe(1);
    expect(game.state.session.sceneId).toBe('preparation-room');
  });

  it('creates nothing once disposed, even when the chunk arrives later, and stops preparing worlds', async () => {
    stubWebGL(true);
    const { chunk, importRenderer } = fakeChunk();
    const { game, host } = await bootWithHost(importRenderer);
    chunk.hold = true;

    const loading = host.load();
    await flush();
    host.dispose();
    chunk.release();
    await loading;
    expect(chunk.built).toBe(0);
    await expect(host.load()).rejects.toThrow('The renderer has been disposed');

    chunk.hold = false;
    await game.newGame('researcher-male'); // no longer waits for the renderer
    expect(chunk.imports).toBe(1);
    expect(game.state.session.sceneId).toBe('preparation-room');
  });
});
