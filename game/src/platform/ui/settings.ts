import { Disposables } from '../../core/EventBus';
import { LANGUAGE_NAMES, LANGUAGES } from '../../core/i18n';
import type { GameSystem } from '../../core/SystemRunner';
import type { Game } from '../../game/Game';
import {
  FRAME_CAPS,
  GRAPHICS_QUALITIES,
  type GraphicsQuality,
  MENU_BACKGROUNDS,
  highOrMore,
} from '../../persistence/settings';
import {
  checkUltra,
  type Experience,
  experienceOf,
  type MachineFacts,
  readMachine,
  ULTRA_MINIMUM,
  type UltraCheck,
} from '../ultraCheck';
import { setHintDot } from './hintDot';
import { el } from './dom';
import './settingsPage.css';

/** A labelled radio button in the menus' style. */
export function radio(
  name: string,
  value: string,
  checked: boolean,
  text: HTMLElement,
  onChange: () => void,
): HTMLLabelElement {
  const label = el('label', 'menu-option');
  const input = el('input');
  input.type = 'radio';
  input.name = name;
  input.value = value;
  input.checked = checked;
  input.addEventListener('change', onChange);
  label.append(input, text);
  return label;
}

/** A choice drawn as a game's selector, ‹ the chosen one › (its radios kept, one in view). */
interface Selector {
  readonly box: HTMLElement;
  readonly track: HTMLElement;
  readonly inputs: readonly HTMLInputElement[];
  readonly prev: HTMLButtonElement;
  readonly next: HTMLButtonElement;
  /** The choice and the width last scrolled to (-1: again at the next frame). */
  shown: number;
  width: number;
}

/**
 * The settings — the interface language, the frame-rate cap, the graphics quality (and the sound,
 * added with its engine: `addSection`) — as one element, shared by every place that offers them
 * (the main menu, the pause menu): each mounts it where it shows it, so there is one implementation
 * and one state, never two copies to keep in step. Changes apply at once.
 *
 * Laid out as a game's settings (Phú 2026-11-12): the sections listed on the left, the chosen one
 * on the right as rows (the name, then its control), a choice as ‹ value ›, and under the rows the
 * description of the row pointed at.
 */
