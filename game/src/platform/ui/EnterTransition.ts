import './enterTransition.css';
import { el } from './dom';
import { emblem } from './menuArt';

/** The opening's length (ms) before the screen counts as covered; with reduced motion. */
const COVER_MS = 950;
const COVER_MS_STILL = 250;
/**
 * The reveal (Phú 2026-11-12, after the portal): a white light drawn up over the screen
 * (WHITE_MS, the portal flying out under it), then cleared off the world (CLEAR_MS); with reduced
 * motion, a short fade. The quick fade of a failure (ms).
 */
const WHITE_MS = 650;
const CLEAR_MS = 900;
const STILL_MS = 300;
const FAIL_MS = 260;
/** Light streaks rushing past: a fixed few, made once. */
const STREAKS = 28;

/**
 * Entering a world (Phú: Play on a LAN room goes straight into it "with a professional enter-room
 * effect"; also a single-player world): a full-screen overlay in the menu's deep-space colours,
 * the SimLab emblem as a portal whose rings spin up, light streaks rushing past, the world's name,
 * a line under it and a status line with a thin shimmer. When the world is ready the portal
 * expands and an iris opens onto it. A room is cool cyan, a solo world warm. Motion is CSS only
 * (transforms and opacity, the iris a mask), none with reduced motion (a fade). It has no text of
 * its own: the words are the caller's.
 */
export class EnterTransition {
  /** Resolves once the opening part has played, so the world loads under a covered screen. */
  readonly covered: Promise<void>;
  private readonly root = el('div', 'enter-transition');
  private readonly statusLine = el('div', 'enter-status');
  /** The white light drawn up over the screen, then cleared off the world. */
  private readonly white = el('div', 'enter-white');
  private reveal = (): void => undefined;
  private coverTimer = 0;
  private closing = false;

  constructor(
    parent: HTMLElement,
    words: { title: string; subtitle: string; status: string },
    kind: 'room' | 'solo',
  ) {
    this.root.classList.add(kind);
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-live', 'polite');
    const streaks = el('div', 'enter-streaks');
    streaks.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < STREAKS; i++) {
      const streak = el('span', 'enter-streak');
      // Spread round the circle (golden angle), each its own pace and start.
      streak.style.setProperty('--a', `${(i * 137.5) % 360}deg`);
      streak.style.setProperty('--t', `${0.7 + ((i * 7) % 5) * 0.12}s`);
      streak.style.setProperty('--d', `${(-((i * 0.37) % 1.3)).toFixed(2)}s`);
      streaks.append(streak);
    }
    const portal = el('div', 'enter-portal');
    portal.setAttribute('aria-hidden', 'true');
    const art = emblem();
    art.classList.replace('menu-emblem', 'enter-emblem');
    portal.append(el('div', 'enter-ring'), el('div', 'enter-ring outer'), art);
    const progress = el('div', 'enter-progress');
    progress.setAttribute('aria-hidden', 'true');
    this.statusLine.textContent = words.status;
    this.root.append(
      el('div', 'enter-back'),
      streaks,
      portal,
      el('div', 'enter-title', words.title),
      el('div', 'enter-subtitle', words.subtitle),
      this.statusLine,
      progress,
      this.white,
    );
    parent.append(this.root);
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.covered = new Promise((resolve) => {
      this.reveal = resolve;
      this.coverTimer = window.setTimeout(resolve, still ? COVER_MS_STILL : COVER_MS);
    });
  }

  /** Updates the status line (e.g. "Joining…", "Loading the lab…"). */
  status(text: string): void {
    this.statusLine.textContent = text;
  }

  /**
   * The world is ready: the portal flies out as a white light rises over the screen, then the
   * light clears off the world, and the overlay goes.
   */
  done(): void {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.close('opening', STILL_MS);
      return;
    }
    if (!this.closing) {
      // Each step when the one before has really played (the game's first frames can hold the
      // page up: a timer alone would clear the light before it is up), a timer behind it.
      const white = this.white;
      const after = (ms: number, next: () => void) => {
        let done = false;
        const go = () => {
          if (done) return;
          done = true;
          white.removeEventListener('transitionend', go);
          next();
        };
        white.addEventListener('transitionend', go);
        window.setTimeout(go, ms * 3);
      };
      after(WHITE_MS, () => {
        this.root.classList.add('clearing');
        after(CLEAR_MS, () => this.root.remove());
      });
    }
    this.close('whiteout', null);
  }

  /** Something failed: fade out quickly and remove itself. */
  fail(): void {
    this.close('failing', FAIL_MS);
  }

  /** Done and fail are idempotent: the first one wins; the overlay always goes. */
  private close(state: 'opening' | 'whiteout' | 'failing', ms: number | null): void {
    if (this.closing) return;
    this.closing = true;
    window.clearTimeout(this.coverTimer);
    this.reveal(); // whoever waits for the cover never waits forever
    this.root.classList.add(state);
    if (ms !== null) window.setTimeout(() => this.root.remove(), ms); // else removed by its caller
  }
}
