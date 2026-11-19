import { Disposables } from '../../../core/EventBus';
import type { Game } from '../../../game/Game';
import {
  type CharacterDefinition,
  CharacterDefinitionSchema,
  CUSTOM_ID,
} from '../../../gameplay/character';
import { listen } from '../../BrowserInput';
import { QUALITY } from '../../render/quality';
import { el } from '../dom';
import type { CharacterStage } from './CharacterStage';
import { Customiser } from './Customiser';

/*
 * The character page (Phase C-2; C-9 the group in view): slides up over the menu, the common room
 * filling it with everyone in their places. "<" and ">" (← →, or a click on a person) choose left
 * to right; their name, role and personality on a card, Choose below. The last place is the
 * player's own character: a black silhouette until they make one, whose button opens the
 * customiser (Edit, once made). Its 3D stage is a lazy chunk of its own (contract D5), made ahead
 * once the player is at the menu, in idle time, a person at a time; kept unseen while the menu
 * shows, its canvas in the page and drawn only while the page is open; freed when the menu goes
 * (Phú, 2026-11-14: made on opening, the page waited ~2 s on an empty room). Keys: ← → change,
 * Enter chooses, Esc goes back.
 */

type Show = (element: HTMLElement, text: () => string) => HTMLElement;

/** The player's place before they make a character: drawn in black, never chosen as such. */
const SILHOUETTE: CharacterDefinition = CharacterDefinitionSchema.parse({
  id: CUSTOM_ID,
  displayName: '?',
  gender: 'unspecified',
  appearance: { heightM: 1.72, skinTone: '#000000', hairColor: '#000000', hair: 'sidePart' },
  outfit: { default: 'lab-coat' },
  profile: { pose: 'wave', seat: 99, coat: false },
});

/** Where the customiser starts the first time: an average build in plain clothes. */
const STARTER: CharacterDefinition = CharacterDefinitionSchema.parse({
  id: CUSTOM_ID,
  displayName: '?',
  gender: 'unspecified',
  appearance: { heightM: 1.7, skinTone: '#f1c9a8', hairColor: '#1b1a1f', hair: 'short' },
  outfit: { default: 'lab-coat' },
  profile: { pose: 'wave', seat: 99, coat: true },
});
STARTER.displayName = ''; // the name box starts empty

export class CharacterPage {
  readonly root = el('section', 'char-page hidden');
  private readonly stageHost = el('div', 'char-stage');
  private readonly name = el('h3', 'char-name');
  private readonly role = el('p', 'char-role');
  private readonly trait = el('p', 'char-trait');
  private readonly count = el('p', 'char-count');
  private readonly choose = el('button', 'menu-button primary char-choose');
  private readonly edit = el('button', 'menu-button char-edit');
  private readonly prev = el('button', 'char-arrow prev', '‹');
  private readonly next = el('button', 'char-arrow next', '›');
  private readonly customiser: Customiser;
  private stage: CharacterStage | null = null;
  /** The stage: none, being made (its chunk, its people), or made; the quality it was made at. */
  private state: 'none' | 'making' | 'made' = 'none';
  private madeAt = '';
  private opening = 0;
  private readonly subscriptions = new Disposables();
  /** Who the card shows (the stage's chosen, or the opening one before it is made). */
  private shown = '';
  isOpen = false;

