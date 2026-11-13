import type { Game } from '../../game/Game';
import type { SaveSlot } from '../../persistence/saveSlots';
import type { LanRooms } from '../net/LanRooms';
import { el } from './dom';
import { multiArt, soloArt } from './playArt';
import './playPages.css';

/*
 * The menu's Play (Phú 2026-11-12): one Play button opens a choice of Single player or
 * Multiplayer (`PlayPage`). Single player (`SoloPage`) starts a new game or plays on — the last
 * one, or any game kept in this browser — and deletes games. Multiplayer is `MultiplayerPage`.
 * Redesigned the same day ("professional, complete, gripping"): a full stage over the menu's sky,
 * each mode a card with its own art, what it offers and how it stands now (games kept, rooms open).
 */

export type Show = (element: HTMLElement, text: () => string) => void;

/**
 * A page's head on the stage: Back, a short label above the title (where the page is), the title
 * (focused when the page opens) and a line under it.
 */
export function stageHead(
  game: Game,
  show: Show,
  title: HTMLElement,
  texts: { eyebrow: () => string; title: () => string; lead: () => string },
  back: () => void,
): HTMLElement {
  title.tabIndex = -1;
  show(title, texts.title);
  title.classList.add('stage-title');
  const button = el('button', 'menu-button menu-back stage-back');
  button.type = 'button';
  const label = el('span');
  show(label, () => game.texts.ui('room.back', 'Back'));
  const arrow = el('span', 'stage-back-arrow', '←');
  arrow.setAttribute('aria-hidden', 'true');
  button.append(arrow, label);
  button.addEventListener('click', back);
  const eyebrow = el('p', 'stage-eyebrow');
  show(eyebrow, texts.eyebrow);
  const lead = el('p', 'stage-lead');
  show(lead, texts.lead);
  const words = el('div', 'stage-words');
  words.append(eyebrow, title, lead);
  const row = el('header', 'stage-head');
  row.append(words, button);
  return row;
}

/** When a game was last played, in the interface's language. */
export function playedWhen(game: Game, iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime())
    ? ''
    : at.toLocaleString(game.language, { dateStyle: 'medium', timeStyle: 'short' });
}

/** How long ago, in words ("5 minutes ago"), in the interface's language; '' if unknown. */
export function playedAgo(game: Game, iso: string, now = Date.now()): string {
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return '';
  const s = Math.round((at - now) / 1000);
  const format = new Intl.RelativeTimeFormat(game.language, { numeric: 'auto' });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 30],
    ['month', 12],
  ];
  let value = s;
  for (const [unit, size] of steps) {
    if (Math.abs(value) < size) return format.format(unit === 'second' ? 0 : value, unit);
    value = Math.round(value / size);
  }
  return format.format(value, 'year');
}

/** A small round icon with a glyph (decorative). */
function glyph(cls: string, text: string): HTMLElement {
  const icon = el('span', `stage-glyph ${cls}`, text);
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}

export class PlayPage {
  readonly root = el('section', 'play-page play-stage hidden');
  readonly title = el('h2', 'menu-catalog-title');
  private readonly soloStatus = el('span', 'play-choice-status');
  private readonly multiStatus = el('span', 'play-choice-status');
  private readonly stopListening: () => void;

