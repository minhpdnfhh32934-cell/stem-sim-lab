import { Disposables } from '../../core/EventBus';
import type { GameSystem } from '../../core/SystemRunner';
import type { Game } from '../../game/Game';
import {
  HOTBAR_KEYS,
  HOTBAR_SLOTS,
  INVENTORY_SLOTS,
} from '../../gameplay/inventory/InventorySystem';
import type { Texts } from '../../core/i18n';
import type { ItemDefinition, WornOn } from '../../gameplay/item';
import { listen } from '../BrowserInput';
import { el, formatQuantity, keyLabel, svg } from './dom';

/** A limb or a sleeve: a round-capped stroke (figure units: 100 × 180). */
const limb = (x1: number, y1: number, x2: number, y2: number, width: number, colour: string) =>
  svg('line', { x1, y1, x2, y2, stroke: colour, 'stroke-width': width, 'stroke-linecap': 'round' });

/** The character, a flat pictogram as on safety signs, in the text colour (CSS). */
const silhouette = (): SVGElement[] => [
  svg('circle', { cx: 50, cy: 20, r: 12, fill: 'currentColor' }),
  svg('path', { d: 'M33 38H67Q71 38 71 43L70 100H30L29 43Q29 38 33 38Z', fill: 'currentColor' }),
  limb(28, 44, 20, 98, 9, 'currentColor'),
  limb(72, 44, 80, 98, 9, 'currentColor'),
  svg('circle', { cx: 19, cy: 105, r: 5, fill: 'currentColor' }),
  svg('circle', { cx: 81, cy: 105, r: 5, fill: 'currentColor' }),
  limb(41, 100, 41, 170, 11, 'currentColor'),
  limb(59, 100, 59, 170, 11, 'currentColor'),
];

/** Dark detail lines on worn items (a coat's opening, the goggles' bridge). */
const detail = (d: string) =>
  svg('path', { d, fill: 'none', stroke: '#000', 'stroke-opacity': 0.3, 'stroke-width': 1.5 });

/**
 * The worn slots, head to toe (every WORN_ON, typed): the name, the figure's crop that is the
 * slot's icon (viewBox), and how an item worn there is drawn on the figure, in its own colour.
 */
const SLOTS: Readonly<
  Record<WornOn, { name: (t: Texts) => string; crop: string; draw: (c: string) => SVGElement[] }>
> = {
  eyes: {
    name: (t) => t.ui('inventory.wornEyes', 'Eyes'),
    crop: '34 6 32 30',
    draw: (c) => [
      svg('rect', { x: 37, y: 14, width: 26, height: 9, rx: 4.5, fill: c }),
      detail('M50 14V23'),
    ],
  },
  face: {
    name: (t) => t.ui('inventory.wornFace', 'Face'),
    crop: '30 0 40 42',
    draw: (c) => [
      svg('path', {
        d: 'M36 5H64V27Q64 39 50 39Q36 39 36 27Z',
        fill: c,
        'fill-opacity': 0.4,
        stroke: c,
        'stroke-width': 1.5,
      }),
      svg('rect', { x: 35, y: 3, width: 30, height: 4, rx: 1, fill: c }),
    ],
  },
  body: {
    name: (t) => t.ui('inventory.wornBody', 'Body'),
    crop: '16 34 68 104',
    draw: (c) => [
      svg('path', { d: 'M32 37H68Q72 37 72 42L75 134H25L28 42Q28 37 32 37Z', fill: c }),
      limb(28, 44, 20, 96, 10, c),
      limb(72, 44, 80, 96, 10, c),
      detail('M41 37L50 56L59 37M50 56V134'),
    ],
  },
  hands: {
    name: (t) => t.ui('inventory.wornHands', 'Hands'),
    crop: '6 88 26 26',
    draw: (c) => [limb(20, 95, 19, 106, 12, c), limb(80, 95, 81, 106, 12, c)],
  },
};

