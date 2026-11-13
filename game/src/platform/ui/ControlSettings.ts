import { Disposables } from '../../core/EventBus';
import type { GameSystem } from '../../core/SystemRunner';
import type { Game } from '../../game/Game';
import { LOOK_SENSITIVITIES, type LookSensitivity } from '../../persistence/settings';
import type { DeviceKind } from '../device';
import { askTilt, tiltAvailable } from '../tilt';
import { el } from './dom';

/** A slider over the sensitivity steps (its value an index), with the step shown beside it. */
function stepSlider(id: string): {
  row: HTMLLabelElement;
  input: HTMLInputElement;
  name: HTMLElement;
  out: HTMLOutputElement;
} {
  const input = el('input', 'menu-volume');
  input.type = 'range';
  input.min = '0';
  input.max = String(LOOK_SENSITIVITIES.length - 1);
  input.step = '1';
  input.id = id;
  const out = el('output', 'menu-volume-value');
  out.htmlFor.add(id);
  const name = el('span', 'menu-field-label');
  const row = el('label', 'menu-volume-row');
  row.append(name, input, out);
  return { row, input, name, out };
}

const stepOf = (input: HTMLInputElement): LookSensitivity | undefined =>
  LOOK_SENSITIVITIES[Number(input.value)];
const indexOf = (value: LookSensitivity) => String(LOOK_SENSITIVITIES.indexOf(value));

/**
 * The settings' Controls (2026-11-12): the look sensitivity for every device (the mouse, a finger's
 * drag, a gamepad's stick); on a phone or tablet, looking by tilting it (the gyroscope), how far,
 * and reversed. The gyroscope is given only to a secure page (https, or the game on this device
 * itself): opened over the LAN address it is unavailable, and the switch says so. A line names
 * the gamepad's buttons.
 */
export class ControlSettings implements GameSystem {
  readonly id = 'control-settings';
  private readonly root = el('fieldset', 'menu-choice');
  private readonly legend = el('legend');
  private readonly look = stepSlider('settings-look-sensitivity');
  private readonly tilt = el('div', 'menu-field');
  private readonly tiltBox = el('input');
  private readonly tiltName = el('span');
  private readonly tiltHelp = el('p', 'menu-help');
  private readonly tiltSpeed = stepSlider('settings-tilt-sensitivity');
  private readonly invertBox = el('input');
  private readonly invertName = el('span');
  private readonly padHelp = el('p', 'menu-help');
  private readonly subscriptions = new Disposables();

  constructor(
    private readonly game: Game,
    private readonly settings: { addSection(section: HTMLElement): void },
    private readonly device: DeviceKind,
  ) {}

  init(): void {
    const { game } = this;
    this.legend.dataset.icon = '⌖';
    this.root.dataset.section = 'controls';
    this.root.append(this.legend, this.look.row);
    this.look.input.addEventListener('input', () => {
      const value = stepOf(this.look.input);
      if (value !== undefined) game.setControl('lookSensitivity', value);
    });
    if (this.device !== 'computer') {
      const row = el('label', 'menu-option');
      this.tiltBox.type = 'checkbox';
      this.tiltBox.id = 'settings-tilt-look';
      this.tiltHelp.id = 'settings-tilt-help';
      this.tiltBox.setAttribute('aria-describedby', this.tiltHelp.id);
      this.tiltBox.disabled = !tiltAvailable();
      // iOS asks for the motion sensors from this tap: refused, it stays off.
      this.tiltBox.addEventListener('change', () => {
        if (!this.tiltBox.checked) {
          game.setControl('tiltLook', false);
          return;
        }
        void askTilt().then((granted) => {
          game.setControl('tiltLook', granted);
          if (!granted) this.tiltBox.checked = false;
        });
      });
      row.append(this.tiltBox, this.tiltName);
      const invert = el('label', 'menu-option');
      this.invertBox.type = 'checkbox';
      this.invertBox.addEventListener('change', () =>
        game.setControl('tiltInvert', this.invertBox.checked),
      );
      invert.append(this.invertBox, this.invertName);
      this.tiltSpeed.input.addEventListener('input', () => {
        const value = stepOf(this.tiltSpeed.input);
        if (value !== undefined) game.setControl('tiltSensitivity', value);
      });
      this.tilt.append(row, this.tiltHelp, this.tiltSpeed.row, invert);
      this.root.append(this.tilt);
    }
    this.root.append(this.padHelp);
    this.settings.addSection(this.root);
    this.subscriptions.add(game.events.subscribe('LanguageChanged', () => this.words()));
    this.subscriptions.add(game.events.subscribe('ControlSettingsChanged', () => this.show()));
    this.words();
    this.show();
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.root.remove();
  }

  private show(): void {
    const c = this.game.controls;
    this.look.input.value = indexOf(c.lookSensitivity);
    this.look.out.textContent = `${c.lookSensitivity}×`;
    this.tiltBox.checked = c.tiltLook;
    this.tiltSpeed.input.value = indexOf(c.tiltSensitivity);
    this.tiltSpeed.out.textContent = `${c.tiltSensitivity}×`;
    this.tiltSpeed.input.disabled = !c.tiltLook;
    this.invertBox.checked = c.tiltInvert;
    this.invertBox.disabled = !c.tiltLook;
  }

  private words(): void {
    const t = this.game.texts;
    this.legend.textContent = t.ui('menu.controls', 'Controls');
    this.look.name.textContent = t.ui('menu.lookSensitivity', 'Look sensitivity');
    this.tiltName.textContent = t.ui('menu.tiltLook', 'Look by tilting the device');
    this.tiltHelp.textContent = tiltAvailable()
      ? t.ui(
          'menu.tiltHelp',
          'Turn and tilt the phone or tablet to look round, as well as dragging a finger.',
        )
      : t.ui(
          'menu.tiltUnavailable',
          'Not available here: the browser gives the gyroscope only to a secure page (https). Opened by the computer’s address on the network, the game cannot use it; dragging a finger still looks round.',
        );
    this.tiltSpeed.name.textContent = t.ui('menu.tiltSensitivity', 'Tilt sensitivity');
    this.invertName.textContent = t.ui('menu.tiltInvert', 'Reverse the tilt');
    this.padHelp.textContent = t.ui(
      'menu.gamepadHelp',
      'A gamepad works too: left stick walks (pressed in, or LB, runs), right stick looks, A use, B more, X put away, Y bag, RT throw, LT look closer, RB pour, d-pad left/right the hotbar, up the phone, down Explain, View tasks, Start pause.',
    );
  }
}