  constructor(
    private readonly game: Game,
    show: Show,
    private readonly rooms: LanRooms,
    onSolo: () => void,
    onMulti: () => void,
    onBack: () => void,
  ) {
    const t = game.texts;
    this.title.id = 'play-title';
    this.root.setAttribute('aria-labelledby', this.title.id);
    const choices = el('div', 'play-choices');
    const card = (
      cls: string,
      number: string,
      art: SVGSVGElement,
      name: () => string,
      hint: () => string,
      features: (() => string)[],
      status: HTMLElement,
      cta: () => string,
      go: () => void,
    ) => {
      const button = el('button', `play-choice ${cls}`);
      button.type = 'button';
      // The name first: it is what the button is called (read aloud, found by tests).
      const label = el('span', 'play-choice-name');
      show(label, name);
      const sub = el('span', 'play-choice-hint');
      show(sub, hint);
      const scene = el('span', 'play-choice-scene');
      const index = el('span', 'play-choice-index', number);
      index.setAttribute('aria-hidden', 'true');
      scene.append(art, index);
      const list = el('span', 'play-choice-features');
      for (const feature of features) {
        const item = el('span', 'play-choice-feature');
        const text = el('span');
        show(text, feature);
        item.append(glyph('stage-check', '✓'), text);
        list.append(item);
      }
      const go_ = el('span', 'play-choice-cta');
      const ctaText = el('span');
      show(ctaText, cta);
      const arrow = el('span', 'play-choice-arrow', '→');
      arrow.setAttribute('aria-hidden', 'true');
      go_.append(ctaText, arrow);
      const body = el('span', 'play-choice-body');
      const foot = el('span', 'play-choice-foot');
      foot.append(status, go_);
      body.append(label, sub, list, foot);
      button.append(body, scene);
      // The body before the scene in the DOM (the name is read first); the scene drawn on top.
      button.addEventListener('click', go);
      return button;
    };
    const embedded = import.meta.env.VITE_SIMLAB_EMBED === '1';
    choices.append(
      card(
        'solo',
        '01',
        soloArt(),
        () => t.ui('play.solo', 'Single player'),
        () => t.ui('play.soloHint', 'Your own games, kept in this browser.'),
        [
          () => t.ui('play.soloF1', 'Every lab and experiment, at your own pace'),
          () => t.ui('play.soloF2', 'Guided tasks and the teacher in the hub'),
          () => t.ui('play.soloF3', 'Several games kept, saved as you play'),
        ],
        this.soloStatus,
        () => t.ui('play.soloGo', 'Play alone'),
        onSolo,
      ),
      ...(embedded
        ? []
        : [
            card(
              'multi',
              '02',
              multiArt(),
              () => t.ui('play.multi', 'Multiplayer'),
              () =>
                t.ui(
                  'play.multiHint',
                  'Rooms on this network: make one, join one, or play on in a room you played.',
                ),
              [
                () => t.ui('play.multiF1', 'Rooms on your network, found by themselves'),
                () => t.ui('play.multiF2', 'Chat with Enter, talk by holding V'),
                () => t.ui('play.multiF3', 'Experiments done together, each room its own progress'),
              ],
              this.multiStatus,
              () => t.ui('play.multiGo', 'Play together'),
              onMulti,
            ),
          ]),
    );
    this.root.append(
      stageHead(
        game,
        show,
        this.title,
        {
          eyebrow: () => t.ui('play.eyebrow', 'Choose a mode'),
          title: () => t.ui('play.title', 'Play'),
          lead: () =>
            t.ui('play.lead', 'Into the lab alone, or with your class on the same network.'),
        },
        onBack,
      ),
      choices,
    );
    this.stopListening = rooms.onChange(() => {
      if (this.open) this.render();
    });
  }

  get open(): boolean {
    return !this.root.classList.contains('hidden');
  }

  dispose(): void {
    this.stopListening();
  }

  /** How each mode stands now: games kept here, rooms open on the network. */
  render(): void {
    const t = this.game.texts;
    const games = this.game.slots.list('solo').length;
    this.soloStatus.textContent =
      games === 0
        ? t.ui('play.soloNone', 'No saved game yet')
        : t.ui('play.soloCount', '{n} saved', { n: games });
    this.soloStatus.classList.toggle('live', games > 0);
    const { available, lost } = this.rooms;
    const open = this.rooms.rooms.length;
    this.multiStatus.textContent =
      !available || lost
        ? t.ui('play.multiOff', 'Room server not running')
        : open === 0
          ? t.ui('play.multiNone', 'Searching the network…')
          : t.ui('play.multiCount', '{n} open now', { n: open });
    this.multiStatus.classList.toggle('live', available && !lost);
  }
}

