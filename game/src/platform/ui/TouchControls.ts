import type { InputAction } from '../../core/config';
import { Disposables } from '../../core/EventBus';
import type { GameSystem } from '../../core/SystemRunner';
import type { Game } from '../../game/Game';
import { listen } from '../BrowserInput';
import type { DeviceKind } from '../device';
import { el } from './dom';

/** The stick's reach (CSS px): pushed past DEAD of it, it walks (as far as pushed); past RUN, runs. */
const STICK_R = 56;
const DEAD = 0.35;
const RUN = 0.92;
/** A finger's drag looks this many times as far as the same mouse move. */
const LOOK_GAIN = 1.6;

interface Button {
  readonly action: InputAction;
  readonly key: string;
  readonly label: () => string;
  readonly className: string;
}

/**
 * Touch controls on a phone or tablet (Phú, 2026-11-12; a computer keeps keyboard and mouse): a
 * stick under the left thumb walks (pushed to its edge, runs), a drag anywhere else looks round,
 * buttons press the game's own actions — E use, F the second action, throw, Q put away/take out,
 * R pour and C look closer (held), the bag, tasks, Explain, the phone, pause — and the hotbar's
 * slots are tapped to choose. With the phone out, a keypad dials (the number keys' actions).
 * They write the same `InputState` the keyboard does: the game does not know a finger from a key.
 * Shown only while playing, with no panel open (panels are tapped as they are).
 */
export class TouchControls implements GameSystem {
  readonly id = 'touch-controls';
  private readonly root = el('div', 'touch-controls hidden');
  private readonly look = el('div', 'touch-look');
  private readonly stickZone = el('div', 'touch-stick-zone');
  private readonly stickBase = el('div', 'touch-stick-base hidden');
  private readonly stickKnob = el('div', 'touch-stick-knob');
  private readonly keypad = el('div', 'touch-keypad hidden');
  private readonly rotate = el('div', 'touch-rotate');
  private readonly labels: [HTMLElement, () => string][] = [];
  private readonly subscriptions = new Disposables();
  private stickId: number | null = null;
  private readonly stickAt = { x: 0, y: 0 };
  private lookId: number | null = null;
  private readonly lookAt = { x: 0, y: 0 };
  /** What the stick holds now (running, at its edge). */
  private readonly walking = new Set<InputAction>();
  private shown = false;

  constructor(
    private readonly parent: HTMLElement,
    private readonly game: Game,
    private readonly device: Exclude<DeviceKind, 'computer'>,
    /** A panel has the screen (inventory, dialogue, results…): the controls step aside. */
    private readonly panelOpen: () => boolean,
  ) {}

