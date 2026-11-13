import type { InputAction } from '../core/config';
import { Disposables } from '../core/EventBus';
import type { GameSystem } from '../core/SystemRunner';
import type { Game } from '../game/Game';

/** Adds a DOM listener and registers its removal. */
export function listen<K extends keyof WindowEventMap>(
  disposables: Disposables,
  target: Window,
  type: K,
  handler: (event: WindowEventMap[K]) => void,
): void;
export function listen<K extends keyof DocumentEventMap>(
  disposables: Disposables,
  target: Document,
  type: K,
  handler: (event: DocumentEventMap[K]) => void,
): void;
export function listen<K extends keyof HTMLElementEventMap>(
  disposables: Disposables,
  target: HTMLElement,
  type: K,
  handler: (event: HTMLElementEventMap[K]) => void,
): void;
export function listen(
  disposables: Disposables,
  target: EventTarget,
  type: string,
  handler: (event: Event) => void,
): void {
  target.addEventListener(type, handler);
  disposables.add(() => target.removeEventListener(type, handler));
}

/**
 * Maps keyboard/mouse to the device-independent InputState using the configured bindings.
 * Mouse look requires pointer lock (click the view); keys work whenever no text field has focus.
 */
export class BrowserInput implements GameSystem {
  readonly id = 'browser-input';
  private readonly listeners = new Disposables();
  private readonly actionByCode = new Map<string, InputAction>();

  constructor(
    private readonly surface: HTMLElement,
    private readonly game: Game,
    /** A phone or tablet: fingers look round (TouchControls); the mouse is never captured. */
    private readonly touch = false,
  ) {}

  init(): void {
    const { input, config, log } = this.game;
    for (const [action, codes] of Object.entries(config.input.bindings)) {
      for (const code of codes) this.actionByCode.set(code, action as InputAction);
    }
    const l = this.listeners;
    listen(l, window, 'keydown', (event) => {
      const action = this.actionByCode.get(event.code);
      // A field keeps its keys, except the developer panel's F3, which types nothing.
      if (!action || (isTextField(event.target) && action !== 'toggleDebug')) return;
      // Paused: no game key reaches the game (the developer panel's F3 still does).
      if (this.game.state.session.paused && action !== 'toggleDebug') return;
      event.preventDefault();
      input.press(action);
    });
    listen(l, window, 'keyup', (event) => {
      const action = this.actionByCode.get(event.code);
      if (action) input.release(action);
    });
    listen(l, window, 'blur', () => input.reset());
    listen(l, document, 'visibilitychange', () => {
      if (document.hidden) input.reset();
    });
    listen(l, document, 'mousemove', (event) => {
      if (document.pointerLockElement === this.surface)
        input.addLook(event.movementX, event.movementY);
    });
    // Mouse buttons map to bindings as `Mouse<button>` (Mouse0 = left), only while the mouse is
    // captured — the click that captures it is not also a game action.
    listen(l, document, 'mousedown', (event) => {
      const action = this.actionByCode.get(`Mouse${event.button}`);
      if (
        action &&
        document.pointerLockElement === this.surface &&
        !this.game.state.session.paused
      ) {
        input.press(action);
      }
    });
    listen(l, document, 'mouseup', (event) => {
      const action = this.actionByCode.get(`Mouse${event.button}`);
      if (action) input.release(action);
    });
    // The right button pours (`pour`), so the page's own menu must not open while it is captured.
    // Not verified in a real browser: R does the same, and is listed first.
    listen(l, document, 'contextmenu', (event) => {
      if (document.pointerLockElement === this.surface) event.preventDefault();
    });
    // A click on the scene captures the mouse — and, when paused, resumes play first.
    listen(l, this.surface, 'click', () => {
      this.game.resume();
      this.lockPointer().catch((error: unknown) => log.debug('Pointer lock refused', error));
    });
    // The browser grants a lock some time after it is asked for: one that arrives after play
    // stopped (Esc, or leaving, while the request was pending) is given back at once — the menu
    // needs the mouse.
    listen(l, document, 'pointerlockchange', () => {
      if (document.pointerLockElement === this.surface && !this.playing()) {
        document.exitPointerLock();
      }
    });
  }

  /** Captures the mouse for looking around; only meaningful while playing. */
  async lockPointer(): Promise<void> {
    if (this.touch || !this.playing()) return;
    if (document.pointerLockElement === this.surface) return;
    await this.surface.requestPointerLock();
  }

  /** In a world and not paused: the only time the mouse may be captured. */
  private playing(): boolean {
    const { phase, paused } = this.game.state.session;
    return phase === 'playing' && !paused;
  }

  dispose(): void {
    this.listeners.dispose();
    if (document.pointerLockElement === this.surface) document.exitPointerLock();
    this.game.input.reset();
  }
}

/** Inputs that keep no keys for themselves: game keys still work while one has focus. */
const KEYLESS_INPUTS = new Set(['checkbox', 'button', 'submit', 'reset']);

/** A field that keeps the keys (typing, arrows in a radio group or a list): no game keys then. */
function isTextField(target: EventTarget | null): boolean {
  return (
    (target instanceof HTMLInputElement && !KEYLESS_INPUTS.has(target.type)) ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}
