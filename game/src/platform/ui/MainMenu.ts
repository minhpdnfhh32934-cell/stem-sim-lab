import { Disposables } from '../../core/EventBus';
import { describeError, type GameSystem } from '../../core/SystemRunner';
import type { Game } from '../../game/Game';
import { ControlsPanel } from './ControlsPanel';
import { CursorTrail } from './cursorTrail';
import { listen } from '../BrowserInput';
import { el } from './dom';
import { ExperimentCatalog } from './ExperimentCatalog';
import { SettingsPage } from './SettingsPage';
import { MultiplayerPage, type RoomPlayer, type RoomTarget } from './MultiplayerPage';
import { PlayPage, SoloPage } from './PlayPages';
import { EnterTransition } from './EnterTransition';
import type { SaveSlot } from '../../persistence/saveSlots';
import type { RoomSummary } from '../../multiplayer/protocol';
import type { LanRooms } from '../net/LanRooms';
import { emblem, meteors } from './menuArt';
import { avatar, portraitKey } from './characterPage/avatar';
import { CharacterPage } from './characterPage/CharacterPage';
import { storedCustom } from './characterPage/Customiser';
import type { SettingsPanel } from './settings';

/**
 * Character choice, Play (Phú 2026-11-12: one button, then Single player — new game, play on,
 * the games kept — or Multiplayer — the rooms; each a page in place of the panel), the experiment
 * catalog (`ExperimentCatalog`), the controls (a dialog, `ControlsPanel`) and Settings (the
 * interface language). Going into the world plays an entering transition (`EnterTransition`).
 * Visible while a menu scene is loaded.
 */
export class MainMenu implements GameSystem {
  readonly id = 'main-menu';
  private readonly root = el('div', 'menu hidden');
  private readonly message = el('p', 'menu-message');
  private readonly playButton = el('button', 'menu-button primary menu-play');
  private readonly catalogButton = el('button', 'menu-button');
  private playPage: PlayPage | null = null;
  private soloPage: SoloPage | null = null;
  /** Going into the world (a page's buttons are off meanwhile). */
  private entering = false;
  /** The LAN room the player is in, under the buttons (Phase M). */
  private readonly roomLine = el('p', 'menu-room');
  private multiplayer: MultiplayerPage | null = null;
  private readonly controlsButton = el('button', 'menu-button');
  private controls: ControlsPanel | null = null;
  private readonly panel = el('div', 'menu-panel');
  private catalog: ExperimentCatalog | null = null;
  /** Settings (Phú 2026-11-12): a page of its own, opened from this button. */
  private readonly settingsButton = el('button', 'menu-button menu-settings-open');
  private settingsPage: SettingsPage | null = null;
  private readonly subscriptions = new Disposables();
  /** Every element showing player-facing text, with that text in the current language. */
  private readonly texts = new Map<HTMLElement, () => string>();
  private characterId: string;
  /** The character page (slides over the menu) and the chosen one's picture on the menu's row. */
  private characterPage: CharacterPage | null = null;
  private readonly portrait = el('img', 'menu-character-portrait');
  private readonly portraits = new Map<string, string>();
  /** Whether a menu scene is loaded (the menu shows). */
  private visible = false;
  private trail: CursorTrail | null = null;

  constructor(
    private readonly parent: HTMLElement,
    private readonly game: Game,
    private readonly onEnterWorld: () => void,
    private readonly storageBlocked: boolean,
    private readonly settingsPanel: SettingsPanel,
    private readonly rooms: LanRooms,
  ) {
    this.characterId = game.content.characters.all()[0]?.id ?? '';
    // The player's own character, if they made one in this browser.
    const own = storedCustom();
    if (own) game.setCustomCharacter(own);
  }