  init(): void {
    const t = this.game.texts;
    this.root.classList.add(`touch-${this.device}`);
    this.stickBase.append(this.stickKnob);
    this.stickZone.append(this.stickBase);
    const main = el('div', 'touch-main');
    const side = el('div', 'touch-side');
    const top = el('div', 'touch-top');
    const big = (action: InputAction, key: string, label: () => string): Button => ({
      action,
      key,
      label,
      className: 'touch-button big',
    });
    const small = (action: InputAction, key: string, label: () => string): Button => ({
      action,
      key,
      label,
      className: 'touch-button',
    });
    main.append(
      ...[
        big('interact', 'E', () => t.ui('touch.use', 'Use')),
        big('throw', '⤴', () => t.ui('touch.throw', 'Throw')),
        big('secondary', 'F', () => t.ui('touch.more', 'More')),
      ].map((b) => this.button(b)),
    );
    side.append(
      ...[
        small('stow', 'Q', () => t.ui('touch.stow', 'Put away')),
        small('pour', 'R', () => t.ui('touch.pour', 'Pour')),
        small('inspect', 'C', () => t.ui('touch.closer', 'Closer')),
      ].map((b) => this.button(b)),
    );
    top.append(
      ...[
        small('inventory', 'I', () => t.ui('touch.bag', 'Bag')),
        small('tasks', 'T', () => t.ui('touch.tasks', 'Tasks')),
        small('explain', 'H', () => t.ui('touch.explain', 'Explain')),
        small('phone', 'P', () => t.ui('touch.phone', 'Phone')),
      ].map((b) => this.button(b)),
      this.pauseButton(),
    );
    const digits: [InputAction, string, () => string][] = [
      ['hotbar1', '1', () => ''],
      ['hotbar2', '2', () => ''],
      ['hotbar3', '3', () => ''],
      ['hotbar4', '4', () => ''],
      ['hotbar5', '5', () => ''],
      ['hotbar6', '6', () => ''],
      ['hotbar7', '7', () => ''],
      ['hotbar8', '8', () => ''],
      ['hotbar9', '9', () => ''],
      ['secondary', '⌫', () => t.ui('touch.delete', 'Delete')],
      ['dial0', '0', () => ''],
      ['interact', 'E', () => t.ui('touch.call', 'Call')],
    ];
    this.keypad.append(
      ...digits.map(([action, key, label]) =>
        this.button({ action, key, label, className: 'touch-key' }),
      ),
    );
    this.rotate.textContent = t.ui('touch.rotate', 'Turn the device sideways to play.');
    this.root.append(this.look, this.stickZone, main, side, top, this.keypad, this.rotate);
    this.parent.append(this.root);

    const s = this.subscriptions;
    this.stick(s);
    this.looking(s);
    s.add(
      this.game.events.subscribe('PhoneChanged', ({ out }) =>
        this.keypad.classList.toggle('hidden', !out),
      ),
    );
    s.add(
      this.game.events.subscribe('LanguageChanged', () => {
        for (const [node, label] of this.labels) node.textContent = label();
        this.rotate.textContent = t.ui('touch.rotate', 'Turn the device sideways to play.');
      }),
    );
  }

  update(): void {
    const { phase, paused } = this.game.state.session;
    const shown = phase === 'playing' && !paused && !this.panelOpen();
    if (shown === this.shown) return;
    this.shown = shown;
    this.root.classList.toggle('hidden', !shown);
    if (!shown) this.letGo();
  }

  dispose(): void {
    this.letGo();
    this.subscriptions.dispose();
    this.root.remove();
  }