export class SettingsPanel implements GameSystem {
  readonly id = 'settings';
  readonly root = el('div', 'menu-settings-fields settings-shell');
  private readonly tabs = el('nav', 'settings-tabs');
  private readonly heading = el('h3', 'settings-heading');
  private readonly panes = el('div', 'settings-panes');
  private readonly describe = el('p', 'settings-describe');
  /** The section shown (the first until another is chosen). */
  private active: Element | null = null;
  private readonly selectors: Selector[] = [];
  /** The tabs (built again only when the sections or their names change, not on a switch). */
  private tabButtons: { section: Element; tab: HTMLButtonElement }[] = [];
  /** The highlight that slides to the chosen tab (one element, so its moves are animated). */
  private readonly indicator = el('span', 'settings-tab-indicator');
  private placed = false;
  private readonly still = matchMedia('(prefers-reduced-motion: reduce)');
  /** A selector shown, or of a new width: scrolled to its choice at once. */
  private readonly resized = new ResizeObserver(() => this.follow(false));
  private readonly languages = el('fieldset', 'menu-choice settings-language');
  private readonly legend = el('legend');
  /** The frame-rate cap: one choice per step (2026-11-12: a row like the preset's, not a list). */
  private readonly frameCap = el('fieldset', 'menu-choice settings-fps');
  private readonly frameCapLegend = el('legend');
  private readonly frameCapNone = el('span');
  private readonly frameCapHelp = el('p', 'menu-help');
  private readonly quality = el('fieldset', 'menu-choice settings-quality');
  private readonly qualityLegend = el('legend');
  private readonly qualityNames = GRAPHICS_QUALITIES.map(() => el('span', 'settings-tile-name'));
  /** What each preset gives, one line in its tile (2026-11-12: in place of one long paragraph). */
  private readonly qualityHints = GRAPHICS_QUALITIES.map(() => el('span', 'settings-tile-hint'));
  private readonly qualityHelp = el('p', 'menu-help');
  /** The main menu's background (Phú 2026-11-18): the game's own, or the live wallpaper. */
  private readonly menuBackground = el('fieldset', 'menu-choice settings-menu-background');
  private readonly menuBackgroundLegend = el('legend');
  private readonly menuBackgroundNames = MENU_BACKGROUNDS.map(() => el('span'));
  private readonly menuBackgroundHelp = el('p', 'menu-help');
  /** The red dot on the menu background's row, shown once the player follows the dots here. */
  private hintRow = false;
  /** Ultra's consent (Phase G, contract §3): shown before Ultra is turned on, never after. */
  private readonly ultra = el('div', 'menu-dialog-backdrop hidden');
  private readonly ultraBox = el('div', 'menu-dialog');
  private readonly ultraTitle = el('h2', 'menu-dialog-title');
  private readonly ultraIntro = el('p', 'menu-help');
  private readonly ultraNotes = el('ul', 'menu-dialog-notes');
  private readonly ultraOn = el('button', 'menu-button primary');
  private readonly ultraCancel = el('button', 'menu-button');
  /** Ultra's minimum against this computer (Phú 2026-11-16): a table as a game's specs page. */
  private readonly ultraSpecs = el('table', 'ultra-specs');
  /** The experience expected here: one solid badge (good, playable, not advised). */
  private readonly ultraExpect = el('div', 'ultra-expect');
  /** The second warning, when this computer is below the minimum. */
  private readonly warn = el('div', 'menu-dialog-backdrop hidden');
  private readonly warnBox = el('div', 'menu-dialog ultra-dialog');
  private readonly warnTitle = el('h2', 'menu-dialog-title ultra-bar warn');
  private readonly warnBody = el('p', 'menu-help');
  private readonly warnMissing = el('ul', 'menu-dialog-notes');
  private readonly warnOn = el('button', 'menu-button');
  private readonly warnKeep = el('button', 'menu-button primary');
  /** Ultra measured while playing here: shown under the presets while Ultra is on. */
  private readonly ultraNow = el('p', 'ultra-now');
  private ultraNowAt = 0;
  /** The level the dialog asks about: Ultra or Max (Max takes the same dialog, its own words). */
  private asking: 'high' | 'ultra' = 'high';
  /** The dialog open now (its buttons, the first focused; Escape closes it), or null. */
  private dialog: { buttons: HTMLButtonElement[]; close: () => void } | null = null;
  private readonly ultraKeys = (e: KeyboardEvent) => {
    const open = this.dialog;
    if (!open || (e.key !== 'Escape' && e.key !== 'Tab')) return;
    e.stopImmediatePropagation(); // the menu behind does not see it
    e.preventDefault();
    if (e.key === 'Escape') {
      open.close();
      return;
    }
    // Focus stays in the dialog: Tab goes round its buttons.
    const at = open.buttons.indexOf(document.activeElement as HTMLButtonElement);
    open.buttons[(at + 1) % open.buttons.length]?.focus();
  };
  private readonly roomSleep = el('div', 'menu-field');
  /** The frame cap, the preset and the rooms out of sight: one card, as all three are the load. */
  private readonly graphics = el('section', 'settings-card');
  private readonly graphicsTitle = el('h3', 'settings-card-title');
  private readonly roomSleepBox = el('input');
  private readonly roomSleepName = el('span');
  private readonly roomSleepHelp = el('p', 'menu-help');
  private readonly subscriptions = new Disposables();

  constructor(private readonly game: Game) {}

