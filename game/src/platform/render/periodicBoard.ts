import * as THREE from 'three';
import raw from '../../content/periodic-table.json';
import {
  type Category,
  KJ_PER_MOL_PER_EV,
  parsePeriodicTable,
  type PeriodicElement,
  type PeriodicTable,
} from '../../content/periodicTable';
import type { Game } from '../../game/Game';
import {
  CARD,
  cardPlace,
  cellCentre,
  cellSize,
  COLUMNS,
  placeOf,
  TILE_SHARE,
} from '../../gameplay/periodic/layout';

/** The screen inside the display's frame (props/hub.ts `board`: 3 cm of frame a side). */
const FRAME_M = 0.03;
/** Canvas pixels per metre of the printed table, by graphics quality (Low-end memory first). */
const PX_PER_M = { low: 400, medium: 600, high: 600, ultra: 800 } as const;
/** How often (s) the display is looked for while it is not there. */
const LOOK_S = 1;
/** The card's pixels per metre (its size and place: gameplay/periodic/layout.ts `CARD`). */
const CARD_PX = 800;
const CARD_W = CARD.w;
const CARD_H = CARD.h;
/** Its fade (s) in and out. */
const FADE_S = 0.18;
const FONT = "'Segoe UI', system-ui, sans-serif";
const INK = '#14202b';
const PAPER = '#eef4fa';
const DIM = '#9fb0c0';
const LABEL = '#a9c7dc';
/** A solid colour per category (Phú: no gradients), dark ink readable on each. */
const COLOUR: Record<Category, string> = {
  'alkali-metal': '#ff8a7a',
  'alkaline-earth-metal': '#ffc27a',
  'transition-metal': '#ffe08a',
  'post-transition-metal': '#b8d98c',
  metalloid: '#8fd9c0',
  nonmetal: '#8cc8ff',
  halogen: '#a9b8ff',
  'noble-gas': '#d3a6ff',
  lanthanide: '#ffadd6',
  actinide: '#f29bb9',
};

const idle =
  typeof requestIdleCallback === 'function'
    ? (run: (deadline: IdleDeadline) => void) => requestIdleCallback(run, { timeout: 1500 })
    : (run: (deadline: IdleDeadline) => void) =>
        window.setTimeout(() => run({ didTimeout: true, timeRemaining: () => 8 }), 30);

/** "4s2 3d6" with its electron counts raised: "4s² 3d⁶". */
const SUPER = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const raised = (configuration: string) =>
  configuration.replace(
    /([spdf])(\d+)/g,
    (_, l: string, n: string) => l + n.replace(/\d/g, (d) => SUPER[Number(d)] ?? d),
  );

/** Significant figures of a number as its source wrote it (JSON keeps them but trailing zeros). */
function figures(value: number): number {
  const digits = String(Math.abs(value)).replace('.', '').replace(/^0+/, '');
  return Math.max(1, digits.length);
}

/** Decimals of a number as written. */
const decimals = (value: number) => String(value).split('.')[1]?.length ?? 0;

/**
 * The hub's periodic table display, drawn over its tiles (2026-11-14, Phú: "like a real periodic
 * table"): every tile printed with its element — atomic number, electronegativity, symbol, name,
 * atomic weight, electron configuration — in its category's colour, the groups and periods
 * numbered, a legend and a key; drawn in idle time a few tiles at a time once the display is there
 * (and again in another language). The element looked up (`game.periodic.view()`) lights its tile
 * and shows its card beside it: a pane of glass before the board with all its data, fading in and
 * out. Reads the system's view and the content; never decides anything.
 */
