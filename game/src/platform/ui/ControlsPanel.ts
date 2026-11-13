import type { GameConfig } from '../../core/config';
import type { Texts } from '../../core/i18n';
import type { Game } from '../../game/Game';
import { el, keyLabel } from './dom';

type Bindings = GameConfig['input']['bindings'];

/** One row: what to press (keys, each a list of alternatives) and what it does. */
interface Row {
  readonly keys: (b: Bindings, t: Texts) => readonly string[];
  readonly does: (t: Texts) => string;
}

const first = (codes: readonly string[], t: Texts) => keyLabel(codes[0], t);

/**
 * The game's controls, as the configured bindings make them (`config.input.bindings`), in four
 * groups. Esc and the mouse wheel are not bindings: the pause menu and the hotbar listen to them.
 */
const GROUPS: readonly { title: (t: Texts) => string; rows: readonly Row[] }[] = [
  {
    title: (t) => t.ui('controls.movement', 'Movement'),
    rows: [
      {
        keys: (b, t) =>
          [b.moveForward, b.moveLeft, b.moveBack, b.moveRight].map((c) => first(c, t)),
        does: (t) => t.ui('controls.move', 'Walk (or the arrow keys)'),
      },
      { keys: (b, t) => [first(b.run, t)], does: (t) => t.ui('controls.run', 'Run, held') },
      {
        keys: (_, t) => [t.ui('key.mouse', 'Mouse')],
        does: (t) => t.ui('controls.look', 'Look around (click the view first)'),
      },
    ],
  },
  {
    title: (t) => t.ui('controls.interaction', 'Interaction'),
    rows: [
      {
        keys: (b, t) => [first(b.interact, t)],
        does: (t) =>
          t.ui('controls.interact', 'The action shown at the crosshair: open, use, grab, a door'),
      },
      {
        keys: (b, t) => [first(b.secondary, t)],
        does: (t) => t.ui('controls.secondary', 'The other action shown, such as Inspect'),
      },
      {
        keys: (b, t) => [first(b.throw, t)],
        does: (t) => t.ui('controls.throw', 'Throw what you hold, when it can be thrown'),
      },
      {
        keys: (b, t) => b.pour.map((c) => first([c], t)),
        does: (t) =>
          t.ui(
            'controls.pour',
            'Held down: pour or squeeze the glassware you hold; with a stoppered vessel, turn it over',
          ),
      },
      {
        keys: (b, t) => b.inspect.map((c) => first([c], t)),
        does: (t) =>
          t.ui('controls.inspect', 'Held down: look closely (narrower view, slower mouse)'),
      },
    ],
  },
  {
    title: (t) => t.ui('controls.inventory', 'Inventory'),
    rows: [
      {
        keys: (b, t) => [first(b.stow, t)],
        does: (t) =>
          t.ui(
            'controls.stow',
            'Put away what you hold; with free hands, take out the selected item',
          ),
      },
      {
        keys: (b, t) => [`${first(b.hotbar1, t)}–${first(b.hotbar9, t)}`],
        does: (t) => t.ui('controls.hotbar', 'Choose a hotbar slot'),
      },
      {
        keys: (_, t) => [t.ui('key.wheel', 'Wheel')],
        does: (t) => t.ui('controls.wheel', 'Next or previous hotbar slot'),
      },
      {
        keys: (b, t) => [first(b.inventory, t)],
        does: (t) => t.ui('controls.panel', 'Open or close the inventory'),
      },
      {
        keys: (b, t) => [first(b.tasks, t)],
        does: (t) => t.ui('controls.tasks', 'The guided tasks of the lab: choose one or stop it'),
      },
      {
        keys: (b, t) => [first(b.explain, t)],
        does: (t) =>
          t.ui('controls.explain', 'By an experiment: its parts named, its principle step by step'),
      },
      {
        keys: (b, t) => [first(b.phone, t)],
        does: (t) =>
          t.ui('controls.phone', 'Take your phone out or put it away (call 114 for a fire)'),
      },
    ],
  },
  {
    title: (t) => t.ui('controls.room', 'In a LAN room'),
    rows: [
      {
        keys: (b, t) => [first(b.chat, t)],
        does: (t) => t.ui('controls.chat', 'Chat: type a line to the room, Enter sends it'),
      },
      {
        keys: (b, t) => [first(b.talk, t)],
        does: (t) => t.ui('controls.talk', 'Hold to talk: the players near you hear you'),
      },
    ],
  },
  {
    title: (t) => t.ui('controls.system', 'System'),
    rows: [
      {
        keys: () => ['Esc'],
        does: (t) => t.ui('controls.pause', 'Pause, or close an open panel'),
      },
    ],
  },
];

/** Development builds only: the developer panel's key. */
const DEVELOPER = {
  title: (t: Texts) => t.ui('controls.developer', 'Development'),
  rows: [
    {
      keys: (b: Bindings, t: Texts) => [first(b.toggleDebug, t)],
      does: (t: Texts) => t.ui('controls.debug', 'Developer panel'),
    },
  ],
};