  init(): void {
    const { content, events, texts: t } = this.game;
    const sky = el('div', 'menu-sky');
    sky.setAttribute('aria-hidden', 'true');
    sky.append(
      el('div', 'menu-stars near'),
      el('div', 'menu-stars mid'),
      el('div', 'menu-stars far'),
      ...meteors(),
    );
    this.trail = new CursorTrail(this.subscriptions, this.root);
    this.root.append(sky, this.trail.root);
    // The name on one side, the controls in their frame on the other (stacked in a narrow window).
    const brand = el('div', 'menu-brand');
    brand.append(
      emblem(),
      el('h1', 'menu-title', 'SIMLAB'),
      this.show(el('p', 'menu-subtitle'), () =>
        t.ui('menu.subtitle', 'Scientific laboratory simulation'),
      ),
    );

    // "Choose your character", the chosen one's name and picture: opens the character page.
    const choice = el('button', 'menu-character');
    choice.setAttribute('aria-haspopup', 'dialog');
    const chosenName = this.show(el('span', 'menu-character-name'), () => {
      const character = content.characters.tryGet(this.characterId);
      return character ? t.of(character, 'displayName') : '';
    });
    this.portrait.alt = '';
    choice.append(
      this.show(el('span', 'menu-character-label'), () =>
        t.ui('menu.chooseCharacter', 'Choose your character'),
      ),
      chosenName,
      this.portrait,
    );
    this.characterPage = new CharacterPage(
      this.game,
      (element, text) => this.show(element, text),
      (chosen) => {
        if (chosen) {
          this.characterId = chosen;
          this.render();
          this.paintPortrait(true);
        }
        choice.focus();
      },
    );
    choice.addEventListener('click', () => this.characterPage?.open(this.characterId));

    // The settings, shared with the pause menu (`SettingsPanel`): mounted here when the menu shows.

    this.show(this.playButton, () => t.ui('menu.play', 'Play'));
    this.playButton.addEventListener('click', () => this.openPage('play'));
    const show = (element: HTMLElement, text: () => string) => this.show(element, text);
    this.settingsButton.type = 'button';
    this.show(this.settingsButton, () => t.ui('menu.settings', 'Settings'));
    this.settingsPage = new SettingsPage(this.game, show, this.settingsPanel, () =>
      this.closePages(this.settingsButton),
    );
    this.settingsPage.render();
    this.settingsButton.addEventListener('click', () => this.openPage('settings'));
    this.playPage = new PlayPage(
      this.game,
      show,
      this.rooms,
      () => this.openPage('solo'),
      () => this.openPage('multi'),
      () => this.closePages(this.playButton),
    );
    this.soloPage = new SoloPage(
      this.game,
      show,
      (slot) => void this.enterSolo(slot),
      () => this.openPage('play'),
    );
    this.show(this.catalogButton, () => t.ui('menu.catalog', 'Experiment catalog'));
    this.catalogButton.addEventListener('click', () => this.openCatalog());
    this.catalog = new ExperimentCatalog(
      this.game,
      (element, text) => this.show(element, text),
      () => this.closeCatalog(),
      () => this.render(),
    );
    this.multiplayer = new MultiplayerPage(
      this.game,
      this.rooms,
      show,
      () => content.characters.tryGet(this.characterId),
      () => this.openPage('play'),
      (target, player) => void this.enterRoom(target, player),
    );
    this.subscriptions.add(this.rooms.onChange(() => this.paintRoom()));
    this.show(this.controlsButton, () => t.ui('menu.controls', 'Controls'));
    this.controlsButton.setAttribute('aria-haspopup', 'dialog');
    this.controls = new ControlsPanel(this.game, (element, text) => this.show(element, text));
    this.controlsButton.addEventListener('click', () => this.controls?.show());
    // Esc goes back from the catalog or the Multiplayer page (Esc is no game key; on the menu the
    // mouse is never captured).
    listen(this.subscriptions, this.root, 'keydown', (event) => {
      if (event.key !== 'Escape' || this.entering) return;
      if (this.catalog?.open) {
        event.preventDefault();
        this.closeCatalog();
      } else if (this.settingsPage?.open) {
        event.preventDefault();
        this.closePages(this.settingsButton);
      } else if (this.multiplayer?.open || this.soloPage?.open) {
        event.preventDefault();
        this.openPage('play');
      } else if (this.playPage?.open) {
        event.preventDefault();
        this.closePages(this.playButton);
      }
    });
    const controls = el('div', 'menu-controls');
    controls.append(
      choice,
      this.playButton,
      this.catalogButton,
      this.roomLine,
      this.controlsButton,
      this.settingsButton,
      this.message,
    );
    this.panel.append(brand, controls);
    this.root.append(
      this.panel,
      this.catalog.root,
      this.playPage.root,
      this.soloPage.root,
      this.multiplayer.root,
      this.settingsPage.root,
      this.controls.root,
      this.characterPage.root,
    );
    this.parent.append(this.root);
    this.render();
    this.paintPortrait();

    this.subscriptions.add(
      events.subscribe('SceneLoaded', ({ kind }) => {
        this.visible = kind === 'menu';
        this.root.classList.toggle('hidden', !this.visible);
        if (this.visible) this.refresh();
      }),
    );
    this.subscriptions.add(events.subscribe('LanguageChanged', () => this.render()));
  }

  /** The chosen one's picture on the menu's row: drawn once per character (the stage's chunk). */
  /**
   * The chosen one's picture on the menu's row: their 3D portrait if one was drawn (this session
   * or kept in the browser), else a flat one in their colours. The menu loads without three.js:
   * the 3D one is drawn only with `draw`, once the character page has brought its chunk.
   */
  private paintPortrait(draw = false): void {
    const id = this.characterId;
    const character = this.game.content.characters.tryGet(id);
    if (!character) return;
    const key = portraitKey(character);
    const known = this.portraits.get(key) ?? stored(key);
    if (known) {
      this.portraits.set(key, known);
      this.portrait.src = known;
      return;
    }
    this.portrait.src = avatar(character);
    if (!draw) return;
    void import('./characterPage/CharacterStage')
      .then(({ portrait }) => {
        const url = portrait(character);
        this.portraits.set(key, url);
        store(key, url);
        if (this.characterId === id) this.portrait.src = url;
      })
      .catch((error: unknown) => this.game.log.warn('Character picture not drawn', error));
  }

