import type { InputAction } from '../core/config';
import type { GameSystem } from '../core/SystemRunner';
import type { Game } from '../game/Game';

/** A stick pushed less than this is at rest (worn sticks drift). */
const DEAD = 0.18;
/** The right stick pushed all the way turns the view this fast (rad/s, at sensitivity 1×). */
const LOOK_RATE = 2.6;

/**
 * The buttons of a pad in the browser's standard layout (Xbox names; a PlayStation pad's ✕ ○ □ △
 * in the same places) and the game's actions they hold. Start pauses, the d-pad's left and right
 * step through the hotbar; the others are below.
 */
export const PAD_BUTTONS: readonly (readonly [number, InputAction])[] = [
  [0, 'interact'], // A
  [1, 'secondary'], // B
  [2, 'stow'], // X
  [3, 'inventory'], // Y
  [4, 'run'], // LB
  [5, 'pour'], // RB
  [6, 'inspect'], // LT
  [7, 'throw'], // RT
  [8, 'tasks'], // Back / View
  [10, 'run'], // left stick pressed
  [12, 'phone'], // d-pad up
  [13, 'explain'], // d-pad down
];
const START = 9;
const LEFT = 14;
const RIGHT = 15;

/** A pad as read: the standard layout's axes and buttons. */
export interface PadState {
  readonly axes: readonly number[];
  readonly buttons: readonly { readonly pressed: boolean }[];
}

/** A stick's two axes with its dead zone taken out: 0 at rest, up to 1 pushed all the way. */
export function stick(x: number, y: number): [number, number] {
  const length = Math.hypot(x, y);
  if (length < DEAD) return [0, 0];
  const k = Math.min(1, (length - DEAD) / (1 - DEAD)) / length;
  return [x * k, y * k];
}

/**
 * A gamepad on a computer, phone or tablet (2026-11-12): the left stick walks (as far as it is
 * pushed; pressed in, or LB held, runs), the right stick looks (× the look sensitivity), the
 * buttons hold the game's own actions (`PAD_BUTTONS`) — what the keys do, through the same
 * `InputState`. The first pad connected is read each frame; none, nothing happens. Menus and
 * panels are not driven by the pad (they want the mouse or a finger).
 */
export class GamepadInput implements GameSystem {
  readonly id = 'gamepad-input';
  /** The buttons down last frame (Start and the d-pad act once a press). */
  private readonly was = new Set<number>();
  /** The actions the pad holds now. */
  private held = new Set<InputAction>();
  /** The pad is walking now (it sets the stick back when let go, and only then). */
  private walking = false;
  /** A pad has been seen (the debug panel says so). */
  connected = false;

  constructor(
    private readonly game: Game,
    private readonly pads: () => readonly (PadState | null)[] = () =>
      typeof navigator !== 'undefined' && 'getGamepads' in navigator ? navigator.getGamepads() : [],
  ) {}

  update(dt: number): void {
    const pad = this.pads().find((p): p is PadState => p !== null) ?? null;
    this.connected = pad !== null;
    const { input, state, config } = this.game;
    if (!pad) {
      this.letGo();
      return;
    }
    const pressed = (i: number) => pad.buttons[i]?.pressed === true;
    // Start: pause and resume (the pause menu's own Esc).
    if (pressed(START) && !this.was.has(START)) {
      if (state.session.paused) this.game.resume();
      else if (state.session.phase === 'playing') this.game.pause();
    }
    if (pressed(LEFT) && !this.was.has(LEFT)) this.game.inventory.step(-1);
    if (pressed(RIGHT) && !this.was.has(RIGHT)) this.game.inventory.step(1);
    // An action is held while any of its buttons is (LB and the pressed stick both run).
    const now = new Set<InputAction>();
    for (const [i, action] of PAD_BUTTONS) if (pressed(i)) now.add(action);
    for (const action of now) if (!this.held.has(action)) input.press(action);
    for (const action of this.held) if (!now.has(action)) input.release(action);
    this.held = now;
    this.was.clear();
    for (let i = 0; i < pad.buttons.length; i++) if (pressed(i)) this.was.add(i);

    const [mx, my] = stick(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
    if (mx !== 0 || my !== 0) {
      this.walking = true;
      input.stickX = mx;
      input.stickY = my;
    } else if (this.walking) this.stopWalking();
    const [lx, ly] = stick(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
    // As mouse pixels: the look sensitivity (PlayerSystem) applies to them as to the mouse's.
    const px = (LOOK_RATE * dt) / config.input.mouseSensitivity;
    if (lx !== 0 || ly !== 0) input.addLook(lx * px, ly * px);
  }

  dispose(): void {
    this.letGo();
  }

  /** The pad gone (or the game closing): nothing it held stays held. */
  private letGo(): void {
    if (this.walking) this.stopWalking();
    for (const action of this.held) this.game.input.release(action);
    this.held.clear();
    this.was.clear();
  }

  private stopWalking(): void {
    this.walking = false;
    this.game.input.stickX = 0;
    this.game.input.stickY = 0;
  }
}