/**
 * The controls, group by group, in the current language: the main menu's dialog and the pause
 * menu show the same.
 */
export function controlGroups(game: Game): HTMLElement[] {
  const { config, texts: t } = game;
  // A phone or tablet plays by touch (TouchControls): its guide, not the keyboard's keys.
  const device = document.documentElement.dataset.device;
  if (device === 'phone' || device === 'tablet') return touchGroups(t);
  const groups = config.debug.enabled ? [...GROUPS, DEVELOPER] : GROUPS;
  return groups.map((group) => {
    const list = el('dl', 'controls-list');
    for (const row of group.rows) {
      const keys = el('dt', 'controls-keys');
      keys.append(...row.keys(config.input.bindings, t).map((k) => el('kbd', undefined, k)));
      list.append(keys, el('dd', 'controls-does', row.does(t)));
    }
    const section = el('section', 'controls-group');
    section.append(el('h3', 'controls-group-title', group.title(t)), list);
    return section;
  });
}

/**
 * The controls reference opened from the main menu: a modal dialog (the page's own `<dialog>`:
 * it keeps the focus inside, Esc closes it, the focus goes back to the button that opened it).
 * Texts follow the language through `show`, like every menu text.
 */
export class ControlsPanel {
  readonly root = el('dialog', 'controls-dialog');
  private readonly groups = el('div', 'controls-groups');

  constructor(
    private readonly game: Game,
    show: (element: HTMLElement, text: () => string) => HTMLElement,
  ) {
    const t = game.texts;
    const title = show(el('h2', 'controls-title'), () => t.ui('controls.title', 'Controls'));
    title.id = 'controls-title';
    this.root.setAttribute('aria-labelledby', title.id);
    const close = show(el('button', 'menu-button controls-close'), () =>
      t.ui('controls.close', 'Close'),
    );
    close.addEventListener('click', () => this.root.close());
    const head = el('header', 'controls-head');
    head.append(title, close);

    this.root.append(head, this.groups);
    this.render();
    // A click on the backdrop (outside the dialog's box) closes it too.
    this.root.addEventListener('click', (event) => {
      if (event.target === this.root) this.root.close();
    });
  }

  /** The groups and their rows in the current language (the menu calls it when that changes). */
  render(): void {
    this.groups.replaceChildren(...controlGroups(this.game));
  }

  get open(): boolean {
    return this.root.open;
  }

  show(): void {
    if (!this.root.open) this.root.showModal();
  }
}

/** The touch controls (a phone or tablet), in the keys' layout: what to touch, what it does. */
function touchGroups(t: Texts): HTMLElement[] {
  const groups: [string, [string, string][]][] = [
    [
      t.ui('controls.movement', 'Movement'),
      [
        [
          t.ui('touch.guideStick', 'Left thumb'),
          t.ui(
            'touch.guideStickDoes',
            'Walk: push the stick as far as you want to go fast; at its edge, run',
          ),
        ],
        [
          t.ui('touch.guideDrag', 'Drag'),
          t.ui('touch.guideDragDoes', 'Look round: drag a finger anywhere free on the screen'),
        ],
        [
          t.ui('touch.guideTilt', 'Tilt'),
          t.ui(
            'touch.guideTiltDoes',
            'Look by tilting the device: Settings → Controls (needs a secure https page)',
          ),
        ],
      ],
    ],
    [
      t.ui('controls.interaction', 'Interaction'),
      [
        [
          'E',
          t.ui('touch.guideUse', 'Use what the dot in the middle points at: open, take, sit, talk'),
        ],
        ['F', t.ui('touch.guideMore', 'Its other action, e.g. Inspect')],
        ['⤴', t.ui('touch.guideThrow', 'Throw what you hold')],
        ['R', t.ui('touch.guidePour', 'Hold: pour the glassware you hold')],
        ['C', t.ui('touch.guideCloser', 'Hold: look closer')],
      ],
    ],
    [
      t.ui('controls.inventory', 'Inventory'),
      [
        [
          'Q',
          t.ui(
            'touch.guideStow',
            'Put away what you hold; with free hands, take out the chosen item',
          ),
        ],
        [
          t.ui('touch.guideSlot', 'Tap a slot'),
          t.ui('touch.guideSlotDoes', 'Choose an item on the hotbar'),
        ],
        [
          'I · T · H · P',
          t.ui('touch.guideTop', 'Bag · tasks · Explain · phone (a keypad dials 114)'),
        ],
        ['II', t.ui('touch.guidePause', 'Pause; a dialog or panel is tapped as it is')],
      ],
    ],
  ];
  return groups.map(([title, rows]) => {
    const list = el('dl', 'controls-list');
    for (const [keys, does] of rows) {
      const dt = el('dt', 'controls-keys');
      dt.append(el('kbd', undefined, keys));
      list.append(dt, el('dd', 'controls-does', does));
    }
    const section = el('section', 'controls-group');
    section.append(el('h3', 'controls-group-title', title), list);
    return section;
  });
}