export class PeriodicBoard {
  private readonly table: PeriodicTable;
  private readonly holder = new THREE.Group();
  // Lit by the room, and lit from behind a little (a backlit acrylic display): its colours stay
  // clear on the hall's shaded wall.
  private readonly printMaterial = new THREE.MeshStandardMaterial({
    transparent: true,
    roughness: 0.6,
    metalness: 0,
    emissive: '#ffffff',
    emissiveIntensity: 0.45,
  });
  private readonly print = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.printMaterial);
  private printCanvas: HTMLCanvasElement | null = null;
  private printTexture: THREE.CanvasTexture | null = null;
  /** The print being drawn: the next element, the language it is in; null once done. */
  private drawing: { next: number; language: string } | null = null;
  private printed = '';
  private readonly glowMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  private readonly glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.glowMaterial);
  /** The card's canvas and texture, and the glow's, made the first time the display is found. */
  private cardCanvas: HTMLCanvasElement | null = null;
  private cardTexture: THREE.CanvasTexture | null = null;
  private readonly cardMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    opacity: 0,
  });
  private readonly card = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W, CARD_H),
    this.cardMaterial,
  );
  private boardId: string | null = null;
  private size: readonly [number, number, number] = [0, 0, 0];
  private since = Infinity;
  private shownKey = '';

  constructor(
    parent: THREE.Object3D,
    private readonly game: Game,
    /** Uploads a texture now (in idle time), so its first frame on screen does not. */
    private readonly upload: (texture: THREE.Texture) => void,
  ) {
    this.table = parsePeriodicTable(raw);
    this.holder.name = 'periodic-board';
    this.print.name = 'periodic-board-print';
    this.glow.name = 'periodic-board-glow';
    this.card.name = 'periodic-board-card';
    this.print.visible = false;
    this.glow.visible = false;
    this.card.visible = false;
    this.card.renderOrder = 2;
    this.glow.renderOrder = 1;
    this.holder.add(this.print, this.glow, this.card);
    this.holder.visible = false;
    parent.add(this.holder);
  }

  update(dt: number): void {
    const board = this.boardId ? this.game.world.entity(this.boardId) : undefined;
    if (!board) {
      this.since += dt;
      if (this.since < LOOK_S) return;
      this.since = 0;
      if (!this.find()) return;
    }
    this.selection(dt);
  }

  dispose(): void {
    this.holder.removeFromParent();
    this.drawing = null;
    this.print.geometry.dispose();
    this.printMaterial.dispose();
    this.printTexture?.dispose();
    this.glow.geometry.dispose();
    this.glowMaterial.map?.dispose();
    this.glowMaterial.dispose();
    this.card.geometry.dispose();
    this.cardMaterial.dispose();
    this.cardTexture?.dispose();
  }

  /** The display, found: placed, its print drawn (in idle time); false while there is none. */
  private find(): boolean {
    let board = null;
    for (const entity of this.game.world.allEntities()) {
      if (entity.item.tags.includes('periodic-table')) {
        board = entity;
        break;
      }
    }
    if (!board) {
      if (this.boardId) this.forget();
      return false;
    }
    if (typeof document === 'undefined') return false; // headless: nothing to draw on
    if (!this.cardCanvas) {
      this.glowMaterial.map = new THREE.CanvasTexture(glowPicture());
      const card = document.createElement('canvas');
      card.width = Math.round(CARD_W * CARD_PX);
      card.height = Math.round(CARD_H * CARD_PX);
      this.cardCanvas = card;
      this.cardTexture = new THREE.CanvasTexture(card);
      this.cardTexture.colorSpace = THREE.SRGBColorSpace;
      this.cardTexture.anisotropy = 4;
      this.cardMaterial.map = this.cardTexture;
    }
    this.boardId = board.id;
    const [w, h, d] = board.item.visual.size;
    this.size = [w, h, d];
    const [x, y, z] = board.pose.position;
    const [qx, qy, qz, qw] = board.pose.rotation;
    this.holder.position.set(x, y, z);
    this.holder.quaternion.set(qx, qy, qz, qw);
    this.holder.visible = true;
    // The panel's face (props/hub.ts `board`) and its tiles' faces, raised by `relief` off it.
    const front = -d / 2 + Math.min(0.03, d / 2);
    const relief = Math.min(0.015, d / 2 - front);
    this.print.scale.set(w - 2 * FRAME_M, h - 2 * FRAME_M, 1);
    this.print.position.set(0, 0, front + relief + 0.0008);
    this.glow.position.z = front + relief + 0.0016;
    this.card.position.z = front + CARD.out;
    this.since = 0;
    return true;
  }

  /** The display gone (its scene left): its print freed, drawn again when it comes back. */
  private forget(): void {
    this.boardId = null;
    this.holder.visible = false;
    this.print.visible = false;
    this.drawing = null;
    this.printed = '';
    this.printTexture?.dispose();
    this.printTexture = null;
    this.printMaterial.map = null;
    this.printMaterial.emissiveMap = null;
    this.printCanvas = null;
    this.shownKey = '';
    this.card.visible = false;
    this.glow.visible = false;
  }

  /** The print in the current language: started once, drawn a few tiles each idle period. */
  private startPrint(): void {
    const language = this.game.language;
    if (this.printed === language || this.drawing?.language === language) return;
    const [w, h] = this.size;
    const px = PX_PER_M[this.game.graphicsQuality];
    const canvas = document.createElement('canvas');
    canvas.width = Math.round((w - 2 * FRAME_M) * px);
    canvas.height = Math.round((h - 2 * FRAME_M) * px);
    this.printCanvas = canvas;
    this.drawing = { next: 0, language };
    const step = (deadline: IdleDeadline) => {
      const drawing = this.drawing;
      if (!drawing || drawing.language !== language || this.printCanvas !== canvas) return;
      const c = canvas.getContext('2d');
      if (!c) return;
      if (drawing.next === 0) this.drawFrame(c, canvas);
      while (drawing.next < 118 && (deadline.didTimeout || deadline.timeRemaining() > 3)) {
        this.drawTile(c, canvas, this.table.elements[drawing.next] as PeriodicElement);
        drawing.next++;
        if (deadline.didTimeout && drawing.next % 12 === 0) break;
      }
      if (drawing.next < 118) {
        idle(step);
        return;
      }
      this.drawing = null;
      this.printed = language;
      // Uploaded in an idle period of its own, then shown.
      idle(() => {
        if (this.printCanvas !== canvas) return;
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        this.upload(texture);
        this.printTexture?.dispose();
        this.printTexture = texture;
        this.printMaterial.map = texture;
        this.printMaterial.emissiveMap = texture;
        this.printMaterial.needsUpdate = true;
        this.print.visible = true;
      });
    };
    idle(step);
  }

  /** The tile looked up lit, its card beside it, both fading as they come and go. */
  private selection(dt: number): void {
    this.startPrint();
    const view = this.game.periodic.view();
    const now = view && view.boardId === this.boardId ? view : null;
    if (now) {
      const key = `${now.z}:${this.game.language}`;
      if (key !== this.shownKey) {
        this.shownKey = key;
        this.place(now.z);
      }
    }
    const target = now ? 1 : 0;
    const opacity = this.cardMaterial.opacity;
    // Towards the target and held there (at it, a step down then up blinked every other frame).
    const next =
      target >= opacity
        ? Math.min(target, opacity + dt / FADE_S)
        : Math.max(target, opacity - dt / FADE_S);
    this.cardMaterial.opacity = next;
    this.card.visible = next > 0;
    this.glow.visible = next > 0;
    // Steady (Phú: a breathing glow read as flicker).
    this.glowMaterial.opacity = next;
    if (next === 0 && !now) this.shownKey = '';
  }

  /** The glow on element `z`'s tile, and its card drawn and set beside it. */
  private place(z: number): void {
    const [w, h] = this.size;
    const unit = cellSize(w, h);
    const [cx, cy] = cellCentre(placeOf(z), unit);
    this.glow.position.x = cx;
    this.glow.position.y = cy;
    this.glow.scale.set(unit * 1.08, unit * 1.08, 1);
    // Beside the tile, towards the board's middle, where the system reads the aim on it.
    const { x, y, side } = cardPlace(z, w, h);
    this.card.position.x = x;
    this.card.position.y = y;
    const element = this.table.elements[z - 1];
    if (element) this.drawCard(element, side, (y - cy) / CARD_H);
    if (this.cardTexture) this.cardTexture.needsUpdate = true;
  }

  // ---- the print -------------------------------------------------------------------------------

  /** Where a cell's tile is on the print (px): its left, top and side. */
  private tileRect(canvas: HTMLCanvasElement, column: number, row: number) {
    const [w, h] = this.size;
    const unit = cellSize(w, h);
    const px = canvas.width / (w - 2 * FRAME_M);
    const [cx, cy] = cellCentre({ column, row }, unit);
    const side = TILE_SHARE * unit * px;
    return {
      x: canvas.width / 2 + cx * px - side / 2,
      y: canvas.height / 2 - cy * px - side / 2,
      side,
      unit: unit * px,
    };
  }

  /** The title, the legend, the key, the groups' and periods' numbers, the f block's marks. */
  private drawFrame(c: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
    const t = this.game.texts;
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.textBaseline = 'middle';
    const at = (column: number, row: number) => this.tileRect(canvas, column, row);
    const { unit, side } = at(0, 0);
    const font = (size: number, weight = 400) => `${weight} ${Math.round(size * unit)}px ${FONT}`;

    // The title over the d block's gap (row 0, columns 2–11).
    const left = at(2, 0);
    const right = at(11, 0);
    c.fillStyle = PAPER;
    c.textAlign = 'center';
    c.font = font(0.36, 700);
    c.fillText(
      t.ui('periodic.title', 'Periodic Table of the Elements'),
      (left.x + right.x + right.side) / 2,
      left.y + side * 0.5,
      right.x + right.side - left.x,
    );

    // The legend: two rows of five in rows 1–2, columns 2–11.
    CATEGORY_ORDER.forEach((category, i) => {
      const cell = at(2 + (i % 5) * 2, 1 + Math.floor(i / 5));
      const swatch = side * 0.42;
      c.fillStyle = COLOUR[category];
      c.beginPath();
      c.roundRect(cell.x, cell.y + (side - swatch) / 2, swatch, swatch, swatch * 0.15);
      c.fill();
      c.fillStyle = PAPER;
      c.textAlign = 'left';
      c.font = font(0.15, 600);
      c.fillText(
        categoryName(this.game, category),
        cell.x + swatch + side * 0.08,
        cell.y + side / 2,
        cell.unit * 2 - swatch - side * 0.2,
      );
    });

    // The key: iron's tile, its fields named beside it, over the p block's gap (row 0, columns 12–16).
    const key = at(12, 0);
    const iron = this.table.elements[25] as PeriodicElement;
    this.drawCell(c, key.x, key.y, side, iron, COLOUR[iron.category]);
    c.fillStyle = DIM;
    c.textAlign = 'left';
    c.font = font(0.13, 600);
    const lines = [
      t.ui('periodic.key.top', 'Atomic number · Electronegativity'),
      t.ui('periodic.key.symbol', 'Symbol'),
      t.ui('periodic.key.name', 'Name'),
      t.ui('periodic.key.weight', 'Standard atomic weight [mass number]'),
      t.ui('periodic.key.configuration', 'Electron configuration'),
    ];
    lines.forEach((line, i) => {
      c.fillText(line, key.x + side * 1.12, key.y + side * (0.1 + i * 0.2), key.unit * 3.9);
    });

    // Groups over each column's top tile; periods left of the first column.
    c.fillStyle = DIM;
    c.textAlign = 'center';
    // IUPAC's numbers 1–18 and, under them, the A/B names Vietnamese textbooks use.
    const tops = [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 0];
    for (let column = 0; column < COLUMNS; column++) {
      const top = at(column, tops[column] ?? 0);
      c.font = font(0.17, 700);
      c.fillText(String(column + 1), top.x + top.side / 2, top.y - top.side * 0.36);
      c.font = font(0.13, 600);
      c.fillText(GROUP_AB[column] ?? '', top.x + top.side / 2, top.y - top.side * 0.14);
    }
    c.textAlign = 'right';
    for (let row = 0; row < 7; row++) {
      const first = at(0, row);
      c.fillText(String(row + 1), first.x - first.side * 0.1, first.y + first.side / 2);
    }
    // Where the f block comes from (group 3 of periods 6, 7) and its rows' names.
    c.textAlign = 'center';
    c.font = font(0.16, 600);
    for (const [row, label] of [
      [5, '57–71'],
      [6, '89–103'],
    ] as const) {
      const gap = at(2, row);
      c.fillText(label, gap.x + gap.side / 2, gap.y + gap.side / 2);
    }
    c.textAlign = 'right';
    c.font = font(0.15, 700);
    for (const [row, label] of [
      [7.5, t.ui('periodic.lanthanides', 'Lanthanides')],
      [8.5, t.ui('periodic.actinides', 'Actinides')],
    ] as const) {
      const first = at(2, row);
      c.fillText(label, first.x - first.side * 0.12, first.y + first.side / 2, first.unit * 1.8);
    }
  }

  private drawTile(c: CanvasRenderingContext2D, canvas: HTMLCanvasElement, e: PeriodicElement) {
    const { column, row } = placeOf(e.z);
    const rect = this.tileRect(canvas, column, row);
    this.drawCell(c, rect.x, rect.y, rect.side, e, COLOUR[e.category]);
  }

  /** One tile: its colour, Z and electronegativity, symbol, name, weight, configuration. */
  private drawCell(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    side: number,
    e: PeriodicElement,
    colour: string,
  ): void {
    const s = side;
    c.fillStyle = colour;
    c.beginPath();
    c.roundRect(x, y, s, s, s * 0.06);
    c.fill();
    c.fillStyle = INK;
    c.textBaseline = 'middle';
    const pad = s * 0.07;
    const fit = (text: string, size: number, weight: number, cx: number, cy: number) => {
      c.font = `${weight} ${Math.round(size * s)}px ${FONT}`;
      c.fillText(text, cx, cy, s - 2 * pad);
    };
    c.textAlign = 'left';
    fit(String(e.z), 0.15, 700, x + pad, y + s * 0.12);
    c.textAlign = 'right';
    if (e.electronegativity !== null) {
      fit(String(e.electronegativity), 0.12, 600, x + s - pad, y + s * 0.12);
    }
    c.textAlign = 'center';
    fit(e.symbol, 0.34, 800, x + s / 2, y + s * 0.39);
    fit(e.name, 0.12, 600, x + s / 2, y + s * 0.62);
    fit(e.weight ?? `[${e.massNumber}]`, 0.115, 500, x + s / 2, y + s * 0.76);
    fit(raised(e.configuration), 0.1, 500, x + s / 2, y + s * 0.89);
  }

  // ---- the card --------------------------------------------------------------------------------

  /**
   * The card of element `e`: a pane of tinted glass, its tile large in its corner, its name and
   * kind, then its data label by label. `side`: the card is right (1) or left (−1) of the tile;
   * `offset`: the tile's height on the card from its middle (a share of the card), where the
   * pointer to the tile stands.
   */
  private drawCard(e: PeriodicElement, side: number, offset: number): void {
    const canvas = this.cardCanvas;
    const c = canvas?.getContext('2d');
    if (!canvas || !c) return;
    const t = this.game.texts;
    const W = canvas.width;
    const H = canvas.height;
    const u = W / 100;
    c.clearRect(0, 0, W, H);
    // The glass: one translucent colour, a bright rim, the pointer to the tile.
    const inset = 3 * u;
    // Tinted enough that the print behind it never crosses its words.
    c.fillStyle = 'rgba(10, 26, 38, 0.82)';
    c.strokeStyle = 'rgba(143, 230, 255, 0.9)';
    c.lineWidth = 0.6 * u;
    c.beginPath();
    c.roundRect(inset, inset, W - 2 * inset, H - 2 * inset, 2.4 * u);
    c.fill();
    c.stroke();
    const py = Math.min(H - 10 * u, Math.max(10 * u, H / 2 + offset * H));
    const edge = side > 0 ? inset : W - inset;
    c.fillStyle = 'rgba(143, 230, 255, 0.9)';
    c.beginPath();
    c.moveTo(edge - side * 2.6 * u, py);
    c.lineTo(edge + side * 0.4 * u, py - 2.6 * u);
    c.lineTo(edge + side * 0.4 * u, py + 2.6 * u);
    c.fill();

    // The tile, large, and the element's name and kind beside it.
    const tile = 30 * u;
    this.drawCell(c, 7 * u, 7 * u, tile, e, COLOUR[e.category]);
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    const x0 = 7 * u + tile + 4 * u;
    const width = W - x0 - 7 * u;
    c.fillStyle = PAPER;
    c.font = `700 ${Math.round(7.2 * u)}px ${FONT}`;
    c.fillText(e.name, x0, 15 * u, width);
    c.fillStyle = COLOUR[e.category];
    c.font = `700 ${Math.round(4 * u)}px ${FONT}`;
    c.fillText(categoryName(this.game, e.category), x0, 22 * u, width);
    const { column, row } = placeOf(e.z);
    const fBlock = row > 7;
    c.fillStyle = DIM;
    c.font = `500 ${Math.round(3.6 * u)}px ${FONT}`;
    c.fillText(
      fBlock
        ? t.ui('periodic.placeF', 'Period {period} · f block', { period: row > 8 ? 7 : 6 })
        : t.ui('periodic.place', 'Group {group} ({ab}) · Period {period}', {
            group: column + 1,
            ab: GROUP_AB[column] ?? '',
            period: row + 1,
          }),
      x0,
      28.5 * u,
      width,
    );
    c.fillText(t.ui('periodic.atomicNumber', 'Atomic number {z}', { z: e.z }), x0, 34 * u, width);

    // The data, label by label.
    const none = '—';
    const temperature = (k: number | null) => {
      if (k === null) return none;
      const places = decimals(k);
      return `${k} K (${(k - 273.15).toFixed(places)} °C)`;
    };
    // In kJ/mol (the textbooks' unit) to the figures the source gives in eV, never as 5e+1.
    const energy = (ev: number | null) =>
      ev === null
        ? none
        : `${Number((ev * KJ_PER_MOL_PER_EV).toPrecision(figures(ev)))} kJ/mol (${ev} eV)`;
    const predicted = (text: string, is: boolean) =>
      is ? t.ui('periodic.predicted', '{value} (predicted)', { value: text }) : text;
    const rows: [string, string][] = [
      [
        e.weight === null
          ? t.ui('periodic.massNumber', 'Mass number of its longest-lived isotope')
          : t.ui('periodic.weight', 'Standard atomic weight'),
        e.weight === null ? `[${e.massNumber}]` : `${e.weight} ± ${e.weightPlusMinus}`,
      ],
      [
        t.ui('periodic.configuration', 'Electron configuration'),
        predicted(raised(e.configuration), e.configurationPredicted),
      ],
      [
        t.ui('periodic.electronegativity', 'Electronegativity (Pauling)'),
        e.electronegativity === null ? none : String(e.electronegativity),
      ],
      [t.ui('periodic.oxidation', 'Oxidation states'), e.oxidationStates || none],
      [
        t.ui('periodic.state', 'State at room temperature'),
        predicted(stateName(this.game, e.state), e.statePredicted),
      ],
      [t.ui('periodic.melting', 'Melting point'), temperature(e.meltingK)],
      [t.ui('periodic.boiling', 'Boiling point'), temperature(e.boilingK)],
      [t.ui('periodic.density', 'Density'), e.density === null ? none : `${e.density} g/cm³`],
      [t.ui('periodic.ionization', 'First ionization energy'), energy(e.ionizationEnergyEv)],
      [t.ui('periodic.affinity', 'Electron affinity'), energy(e.electronAffinityEv)],
      [
        t.ui('periodic.radius', 'Van der Waals radius'),
        e.vanDerWaalsRadiusPm === null ? none : `${e.vanDerWaalsRadiusPm} pm`,
      ],
      [
        t.ui('periodic.discovered', 'Discovered'),
        e.discovered === 'ancient'
          ? t.ui('periodic.ancient', 'Known since antiquity')
          : String(e.discovered),
      ],
    ];
    let y = 46 * u;
    const lineH = 8 * u;
    for (const [label, value] of rows) {
      c.fillStyle = LABEL;
      c.font = `600 ${Math.round(2.9 * u)}px ${FONT}`;
      c.fillText(label, 7 * u, y, 86 * u);
      c.fillStyle = PAPER;
      c.font = `500 ${Math.round(3.5 * u)}px ${FONT}`;
      c.fillText(value, 7 * u, y + 4 * u, 86 * u);
      y += lineH;
    }
    c.fillStyle = DIM;
    c.font = `400 ${Math.round(2.3 * u)}px ${FONT}`;
    c.fillText(
      t.ui('periodic.source', 'Data: PubChem (NIH) · standard atomic weights: CIAAW 2021'),
      7 * u,
      H - 4.5 * u,
      86 * u,
    );
  }
}