export class SoloPage {
  readonly root = el('section', 'solo-page play-stage hidden');
  readonly title = el('h2', 'menu-catalog-title');
  private readonly newGame = el('button', 'menu-button primary solo-new-button');
  private readonly playOn = el('button', 'menu-button primary solo-continue-button');
  private readonly hero = el('div', 'solo-hero');
  private readonly heroName = el('p', 'solo-hero-name');
  private readonly heroMeta = el('div', 'solo-hero-meta');
  private readonly list = el('ul', 'play-list');
  private readonly count = el('span', 'stage-count');
  /** The game whose Delete asks to be sure. */
  private confirming: string | null = null;

  constructor(
    private readonly game: Game,
    show: Show,
    /** Plays in a game: a new one (null) or a kept one. */
    private readonly onPlay: (slot: SaveSlot | null) => void,
    onBack: () => void,
  ) {
    const t = game.texts;
    this.title.id = 'solo-title';
    this.root.setAttribute('aria-labelledby', this.title.id);
    show(this.newGame, () => t.ui('solo.new', 'New game'));
    show(this.playOn, () => t.ui('solo.continue', 'Continue'));
    this.newGame.addEventListener('click', () => this.onPlay(null));
    this.playOn.addEventListener('click', () => {
      const last = this.game.slots.list('solo')[0];
      if (last) this.onPlay(last);
    });

    // Continue: the last game, large, with where it was left.
    const heroLabel = el('p', 'solo-kicker');
    show(heroLabel, () => t.ui('solo.lastGame', 'Your last game'));
    const heroArt = el('div', 'solo-hero-art');
    heroArt.append(soloArt());
    const heroWords = el('div', 'solo-hero-words');
    heroWords.append(heroLabel, this.heroName, this.heroMeta, this.playOn);
    this.hero.append(heroArt, heroWords);

    // New game: from the preparation room.
    const fresh = el('div', 'solo-fresh');
    const plus = glyph('solo-plus', '+');
    const freshTitle = el('p', 'solo-fresh-title');
    show(freshTitle, () => t.ui('solo.freshTitle', 'A new game'));
    const freshText = el('p', 'solo-fresh-text');
    show(freshText, () =>
      t.ui(
        'solo.freshText',
        'From the preparation room: dress for the cleanroom, then into the labs. The games you have stay as they are.',
      ),
    );
    fresh.append(plus, freshTitle, freshText, this.newGame);

    const top = el('div', 'solo-top');
    top.append(this.hero, fresh);

    const listTitle = el('h3', 'stage-section-title');
    const listWords = el('span');
    show(listWords, () => t.ui('solo.saved', 'Saved games'));
    listTitle.append(listWords, this.count);
    this.root.append(
      stageHead(
        game,
        show,
        this.title,
        {
          eyebrow: () => t.ui('play.title', 'Play'),
          title: () => t.ui('solo.title', 'Single player'),
          lead: () => t.ui('solo.lead', 'Your own lab: play on where you left, or begin again.'),
        },
        onBack,
      ),
      top,
      listTitle,
      this.list,
    );
  }

  get open(): boolean {
    return !this.root.classList.contains('hidden');
  }

  /** Draws the kept games again (on open, after a delete, in a new language). */
  render(): void {
    const t = this.game.texts;
    const games = this.game.slots.list('solo');
    const last = games[0];
    this.playOn.disabled = !last;
    this.hero.classList.toggle('empty', !last);
    this.count.textContent = String(games.length);
    this.heroMeta.replaceChildren();
    if (last) {
      this.heroName.textContent = t.ui('solo.name', 'Game {n}', { n: last.n });
      this.heroMeta.append(...this.facts(last));
    } else {
      this.heroName.textContent = t.ui('solo.noLast', 'No game to play on yet');
      this.heroMeta.append(
        el('span', 'solo-fact', t.ui('solo.noLastHint', 'Start a new game: it is kept here.')),
      );
    }

    this.list.replaceChildren();
    games.forEach((slot, i) => this.list.append(this.row(slot, i === 0)));
    if (games.length === 0) {
      const empty = el('li', 'play-empty-card');
      empty.append(el('p', 'play-empty', t.ui('solo.none', 'No saved game yet.')));
      this.list.append(empty);
    }
  }

