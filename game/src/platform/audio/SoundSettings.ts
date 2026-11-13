import { Disposables } from '../../core/EventBus';
import type { Game } from '../../game/Game';
import { AUDIO_BUSES, VOLUMES } from '../../persistence/settings';
import { el } from '../ui/dom';

/**
 * The sound's settings (Phase S): a slider per volume (0–100 %, in the settings' steps) and the
 * mute, each applied at once. Shipped with the sound engine, not with the menu (the menu's JS
 * guard): added to the settings when the engine arrives, at the player's first click or key.
 */
export class SoundSettings {
  readonly root = el('fieldset', 'menu-choice');
  private readonly legend = el('legend');
  private readonly labels = AUDIO_BUSES.map(() => el('span', 'menu-field-label'));
  private readonly values = AUDIO_BUSES.map(() => el('output', 'menu-volume-value'));
  private readonly inputs = AUDIO_BUSES.map(() => el('input', 'menu-volume'));
  private readonly mute = el('input');
  private readonly muteName = el('span');
  private readonly help = el('p', 'menu-help');
  private readonly subscriptions = new Disposables();

  constructor(private readonly game: Game) {
    this.legend.dataset.icon = '♪';
    this.root.dataset.section = 'sound';
    this.root.append(this.legend);
    AUDIO_BUSES.forEach((bus, i) => {
      const input = this.inputs[i] ?? el('input');
      const value = this.values[i] ?? el('output');
      input.type = 'range';
      input.min = String(VOLUMES[0]);
      input.max = String(VOLUMES[VOLUMES.length - 1]);
      input.step = String(VOLUMES[1]);
      input.id = `settings-volume-${bus}`;
      input.addEventListener('input', () => {
        const volume = Number(input.value);
        if (VOLUMES.includes(volume)) game.setVolume(bus, volume);
      });
      value.htmlFor.add(input.id);
      const row = el('label', 'menu-volume-row');
      row.append(this.labels[i] ?? el('span'), input, value);
      this.root.append(row);
    });
    const muteRow = el('label', 'menu-option');
    this.mute.type = 'checkbox';
    this.mute.addEventListener('change', () => game.setMuted(this.mute.checked));
    muteRow.append(this.mute, this.muteName);
    this.root.append(muteRow, this.help);
    this.subscriptions.add(game.events.subscribe('LanguageChanged', () => this.words()));
    this.subscriptions.add(game.events.subscribe('AudioSettingsChanged', () => this.show()));
    this.words();
    this.show();
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.root.remove();
  }

  private show(): void {
    AUDIO_BUSES.forEach((bus, i) => {
      const volume = this.game.volumes[bus];
      const input = this.inputs[i];
      const value = this.values[i];
      if (input) input.value = String(volume);
      if (value) value.textContent = `${volume} %`;
    });
    this.mute.checked = this.game.muted;
  }

  private words(): void {
    const t = this.game.texts;
    this.legend.textContent = t.ui('menu.sound', 'Sound');
    const name: Record<(typeof AUDIO_BUSES)[number], string> = {
      master: t.ui('menu.volumeMaster', 'Master volume'),
      music: t.ui('menu.volumeMusic', 'Music'),
      effects: t.ui('menu.volumeEffects', 'Effects'),
      room: t.ui('menu.volumeRoom', 'Room sound'),
      interface: t.ui('menu.volumeInterface', 'Interface'),
      voice: t.ui('menu.volumeVoice', "Teacher's voice"),
    };
    const names = AUDIO_BUSES.map((bus) => name[bus]);
    this.labels.forEach((span, i) => (span.textContent = names[i] ?? ''));
    this.inputs.forEach((input, i) => input.setAttribute('aria-label', names[i] ?? ''));
    this.muteName.textContent = t.ui('menu.mute', 'Mute');
    this.help.textContent = t.ui(
      'menu.soundHelp',
      'Music: on the menu and in the labs. Effects: steps, doors, equipment. Room sound: the air of each room. Headphones let you hear where each sound comes from.',
    );
  }
}