  /**
   * The catalog in place of the panel, its title read first; its experiments (loaded the first
   * time) and saved progress follow.
   */
  private openCatalog(): void {
    if (!this.catalog) return;
    void this.catalog.refresh();
    this.panel.classList.add('hidden');
    this.catalog.root.classList.remove('hidden');
    this.root.scrollTop = 0;
    this.catalog.title.focus();
  }

  /** One of Play's pages in place of the panel (and of the others), its title read first. */
  private openPage(name: 'play' | 'solo' | 'multi' | 'settings'): void {
    const page = {
      play: this.playPage,
      solo: this.soloPage,
      multi: this.multiplayer,
      settings: this.settingsPage,
    }[name];
    if (!page) return;
    if (name === 'multi') this.rooms.refresh();
    if (name === 'multi') this.multiplayer?.render();
    if (name === 'solo') this.soloPage?.render();
    if (name === 'play') this.playPage?.render();
    if (name === 'settings') this.settingsPage?.render();
    this.panel.classList.add('hidden');
    for (const other of [this.playPage, this.soloPage, this.multiplayer, this.settingsPage]) {
      other?.root.classList.toggle('hidden', other !== page);
    }
    this.root.scrollTop = 0;
    page.title.focus();
  }

  /** Back to the panel from Play's pages. */
  private closePages(focus: HTMLElement): void {
    for (const page of [this.playPage, this.soloPage, this.multiplayer, this.settingsPage]) {
      page?.root.classList.add('hidden');
    }
    this.panel.classList.remove('hidden');
    focus.focus();
  }

  /** Plays a single-player game: a new one (`slot` null) or a kept one. */
  private async enterSolo(slot: SaveSlot | null): Promise<void> {
    if (this.entering) return;
    const t = this.game.texts;
    // Single player: out of any LAN room first.
    if (this.game.peers.room) this.rooms.leave();
    const game = slot ?? this.game.slots.create('solo');
    this.game.useSlot(game.id);
    const fresh = slot === null || !this.game.hasSavedGame();
    await this.enter(
      'solo',
      {
        title: t.ui('solo.name', 'Game {n}', { n: game.n }),
        subtitle: t.ui('play.solo', 'Single player'),
        status: t.ui('enter.loading', 'Loading the lab…'),
      },
      async () => {
        if (fresh) await this.game.newGame(this.characterId);
        else await this.continueSaved();
      },
      (busy) => this.soloPage?.busy(busy),
      (reason) => this.show(this.message, () => reason),
    );
  }

  /**
   * Plays in a LAN room: joins it (or makes it: a new room, or a played one no longer open), then
   * goes into the world with the room's own game — played on if this browser has played it, else
   * a new one — under the entering transition.
   */
  private async enterRoom(target: RoomTarget, player: RoomPlayer): Promise<void> {
    if (this.entering || !this.multiplayer) return;
    const t = this.game.texts;
    const page = this.multiplayer;
    const name =
      target.kind === 'saved'
        ? (target.slot.room?.name ?? '')
        : target.kind === 'id'
          ? target.id
          : target.name;
    await this.enter(
      'room',
      {
        title: name,
        subtitle: target.kind === 'create' ? '' : t.ui('play.multi', 'Multiplayer'),
        status:
          target.kind === 'create'
            ? t.ui('enter.creating', 'Making the room…')
            : t.ui('enter.joining', 'Joining the room…'),
      },
      async (shown) => {
        const room = await this.joinRoom(target, player);
        shown.status(t.ui('enter.loading', 'Loading the lab…'));
        const slot =
          this.game.slots.forRoom(room.id, room.name) ??
          this.game.slots.create('room', { name: room.name, id: room.id });
        this.game.slots.touch(slot.id, { name: room.name, id: room.id });
        this.game.useSlot(slot.id);
        if (this.game.hasSavedGame()) await this.continueSaved();
        else await this.game.newGame(this.characterId);
      },
      (busy) => page.setBusy(busy),
      (reason) => page.say(reason),
    );
  }

