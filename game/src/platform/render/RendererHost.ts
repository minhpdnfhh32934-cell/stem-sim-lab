import type { Unsubscribe } from '../../core/EventBus';
import type { Logger } from '../../core/Logger';
import { describeError, type GameSystem } from '../../core/SystemRunner';
import type { Game } from '../../game/Game';
import type * as WorldRendererModule from './WorldRenderer';
import type { ExplainAnchor as ExplainAnchorPoint } from './explainFraming';

/** What the host needs from the world renderer's own chunk. */
export type RendererModule = Pick<typeof WorldRendererModule, 'WorldRenderer'>;

/**
 * The renderer system the game boots with. three.js and the world renderer are in a chunk of
 * their own, downloaded before the first world scene is built (a world preparation, alongside
 * Rapier), never for the menu; a browser without WebGL 2 still stops at boot, at the systems
 * stage. Later world scenes reuse the loaded renderer; after a failed load the next one retries.
 */
export class RendererHost implements GameSystem {
  readonly id = 'renderer';
  private renderer: WorldRendererModule.WorldRenderer | null = null;

  /** The rooms not drawn now (world/dormancy.ts), for the debug panel: "—" before the renderer. */
  get roomsAsleep(): string {
    const rooms = this.renderer?.sleepingRooms;
    if (!rooms) return '—';
    const asleep = rooms.asleep.join(', ') || '—';
    return rooms.waking.length > 0 ? `${asleep} · waking ${rooms.waking.join(', ')}` : asleep;
  }
  /** Shadow maps drawn since the renderer began (shadowCache.ts), for the debug panel. */
  get shadowMaps(): string {
    const r = this.renderer;
    return r ? `${r.shadowMapsDrawn} · last: ${r.shadowCause}` : '—';
  }
  /** The open Explain view's labels on the screen (none before the renderer). */
  explainAnchors(width: number, height: number): readonly ExplainAnchorPoint[] {
    return this.renderer?.explainAnchors(width, height) ?? [];
  }
  private loading: Promise<void> | null = null;
  private disposed = false;
  private unregister: Unsubscribe | null = null;
  private readonly log: Logger;

  constructor(
    private readonly host: HTMLElement,
    private readonly game: Game,
    private readonly canvas: HTMLCanvasElement,
    private readonly importRenderer: () => Promise<RendererModule> = () =>
      import('./WorldRenderer'),
  ) {
    this.log = game.log.child('Renderer');
  }

  init(): void {
    if (!webgl2Available()) throw new Error('WebGL is not available in this browser');
    // Each world load: the renderer, then (under Ultra) its chunk and surfaces.
    this.unregister = this.game.addWorldPreparation(() =>
      this.load().then(() => this.renderer?.ultraReady()),
    );
  }

  /**
   * Downloads the renderer and starts it on the page's canvas. Concurrent and repeated calls share
   * one load; after a failure the next call retries.
   */
  load(): Promise<void> {
    if (this.disposed) return Promise.reject(new Error('The renderer has been disposed'));
    this.loading ??= this.start().catch((error: unknown) => {
      this.loading = null;
      this.log.error('3D view could not be loaded', error);
      const reason = describeError(error);
      throw new Error(
        this.game.texts.ui('renderer.loadFailed', '3D view could not be loaded: {reason}', {
          reason,
        }),
        { cause: error },
      );
    });
    return this.loading;
  }

  update(dt: number): void {
    this.renderer?.update(dt);
  }

  dispose(): void {
    this.disposed = true;
    this.unregister?.();
    this.unregister = null;
    this.renderer?.dispose();
    this.renderer = null;
  }

  private async start(): Promise<void> {
    const { WorldRenderer } = await this.importRenderer();
    if (this.disposed) return; // the game shut down while the chunk was loading
    const renderer = new WorldRenderer(this.host, this.game, this.canvas);
    try {
      renderer.init();
    } catch (error) {
      renderer.dispose();
      throw error;
    }
    this.renderer = renderer;
  }
}

/**
 * WebGL 2 (what three.js needs), tried on a canvas outside the page and released at once: the
 * page's canvas gets its context, with the renderer's own settings, only when the renderer loads.
 */
function webgl2Available(): boolean {
  const context = document.createElement('canvas').getContext('webgl2');
  context?.getExtension('WEBGL_lose_context')?.loseContext();
  return context !== null;
}
