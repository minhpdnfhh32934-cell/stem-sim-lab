import { Disposables } from '../../core/EventBus';
import type { GameSystem } from '../../core/SystemRunner';
import type { Game } from '../../game/Game';
import type { NpcChoice } from '../../gameplay/npc/NpcSystem';
import { listen } from '../BrowserInput';
import { el, keyLabel } from './dom';
import { Speech } from './speech';
import { formulaNodes } from './formulaHtml';

/** How fast a line is written out (characters per second). */
const CHARS_PER_S = 45;
/** With Auto on: how long (s) a finished line stays before the next. */
const AUTO_HOLD_S = 1.4;

/**
 * A conversation on screen (Phase Y, Phú 2026-11-09, the visual novel's look): a box along the
 * bottom with the speaker's name and their line written out letter by letter — read aloud by the
 * browser's voice — with Auto (go on by itself) and Skip; their choices in a see-through list beside
 * them (the view turns so they stand just left of it, as in the reference), numbered, the ones not
 * built yet shown disabled ("coming soon"), Goodbye last. Click the box, E, Space or Enter: the line
 * whole, then on; 1–9 choose; Esc ends the talk. It only asks the NpcSystem; it changes nothing
 * itself.
 */
export class DialogueView implements GameSystem {
  readonly id = 'dialogue-view';
  private readonly root = el('div', 'dialogue hidden');
  private readonly box = el('section', 'dialogue-box');
  private readonly name = el('div', 'dialogue-name');
  private readonly text = el('p', 'dialogue-text');
  private readonly next = el('div', 'dialogue-next');
  private readonly auto = el('button', 'dialogue-button');
  private readonly skip = el('button', 'dialogue-button');
  private readonly choices = el('ol', 'dialogue-choices hidden');
  private readonly speech = new Speech();
  private readonly subscriptions = new Disposables();
  private open = false;
  /** The line being written out, and how much of it is shown. */
  private line = '';
  private written = 0;
  private autoOn = false;
  private held = 0;
  private reading = false;
  /** The answers shown now (none: the box goes on when clicked). */
  private listed: readonly NpcChoice[] = [];

  constructor(
    private readonly parent: HTMLElement,
    private readonly game: Game,
    private readonly host: HTMLElement,
    private readonly capture: () => Promise<void>,
  ) {}

  /** The conversation is on screen and has the mouse (the pause menu does not pause for it). */
  get shown(): boolean {
    return this.open;
  }

