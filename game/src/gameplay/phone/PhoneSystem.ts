import type { EventBus } from '../../core/EventBus';
import type { GameSystem } from '../../core/SystemRunner';
import type { GameEvents } from '../../game/GameEvents';
import type { GameState } from '../../game/GameState';
import type { InputState } from '../player/InputState';
import type { InputAction } from '../../core/config';

/** The phone's item (core-items.json) and its one instance, carried from the start. */
export const PHONE_ITEM = 'phone';
export const PHONE_ID = 'phone';
/** How long a call rings before it is answered (s). */
export const RING_S = 2;
/** How long the answer stays on the screen before the call ends by itself (s). */
const TALK_S = 9;
/** The longest number the screen takes. */
const MAX_DIGITS = 12;
const DIGITS: readonly (readonly [InputAction, string])[] = [
  ['dial0', '0'],
  ['hotbar1', '1'],
  ['hotbar2', '2'],
  ['hotbar3', '3'],
  ['hotbar4', '4'],
  ['hotbar5', '5'],
  ['hotbar6', '6'],
  ['hotbar7', '7'],
  ['hotbar8', '8'],
  ['hotbar9', '9'],
];

export type PhoneCall =
  | { readonly state: 'idle' }
  | { readonly state: 'ringing'; seconds: number }
  | {
      readonly state: 'talking';
      readonly outcome: GameEvents['EmergencyCall']['outcome'];
      seconds: number;
    };

export interface PhoneSystemDeps {
  state: GameState;
  input: InputState;
  events: EventBus<GameEvents>;
  /** The selected hotbar stack's last instance (the inventory). */
  selected(): string | null;
  /** Whether the hands hold something (the phone needs them free). */
  handsFull(): boolean;
  /** Places a call (the fire system: 114 and the other numbers). */
  call(number: string): GameEvents['EmergencyCall']['outcome'];
}

/**
 * The player's own phone (Phú, Phase E-2b): an item in the bag from the start that never leaves
 * it — no world object, so it cannot be dropped or thrown. Chosen in the hotbar, Q takes it out
 * into the hand (P does too, from any slot) and puts it away again. While it is out it has the
 * keys: the number keys dial, E calls (and hangs up), F deletes, Q or P puts it away; the hands
 * do nothing else meanwhile (`out`: the interaction waits), the player can still walk and look.
 * A call rings, then is answered with what the number gives (`call`: 114 sends the fire brigade).
 */
export class PhoneSystem implements GameSystem {
  readonly id = 'phone';
  /** Whether the phone is in the hand. */
  out = false;
  /** What has been dialled. */
  number = '';
  call: PhoneCall = { state: 'idle' };
  private takenOutThisFrame = false;

  constructor(private readonly deps: PhoneSystemDeps) {}

  /** Whether the phone is the selected hotbar item. */
  get selected(): boolean {
    return this.deps.selected() === PHONE_ID;
  }

  /** Takes the phone out into the hand (the inventory's Q, or P); false with the hands full. */
  takeOut(): boolean {
    if (this.out || this.deps.handsFull()) return false;
    this.out = true;
    this.takenOutThisFrame = true; // the press that took it out is not also a phone key
    this.changed();
    return true;
  }

  /** Puts it away (a call goes on hold: it ends). */
  putAway(): void {
    if (!this.out) return;
    this.out = false;
    this.call = { state: 'idle' };
    this.changed();
  }

  update(dt: number): void {
    const { state, input } = this.deps;
    if (state.session.phase !== 'playing') {
      if (this.out) this.putAway();
      return;
    }
    if (state.session.paused) return;
    this.tick(dt);
    if (this.takenOutThisFrame) {
      this.takenOutThisFrame = false;
      return;
    }
    if (!this.out) {
      // Taken out here, by P: the frame after reads the number keys as usual (only the inventory's
      // Q, which takes it out earlier in this same frame, must not also put it away now).
      if (input.wasPressed('phone') && this.takeOut()) this.takenOutThisFrame = false;
      return;
    }
    if (input.wasPressed('stow') || input.wasPressed('phone')) {
      this.putAway();
      return;
    }
    if (input.wasPressed('interact')) {
      if (this.call.state === 'idle') this.dial();
      else this.hangUp();
      return;
    }
    if (this.call.state !== 'idle') return;
    if (input.wasPressed('secondary') && this.number !== '') {
      this.number = this.number.slice(0, -1);
      this.changed();
    }
    for (const [action, digit] of DIGITS) {
      if (!input.wasPressed(action) || this.number.length >= MAX_DIGITS) continue;
      this.number += digit;
      this.changed();
    }
  }

  dispose(): void {
    this.out = false;
  }

  /** Calls the number dialled: it rings first. */
  private dial(): void {
    if (this.number === '') return;
    this.call = { state: 'ringing', seconds: RING_S };
    this.changed();
  }

  private hangUp(): void {
    this.call = { state: 'idle' };
    this.changed();
  }

  private tick(dt: number): void {
    const call = this.call;
    if (call.state === 'idle') return;
    call.seconds -= dt;
    if (call.seconds > 0) return;
    if (call.state === 'ringing') {
      this.call = { state: 'talking', outcome: this.deps.call(this.number), seconds: TALK_S };
    } else {
      this.call = { state: 'idle' };
      this.number = '';
    }
    this.changed();
  }

  private changed(): void {
    this.deps.events.publish('PhoneChanged', { out: this.out, call: this.call.state });
  }
}