  constructor(
    private readonly game: Game,
    show: Show,
    /** Called with the character chosen (Choose), or nothing (Back). */
    private readonly onClose: (chosen: string | null) => void,
  ) {
    const t = game.texts;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    const title = show(el('h2', 'char-title'), () =>
      t.ui('menu.chooseCharacter', 'Choose your character'),
    );
    this.root.setAttribute('aria-labelledby', (title.id = 'char-title'));
    const back = show(el('button', 'menu-button char-back'), () => t.ui('character.back', 'Back'));
    back.addEventListener('click', () => this.close(null));
    const { prev, next } = this;
    prev.addEventListener('click', () => this.step(-1));
    next.addEventListener('click', () => this.step(1));
    show(this.choose, () =>
      this.made() || this.shown !== CUSTOM_ID
        ? t.ui('character.choose', 'Choose')
        : t.ui('character.create', 'Create'),
    );
    this.choose.addEventListener('click', () => {
      if (this.current() === CUSTOM_ID && !this.made()) this.customise();
      else this.close(this.current());
    });
    show(this.edit, () => t.ui('character.edit', 'Edit'));
    this.edit.addEventListener('click', () => this.customise());
    // A click on someone in the room chooses them.
    this.stageHost.addEventListener('click', (event) => {
      const id = this.stage?.pick(event.clientX, event.clientY);
      if (!id || !this.stage) return;
      this.stage.select(id);
      this.shown = id;
      this.refreshCard();
    });
    const card = el('div', 'char-card');
    card.setAttribute('aria-live', 'polite');
    card.append(this.name, this.role, this.trait, this.count);
    const head = el('div', 'char-head');
    head.append(back, title);
    this.customiser = new Customiser(game, (made) => {
      if (made) this.reopen(CUSTOM_ID);
      this.choose.focus();
    });
    this.root.append(
      this.stageHost,
      head,
      prev,
      next,
      card,
      this.choose,
      this.edit,
      this.customiser.root,
    );
    for (const element of [this.name, this.role, this.trait, this.count]) {
      show(element, () => this.cardText(element));
    }
    listen(this.subscriptions, this.root, 'keydown', (event) => {
      if (!this.isOpen || this.customiser.isOpen) return;
      if (event.key === 'ArrowRight') this.step(1);
      else if (event.key === 'ArrowLeft') this.step(-1);
      else if (event.key === 'Escape') this.close(null);
      else return;
      event.preventDefault();
    });
  }

  /** Everyone in the room by place, left to right: the cast, then the player's own (or its place). */
  private people(): CharacterDefinition[] {
    const characters = this.game.content.characters;
    const cast = characters
      .all()
      .filter((c) => c.id !== CUSTOM_ID)
      .sort((a, b) => a.profile.seat - b.profile.seat);
    return [...cast, characters.tryGet(CUSTOM_ID) ?? SILHOUETTE];
  }

  /** Whether the player has made their own character. */
  private made(): boolean {
    return this.game.content.characters.has(CUSTOM_ID);
  }

  /** The stage made ahead, in idle time (the player at the menu): opening then shows it at once. */
  prepare(current: string): void {
    if (this.state === 'none' && !this.isOpen) this.makeStage(current);
  }

  /** The menu goes (into the world): the stage is freed. */
  release(): void {
    if (this.isOpen) return;
    this.opening++;
    this.stage?.dispose();
    this.stage = null;
    this.state = 'none';
  }