/** The groups' A/B names (CAS), as Vietnamese textbooks name them, by IUPAC group 1–18. */
const GROUP_AB = [
  'IA',
  'IIA',
  'IIIB',
  'IVB',
  'VB',
  'VIB',
  'VIIB',
  'VIIIB',
  'VIIIB',
  'VIIIB',
  'IB',
  'IIB',
  'IIIA',
  'IVA',
  'VA',
  'VIA',
  'VIIA',
  'VIIIA',
] as const;

const CATEGORY_ORDER: readonly Category[] = [
  'alkali-metal',
  'alkaline-earth-metal',
  'transition-metal',
  'post-transition-metal',
  'metalloid',
  'nonmetal',
  'halogen',
  'noble-gas',
  'lanthanide',
  'actinide',
];

function categoryName(game: Game, category: Category): string {
  const t = game.texts;
  switch (category) {
    case 'alkali-metal':
      return t.ui('periodic.category.alkaliMetal', 'Alkali metal');
    case 'alkaline-earth-metal':
      return t.ui('periodic.category.alkalineEarthMetal', 'Alkaline earth metal');
    case 'transition-metal':
      return t.ui('periodic.category.transitionMetal', 'Transition metal');
    case 'post-transition-metal':
      return t.ui('periodic.category.postTransitionMetal', 'Post-transition metal');
    case 'metalloid':
      return t.ui('periodic.category.metalloid', 'Metalloid');
    case 'nonmetal':
      return t.ui('periodic.category.nonmetal', 'Nonmetal');
    case 'halogen':
      return t.ui('periodic.category.halogen', 'Halogen');
    case 'noble-gas':
      return t.ui('periodic.category.nobleGas', 'Noble gas');
    case 'lanthanide':
      return t.ui('periodic.category.lanthanide', 'Lanthanide');
    case 'actinide':
      return t.ui('periodic.category.actinide', 'Actinide');
  }
}

function stateName(game: Game, state: PeriodicElement['state']): string {
  const t = game.texts;
  if (state === 'solid') return t.ui('periodic.solid', 'Solid');
  if (state === 'liquid') return t.ui('periodic.liquid', 'Liquid');
  return t.ui('periodic.gas', 'Gas');
}

/** The lit tile's glow: a bright rounded rim and a faint light over the tile (added to it). */
function glowPicture(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const c = canvas.getContext('2d');
  if (!c) return canvas;
  c.fillStyle = 'rgba(255, 244, 200, 0.22)';
  c.beginPath();
  c.roundRect(10, 10, 108, 108, 10);
  c.fill();
  c.shadowColor = 'rgba(255, 230, 150, 1)';
  c.shadowBlur = 10;
  c.strokeStyle = 'rgba(255, 246, 210, 1)';
  c.lineWidth = 6;
  c.beginPath();
  c.roundRect(10, 10, 108, 108, 10);
  c.stroke();
  return canvas;
}
