import type { Game } from '../../game/Game';
import { el } from './dom';

/** The 3-minute promo (Phú 2026-11-19), fetched only when it is played. */
export const PROMO_VIDEO = 'video/simlab3d-gioi-thieu.mp4';

/**
 * The promo video from a small button on the main menu: a modal dialog (the page's own `<dialog>`:
 * focus kept inside, Esc closes it) with the browser's player. It starts when opened and stops
 * where it is when closed; the menu's own music is quiet meanwhile (`onPlaying`).
 */
export class PromoVideo {
  readonly root = el('dialog', 'promo-dialog');
  private readonly video = el('video', 'promo-video');

  constructor(
    private readonly game: Game,
    show: (element: HTMLElement, text: () => string) => HTMLElement,
    /** The menu's music quiet (true) while the video is open, back after. */
    private readonly onPlaying: (playing: boolean) => void,
  ) {
    const t = game.texts;
    const title = show(el('h2', 'promo-title'), () => t.ui('promo.title', 'SimLab 3D trailer'));
    title.id = 'promo-title';
    this.root.setAttribute('aria-labelledby', title.id);
    const close = show(el('button', 'menu-button promo-close'), () =>
      t.ui('controls.close', 'Close'),
    );
    close.addEventListener('click', () => this.root.close());
    const head = el('header', 'promo-head');
    head.append(title, close);
    this.video.controls = true;
    this.video.preload = 'none';
    this.video.playsInline = true;
    this.root.append(head, this.video);
    this.root.addEventListener('click', (event) => {
      if (event.target === this.root) this.root.close();
    });
    this.root.addEventListener('close', () => {
      this.video.pause();
      this.onPlaying(false);
    });
  }

  get open(): boolean {
    return this.root.open;
  }

  show(): void {
    if (this.root.open) return;
    if (!this.video.src) this.video.src = PROMO_VIDEO;
    const { master } = this.game.volumes;
    this.video.volume = Math.min(1, Math.max(0, master));
    this.video.muted = this.game.muted;
    this.onPlaying(true);
    this.root.showModal();
    void this.video.play().catch(() => {
      // Not allowed to start by itself (or not loaded yet): the player's own button starts it.
    });
  }
}