  /** Buttons off while a game is being entered. */
  busy(on: boolean): void {
    for (const b of this.root.querySelectorAll('button')) b.disabled = on;
    if (!on) this.render();
  }

  /** Where a game was left, as whom, how far, when: from its save, never guessed. */
  private facts(slot: SaveSlot): HTMLElement[] {
    const t = this.game.texts;
    const summary = this.game.slotSummary(slot.id);
    const fact = (icon: string, text: string) => {
      const span = el('span', 'solo-fact');
      span.append(glyph('solo-fact-icon', icon), el('span', undefined, text));
      return span;
    };
    const facts: HTMLElement[] = [];
    if (summary?.scene) facts.push(fact('◎', summary.scene));
    if (summary) {
      facts.push(
        fact('✓', t.ui('solo.completed', '{n} experiments completed', { n: summary.completed })),
      );
    }
    if (summary?.character) facts.push(fact('☺', summary.character));
    const ago = playedAgo(this.game, slot.playedAt);
    if (ago) {
      const when = fact('◷', ago);
      when.title = t.ui('solo.played', 'Last played {when}', {
        when: playedWhen(this.game, slot.playedAt),
      });
      facts.push(when);
    }
    return facts;
  }

  private row(slot: SaveSlot, latest: boolean): HTMLElement {
    const t = this.game.texts;
    const name = t.ui('solo.name', 'Game {n}', { n: slot.n });
    const item = el('li', `play-row${latest ? ' latest' : ''}`);
    const badge = el('span', 'play-row-badge', String(slot.n));
    badge.setAttribute('aria-hidden', 'true');
    const text = el('div', 'play-row-text');
    const nameRow = el('span', 'play-row-name', name);
    if (latest) nameRow.append(el('span', 'play-row-tag', t.ui('solo.latest', 'Latest')));
    text.append(
      nameRow,
      el(
        'span',
        'play-row-info',
        t.ui('solo.played', 'Last played {when}', { when: playedWhen(this.game, slot.playedAt) }),
      ),
    );
    const facts = el('div', 'play-row-facts');
    facts.append(...this.facts(slot).slice(0, 2));
    const head = el('div', 'play-row-head');
    head.append(badge, text);
    item.append(head, facts);
    const actions = el('div', 'play-row-actions');
    if (this.confirming === slot.id) {
      item.classList.add('confirming');
      const sure = el('button', 'menu-button danger play-small', t.ui('solo.delete', 'Delete'));
      const no = el('button', 'menu-button play-small', t.ui('solo.cancel', 'Cancel'));
      sure.addEventListener('click', () => {
        this.game.slots.remove(slot.id);
        this.confirming = null;
        this.render();
        this.newGame.focus();
      });
      no.addEventListener('click', () => {
        this.confirming = null;
        this.render();
      });
      item.append(
        el(
          'p',
          'play-row-warn',
          t.ui('solo.confirm', 'Delete “{name}”? This cannot be undone.', { name }),
        ),
      );
      actions.append(sure, no);
      item.append(actions);
      queueMicrotask(() => sure.focus());
      return item;
    }
    const play = el('button', 'menu-button primary play-small', t.ui('solo.play', 'Play'));
    const remove = el(
      'button',
      'menu-button play-small play-remove',
      t.ui('solo.delete', 'Delete'),
    );
    play.setAttribute('aria-label', `${t.ui('solo.play', 'Play')} ${name}`);
    remove.setAttribute('aria-label', `${t.ui('solo.delete', 'Delete')} ${name}`);
    play.addEventListener('click', () => this.onPlay(slot));
    remove.addEventListener('click', () => {
      this.confirming = slot.id;
      this.render();
    });
    actions.append(play, remove);
    item.append(actions);
    return item;
  }
}