  init(): void {
    // Each card's mark in the Play pages' style (settingsPage.css draws it from data-icon).
    this.legend.dataset.icon = 'Aa';
    // Each section's id (its tab carries it: tests and links find a section by it).
    this.languages.dataset.section = 'general';
    this.graphics.dataset.section = 'graphics';
    this.graphicsTitle.dataset.icon = '◐';
    this.languages.append(this.legend);
    // Each language is named in itself, so a player finds theirs whatever language is shown.
    for (const language of LANGUAGES) {
      const name = el('span', undefined, LANGUAGE_NAMES[language]);
      name.lang = language;
      this.languages.append(
        radio('language', language, language === this.game.language, name, () =>
          this.game.setLanguage(language),
        ),
      );
    }
    // The frame-rate cap: a choice per step; it applies from the next frame.
    this.frameCapHelp.id = 'settings-frame-cap-help';
    this.frameCap.setAttribute('aria-describedby', this.frameCapHelp.id);
    this.frameCap.append(this.frameCapLegend);
    for (const cap of FRAME_CAPS) {
      // A number with its unit ("30 FPS"), or "No limit" (in the interface's language).
      const name = el('span', 'settings-fps-name');
      if (cap === 0) name.append(this.frameCapNone);
      else name.append(String(cap), ' ', el('small', undefined, 'FPS'));
      this.frameCap.append(
        radio('frame-cap', String(cap), cap === this.game.frameCap, name, () =>
          this.game.setFrameCap(cap),
        ),
      );
    }
    this.frameCap.append(this.frameCapHelp);
    // Graphics quality: three presets, next to the frame-rate cap (both trade looks for load).
    this.qualityHelp.id = 'settings-quality-help';
    this.quality.setAttribute('aria-describedby', this.qualityHelp.id);
    this.quality.append(this.qualityLegend);
    GRAPHICS_QUALITIES.forEach((quality, i) => {
      const tile = el('span', 'settings-tile');
      const hint = this.qualityHints[i] ?? el('span');
      // The hint is shown, not part of the choice's name (read as its description instead).
      hint.id = `settings-quality-hint-${quality}`;
      hint.setAttribute('aria-hidden', 'true');
      tile.append(this.qualityNames[i] ?? el('span'), hint);
      const name = tile;
      this.quality.append(
        radio('graphics-quality', quality, quality === this.game.graphicsQuality, name, () =>
          quality === 'high' || quality === 'ultra'
            ? this.askUltra(quality)
            : this.game.setGraphicsQuality(quality),
        ),
      );
      this.quality.lastElementChild
        ?.querySelector('input')
        ?.setAttribute('aria-describedby', hint.id);
    });
    // The measured line last: a row of its own under the name and the selector.
    this.quality.append(this.qualityHelp, this.ultraNow);
    // The menu's background: the live one costs the graphics card, so it sits with the load's
    // settings, and is not offered at Low.
    this.menuBackgroundHelp.id = 'settings-menu-background-help';
    this.menuBackground.setAttribute('aria-describedby', this.menuBackgroundHelp.id);
    this.menuBackground.append(this.menuBackgroundLegend);
    MENU_BACKGROUNDS.forEach((background, i) => {
      this.menuBackground.append(
        radio(
          'menu-background',
          background,
          background === this.game.menuBackground,
          this.menuBackgroundNames[i] ?? el('span'),
          () => {
            this.hintRow = false;
            this.game.setMenuBackground(background);
            this.paintHints();
          },
        ),
      );
    });
    this.menuBackground.append(this.menuBackgroundHelp);
    this.menuBackground.hidden = this.game.graphicsQuality === 'low';
    // Rooms out of sight (world/dormancy.ts): a switch under the preset, as both lighten the load.
    const row = el('label', 'menu-option');
    this.roomSleepBox.type = 'checkbox';
    this.roomSleepBox.id = 'settings-room-sleep';
    this.roomSleepHelp.id = 'settings-room-sleep-help';
    this.roomSleepBox.setAttribute('aria-describedby', this.roomSleepHelp.id);
    this.roomSleepBox.checked = this.game.roomSleep;
    this.roomSleepBox.addEventListener('change', () =>
      this.game.setRoomSleep(this.roomSleepBox.checked),
    );
    row.append(this.roomSleepBox, this.roomSleepName);
    this.roomSleep.append(row, this.roomSleepHelp);
    this.graphics.append(
      this.graphicsTitle,
      this.quality,
      this.frameCap,
      this.menuBackground,
      this.roomSleep,
    );
    for (const group of [this.languages, this.quality, this.frameCap, this.menuBackground]) {
      this.selector(group);
    }
    this.panes.append(this.languages, this.graphics);
    const main = el('div', 'settings-main');
    this.describe.setAttribute('aria-hidden', 'true'); // each control has its own description
    main.append(this.heading, this.panes, this.describe);
    this.root.append(this.tabs, main);
    // The row pointed at, or focused, is described under the rows.
    const describe = (event: Event) => {
      if (event.target instanceof Element) this.describeRow(event.target);
    };
    this.panes.addEventListener('pointerover', describe);
    this.panes.addEventListener('focusin', describe);
    this.panes.addEventListener('change', describe);
    this.showTabs();
    const follow = () => this.place();
    window.addEventListener('resize', follow);
    this.subscriptions.add(() => window.removeEventListener('resize', follow));
    this.ultra.setAttribute('role', 'presentation');
    this.ultraBox.setAttribute('role', 'dialog');
    this.ultraBox.setAttribute('aria-modal', 'true');
    this.ultraTitle.id = 'settings-ultra-title';
    this.ultraBox.setAttribute('aria-labelledby', this.ultraTitle.id);
    this.ultraOn.type = 'button';
    this.ultraCancel.type = 'button';
    this.ultraBox.classList.add('ultra-dialog');
    this.ultraTitle.classList.add('ultra-bar');
    this.ultraOn.addEventListener('click', () => {
      this.closeUltra();
      // Below the minimum: asked a second time, with what that means for playing here.
      if (this.check().expected === 'good') this.game.setGraphicsQuality(this.asking);
      else this.askAgain();
    });
    this.ultraCancel.addEventListener('click', () => this.closeUltra());
    const actions = el('div', 'menu-dialog-actions');
    actions.append(this.ultraCancel, this.ultraOn);
    this.ultraBox.append(
      this.ultraTitle,
      this.ultraIntro,
      this.ultraSpecs,
      this.ultraExpect,
      this.ultraNotes,
      actions,
    );
    this.ultra.append(this.ultraBox);
    this.warn.setAttribute('role', 'presentation');
    this.warnBox.setAttribute('role', 'alertdialog');
    this.warnBox.setAttribute('aria-modal', 'true');
    this.warnTitle.id = 'settings-ultra-warn-title';
    this.warnBox.setAttribute('aria-labelledby', this.warnTitle.id);
    this.warnOn.type = 'button';
    this.warnKeep.type = 'button';
    this.warnOn.addEventListener('click', () => {
      this.closeWarn();
      this.game.setGraphicsQuality(this.asking);
    });
    this.warnKeep.addEventListener('click', () => this.closeWarn());
    const warnActions = el('div', 'menu-dialog-actions');
    warnActions.append(this.warnOn, this.warnKeep);
    this.warnBox.append(this.warnTitle, this.warnMissing, this.warnBody, warnActions);
    this.warn.append(this.warnBox);
    document.body.append(this.ultra, this.warn);
    this.render();
    this.subscriptions.add(
      this.game.events.subscribe('LanguageChanged', () => {
        this.render();
        // After every section has written its words in the new language.
        queueMicrotask(() => this.showTabs());
      }),
    );
    // The dots follow the background chosen anywhere, and their being seen.
    this.subscriptions.add(
      this.game.events.subscribe('MenuBackgroundChanged', () => this.paintHints()),
    );
    this.subscriptions.add(this.game.events.subscribe('LiveHintSeen', () => this.paintHints()));
    // The preset can change without a click (a default suggested for this machine): follow it.
    this.subscriptions.add(
      this.game.events.subscribe('GraphicsQualityChanged', ({ quality }) => {
        for (const input of this.quality.querySelectorAll('input')) {
          input.checked = input.value === quality;
        }
        this.menuBackground.hidden = quality === 'low';
        this.paintHints();
        this.follow(false);
        this.showUltraNow();
      }),
    );
  }