/** First slot of each of the panel's rows, top to bottom: the bag's rows, then the hotbar's. */
const ROWS = [
  ...Array.from({ length: INVENTORY_SLOTS / HOTBAR_SLOTS - 1 }, (_, i) => (i + 1) * HOTBAR_SLOTS),
  0,
];

/** Arrow keys in the panel: rows and columns to move the focus by. */
const ARROWS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

/**
 * An item drawn from its own data (shape, front proportions, colour): no image files. A flat
 * item (a sheet, a card) is drawn from above, its long side across; a ruled one shows its lines,
 * and a test paper's red tick once it is marked (`marked`).
 */
function picture(item: ItemDefinition, marked = false): SVGSVGElement {
  const { shape, size, color } = item.visual;
  const flat = size[1] < Math.min(size[0], size[2]) / 10;
  const face = flat ? [Math.max(size[0], size[2]), Math.min(size[0], size[2])] : [size[0], size[1]];
  const scale = 20 / Math.max(face[0] ?? 1, face[1] ?? 1);
  const [w, h] = [(face[0] ?? 1) * scale, (face[1] ?? 1) * scale];
  const image = svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  if (flat) {
    const [x, y] = [12 - w / 2, 12 - h / 2];
    image.append(
      svg('rect', {
        x,
        y,
        width: w,
        height: h,
        rx: 0.6,
        fill: color,
        stroke: '#aeb8c4',
        'stroke-width': 0.5,
      }),
    );
    if (item.inventory?.ruled) {
      // A heading line, then the ruled lines across the sheet.
      image.append(
        svg('path', {
          d: `M ${x + 2.5} ${y + 2.6} h ${w * 0.45}`,
          stroke: '#3b4a5e',
          'stroke-width': 1.1,
          'stroke-linecap': 'round',
        }),
      );
      for (let i = 1; i <= 4; i++) {
        const ly = y + 2.6 + (i * (h - 4.2)) / 4;
        image.append(
          svg('path', {
            d: `M ${x + 1.6} ${ly} H ${x + w - 1.6}`,
            stroke: '#8fa7c9',
            'stroke-width': 0.6,
          }),
        );
      }
    }
    if (marked) {
      image.append(
        svg('path', {
          d: `M ${x + w - 6} ${y + 3.2} l 1.6 1.8 l 3 -3.6`,
          fill: 'none',
          stroke: '#d0312d',
          'stroke-width': 1.2,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
      );
    }
    return image;
  }
  image.append(
    shape === 'sphere'
      ? svg('circle', { cx: 12, cy: 12, r: 10, fill: color })
      : svg('rect', {
          x: 12 - w / 2,
          y: 12 - h / 2,
          width: w,
          height: h,
          rx: shape === 'cylinder' ? w / 2 : 1.5,
          fill: color,
        }),
  );
  return image;
}

/**
 * The hotbar (the inventory's first nine slots, at the bottom of the screen) and the inventory
 * panel (I). Both are drawn from `game.inventory` on events, never per frame, and only ask it to
 * change (`move`, `takeOut`): the view keeps nothing but the panel's focus and the stack picked to
 * move. Like the results panel, the open panel frees the mouse without pausing — the game goes
 * on, the camera stands still (looking needs the captured mouse) — and it has the keyboard: no
 * game key and no pause until it closes (I, Esc, Close, Take out, or a click on the scene).
 * Worn PPE is shown read-only: it is worn, never carried.
 */
export class InventoryView implements GameSystem {
  readonly id = 'inventory-view';
  private readonly root = el('div', 'inventory hidden');
  private readonly label = el('div', 'hotbar-label');
  private readonly hotbar = el('div', 'hotbar');
  private readonly bar: HTMLElement[] = [];
  private readonly panel = el('section', 'inventory-panel hidden');
  private readonly title = el('h2');
  private readonly closeButton = el('button', 'menu-button');
  private readonly grid = el('div', 'inventory-grid');
  private readonly cells: HTMLButtonElement[] = [];
  private readonly details = el('div', 'inventory-details');
  private readonly takeOutButton = el('button', 'menu-button inventory-action');
  private readonly takeOutLabel = el('span');
  private readonly wornTitle = el('h3');
  private readonly figure = svg('svg', {
    class: 'equip-figure',
    viewBox: '0 0 100 180',
    'aria-hidden': 'true',
  });
  private readonly wornSlots = el('dl', 'equip-slots');
  private readonly wornNote = el('p', 'inventory-note');
  private readonly help = el('p', 'inventory-help');
  private open = false;
  /** The slot the panel's focus is on (its details show). */
  private current = 0;
  /** The stack picked to move: its slot, and how many of it. */
  private picked: { slot: number; count: number } | null = null;
  private readonly subscriptions = new Disposables();

  constructor(
    private readonly parent: HTMLElement,
    private readonly game: Game,
    private readonly surface: HTMLElement,
    private readonly capture: () => Promise<void>,
  ) {}

  /** Whether the panel is open: it has the mouse then, so freeing it is not a pause. */
  get shown(): boolean {
    return this.open;
  }

  init(): void {
    const { events } = this.game;
    this.label.setAttribute('aria-live', 'polite');
    this.hotbar.setAttribute('role', 'list');
    for (let slot = 0; slot < HOTBAR_SLOTS; slot++) {
      const item = el('div', 'slot');
      item.setAttribute('role', 'listitem');
      this.bar.push(item);
    }
    this.hotbar.append(...this.bar);

    this.title.id = 'inventory-title';
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-modal', 'true');
    this.panel.setAttribute('aria-labelledby', this.title.id);
    this.grid.setAttribute('role', 'grid');
    this.grid.setAttribute('aria-labelledby', this.title.id);
    for (let slot = 0; slot < INVENTORY_SLOTS; slot++) {
      const cell = el('button', 'slot');
      cell.type = 'button';
      cell.setAttribute('role', 'gridcell');
      cell.addEventListener('click', () => this.activate(slot, false));
      cell.addEventListener('focus', () => {
        this.current = slot;
        this.render();
      });
      this.cells.push(cell);
    }
    for (const first of ROWS) {
      const row = el('div', first === 0 ? 'inventory-row hotbar-row' : 'inventory-row');
      row.setAttribute('role', 'row');
      row.append(...this.cells.slice(first, first + HOTBAR_SLOTS));
      this.grid.append(row);
    }
    this.closeButton.type = 'button';
    this.closeButton.addEventListener('click', () => this.hide(true));
    this.takeOutButton.type = 'button';
    // An arrow up out of a tray: from the bag into the hands.
    const icon = svg('svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true' });
    icon.append(
      svg('path', {
        d: 'M2 9.5V13.5H14V9.5M8 10.5V2.5M4.75 5.75L8 2.5L11.25 5.75',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 1.6,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      }),
    );
    this.takeOutButton.append(icon, this.takeOutLabel);
    this.takeOutButton.addEventListener('click', () => {
      if (this.game.inventory.takeOut(this.current)) this.hide(true);
    });
    // Right click picks half a stack; the browser's menu is kept off the panel only.
    this.panel.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      const slot = this.cells.indexOf(event.target as HTMLButtonElement);
      if (slot >= 0) this.activate(slot, true);
    });
    const head = el('div', 'inventory-head');
    head.append(this.title, this.closeButton);
    // What the character wears first, then the bag and hotbar, the focused item, its action.
    const worn = el('section', 'inventory-worn');
    const equip = el('div', 'equip');
    equip.append(this.figure, this.wornSlots);
    worn.append(this.wornTitle, equip, this.wornNote);
    this.panel.append(head, worn, this.grid, this.details, this.takeOutButton, this.help);
    this.root.append(this.label, this.hotbar, this.panel);
    this.parent.append(this.root);

    const s = this.subscriptions;
    const render = () => this.render();
    for (const type of [
      'InventoryChanged',
      'EquipmentChanged',
      'ObjectGrabbed',
      'ObjectReleased',
      'PaperMarked',
    ] as const) {
      s.add(events.subscribe(type, render));
    }
    s.add(
      events.subscribe('LanguageChanged', () => {
        this.renderLabels();
        render();
      }),
    );
    s.add(
      events.subscribe('SceneLoaded', ({ kind }) => {
        this.root.classList.toggle('hidden', kind !== 'world');
        render();
      }),
    );
    // A scene change or a pause closes the panel; the mouse is left as they leave it.
    s.add(events.subscribe('SceneLoading', () => this.hide(false)));
    s.add(
      events.subscribe('PauseChanged', ({ paused }) => {
        if (paused) this.hide(false);
      }),
    );
    // On the document: it hears keys before BrowserInput and the pause menu (on the window).
    listen(s, document, 'keydown', (event) => this.key(event));
    // A grant of the mouse asked for before the panel opened is given back: the panel needs it.
    listen(s, document, 'pointerlockchange', () => {
      if (this.open && document.pointerLockElement === this.surface) document.exitPointerLock();
    });
    // A click on the scene beside the panel closes it; that click then captures the mouse.
    listen(s, this.surface, 'mousedown', () => this.hide(false));
    this.renderLabels();
    render();
  }

  /** Opens the panel on its key while playing; nothing else happens per frame. */
  update(): void {
    const { input, state } = this.game;
    if (
      input.wasPressed('inventory') &&
      !this.open &&
      state.session.phase === 'playing' &&
      !state.session.paused
    ) {
      this.show();
    }
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.root.remove();
  }

  private show(): void {
    this.open = true; // first: the pause menu then lets the mouse go without pausing
    this.game.input.reset(); // a key held now (W) does not go on walking
    if (document.pointerLockElement) document.exitPointerLock();
    this.panel.classList.remove('hidden');
    this.render();
    this.cells[this.game.inventory.selected]?.focus();
  }

  /** Closes the panel; `capture`: takes the mouse back for looking (as after a click on the scene). */
  private hide(capture: boolean): void {
    if (!this.open) return;
    this.open = false;
    this.picked = null;
    this.panel.classList.add('hidden');
    if (this.panel.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    if (capture) this.capture().catch(() => undefined); // refused: the HUD says to click the scene
  }

  /** While open, the panel has the keyboard, but for the developer panel's key. */
  private key(event: KeyboardEvent): void {
    if (!this.open) return;
    const keys = this.game.config.input.bindings;
    if (keys.toggleDebug.includes(event.code)) return;
    event.stopPropagation(); // no game key, no pause
    if (event.key === 'Escape' || keys.inventory.includes(event.code)) {
      event.preventDefault();
      if (!event.repeat) this.hide(true);
      return;
    }
    const slot = this.cells.indexOf(event.target as HTMLButtonElement);
    const step = ARROWS[event.key];
    if (slot < 0) return; // on Close, Take out: their own keys (Enter, Space, Tab)
    if (step) {
      event.preventDefault();
      this.cells[this.beside(slot, step)]?.focus();
    } else if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault(); // not also a click
      this.activate(slot, true);
    }
  }

  /** The slot `rows` and `columns` away on screen from `slot`, stopping at the edges. */
  private beside(slot: number, [rows, columns]: readonly [number, number]): number {
    const column = slot % HOTBAR_SLOTS;
    const row = Math.min(Math.max(ROWS.indexOf(slot - column) + rows, 0), ROWS.length - 1);
    return (ROWS[row] ?? 0) + Math.min(Math.max(column + columns, 0), HOTBAR_SLOTS - 1);
  }

  /**
   * A click, Enter or Space on a slot (`half`: right click, Shift+Enter): picks its stack (or the
   * larger half), or puts the picked one there through the inventory — an empty slot, onto the
   * same item, or swapped with another item's whole stack; its own slot drops the pick. A move the
   * inventory refuses keeps the pick.
   */
  private activate(slot: number, half: boolean): void {
    const picked = this.picked;
    this.picked = null; // before the move: its InventoryChanged draws the slots without the pick
    if (!picked) {
      const count = this.game.inventory.at(slot)?.placements.length ?? 0;
      if (count > 0) this.picked = { slot, count: half ? Math.ceil(count / 2) : count };
    } else if (picked.slot !== slot && !this.game.inventory.move(picked.slot, slot, picked.count)) {
      this.picked = picked;
    }
    this.cells[slot]?.focus();
    this.render();
  }

  /** Texts that change only with the language. */
  private renderLabels(): void {
    const { config, texts: t } = this.game;
    this.hotbar.setAttribute('aria-label', t.ui('inventory.hotbar', 'Hotbar'));
    this.title.textContent = t.ui('inventory.title', 'Inventory');
    this.closeButton.textContent = t.ui('inventory.close', 'Close');
    this.takeOutLabel.textContent = t.ui('inventory.takeOut', 'Take out');
    this.wornTitle.textContent = t.ui('inventory.worn', 'Worn');
    this.wornNote.textContent = t.ui(
      'inventory.wornNote',
      'Protective equipment is worn, not carried: put it back where you took it; used gloves go into the waste bin.',
    );
    this.help.textContent = t.ui(
      'inventory.help',
      'Enter or click: pick a stack, then the slot it goes to (onto the same item it adds up, onto another item they swap). Shift+Enter or right click: pick half. Arrows: move. {inventory} or Esc: close.',
      { inventory: keyLabel(config.input.bindings.inventory[0], t) },
    );
  }

  /** Everything that follows the inventory, the hands and what is worn. */
  private render(): void {
    for (const [slot, cell] of this.cells.entries()) {
      this.fill(cell, slot);
      cell.tabIndex = slot === this.current ? 0 : -1; // one Tab stop in the grid; arrows move inside
      cell.setAttribute('aria-selected', String(this.picked?.slot === slot));
      const onBar = this.bar[slot];
      if (onBar) this.fill(onBar, slot);
    }
    this.renderLabel();
    this.renderDetails();
    this.renderWorn();
  }

  /** One slot, on the hotbar or in the panel: picture, count, key; its name for screen readers. */
  private fill(element: HTMLElement, slot: number): void {
    const { inventory, content, config, texts: t } = this.game;
    const stack = inventory.at(slot);
    const item = stack ? content.items.tryGet(stack.item) : undefined;
    const count = stack?.placements.length ?? 0;
    const action = HOTBAR_KEYS[slot];
    element.replaceChildren(
      ...(action ? [el('span', 'slot-key', keyLabel(config.input.bindings[action][0], t))] : []),
      ...(item
        ? [
            picture(
              item,
              stack?.placements.some((id) => this.game.papers.paper(id)?.marked) ?? false,
            ),
          ]
        : []),
      ...(item && count > 1 ? [el('span', 'slot-count', String(count))] : []),
    );
    element.toggleAttribute('data-decorative', item?.inventory?.decorative === true);
    element.setAttribute('aria-current', String(slot === inventory.selected));
    element.setAttribute(
      'aria-label',
      item
        ? t.ui('inventory.slot', 'Slot {n}: {item}', { n: slot + 1, item: this.named(item, count) })
        : t.ui('inventory.slotEmpty', 'Slot {n}: empty', { n: slot + 1 }),
    );
  }

  /** An item's name, with the count when there are more than one, marked when decorative. */
  private named(item: ItemDefinition, count: number): string {
    const t = this.game.texts;
    const name = t.of(item, 'displayName');
    const counted = count > 1 ? `${name} × ${count}` : name;
    return item.inventory?.decorative
      ? t.ui('inventory.decorativeName', '{item} (decorative)', { item: counted })
      : counted;
  }

  /** Above the hotbar: the selected item, and the key that takes it out while the hands are free. */
  private renderLabel(): void {
    const { inventory, interaction, content, config, texts: t } = this.game;
    const stack = inventory.at(inventory.selected);
    const item = stack ? content.items.tryGet(stack.item) : undefined;
    this.label.replaceChildren();
    if (!stack || !item) return;
    this.label.append(el('span', undefined, this.named(item, stack.placements.length)));
    // Held in the hands, nothing to take out; a bag-only item (a test paper) is used with E instead.
    if (interaction.heldEntity || item.inventory?.virtual) return;
    this.label.append(
      el('kbd', undefined, keyLabel(config.input.bindings.stow[0], t)),
      el('span', undefined, ` ${t.ui('inventory.takeOut', 'Take out')}`),
    );
  }

  /** The focused slot: what is picked, the item's name, amount and mass, decorative or not. */
  private renderDetails(): void {
    const { inventory, interaction, content, texts: t } = this.game;
    const stack = inventory.at(this.current);
    const item = stack ? content.items.tryGet(stack.item) : undefined;
    const holding = interaction.heldEntity !== null;
    const pickedStack = this.picked && inventory.at(this.picked.slot);
    const pickedItem = pickedStack ? content.items.tryGet(pickedStack.item) : undefined;
    const lines: HTMLElement[] = [];
    if (this.picked && pickedItem) {
      const what = this.named(pickedItem, this.picked.count);
      lines.push(
        el(
          'p',
          'inventory-picked',
          t.ui('inventory.picked', 'Picked: {item}. Choose the slot it goes to.', { item: what }),
        ),
      );
    }
    if (stack && item) {
      lines.push(
        el('strong', undefined, t.of(item, 'displayName')),
        el(
          'p',
          undefined,
          t.ui('inventory.amount', '{count} in this slot, up to {stack} · mass {mass}', {
            count: stack.placements.length,
            stack: item.inventory?.stack ?? 1,
            mass: formatQuantity(item.physical.massKg, 'kg'),
          }),
        ),
      );
      if (item.inventory?.decorative) {
        const text = t.ui('inventory.decorative', 'Decorative: nothing in the lab uses it.');
        lines.push(el('p', 'inventory-decorative', text));
      }
      const description = t.of(item, 'description');
      if (description) lines.push(el('p', undefined, description));
      if (item.inventory?.virtual) {
        const text = t.ui(
          'inventory.stays',
          'This stays in your bag: choose it, then press E to use it.',
        );
        lines.push(el('p', 'inventory-note', text));
      }
    } else {
      lines.push(el('p', undefined, t.ui('inventory.emptySlot', 'Empty slot.')));
    }
    if (holding) {
      const full = t.ui(
        'inventory.handsFull',
        'Your hands are full: put away or drop what you hold first.',
      );
      lines.push(el('p', 'inventory-note', full));
    }
    this.takeOutButton.disabled = !item || holding || item.inventory?.virtual === true;
    this.details.replaceChildren(...lines);
  }

  /**
   * What is worn, from the equipment (shown, never stored here): drawn on the figure, and slot by
   * slot as its icon, its name and what is worn there (one list item each) or "Not worn".
   */
  private renderWorn(): void {
    const { equipment, content, texts: t } = this.game;
    const worn = equipment.worn.flatMap((id) => content.items.tryGet(id) ?? []);
    this.figure.replaceChildren(...silhouette());
    this.wornSlots.replaceChildren(
      ...Object.entries(SLOTS).map(([slot, { name, crop, draw }]) => {
        const items = worn.filter((item) => item.wornOn === slot);
        const colour = items[0]?.visual.color;
        if (colour) this.figure.append(...draw(colour));
        const icon = svg('svg', { viewBox: crop, 'aria-hidden': 'true' });
        icon.append(...silhouette(), ...(colour ? draw(colour) : []));
        const term = el('dt');
        term.append(icon, el('span', undefined, name(t)));
        const value = el('dd');
        if (items.length === 0) {
          value.className = 'equip-empty';
          value.textContent = t.ui('inventory.notWorn', 'Not worn');
        } else {
          const list = el('ul');
          list.append(...items.map((item) => el('li', undefined, t.of(item, 'displayName'))));
          value.append(list);
        }
        const row = el('div', 'equip-slot');
        row.append(term, value);
        return row;
      }),
    );
  }
}