  /** Slides in with `current` chosen; the stage shows when it is made (at once if made ahead). */
  open(current: string): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.shown = current;
    this.refreshCard();
    this.root.classList.remove('hidden');
    // Next frame: the slide starts from below.
    requestAnimationFrame(() => this.root.classList.add('open'));
    this.choose.focus();
    if (this.state !== 'none' && this.madeAt !== this.game.graphicsQuality) this.reopen(current);
    else if (this.state === 'none') this.makeStage(current);
    else if (this.state === 'made') this.reveal();
  }

  private makeStage(current: string): void {
    const ticket = ++this.opening;
    this.state = 'making';
    this.madeAt = this.game.graphicsQuality;
    void import('./CharacterStage').then(async ({ CharacterStage: Stage }) => {
      if (ticket !== this.opening) return;
      const quality = QUALITY[this.game.graphicsQuality];
      const stage = new Stage(
        this.stageHost,
        this.people(),
        current,
        quality,
        !this.made(),
        () => this.game.frameCap,
        (message) => this.game.log.warn(message),
      );
      this.stage = stage;
      // The player waiting: a person a frame; else in idle time, after the app's opening.
      const next = () => (this.isOpen ? nextFrame() : idle());
      if (!(await stage.build(next, () => !this.isOpen)) || ticket !== this.opening) return;
      this.state = 'made';
      if (this.isOpen) this.reveal();
    });
  }

  /** The stage on screen, on whoever the card shows. */
  private reveal(): void {
    if (!this.stage) return;
    this.stage.select(this.shown);
    this.stage.show();
    this.root.dataset.ready = 'true';
  }

  /** The room again, with the player's own character as just made, `current` chosen. */
  private reopen(current: string): void {
    this.stage?.dispose();
    this.stage = null;
    this.state = 'none';
    delete this.root.dataset.ready;
    this.shown = current;
    this.refreshCard();
    this.makeStage(current);
  }

  private customise(): void {
    const start = this.game.content.characters.tryGet(CUSTOM_ID) ?? STARTER;
    this.customiser.open({
      ...start,
      profile: { ...start.profile, seat: this.people().length - 1 },
    });
  }

  private step(direction: 1 | -1): void {
    const order = this.people().map((c) => c.id);
    const next = this.stage
      ? this.stage.step(direction)
      : (order[(order.indexOf(this.shown) + direction + order.length) % order.length] ??
        this.shown);
    this.shown = next;
    this.refreshCard();
  }

  private current(): string {
    return this.stage?.chosen ?? this.shown;
  }

  private close(chosen: string | null): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.classList.remove('open');
    delete this.root.dataset.ready;
    // Kept (made ahead for the next opening), not drawn once it has slid away.
    window.setTimeout(() => {
      if (this.isOpen) return;
      this.stage?.hide();
      this.root.classList.add('hidden');
    }, 350);
    this.onClose(chosen);
  }

  private cardText(element: HTMLElement): string {
    const t = this.game.texts;
    const people = this.people();
    const c = people.find((x) => x.id === this.shown) ?? people[0];
    if (!c) return '';
    const own = c.id === CUSTOM_ID;
    const made = own && this.made();
    if (element === this.name) {
      if (own && !made) return t.ui('character.newName', 'Your own character');
      return t.of(c, 'displayName');
    }
    if (element === this.role) {
      if (made) return t.ui('character.ownRole', 'Your own character');
      if (own) return t.ui('character.newRole', 'Not made yet');
      return t.of(c, 'role');
    }
    if (element === this.trait) {
      if (made) return t.ui('character.ownTrait', 'Made by you. Edit changes anything.');
      if (own) {
        return t.ui(
          'character.newTrait',
          'Make them as you like: face, eyes, hair, clothes, height and build.',
        );
      }
      return t.of(c, 'trait');
    }
    // The arrows' names, in the language of the rest (the count is redrawn with them).
    this.prev.setAttribute('aria-label', t.ui('character.previous', 'Previous character'));
    this.next.setAttribute('aria-label', t.ui('character.next', 'Next character'));
    return t.ui('character.count', '{n} of {total}', {
      n: people.indexOf(c) + 1,
      total: people.length,
    });
  }

  private refreshCard(): void {
    const t = this.game.texts;
    this.root.dataset.chosen = this.shown;
    for (const element of [this.name, this.role, this.trait, this.count]) {
      element.textContent = this.cardText(element);
    }
    const own = this.shown === CUSTOM_ID;
    this.choose.textContent =
      own && !this.made() ? t.ui('character.create', 'Create') : t.ui('character.choose', 'Choose');
    this.edit.classList.toggle('hidden', !(own && this.made()));
  }

  dispose(): void {
    this.opening++;
    this.subscriptions.dispose();
    this.customiser.dispose();
    this.stage?.dispose();
    this.stage = null;
  }
}

const nextFrame = () => new Promise<void>((done) => requestAnimationFrame(() => done()));

/**
 * When the page is idle and the app's opening has gone (its ball's flight is drawn on this thread:
 * a person built under it would stutter it).
 */
function idle(): Promise<void> {
  return new Promise((done) => {
    const wait = () => {
      if (document.querySelector('.app-intro')) window.setTimeout(wait, 250);
      else if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(() => done(), { timeout: 1000 });
      } else window.setTimeout(done, 50);
    };
    wait();
  });
}