  /** Ultra's measured experience, written again once a second while the settings are shown. */
  update(dt: number): void {
    this.ultraNowAt -= dt;
    if (this.ultraNowAt > 0 || !this.root.isConnected) return;
    this.ultraNowAt = 1;
    this.showUltraNow();
  }

  /** A section of settings that arrives later (the sound, with its engine), after the others. */
  addSection(section: HTMLElement): void {
    this.panes.append(section);
    this.showTabs();
  }

  /** Each selector scrolled to its choice when the choice or its width changed (no layout else). */
  /**
   * Each selector scrolled to its choice: sliding when the player chose (`slide`), at once when
   * it was set for them or its size changed. Only on those events, never per frame (a layout read
   * every frame cost the game long frames).
   */
  private follow(slide: boolean): void {
    for (const s of this.selectors) {
      let index = 0;
      for (let i = 0; i < s.inputs.length; i++) if (s.inputs[i]?.checked) index = i;
      const width = s.track.clientWidth;
      if (width === 0) continue; // not shown: followed again when it is (its size changes)
      const moved = index !== s.shown;
      const smooth = slide && moved && s.shown !== -1 && !this.still.matches;
      s.shown = index;
      s.width = width;
      s.track.scrollTo({ left: index * width, behavior: smooth ? 'smooth' : 'auto' });
      if (smooth) replay(s.box, 'bump');
      s.prev.disabled = index <= 0;
      s.next.disabled = index >= s.inputs.length - 1;
    }
  }

  /** A radio group as ‹ value ›: its choices side by side in a track that shows one. */
  private selector(group: HTMLFieldSetElement): void {
    const labels = [...group.querySelectorAll<HTMLLabelElement>(':scope > label.menu-option')];
    const inputs = labels.flatMap((label) => {
      const input = label.querySelector('input');
      return input ? [input] : [];
    });
    const track = el('div', 'settings-selector-track');
    track.append(...labels);
    const arrow = (text: string, step: number) => {
      const button = el('button', 'settings-selector-arrow', text);
      button.type = 'button';
      // The mouse's way; the keyboard moves the radios themselves (arrow keys).
      button.tabIndex = -1;
      button.setAttribute('aria-hidden', 'true');
      button.addEventListener('click', () => {
        const at = inputs.findIndex((input) => input.checked);
        inputs[Math.min(inputs.length - 1, Math.max(0, at + step))]?.click();
      });
      return button;
    };
    const prev = arrow('‹', -1);
    const next = arrow('›', 1);
    const box = el('div', 'settings-selector');
    box.append(prev, track, next);
    group.insertBefore(box, group.querySelector(':scope > .menu-help'));
    this.selectors.push({ box, track, inputs, prev, next, shown: -1, width: -1 });
    group.addEventListener('change', () => this.follow(true));
    this.resized.observe(track);
  }

