import { Disposables } from '../../core/EventBus';
import { describeError, type GameSystem } from '../../core/SystemRunner';
import type { Game } from '../../game/Game';
import { listen } from '../BrowserInput';
import { controlGroups } from './ControlsPanel';
import { el } from './dom';
import type { SettingsPanel } from './settings';

type View = 'menu' | 'settings' | 'confirm';

/**
 * The pause menu during play: Resume, Settings (the shared `SettingsPanel`) and Back to the main
 * menu, with the controls listed beside them (Phú, 2026-11-09: shown at once, no button). It
 * opens with Esc, or when the mouse is freed from the scene while playing (the browser spends
 * that Esc on releasing the pointer) — not while a panel that takes the mouse is open (the
 * results’ run list, the inventory). While it shows, `Game` is paused: every system gets dt 0, so
 * physics, experiments and timers stand still and game keys are ignored. A click on the scene,
 * Resume, or Esc from the menu resumes; Esc from Settings or the confirmation goes back to the
 * menu. Leaving saves first; when that would end a run still running (it is not recorded) or the
 * save fails, it asks before leaving.
 */
export class PauseMenu implements GameSystem {
  readonly id = 'pause-menu';
  private readonly root = el('div', 'pause hidden');
  private readonly panel = el('section', 'pause-panel');
  private readonly title = el('h2', 'pause-title');
  private readonly views: Record<View, HTMLElement> = {
    menu: el('div', 'pause-view pause-menu'),
    settings: el('div', 'pause-view hidden'),
    confirm: el('div', 'pause-view hidden'),
  };
  private readonly resumeButton = el('button', 'menu-button primary');
  private readonly settingsButton = el('button', 'menu-button');
  private readonly homeButton = el('button', 'menu-button caution');
  private readonly confirmText = el('p', 'pause-note');
  private readonly leaveButton = el('button', 'menu-button caution');
  /** Where the settings are mounted while the Settings view shows. */
  private readonly settingsBody = el('div', 'pause-settings');
  /** The controls, shown beside the menu's buttons (no button to open them). */
  private readonly keysTitle = el('h3', 'pause-keys-title');
  private readonly keys = el('div', 'controls-groups pause-keys-groups');
  private view: View = 'menu';
  /** Whether the confirmation is for a failed save (leave without saving) or for lost runs. */
  private saveFailed = false;
  /** Why the last save failed, for the confirmation. */
  private failure = '';
  private readonly subscriptions = new Disposables();

  constructor(
    private readonly parent: HTMLElement,
    private readonly game: Game,
    private readonly settings: SettingsPanel,
    private readonly capture: () => Promise<void>,
    /** A panel that needs the mouse is open (results, inventory): freeing it is not a pause. */
    private readonly panelHasMouse: () => boolean,
  ) {}

