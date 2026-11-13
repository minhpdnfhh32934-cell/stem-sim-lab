import type { Game } from '../../game/Game';
import { el } from './dom';
import { stageHead, type Show } from './PlayPages';
import type { SettingsPanel } from './settings';
import './settingsPage.css';

/**
 * The menu's Settings (Phú 2026-11-12: "make the settings look better"): a page of its own on the
 * stage, as Play's pages are, in place of the fold under the menu's buttons. The settings
 * themselves are the one shared `SettingsPanel` (the pause menu shows the same element), drawn as
 * cards.
 */
export class SettingsPage {
  readonly root = el('section', 'settings-page menu-settings play-stage hidden');
  readonly title = el('h2', 'menu-catalog-title');
  /** Where the shared settings are mounted. */
  readonly body = el('div', 'settings-body');

  constructor(
    game: Game,
    show: Show,
    private readonly panel: SettingsPanel,
    onBack: () => void,
  ) {
    const t = game.texts;
    this.title.id = 'settings-title';
    this.root.setAttribute('aria-labelledby', this.title.id);
    this.root.append(
      stageHead(
        game,
        show,
        this.title,
        {
          eyebrow: () => t.ui('settings.eyebrow', 'Menu'),
          title: () => t.ui('menu.settings', 'Settings'),
          lead: () => t.ui('settings.lead', 'Changes apply at once and are kept in this browser.'),
        },
        onBack,
      ),
      this.body,
    );
  }

  get open(): boolean {
    return !this.root.classList.contains('hidden');
  }

  /** The settings mounted here (back from the pause menu, if they were shown there). */
  render(): void {
    this.panel.mount(this.body);
  }
}