  /** The list of sections, from their titles (again when one arrives or the language changes). */
  private showTabs(): void {
    const sections = [...this.panes.children];
    if (!this.active || !sections.includes(this.active)) this.active = sections[0] ?? null;
    this.tabButtons = sections.map((section, i) => {
      const title = section.querySelector(':scope > legend, :scope > .settings-card-title');
      const tab = el('button', 'settings-tab');
      tab.type = 'button';
      tab.dataset.section = section.getAttribute('data-section') ?? '';
      // A section may be named apart from its title (the language's: "General").
      const name = section.getAttribute('data-tab') ?? title?.textContent ?? '';
      tab.dataset.name = name;
      tab.style.setProperty('--i', String(i)); // the tabs come in one after another
      const icon = section.getAttribute('data-tab-icon') ?? title?.getAttribute('data-icon') ?? '';
      const mark = el('span', 'settings-tab-icon', icon);
      mark.setAttribute('aria-hidden', 'true');
      tab.append(mark, el('span', undefined, name));
      tab.addEventListener('click', () => this.select(section));
      return { section, tab };
    });
    this.indicator.setAttribute('aria-hidden', 'true');
    this.tabs.replaceChildren(this.indicator, ...this.tabButtons.map(({ tab }) => tab));
    this.select(this.active, false);
  }

  /**
   * The way to the live background for a first-time player (Phú 2026-11-18): a red dot on the
   * Graphics tab until it is opened, then on the Menu background row until a choice is made.
   */
  private paintHints(): void {
    const label = this.game.texts.ui('menu.hintNew', 'New');
    const graphics = this.tabButtons.find(({ section }) => section === this.graphics)?.tab;
    if (graphics) setHintDot(graphics, this.game.liveHint, label);
    setHintDot(this.menuBackgroundLegend, this.hintRow, label, true);
  }

  /** Shows one section: its tab lit (the highlight slides there), its rows coming in in turn. */
  private select(section: Element | null, animate = true): void {
    if (!section) return;
    const changed = section !== this.active;
    this.active = section;
    for (const { section: other, tab } of this.tabButtons) {
      const on = other === section;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-pressed', String(on));
      if (other instanceof HTMLElement) {
        other.classList.add('settings-pane');
        // A shown section's rows animate in (CSS), each a little after the one above.
        other.hidden = !on;
      }
      if (on) {
        this.heading.textContent = tab.dataset.name ?? '';
        // The section's own colour for the heading, the highlight and the description.
        const id = section.getAttribute('data-section') ?? '';
        this.root.dataset.active = id;
        this.indicator.dataset.section = id;
      }
    }
    [...section.children].forEach((row, i) => {
      if (row instanceof HTMLElement) row.style.setProperty('--i', String(i));
    });
    // Followed the dot to Graphics: the dot moves to the row, and the hint counts as seen.
    if (section === this.graphics && this.game.liveHint && this.root.isConnected) {
      this.hintRow = true;
      this.game.seeLiveHint();
    } else if (section !== this.graphics) this.hintRow = false;
    this.paintHints();
    if (animate && changed) replay(this.heading, 'swap');
    this.follow(false); // a section shown again: its selectors on their choices
    this.place();
    this.describeRow(section);
  }

  /** The highlight onto the chosen tab (after layout; at once the first time, then sliding). */
  private place(): void {
    requestAnimationFrame(() => {
      const tab = this.tabButtons.find(({ section }) => section === this.active)?.tab;
      if (!tab || tab.offsetParent === null) return; // not shown: placed when mounted
      const style = this.indicator.style;
      style.setProperty('--x', `${tab.offsetLeft}px`);
      style.setProperty('--y', `${tab.offsetTop}px`);
      style.setProperty('--w', `${tab.offsetWidth}px`);
      style.setProperty('--h', `${tab.offsetHeight}px`);
      if (!this.placed) {
        this.indicator.classList.add('instant');
        this.indicator.getBoundingClientRect(); // laid out where it starts, with no slide
        this.indicator.classList.remove('instant');
        this.placed = true;
      }
    });
  }

  /** The description of the row `target` is in (its help line), or of its section. */
  private describeRow(target: Element): void {
    let node: Element | null = target;
    while (node && node !== this.panes) {
      const help = node.querySelector(':scope > .menu-help');
      if (help?.textContent) {
        // A preset's own line first, then what holds for all of them.
        const hint = node.querySelector(
          'label.menu-option:has(> input:checked) .settings-tile-hint',
        );
        this.say([hint?.textContent, help.textContent].filter(Boolean).join(' '));
        return;
      }
      node = node.parentElement;
    }
    this.say('');
  }

  /** The description's new words, faded in (only when they change). */
  private say(text: string): void {
    if (this.describe.textContent === text) return;
    this.describe.textContent = text;
    if (text) replay(this.describe, 'swap');
  }

  /** Shows the settings in `parent` (moved there from wherever they were). */
  mount(parent: HTMLElement): void {
    if (this.root.parentElement !== parent) parent.append(this.root);
    this.placed = false; // shown in a new place: the highlight is put there at once
    this.place();
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.resized.disconnect();
    window.removeEventListener('keydown', this.ultraKeys, true);
    this.ultra.remove();
    this.warn.remove();
    this.root.remove();
  }