  /** Into the room `target` names: resolves with it once in, or fails with the reason. */
  private joinRoom(target: RoomTarget, player: RoomPlayer): Promise<RoomSummary> {
    const { rooms } = this;
    const peers = this.game.peers;
    const open = (id: string) => rooms.rooms.find((r) => r.id === id);
    let id: string | null = null;
    let make: string | null = null;
    if (target.kind === 'open' || target.kind === 'id') id = target.id;
    else if (target.kind === 'create') make = target.name;
    else {
      const name = target.slot.room?.name ?? '';
      const lower = name.trim().toLowerCase();
      const found =
        open(target.slot.room?.id ?? '') ??
        rooms.rooms.find((r) => r.name.trim().toLowerCase() === lower);
      if (found) id = found.id;
      else make = name;
    }
    if (id !== null && peers.room?.id === id) return Promise.resolve(peers.room);
    return new Promise((resolve, reject) => {
      const was = peers.room?.id ?? null;
      let stop = () => {};
      const timer = window.setTimeout(() => {
        stop();
        reject(new Error(this.game.texts.ui('enter.timeout', 'The room server did not answer.')));
      }, 10_000);
      stop = rooms.onChange(() => {
        const now = peers.room;
        if (now && now.id !== was && (id === null || now.id === id)) {
          window.clearTimeout(timer);
          stop();
          resolve(now);
        } else if (rooms.refusal || rooms.lost) {
          window.clearTimeout(timer);
          stop();
          reject(
            new Error(
              this.multiplayer?.refusalText(rooms.refusal) ||
                this.game.texts.ui(
                  'room.lost',
                  'The connection to the room server was lost: reload the page.',
                ),
            ),
          );
        }
      });
      if (was) rooms.leave();
      if (make !== null) rooms.create(make, player.name, player.character);
      else rooms.join(id ?? '', player.name, player.character);
    });
  }

  /** Continue the save in use, or throw its reason. */
  private async continueSaved(): Promise<void> {
    const result = await this.game.continueGame();
    if (!result.ok) throw new Error(result.error);
  }

  /**
   * Goes into the world under the entering transition: `action` loads it while the screen is
   * covered; on success the world is shown, on failure the transition goes and `fail` says why.
   */
  private async enter(
    kind: 'room' | 'solo',
    words: { title: string; subtitle: string; status: string },
    action: (shown: EnterTransition) => Promise<void>,
    busy: (on: boolean) => void,
    fail: (reason: string) => void,
  ): Promise<void> {
    this.entering = true;
    busy(true);
    const shown = new EnterTransition(document.body, words, kind);
    try {
      await shown.covered;
      await action(shown);
      this.closePages(this.playButton);
      this.onEnterWorld();
      shown.done();
    } catch (error) {
      // Shown to the player (a refused room is no fault of the game's).
      this.game.log.warn('Going into the world failed', describeError(error));
      shown.fail();
      fail(describeError(error));
    } finally {
      this.entering = false;
      busy(false);
    }
  }

  /** The room the player is in, on the panel: its name and ID, and how many are in it. */
  private paintRoom(): void {
    const room = this.game.peers.room;
    this.roomLine.textContent = room
      ? this.game.texts.ui('room.line', 'Room “{name}” · ID {id} · {n}/{max}', {
          name: room.name,
          id: room.id,
          n: room.players,
          max: room.max,
        })
      : '';
  }

  /** Back to the panel, with the focus on the button that opened the catalog. */
  private closeCatalog(): void {
    this.catalog?.root.classList.add('hidden');
    this.panel.classList.remove('hidden');
    this.catalogButton.focus();
  }

  /** Per frame, from the game's one loop: the cursor trail, only while the menu shows. */
  update(dt: number): void {
    if (this.visible) this.trail?.update(dt);
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.multiplayer?.dispose();
    this.playPage?.dispose();
    this.characterPage?.dispose();
    this.root.remove();
  }

  /** Gives `element` its text now, and again in the new language whenever the language changes. */
  private show<T extends HTMLElement>(element: T, text: () => string): T {
    this.texts.set(element, text);
    element.textContent = text();
    return element;
  }

  /** Every text in the current language; the page's `lang` follows, for screen readers. */
  private render(): void {
    document.documentElement.lang = this.game.language;
    for (const [element, text] of this.texts) element.textContent = text();
    this.controls?.render();
    this.multiplayer?.render();
    this.paintRoom();
  }

  private refresh(): void {
    // Back from the pause menu, if they were shown there.
    if (this.settingsPage) this.settingsPanel.mount(this.settingsPage.body);
    if (this.catalog?.open) void this.catalog.refresh(); // else it reads the save when it opens
    this.render();
    this.show(this.message, () =>
      this.storageBlocked
        ? this.game.texts.ui(
            'menu.storageBlocked',
            'This browser blocks storage: progress will not be saved.',
          )
        : '',
    );
  }
}

/** A kept portrait, if the browser keeps them (private windows may not). */
function stored(key: string): string | undefined {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function store(key: string, url: string): void {
  try {
    localStorage.setItem(key, url);
  } catch {
    // Not kept: drawn again next time the page is used.
  }
}