  init(): void {
    const { events } = this.game;
    this.root.setAttribute('role', 'dialog');
    this.box.setAttribute('aria-live', 'polite');
    this.auto.type = 'button';
    this.skip.type = 'button';
    this.auto.setAttribute('aria-pressed', 'false');
    const controls = el('div', 'dialogue-controls');
    controls.append(this.auto, this.skip);
    this.box.append(this.name, this.text, this.next, controls);
    this.root.append(this.choices, this.box);
    this.parent.append(this.root);
    this.box.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('button')) return;
      this.onward();
    });
    this.auto.addEventListener('click', () => {
      this.autoOn = !this.autoOn;
      this.auto.classList.toggle('on', this.autoOn);
      this.auto.setAttribute('aria-pressed', String(this.autoOn));
    });
    this.skip.addEventListener('click', () => this.skipLine());
    const s = this.subscriptions;
    s.add(events.subscribe('ConversationOpened', () => this.opened()));
    s.add(events.subscribe('ConversationChanged', () => this.render(true)));
    s.add(events.subscribe('ConversationClosed', () => this.closed()));
    s.add(
      events.subscribe('LanguageChanged', () => {
        this.words();
        if (this.open) this.render(false);
      }),
    );
    this.words();
    listen(s, document, 'keydown', (event) => this.key(event));
    listen(s, document, 'pointerlockchange', () => {
      if (this.open && document.pointerLockElement === this.host) document.exitPointerLock();
    });
  }

  update(dt: number): void {
    if (!this.open || dt <= 0) return;
    if (this.written < this.line.length) {
      this.written = Math.min(this.line.length, this.written + dt * CHARS_PER_S);
      this.write(Math.floor(this.written));
      this.next.classList.toggle('ready', this.written >= this.line.length);
      return;
    }
    // Auto: on once the line is whole and read aloud, after a moment (not past the choices).
    if (!this.autoOn || this.reading || this.listed.length > 0) return;
    this.held += dt;
    if (this.held >= AUTO_HOLD_S) this.game.npcs.advance();
  }

  dispose(): void {
    this.speech.stop();
    this.subscriptions.dispose();
    this.root.remove();
  }

  /** The line, its first `count` characters written, its formulas as a teacher writes them. */
  private write(count = Infinity): void {
    this.text.replaceChildren(...formulaNodes(this.line, this.game.language, count));
  }

  /** The line whole if it is still being written; else on (the choices, or the end). */
  private onward(): void {
    if (this.written < this.line.length) {
      this.written = this.line.length;
      this.write();
      this.next.classList.add('ready');
      return;
    }
    if (this.listed.length === 0) this.game.npcs.advance();
  }

  /** Skip: past the line at once (its voice cut too). */
  private skipLine(): void {
    this.speech.stop();
    this.reading = false;
    this.written = this.line.length;
    this.write();
    if (this.listed.length === 0) this.game.npcs.advance();
  }

  private key(event: KeyboardEvent): void {
    if (!this.open) return;
    const bindings = this.game.config.input.bindings;
    if (bindings.toggleDebug.includes(event.code)) return;
    // The game's keys wait while a conversation is on screen (no hotbar slot, no walking).
    event.stopPropagation();
    if (event.repeat) return;
    const take = () => event.preventDefault();
    if (event.key === 'Escape') {
      take();
      this.game.npcs.close();
      return;
    }
    const confirm =
      event.code === 'Space' || event.code === 'Enter' || event.code === 'NumpadEnter';
    // Space or Enter on a focused choice: its own click chooses it; keys in a form are the form's.
    const target = event.target as Element | null;
    if (confirm && target?.closest('.dialogue-choice-button')) return;
    if (target?.closest('.test-setup')) return;
    if (confirm || bindings.interact.includes(event.code)) {
      take();
      this.onward();
      return;
    }
    const digit = /^(?:Digit|Numpad)([1-9])$/.exec(event.code)?.[1];
    if (digit && this.listed.length > 0) {
      take();
      this.pick(Number(digit) - 1);
    }
  }

  /** Chooses the n-th answer of the list (0-based), if it can be chosen. */
  private pick(index: number): void {
    const choice = this.listed[index];
    if (choice?.enabled) this.game.npcs.pick(choice.id);
  }

  private opened(): void {
    this.open = true;
    this.root.classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock(); // the choices need the mouse
    this.render(true);
  }

  private closed(): void {
    if (!this.open) return;
    this.open = false;
    this.speech.stop();
    this.reading = false;
    this.listed = [];
    this.root.classList.add('hidden');
    this.capture().catch(() => undefined); // refused: the HUD says to click the scene
  }

  /** The line and the choices as the conversation stands; `fresh`: a new line, written out. */
  private render(fresh: boolean): void {
    const npcs = this.game.npcs;
    const open = npcs.conversation;
    const say = npcs.say;
    if (!open || !say) return;
    this.name.textContent = say.title;
    const text = say.text;
    // The greeting stays as it was written when the choices come up under it.
    const again = open.stage === 'menu';
    if (fresh && !again) {
      this.line = text;
      this.written = 0;
      this.held = 0;
      this.write(0);
      this.next.classList.remove('ready');
      this.read(text);
    } else {
      this.line = text;
      this.written = text.length;
      this.write();
    }
    this.listed = npcs.choices;
    const asking = this.listed.length > 0;
    this.next.classList.toggle('ready', !asking && this.written >= text.length);
    this.next.classList.toggle('hidden', asking);
    this.skip.disabled = asking;
    this.choices.classList.toggle('hidden', !asking);
    if (asking) this.renderChoices(this.listed);
    else this.choices.replaceChildren();
  }

  private renderChoices(choices: readonly NpcChoice[]): void {
    const t = this.game.texts;
    const npcs = this.game.npcs;
    this.choices.replaceChildren(
      ...choices.map((choice, index) => {
        const li = el('li', 'dialogue-choice');
        const button = el('button', 'dialogue-choice-button');
        button.type = 'button';
        button.disabled = !choice.enabled;
        const icon = el('span', 'dialogue-choice-icon');
        icon.setAttribute('aria-hidden', 'true');
        const key = el('kbd', 'dialogue-choice-key', String(index + 1));
        button.append(icon, el('span', 'dialogue-choice-label', choice.label), key);
        if (!choice.enabled) {
          button.append(el('span', 'dialogue-choice-soon', t.ui('npc.soon', 'Coming soon')));
        }
        button.addEventListener('click', () => npcs.pick(choice.id));
        li.append(button);
        return li;
      }),
    );
    this.choices.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
  }

  /** The line read aloud in the game's language, at the teacher's volume. */
  private read(text: string): void {
    const { volumes, muted, language } = this.game;
    const volume = muted ? 0 : (volumes.master / 100) * (volumes.voice / 100);
    this.reading = this.speech.speak(text, language, volume, () => {
      this.reading = false;
    });
  }

  private words(): void {
    const t = this.game.texts;
    this.auto.textContent = t.ui('dialogue.auto', 'Auto');
    this.skip.textContent = t.ui('dialogue.skip', 'Skip');
    this.next.textContent = '▼';
    this.next.setAttribute(
      'aria-label',
      t.ui('dialogue.next', 'Next: click, {key} or Space', {
        key: keyLabel(this.game.config.input.bindings.interact[0], t),
      }),
    );
  }
}