  /**
   * High or Ultra chosen: the preset stays as it was (its radio checked again) until the player
   * agrees in the dialog. Each time either is chosen from another preset (decision D2; the dialog
   * was Ultra's and Max's before the levels were renamed, 2026-11-18).
   */
  private askUltra(level: 'high' | 'ultra'): void {
    this.asking = level;
    const current = this.game.graphicsQuality;
    for (const input of this.quality.querySelectorAll('input')) {
      input.checked = input.value === current;
    }
    this.follow(false); // Ultra's radio put back: the selector shows the preset kept
    this.words();
    this.open(this.ultra, [this.ultraCancel, this.ultraOn], () => this.closeUltra());
  }

  private closeUltra(): void {
    this.shut(this.ultra);
  }

  /** The second warning: what this computer lacks, and what playing at Ultra will be like here. */
  private askAgain(): void {
    this.warnWords();
    this.open(this.warn, [this.warnKeep, this.warnOn], () => this.closeWarn());
  }

  private closeWarn(): void {
    this.shut(this.warn);
  }

  private open(backdrop: HTMLElement, buttons: HTMLButtonElement[], close: () => void): void {
    backdrop.classList.remove('hidden');
    this.dialog = { buttons, close };
    window.addEventListener('keydown', this.ultraKeys, true);
    buttons[0]?.focus();
  }

  private shut(backdrop: HTMLElement): void {
    backdrop.classList.add('hidden');
    this.dialog = null;
    window.removeEventListener('keydown', this.ultraKeys, true);
    this.quality.querySelector<HTMLInputElement>(`input[value="${this.asking}"]`)?.focus();
  }

  /** Ultra's minimum against this computer, as the browser tells it. */
  private check(): UltraCheck {
    return checkUltra(this.machine());
  }

  /** This computer as the browser tells it (the GPU read here when the renderer has not loaded). */
  private machine(): MachineFacts {
    return readMachine(this.game.gpuName, this.game.softwareRenderer);
  }

  /** "Good", "Playable", "Not advised": one solid badge. */
  private badge(experience: Experience): HTMLElement {
    const t = this.game.texts;
    const words: Record<Experience, string> = {
      good: t.ui('menu.ultraGood', 'Good'),
      ok: t.ui('menu.ultraOk', 'Playable'),
      poor: t.ui('menu.ultraPoor', 'Not advised'),
    };
    return el('span', 'ultra-badge ' + experience, words[experience]);
  }

  /** High or Ultra on: how it plays here, measured (or being measured); hidden under the others. */
  private showUltraNow(): void {
    const on = highOrMore(this.game.graphicsQuality);
    this.ultraNow.hidden = !on;
    if (!on) return;
    const t = this.game.texts;
    const fps = this.game.ultraFps;
    const label = el(
      'span',
      'ultra-now-name',
      t.ui('menu.levelHere', '{level} on this computer', {
        level: this.levelName(this.game.graphicsQuality),
      }),
    );
    if (fps === null) {
      const note = t.ui('menu.ultraMeasuring', 'measured while you play…');
      this.ultraNow.replaceChildren(label, el('span', 'ultra-now-note', note));
      return;
    }
    const measured = t.ui('menu.ultraMeasured', '{fps} frames a second while playing', {
      fps: String(Math.round(fps)),
    });
    this.ultraNow.replaceChildren(
      label,
      this.badge(experienceOf(fps, this.game.frameCap)),
      el('span', 'ultra-now-note', measured),
    );
  }

  /** The second warning's words: what is below the minimum here. */
  private warnWords(): void {
    const t = this.game.texts;
    const c = this.check();
    const level = this.levelName(this.asking);
    this.warnTitle.textContent = t.ui('menu.levelWarnTitle', 'Below the minimum for {level}', {
      level,
    });
    const missing: string[] = [];
    if (this.machine().software) {
      missing.push(t.ui('menu.ultraWarnSoftware', 'No graphics card is drawing the game.'));
    } else if (c.gpu === false) {
      missing.push(
        t.ui('menu.ultraWarnGpu', 'The graphics card is below the {gpu} class.', {
          gpu: ULTRA_MINIMUM.gpu,
        }),
      );
    } else if (c.gpu === null) {
      missing.push(
        t.ui('menu.ultraWarnGpuUnknown', 'The browser does not name the graphics card.'),
      );
    }
    if (!c.threads) {
      missing.push(
        t.ui('menu.ultraWarnCpu', 'The processor has fewer than {n} threads.', {
          n: String(ULTRA_MINIMUM.threads),
        }),
      );
    }
    if (c.memory === false) {
      missing.push(
        t.ui('menu.ultraWarnRam', 'Less than {n} GB of memory.', {
          n: String(ULTRA_MINIMUM.memoryGb),
        }),
      );
    }
    this.warnMissing.replaceChildren(...missing.map((line) => el('li', undefined, line)));
    this.warnBody.textContent = t.ui(
      'menu.ultraWarnBody',
      '{level} may then run at few frames a second, stutter as you walk and aim, and make the computer hot and loud; labs may open slowly. You can turn it off at any time in Settings.',
      { level },
    );
    this.warnKeep.textContent = t.ui('menu.ultraWarnKeep', 'Keep the current level');
    this.warnOn.textContent = t.ui('menu.ultraWarnOn', 'Turn on anyway');
  }

