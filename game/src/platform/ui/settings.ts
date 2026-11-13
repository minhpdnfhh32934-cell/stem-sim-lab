import { Disposables } from '../../core/EventBus';
import { LANGUAGE_NAMES, LANGUAGES } from '../../core/i18n';
import type { GameSystem } from '../../core/SystemRunner';
import type { Game } from '../../game/Game';
import { FRAME_CAPS, GRAPHICS_QUALITIES } from '../../persistence/settings';
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
  /** Ultra's consent (Phase G, contract §3): shown before Ultra is turned on, never after. */
  private readonly ultra = el('div', 'menu-dialog-backdrop hidden');
  private readonly ultraBox = el('div', 'menu-dialog');
  private readonly ultraTitle = el('h2', 'menu-dialog-title');
  private readonly ultraIntro = el('p', 'menu-help');
  private readonly ultraNotes = el('ul', 'menu-dialog-notes');
  private readonly ultraOn = el('button', 'menu-button primary');
  private readonly ultraCancel = el('button', 'menu-button');
  private readonly ultraKeys = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' && e.key !== 'Tab') return;
    e.stopImmediatePropagation(); // the menu behind does not see it
    if (e.key === 'Escape') {
      e.preventDefault();
      this.closeUltra();
      return;
    }
    // Focus stays in the dialog: Tab goes between its two buttons.
    e.preventDefault();
    (document.activeElement === this.ultraOn ? this.ultraCancel : this.ultraOn).focus();
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
      if (quality === 'ultra' && import.meta.env.VITE_SIMLAB_EMBED === '1') return;
      const tile = el('span', 'settings-tile');
      const hint = this.qualityHints[i] ?? el('span');
      // The hint is shown, not part of the choice's name (read as its description instead).
      hint.id = `settings-quality-hint-${quality}`;
      hint.setAttribute('aria-hidden', 'true');
      tile.append(this.qualityNames[i] ?? el('span'), hint);
      const name = tile;
      this.quality.append(
        radio('graphics-quality', quality, quality === this.game.graphicsQuality, name, () =>
          quality === 'ultra' ? this.askUltra() : this.game.setGraphicsQuality(quality),
        ),
      );
      this.quality.lastElementChild
        ?.querySelector('input')
        ?.setAttribute('aria-describedby', hint.id);
    });
    this.quality.append(this.qualityHelp);
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
    this.graphics.append(this.graphicsTitle, this.quality, this.frameCap, this.roomSleep);
    for (const group of [this.languages, this.quality, this.frameCap]) this.selector(group);
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
    this.ultraOn.addEventListener('click', () => {
      this.closeUltra();
      this.game.setGraphicsQuality('ultra');
    });
    this.ultraCancel.addEventListener('click', () => this.closeUltra());
    const actions = el('div', 'menu-dialog-actions');
    actions.append(this.ultraCancel, this.ultraOn);
    this.ultraBox.append(this.ultraTitle, this.ultraIntro, this.ultraNotes, actions);
    this.ultra.append(this.ultraBox);
    document.body.append(this.ultra);
    this.render();
    this.subscriptions.add(
      this.game.events.subscribe('LanguageChanged', () => {
        this.render();
        // After every section has written its words in the new language.
        queueMicrotask(() => this.showTabs());
      }),
    );
    // The preset can change without a click (a default suggested for this machine): follow it.
    this.subscriptions.add(
      this.game.events.subscribe('GraphicsQualityChanged', ({ quality }) => {
        for (const input of this.quality.querySelectorAll('input')) {
          input.checked = input.value === quality;
        }
        this.follow(false);
      }),
    );
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
    this.root.remove();
  }

  /**
   * Ultra chosen: the preset stays as it was (its radio checked again) until the player agrees in
   * the dialog. Each time Ultra is chosen from another preset (decision D2).
   */
  private askUltra(): void {
    const current = this.game.graphicsQuality;
    for (const input of this.quality.querySelectorAll('input')) {
      input.checked = input.value === current;
    }
    this.follow(false); // Ultra's radio put back: the selector shows the preset kept
    this.words();
    this.ultra.classList.remove('hidden');
    window.addEventListener('keydown', this.ultraKeys, true);
    this.ultraCancel.focus();
  }

  private closeUltra(): void {
    this.ultra.classList.add('hidden');
    window.removeEventListener('keydown', this.ultraKeys, true);
    this.quality.querySelector<HTMLInputElement>('input[value="ultra"]')?.focus();
  }

  /** The dialog's words, in the interface language (and the software renderer's warning). */
  private words(): void {
    const t = this.game.texts;
    this.ultraTitle.textContent = t.ui('menu.ultraTitle', 'Turn on Ultra graphics?');
    this.ultraIntro.textContent = t.ui(
      'menu.ultraIntro',
      'Ultra adds ambient occlusion where things meet, soft shadows, reflections of the room you are in and the glow of lamps and screens, with more detail to come. Before you turn it on:',
    );
    const notes = [
      t.ui(
        'menu.ultraGpu',
        'It is made for a dedicated graphics card of the RTX 4060 / RX 7600 class or better, with at least 8 GB of video memory.',
      ),
      t.ui(
        'menu.ultraCost',
        'It draws fewer frames per second than High, and on a laptop it brings more heat, fan noise and battery use.',
      ),
      t.ui(
        'menu.ultraLoad',
        'Its effects are downloaded the first time you use it, and a lab may take a moment longer to open.',
      ),
      t.ui('menu.ultraSame', 'Experiments and their results are the same at every graphics level.'),
    ];
    if (this.game.softwareRenderer) {
      notes.push(
        t.ui(
          'menu.ultraSoftware',
          'This browser is drawing without a graphics card (software rendering): Ultra will be very slow here.',
        ),
      );
    }
    this.ultraNotes.replaceChildren(...notes.map((note) => el('li', undefined, note)));
    this.ultraOn.textContent = t.ui('menu.ultraOn', 'Turn on Ultra');
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
      t.ui('menu.graphicsMediumHint', 'Shadows on. The balance for most computers.'),
      t.ui('menu.graphicsHighHint', 'Softer, more natural reflections on metal.'),
      t.ui(
        'menu.graphicsUltraHint',
        'Ambient occlusion, soft shadows, reflections of the room. A strong graphics card.',
      ),
    ];
    this.qualityHints.forEach((span, i) => (span.textContent = hints[i] ?? ''));
    this.qualityHelp.textContent = t.ui(
      'menu.graphicsSame',
      'Experiment results are the same at every setting.',
    );
    this.roomSleepName.textContent = t.ui('menu.roomSleep', 'Draw only rooms you can see');
    this.roomSleepHelp.textContent = t.ui(
      'menu.roomSleepHelp',
      'Rooms behind closed doors you are far from are not drawn or kept in graphics memory, and are made ready again as you walk towards their door, before it opens. Lighter for the machine; experiments and everything else go on in every room.',
    );
    this.roomSleepBox.checked = this.game.roomSleep;
  }
}

/** Plays a CSS animation class again (removed, laid out, added). */
function replay(element: HTMLElement, name: string): void {
  element.classList.remove(name);
  element.getBoundingClientRect();
  element.classList.add(name);
}
