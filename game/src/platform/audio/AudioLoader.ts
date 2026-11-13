import { describeError, type GameSystem } from '../../core/SystemRunner';
import type { Game } from '../../game/Game';
import type { AudioView, SoundSettings } from './AudioView';

/**
 * The part of the sound the menu ships (Phase S). The engine, its bank and the sound's settings
 * are a chunk of their own, fetched at the player's first click or key — the moment a browser
 * lets a page make sound — so the menu's JS stays under its guard. The settings get the sound's
 * section when it arrives. A failure is logged and the game plays silent.
 */
export class AudioLoader implements GameSystem {
  readonly id = 'audio';
  private view: AudioView | null = null;
  private section: SoundSettings | null = null;
  private loading = false;
  private disposed = false;
  private readonly load = () => {
    if (this.loading) return;
    this.loading = true;
    this.forget();
    import('./AudioView').then(
      ({ AudioView, SoundSettings }) => {
        if (this.disposed) return;
        this.view = new AudioView(this.game);
        this.view.init();
        this.section = new SoundSettings(this.game);
        this.settings.addSection(this.section.root);
      },
      (error: unknown) => {
        this.loading = false; // tried again at the next click
        this.listen();
        this.game.log.warn(`The sound could not be loaded: ${describeError(error)}`);
      },
    );
  };

  constructor(
    private readonly game: Game,
    private readonly settings: { addSection(section: HTMLElement): void },
  ) {}

  /** For the debug panel. */
  get status(): string {
    return this.view?.status ?? (this.loading ? 'loading' : 'waiting for a click');
  }

  init(): void {
    this.listen();
  }

  update(): void {
    this.view?.update();
  }

  dispose(): void {
    this.disposed = true;
    this.forget();
    this.view?.dispose();
    this.section?.dispose();
    this.view = null;
  }

  private listen(): void {
    for (const type of ['pointerdown', 'keydown'] as const) {
      document.addEventListener(type, this.load, { capture: true });
    }
  }

  private forget(): void {
    for (const type of ['pointerdown', 'keydown'] as const) {
      document.removeEventListener(type, this.load, { capture: true });
    }
  }
}