  /** The minimum, this computer, met or not: a row each, and the experience expected here. */
  private specs(): void {
    const t = this.game.texts;
    const c = this.check();
    const m = this.machine();
    const unread = t.ui('menu.ultraUnread', 'not readable');
    const threads = (n: number) => t.ui('menu.ultraThreads', '{n} threads', { n: String(n) });
    const memory =
      m.memoryGb === null
        ? unread
        : m.memoryGb >= ULTRA_MINIMUM.memoryGb
          ? t.ui('menu.ultraRamAtLeast', '{n} GB or more', { n: String(m.memoryGb) })
          : String(m.memoryGb) + ' GB';
    const rows: [string, string, string, boolean | null][] = [
      [
        t.ui('menu.ultraReqGpu', 'Graphics card'),
        ULTRA_MINIMUM.gpu,
        m.software
          ? t.ui('menu.ultraNoCard', 'no graphics card (software)')
          : cardName(m.gpu) || unread,
        c.gpu,
      ],
      [
        t.ui('menu.ultraReqVram', 'Graphics memory'),
        String(ULTRA_MINIMUM.vramGb) + ' GB',
        unread,
        null,
      ],
      [
        t.ui('menu.ultraReqCpu', 'Processor'),
        threads(ULTRA_MINIMUM.threads),
        threads(m.threads),
        c.threads,
      ],
      [
        t.ui('menu.ultraReqRam', 'Memory'),
        String(ULTRA_MINIMUM.memoryGb) + ' GB',
        memory,
        c.memory,
      ],
    ];
    const head = el('tr');
    head.append(
      el('th'),
      el('th', undefined, t.ui('menu.ultraMinimum', 'Minimum')),
      el('th', undefined, t.ui('menu.ultraThisMachine', 'This computer')),
      el('th'),
    );
    const body = rows.map(([name, need, has, met]) => {
      const row = el('tr');
      const kind = met === true ? 'met' : met === false ? 'short' : 'unknown';
      const mark = el('td', 'ultra-mark-cell');
      mark.append(el('span', 'ultra-mark ' + kind, met === true ? '✔' : met === false ? '✘' : '?'));
      row.append(
        el('td', 'ultra-spec-name', name),
        el('td', undefined, need),
        el('td', undefined, has),
        mark,
      );
      return row;
    });
    const thead = el('thead');
    thead.append(head);
    const tbody = el('tbody');
    tbody.append(...body);
    this.ultraSpecs.replaceChildren(thead, tbody);
    this.ultraExpect.replaceChildren(
      el('span', 'ultra-expect-name', t.ui('menu.ultraExpected', 'Expected experience')),
      this.badge(c.expected),
    );
  }

  /** A level's name in the interface language (as its radio shows it). */
  private levelName(quality: GraphicsQuality): string {
    const t = this.game.texts;
    switch (quality) {
      case 'low':
        return t.ui('menu.graphicsLow', 'Low');
      case 'medium':
        return t.ui('menu.graphicsMedium', 'Medium');
      case 'high':
        return t.ui('menu.graphicsHigh', 'High');
      case 'ultra':
        return t.ui('menu.graphicsUltra', 'Ultra');
    }
  }

  /** The dialog's words, in the interface language (and the software renderer's warning). */
  private words(): void {
    const t = this.game.texts;
    const ultra = this.asking === 'ultra';
    const level = this.levelName(this.asking);
    this.ultraTitle.textContent = t.ui('menu.levelTitle', 'Turn on {level} graphics?', { level });
    this.ultraIntro.textContent = ultra
      ? t.ui(
          'menu.ultraIntro',
          'Ultra is everything High draws and more: the most detail the game has, made as real as it can be, from the people to the objects and what happens in the labs. It is the heaviest level. Before you turn it on:',
        )
      : t.ui(
          'menu.highIntro',
          'High adds ambient occlusion where things meet, soft shadows, reflections of the room you are in and the glow of lamps and screens. Before you turn it on:',
        );
    this.specs();
    const notes = [
      t.ui(
        'menu.ultraCost',
        'It draws fewer frames per second than {lower}, and on a laptop it brings more heat, fan noise and battery use.',
        { lower: this.levelName(ultra ? 'high' : 'medium') },
      ),
      t.ui(
        'menu.ultraLoad',
        'Its effects are downloaded the first time you use it, and a lab may take a moment longer to open.',
      ),
      t.ui('menu.ultraSame', 'Experiments and their results are the same at every graphics level.'),
    ];
    if (this.machine().software) {
      notes.push(
        t.ui(
          'menu.ultraSoftware',
          'This browser is drawing without a graphics card (software rendering): {level} will be very slow here.',
          { level },
        ),
      );
    }
    this.ultraNotes.replaceChildren(...notes.map((note) => el('li', undefined, note)));
    this.ultraOn.textContent = t.ui('menu.levelOn', 'Turn on {level}', { level });
    this.ultraCancel.textContent = t.ui('menu.ultraCancel', 'Cancel');
  }