  init(): void {
    const { events, texts: t } = this.game;
    const button = (b: HTMLButtonElement, onClick: () => void) => {
      b.type = 'button';
      b.addEventListener('click', onClick);
      return b;
    };
    this.title.id = 'pause-title';
    this.panel.setAttribute('aria-labelledby', this.title.id);
    const backButton = button(el('button', 'menu-button'), () => this.show('menu'));
    const cancelButton = button(el('button', 'menu-button'), () => this.show('menu'));
    const note = el('p', 'pause-note');
    const actions = el('div', 'pause-actions');
    actions.append(
      note,
      button(this.resumeButton, () => this.resume()),
      button(this.settingsButton, () => this.show('settings')),
      button(this.homeButton, () => this.askToLeave()),
    );
    const keys = el('section', 'pause-keys');
    this.keysTitle.id = 'pause-keys-title';
    keys.setAttribute('aria-labelledby', this.keysTitle.id);
    keys.append(this.keysTitle, this.keys);
    this.views.menu.append(actions, keys);
    this.views.settings.append(this.settingsBody, backButton);
    this.views.confirm.append(
      this.confirmText,
      button(this.leaveButton, () => void this.leave(this.saveFailed)),
      cancelButton,
    );
    this.panel.append(this.title, this.views.menu, this.views.settings, this.views.confirm);
    this.root.append(this.panel);
    this.parent.append(this.root);

    const texts = (): void => {
      note.textContent = t.ui(
        'pause.note',
        'Paused: the simulation and every experiment stand still. Click the scene to resume.',
      );
      this.resumeButton.textContent = t.ui('pause.resume', 'Resume');
      this.settingsButton.textContent = t.ui('menu.settings', 'Settings');
      this.homeButton.textContent = t.ui('pause.home', 'Back to the main menu');
      backButton.textContent = t.ui('pause.back', 'Back');
      cancelButton.textContent = t.ui('pause.cancel', 'Cancel');
      this.keysTitle.textContent = t.ui('controls.title', 'Controls');
      this.keys.replaceChildren(...controlGroups(this.game));
      this.renderView();
    };
    texts();
    this.subscriptions.add(events.subscribe('LanguageChanged', texts));
    this.subscriptions.add(
      events.subscribe('PauseChanged', ({ paused }) => {
        this.root.classList.toggle('hidden', !paused);
        if (paused) {
          if (document.pointerLockElement) document.exitPointerLock(); // the menu needs the mouse
          this.show('menu');
        } else if (this.root.contains(document.activeElement)) {
          (document.activeElement as HTMLElement).blur();
        }
      }),
    );

    // The mouse freed from the scene while playing (the browser's Esc, another window): pause.
    listen(this.subscriptions, document, 'pointerlockchange', () => {
      if (document.pointerLockElement === null && this.playing() && !this.panelHasMouse()) {
        this.game.pause();
      }
    });
    listen(this.subscriptions, window, 'keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (this.game.state.session.paused) {
        event.preventDefault();
        if (this.view === 'menu') this.game.resume();
        else this.show('menu');
      } else if (this.playing()) {
        event.preventDefault();
        this.game.pause();
      }
    });
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.root.remove();
  }

  private playing(): boolean {
    const { phase, paused } = this.game.state.session;
    return phase === 'playing' && !paused;
  }

  /** Resume and capture the mouse again (this click is the gesture pointer lock needs). */
  private resume(): void {
    this.game.resume();
    this.capture().catch(() => undefined); // refused: the HUD says to click the scene
  }

  /** Leave at once when nothing would be lost; else say what would be, and ask. */
  private askToLeave(): void {
    if (this.game.experiments.activeCount === 0) {
      void this.leave(false);
      return;
    }
    this.saveFailed = false;
    this.show('confirm');
  }

  private async leave(force: boolean): Promise<void> {
    try {
      const result = await this.game.backToMenu(force);
      if (result.ok) return;
      this.saveFailed = true;
      this.failure = result.error;
    } catch (error) {
      this.saveFailed = true;
      this.failure = describeError(error);
    }
    this.show('confirm');
  }

  /** Shows a view, its title and texts, and puts the focus on its first control. */
  private show(view: View): void {
    const from = this.view;
    this.view = view;
    for (const [name, element] of Object.entries(this.views)) {
      element.classList.toggle('hidden', name !== view);
    }
    this.panel.dataset.view = view; // the styles set the menu's title apart
    if (view === 'settings') this.settings.mount(this.settingsBody);
    this.renderView();
    // Back on the menu, the focus returns to the control that left it.
    const focus =
      view === 'menu'
        ? from === 'settings'
          ? this.settingsButton
          : from === 'confirm'
            ? this.homeButton
            : this.resumeButton
        : view === 'settings'
          ? // The settings: the first control of the section shown (not its list of sections).
            (this.settingsBody.querySelector<HTMLElement>('.settings-pane:not([hidden]) input') ??
            this.views[view].querySelector<HTMLElement>('button'))
          : this.views[view].querySelector<HTMLElement>('input, button');
    focus?.focus();
  }

  private renderView(): void {
    const t = this.game.texts;
    this.title.textContent =
      this.view === 'settings'
        ? t.ui('menu.settings', 'Settings')
        : this.view === 'confirm'
          ? t.ui('pause.leaveTitle', 'Back to the main menu?')
          : t.ui('pause.title', 'Paused');
    if (this.saveFailed) {
      this.confirmText.textContent = t.ui(
        'pause.saveFailed',
        'The game could not be saved ({error}). Leaving now loses what changed since the last save.',
        { error: this.failure },
      );
      this.leaveButton.textContent = t.ui('pause.leaveUnsaved', 'Leave without saving');
    } else {
      this.confirmText.textContent = t.ui(
        'pause.leaveRuns',
        'Your place, the stations’ settings, the completed experiments and the ended runs are kept. The {runs} run(s) still running are not: going back to the main menu ends them unrecorded.',
        { runs: this.game.experiments.activeCount },
      );
      this.leaveButton.textContent = t.ui('pause.leave', 'Save and go to the main menu');
    }
  }
}