  /** A button holding its action while a finger is on it (as a key held down). */
  private button(b: Button): HTMLButtonElement {
    const button = el('button', b.className);
    button.type = 'button';
    button.dataset.action = b.action;
    const key = el('span', 'touch-key-cap', b.key);
    const label = el('span', 'touch-label', b.label());
    this.labels.push([label, b.label]);
    button.append(key, label);
    button.setAttribute('aria-label', `${b.key} ${b.label()}`.trim());
    const input = this.game.input;
    const s = this.subscriptions;
    listen(s, button, 'pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      button.classList.add('down');
      input.press(b.action);
    });
    const up = () => {
      button.classList.remove('down');
      input.release(b.action);
    };
    listen(s, button, 'pointerup', up);
    listen(s, button, 'pointercancel', up);
    listen(s, button, 'contextmenu', (event) => event.preventDefault());
    return button;
  }

  private pauseButton(): HTMLButtonElement {
    const button = el('button', 'touch-button touch-pause');
    button.type = 'button';
    const label = () => this.game.texts.ui('touch.pause', 'Pause');
    button.append(el('span', 'touch-key-cap', 'II'));
    const text = el('span', 'touch-label', label());
    this.labels.push([text, label]);
    button.append(text);
    button.setAttribute('aria-label', label());
    listen(this.subscriptions, button, 'click', () => this.game.pause());
    return button;
  }

  /** The stick: where the thumb comes down is its centre; pushing holds the walking actions. */
  private stick(s: Disposables): void {
    listen(s, this.stickZone, 'pointerdown', (event) => {
      if (this.stickId !== null) return;
      event.preventDefault();
      this.stickId = event.pointerId;
      this.stickZone.setPointerCapture(event.pointerId);
      const box = this.stickZone.getBoundingClientRect();
      this.stickAt.x = event.clientX;
      this.stickAt.y = event.clientY;
      this.stickBase.style.left = `${event.clientX - box.left}px`;
      this.stickBase.style.top = `${event.clientY - box.top}px`;
      this.stickBase.classList.remove('hidden');
      this.push(0, 0);
    });
    listen(s, this.stickZone, 'pointermove', (event) => {
      if (event.pointerId !== this.stickId) return;
      this.push(event.clientX - this.stickAt.x, event.clientY - this.stickAt.y);
    });
    const end = (event: PointerEvent) => {
      if (event.pointerId !== this.stickId) return;
      this.stickId = null;
      this.stickBase.classList.add('hidden');
      this.push(0, 0);
    };
    listen(s, this.stickZone, 'pointerup', end);
    listen(s, this.stickZone, 'pointercancel', end);
  }

  /** The stick pushed (dx, dy) px from its centre: the knob follows; the directions held. */
  private push(dx: number, dy: number): void {
    const length = Math.hypot(dx, dy);
    const k = length > STICK_R ? STICK_R / length : 1;
    this.stickKnob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    // Walks as far as it is pushed (the dead zone taken out), runs at its edge.
    const push = Math.min(1, length / STICK_R);
    const speed = push < DEAD ? 0 : (push - DEAD) / (1 - DEAD);
    const input = this.game.input;
    input.stickX = length > 0 ? (dx / length) * speed : 0;
    input.stickY = length > 0 ? (dy / length) * speed : 0;
    this.hold('run', push >= RUN);
  }

  private hold(action: InputAction, on: boolean): void {
    if (on === this.walking.has(action)) return;
    if (on) {
      this.walking.add(action);
      this.game.input.press(action);
    } else {
      this.walking.delete(action);
      this.game.input.release(action);
    }
  }

  /** A drag on the free screen turns the view, as the captured mouse does. */
  private looking(s: Disposables): void {
    listen(s, this.look, 'pointerdown', (event) => {
      if (this.lookId !== null) return;
      event.preventDefault();
      if (this.tapHotbar(event.clientX, event.clientY)) return;
      this.lookId = event.pointerId;
      this.look.setPointerCapture(event.pointerId);
      this.lookAt.x = event.clientX;
      this.lookAt.y = event.clientY;
    });
    listen(s, this.look, 'pointermove', (event) => {
      if (event.pointerId !== this.lookId) return;
      const dx = event.clientX - this.lookAt.x;
      const dy = event.clientY - this.lookAt.y;
      this.lookAt.x = event.clientX;
      this.lookAt.y = event.clientY;
      this.game.input.addLook(dx * LOOK_GAIN, dy * LOOK_GAIN);
    });
    const end = (event: PointerEvent) => {
      if (event.pointerId === this.lookId) this.lookId = null;
    };
    listen(s, this.look, 'pointerup', end);
    listen(s, this.look, 'pointercancel', end);
  }

  /** A tap on a hotbar slot (drawn under these controls, which take the touches) chooses it. */
  private tapHotbar(x: number, y: number): boolean {
    const slots = this.parent.querySelectorAll('.hotbar > *');
    for (let i = 0; i < slots.length; i++) {
      const r = slots[i]?.getBoundingClientRect();
      if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        this.game.inventory.select(i);
        return true;
      }
    }
    return false;
  }

  /** Every finger off: nothing stays held (a panel opened, the game paused, a menu). */
  private letGo(): void {
    this.stickId = null;
    this.lookId = null;
    this.stickBase.classList.add('hidden');
    for (const action of this.walking) this.game.input.release(action);
    this.walking.clear();
    this.game.input.stickX = 0;
    this.game.input.stickY = 0;
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('button.down')) {
      button.classList.remove('down');
      const action = button.dataset.action as InputAction | undefined;
      if (action) this.game.input.release(action);
    }
  }
}