  private render(): void {
    const t = this.game.texts;
    this.legend.textContent = t.ui('menu.language', 'Language');
    this.languages.dataset.tab = t.ui('settings.general', 'General');
    this.languages.dataset.tabIcon = '⚙';
    this.graphicsTitle.textContent = t.ui('settings.graphics', 'Graphics');
    this.frameCapLegend.textContent = t.ui('menu.frameCap', 'FPS limit');
    this.frameCapHelp.textContent = t.ui(
      'menu.frameCapHelp',
      'Limits the frame rate to balance smoothness, power use and system load.',
    );
    this.frameCapNone.textContent = t.ui('menu.frameCapNone', 'No limit');
    for (const input of this.frameCap.querySelectorAll('input')) {
      input.checked = input.value === String(this.game.frameCap);
    }
    this.follow(false);
    this.qualityLegend.textContent = t.ui('menu.graphicsQuality', 'Graphics quality');
    const names = [
      t.ui('menu.graphicsLow', 'Low'),
      t.ui('menu.graphicsMedium', 'Medium'),
      t.ui('menu.graphicsHigh', 'High'),
      t.ui('menu.graphicsUltra', 'Ultra'),
    ];
    this.qualityNames.forEach((span, i) => (span.textContent = names[i] ?? ''));
    const hints = [
      t.ui('menu.graphicsLowHint', 'Plain light, no shadows, fewer pixels. For older computers.'),
      t.ui(
        'menu.graphicsMediumHint',
        'Shadows, soft reflections on metal and glass. The balance for most computers.',
      ),
      t.ui(
        'menu.graphicsHighHint',
        'Ambient occlusion, soft shadows, reflections of the room. A strong graphics card.',
      ),
      t.ui(
        'menu.graphicsUltraHint',
        'Everything of High, and the most detail: as real as the game can draw. The strongest graphics cards.',
      ),
    ];
    this.qualityHints.forEach((span, i) => (span.textContent = hints[i] ?? ''));
    this.qualityHelp.textContent = t.ui(
      'menu.graphicsSame',
      'Experiment results are the same at every setting.',
    );
    this.menuBackgroundLegend.textContent = t.ui('menu.menuBackground', 'Menu background');
    this.paintHints();
    const backgrounds = [
      t.ui('menu.menuBackgroundDefault', 'Default'),
      t.ui('menu.menuBackgroundLive', 'Live'),
    ];
    this.menuBackgroundNames.forEach((span, i) => (span.textContent = backgrounds[i] ?? ''));
    this.menuBackgroundHelp.textContent = t.ui(
      'menu.menuBackgroundHelp',
      'Live: Linh and Khoa on a rooftop over the city, from afternoon into the night; scroll the mouse to turn the view. It uses the graphics card while the menu shows. Not at Low quality.',
    );
    for (const input of this.menuBackground.querySelectorAll('input')) {
      input.checked = input.value === this.game.menuBackground;
    }
    this.roomSleepName.textContent = t.ui('menu.roomSleep', 'Draw only rooms you can see');
    this.roomSleepHelp.textContent = t.ui(
      'menu.roomSleepHelp',
      'Rooms behind closed doors you are far from are not drawn or kept in graphics memory, and are made ready again as you walk towards their door, before it opens. Lighter for the machine; experiments and everything else go on in every room.',
    );
    this.roomSleepBox.checked = this.game.roomSleep;
    this.showUltraNow();
  }
}

/** The card's own name out of the browser's renderer string ("ANGLE (NVIDIA, NVIDIA GeForce …)"). */
function cardName(renderer: string): string {
  const inner =
    /^ANGLE \([^,]+, (.+?)(?: \(0x[0-9A-Fa-f]+\))?(?: Direct3D.*| Vulkan.*| OpenGL.*)?\)$/.exec(
      renderer,
    );
  return (inner?.[1] ?? renderer).trim();
}

/** Plays a CSS animation class again (removed, laid out, added). */
function replay(element: HTMLElement, name: string): void {
  element.classList.remove(name);
  element.getBoundingClientRect();
  element.classList.add(name);
}
