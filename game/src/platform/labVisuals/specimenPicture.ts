import { SPECIMENS } from '../../simulation/models/microscope';

/*
 * The microscope monitor's picture, painted on a 2D canvas context: pure drawing (no three.js, no
 * DOM lookups), shared by the 3D bench screen and any 2D workspace.
 */

/** The parts of CanvasRenderingContext2D the painter uses, so a stub or a 2D workspace's context fits. */
export type Ctx = Pick<
  CanvasRenderingContext2D,
  | 'arc'
  | 'beginPath'
  | 'closePath'
  | 'ellipse'
  | 'fill'
  | 'fillStyle'
  | 'fillText'
  | 'font'
  | 'globalAlpha'
  | 'lineTo'
  | 'lineWidth'
  | 'moveTo'
  | 'rect'
  | 'stroke'
  | 'strokeStyle'
  | 'textAlign'
  | 'textBaseline'
>;

/** How each slide's cells are drawn on the monitor (SPECIMENS order); L is the slide's cell length. */
export const CELLS = [
  { kind: 'brick', across: 0.22, nucleus: true, chloroplasts: 0 }, // files of cells 250 × 55 µm
  { kind: 'sheet', across: 1, nucleus: true, chloroplasts: 0 }, // flat, round, side by side
  { kind: 'brick', across: 0.4, nucleus: false, chloroplasts: 14 }, // boxes 80 × 32 µm, full of them
] as const;

/** The monitor's inks by stain (STAINS order): what each stain colours in bright field. */
export const INK = {
  background: ['#f3f1ea', '#f2e8c9', '#e9eef7'],
  cytoplasm: ['#e6e4de', '#e4d39c', '#d2dcf0'],
  wall: ['#9aa0a6', '#9c6a1e', '#3b55a8'],
  nucleus: ['#a7adb3', '#6b4512', '#1f3380'],
  chloroplast: ['#43943c', '#5a6e26', '#2e6e5a'],
} as const;

/**
 * The nosepiece's objectives in slot order (DIN achromats): their magnification (the `objective`
 * dial's value), working distance and radius (m) and colour band.
 */
export const NOSEPIECE = [
  { magnification: 4, workingDistance: 0.018, radius: 0.0075, band: '#d03a2f' },
  { magnification: 10, workingDistance: 0.007, radius: 0.008, band: '#e8c227' },
  { magnification: 40, workingDistance: 0.0006, radius: 0.0085, band: '#2f67c9' },
] as const;

/** The fine focus moves the stage this far per turn (µm). */
export const FINE_PITCH = 200;

/** The specimen's tint under the coverslip, by slide (SPECIMENS order) and stain (STAINS order). */
export const PATCH_INK = [
  ['#e9e4d6', '#c9953a', '#5a74c0'], // onion: colourless; iodine yellow-brown; methylene blue
  ['#e4e2dc', '#dcc58a', '#4b63b5'], // cheek cells: colourless; weakly yellow; blue
  ['#4f9a44', '#6b7a2a', '#3d7a63'], // Elodea: its chloroplasts' green; either stain darkens it
] as const;

/** Its size (x, z scale of a 12 mm disc) by slide: a peel of onion skin, a smear, a narrow leaf. */
export const PATCH_SHAPE = [
  [1, 0.85],
  [1.1, 1.1],
  [0.7, 0.25],
] as const;

/** Blur radii (px) the screen is drawn at: a few levels, so a run redraws it only a few times. */
export const BLUR_LEVELS = [0, 1, 2, 3, 5, 8, 12, 18, 26, 40] as const;

/** The blur level at sharpness S: the circle of confusion grows as |2Δz/d| = √(1/S − 1). */
export function blurLevel(sharpness: number): number {
  const px = Math.min(40, 3 * Math.sqrt(Math.max(0, 1 / sharpness - 1)));
  let best = 0;
  for (let i = 1; i < BLUR_LEVELS.length; i++) {
    if (Math.abs((BLUR_LEVELS[i] ?? 0) - px) < Math.abs((BLUR_LEVELS[best] ?? 0) - px)) best = i;
  }
  return best;
}

/** The scale bar's length (µm): the roundest that fits a quarter of the field. */
export function scaleBar(fieldOfView: number): number {
  for (const bar of [1000, 500, 200, 100, 50, 20]) if (bar <= fieldOfView / 4) return bar;
  return 10;
}

/** A deterministic sequence in [0, 1): the same picture every time (never Math.random). */
export function sequence(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Pixels per µm the picture is drawn at: a cell at least 2 px, however wide the field, so the drawing stays bounded. */
export function pixelsPerMicron(r: number, fieldOfView: number, specimen: number): number {
  return Math.max((2 * r) / fieldOfView, 2 / (SPECIMENS[specimen]?.length ?? 100));
}

/** Whether the slide's cells are big enough (at `px` per µm) to be drawn with their nuclei and chloroplasts. */
export function hasDetail(specimen: number, px: number): boolean {
  const style = CELLS[specimen] ?? CELLS[0];
  const L = SPECIMENS[specimen]?.length ?? 100;
  return style.kind === 'brick' ? L * style.across * px >= 6 : (L * px) / 2 >= 4;
}

/** A structure the painter draws; a sheet's outline is the cell membrane, a brick's the wall. */
export type Structure = 'wall' | 'membrane' | 'cytoplasm' | 'nucleus' | 'chloroplast';

const outline = (specimen: number): Structure =>
  (CELLS[specimen] ?? CELLS[0]).kind === 'sheet' ? 'membrane' : 'wall';

const OUTLINE = CELLS.map((_, i) => Object.freeze<Structure[]>([outline(i)]));
const COARSE = CELLS.map((_, i) => Object.freeze<Structure[]>([outline(i), 'cytoplasm']));
const FINE = CELLS.map((style, i) => {
  const list: Structure[] = [outline(i), 'cytoplasm'];
  if (style.nucleus) list.push('nucleus');
  if (style.chloroplasts > 0) list.push('chloroplast');
  return Object.freeze(list);
});

/**
 * The structures `paintCells` draws for a slide at `px` per µm, from its own table and detail
 * threshold, so a label can never name what the picture lacks. Elodea's tissue below the detail
 * threshold is one green fill: only its walls are drawn as a structure.
 */
export function drawnStructures(specimen: number, px: number): readonly Structure[] {
  const i = CELLS[specimen] ? specimen : 0;
  if (hasDetail(i, px)) return FINE[i] ?? [];
  return ((CELLS[i]?.chloroplasts ?? 0) > 0 ? OUTLINE[i] : COARSE[i]) ?? [];
}

/** The ink a structure is drawn in on a stain. */
export function structureInk(structure: Structure, stain: number): string {
  const ink =
    structure === 'wall' || structure === 'membrane'
      ? INK.wall
      : structure === 'cytoplasm'
        ? INK.cytoplasm
        : structure === 'nucleus'
          ? INK.nucleus
          : INK.chloroplast;
  return ink[stain] ?? ink[0];
}

/**
 * The slide's cells about the origin, out to radius `r` (px), at `px` pixels per µm (L µm long
 * along x, the line counted): their walls, nuclei and chloroplasts inked at `alpha`, the contrast
 * (0–1). Detail too small to show (a few pixels) is left out: tissue is then its cells' colour,
 * filled once, and their walls stroked once. Cells wholly outside the field are not drawn.
 */
export function paintCells(
  f: Ctx,
  r: number,
  specimen: number,
  stain: number,
  px: number,
  alpha: number,
) {
  const style = CELLS[specimen] ?? CELLS[0];
  const L = SPECIMENS[specimen]?.length ?? 100;
  const rand = sequence(7 + specimen * 31 + stain);
  const cyto = INK.cytoplasm[stain] ?? INK.cytoplasm[0];
  const wall = INK.wall[stain] ?? INK.wall[0];
  const nucleus = INK.nucleus[stain] ?? INK.nucleus[0];
  const chloroplast = INK.chloroplast[stain] ?? INK.chloroplast[0];
  const disc = (x: number, y: number, radius: number) => {
    f.beginPath();
    f.arc(x, y, radius, 0, 2 * Math.PI);
    f.fill();
  };
  /** The tissue drawn as one path: its cells' colour filled, then their walls stroked. */
  const tissue = (color: string, fillAlpha: number) => {
    f.globalAlpha = fillAlpha;
    f.fillStyle = color;
    f.fill();
    f.globalAlpha = alpha;
    f.strokeStyle = wall;
    f.stroke();
  };
  if (style.kind === 'brick') {
    // Files of cells, each row half a cell on from the last, lengths a little uneven.
    const l = L * px;
    const w = L * style.across * px;
    const detail = hasDetail(specimen, px);
    const green = style.chloroplasts > 0 && !detail;
    f.lineWidth = Math.max(1, 2.5 * px);
    const rows = Math.ceil(r / w) + 1;
    const cols = Math.ceil(r / l) + 2;
    if (!detail) f.beginPath();
    for (let j = -rows; j <= rows; j++) {
      const y = j * w;
      const shift = j % 2 ? l / 2 : 0;
      for (let i = -cols; i <= cols; i++) {
        const x = i * l + shift + (rand() - 0.5) * 0.1 * l;
        const length = l * (0.9 + 0.2 * rand());
        // The cell's nearest point to the field's centre.
        const nx = Math.min(Math.max(0, x), x + length);
        const ny = Math.min(Math.max(0, y), y + w);
        if (nx * nx + ny * ny > r * r) continue;
        if (!detail) {
          f.rect(x, y, length, w);
          continue;
        }
        f.beginPath();
        f.rect(x, y, length, w);
        tissue(cyto, 0.6);
        if (style.nucleus) {
          f.fillStyle = nucleus;
          f.beginPath();
          f.ellipse(
            x + length * (0.15 + 0.7 * rand()),
            y + w * (0.2 + 0.6 * rand()),
            Math.max(1, 0.06 * l),
            Math.max(0.7, 0.04 * l),
            0,
            0,
            2 * Math.PI,
          );
          f.fill();
        }
        f.fillStyle = chloroplast;
        for (let k = 0; k < style.chloroplasts; k++) {
          disc(x + length * (0.08 + 0.84 * rand()), y + w * (0.14 + 0.72 * rand()), 2.5 * px);
        }
      }
    }
    if (!detail) tissue(green ? chloroplast : cyto, green ? 0.85 * alpha : 0.6);
    return;
  }
  // A sheet of flat cells side by side, one per L, as the count has them: each an irregular
  // outline round its nucleus, a little off its place in the grid.
  const spacing = L * px;
  const radius = spacing / 2;
  const detail = hasDetail(specimen, px);
  f.lineWidth = Math.max(1, 1.5 * px);
  const n = Math.ceil(r / spacing) + 1;
  if (!detail) f.beginPath();
  for (let j = -n; j <= n; j++) {
    for (let i = -n; i <= n; i++) {
      const cx = i * spacing + (rand() - 0.5) * 0.2 * spacing;
      const cy = j * spacing + (rand() - 0.5) * 0.2 * spacing;
      if (Math.hypot(cx, cy) > r + radius) continue;
      if (!detail) {
        // A few pixels across: a round outline, its nucleus too small to show.
        f.moveTo(cx + radius, cy);
        f.arc(cx, cy, radius, 0, 2 * Math.PI);
        continue;
      }
      f.beginPath();
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * 2 * Math.PI;
        const rr = radius * (0.78 + 0.3 * rand());
        if (k) f.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
        else f.moveTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
      }
      f.closePath();
      tissue(cyto, 0.2 + 0.5 * alpha);
      f.fillStyle = nucleus;
      disc(cx + (rand() - 0.5) * 0.2 * radius, cy + (rand() - 0.5) * 0.2 * radius, 0.18 * radius);
      if (radius < 8) continue; // granules under a pixel across: not drawn
      f.globalAlpha = 0.5 * alpha;
      for (let k = 0; k < 4; k++) {
        disc(cx + (rand() - 0.5) * radius, cy + (rand() - 0.5) * radius, Math.max(0.6, 0.8 * px));
      }
    }
  }
  if (!detail) tissue(cyto, 0.2 + 0.5 * alpha);
}

/** The camera software's overlay: the magnification and a scale bar at the field's true scale. */
export function paintOverlay(
  c: Ctx,
  w: number,
  h: number,
  r: number,
  fov: number,
  magnification: number,
) {
  c.globalAlpha = 1;
  c.fillStyle = '#f2f4f6';
  c.strokeStyle = '#f2f4f6';
  c.textAlign = 'left';
  c.textBaseline = 'top';
  c.font = '600 22px system-ui, sans-serif';
  c.fillText(`${Math.round(magnification)}×`, 12, 10);
  const bar = scaleBar(fov);
  const x1 = w - 14;
  const x0 = x1 - (bar * 2 * r) / fov;
  const y = h - 18;
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(x0, y);
  c.lineTo(x1, y);
  c.moveTo(x0, y - 6);
  c.lineTo(x0, y + 6);
  c.moveTo(x1, y - 6);
  c.lineTo(x1, y + 6);
  c.stroke();
  c.textAlign = 'right';
  c.textBaseline = 'bottom';
  c.font = '600 18px system-ui, sans-serif';
  c.fillText(bar >= 1000 ? `${bar / 1000} mm` : `${bar} µm`, x1, y - 6);
}

// ---- the field of view: the picture, its blur, the field stop -------------------------------

const STANDBY = '#2a2e33';
const BLACK = '#07080a';

/** Whether the camera shows a picture: a run exists and its field and sharpness are known. */
export const fieldIsLive = (run: boolean, fieldOfView: number, sharpness: number): boolean =>
  run && fieldOfView > 0 && Number.isFinite(sharpness);

/** Two same-size canvases' contexts: the visible one, and the sharp picture composited onto it through the blur. */
export interface FieldSurface {
  readonly screen: CanvasRenderingContext2D;
  readonly buffer: CanvasRenderingContext2D;
  readonly bufferImage: CanvasImageSource;
  readonly width: number;
  readonly height: number;
}

/**
 * Draws the field (`live`) or standby grey, only when what it shows changed: the slide, stain,
 * field of view and contrast (the sharp picture), the magnification (its overlay) or the blur
 * level. The field is a circle of radius 0.47 of the height; the eyepiece's field stop lies in the
 * image plane, so its edge stays sharp at any focus. Returns true when it drew.
 */
export type FieldPainter = (
  live: boolean,
  specimen: number,
  stain: number,
  fieldOfView: number,
  magnification: number,
  contrast: number,
  level: number,
) => boolean;

export function createFieldPainter({
  screen: c,
  buffer: f,
  bufferImage,
  width: w,
  height: h,
}: FieldSurface): FieldPainter {
  const r = h * 0.47;
  let shown: boolean | null = null;
  let specimen = NaN;
  let stain = NaN;
  let fov = NaN;
  let contrast = NaN;
  let magnification = NaN;
  let level = NaN;
  return (live, sp, st, fo, mg, co, lv) => {
    const picture =
      live &&
      !(
        Object.is(sp, specimen) &&
        Object.is(st, stain) &&
        Object.is(fo, fov) &&
        Object.is(co, contrast)
      );
    if (!picture && live === shown && Object.is(lv, level) && Object.is(mg, magnification)) {
      return false;
    }
    shown = live;
    specimen = sp;
    stain = st;
    fov = fo;
    contrast = co;
    magnification = mg;
    level = lv;
    c.filter = 'none';
    c.globalAlpha = 1;
    if (!live) {
      c.fillStyle = STANDBY;
      c.fillRect(0, 0, w, h);
      return true;
    }
    if (picture) {
      f.globalAlpha = 1;
      f.fillStyle = BLACK;
      f.fillRect(0, 0, w, h);
      f.save();
      f.translate(w / 2, h / 2);
      f.beginPath();
      f.arc(0, 0, r, 0, 2 * Math.PI);
      f.clip();
      f.fillStyle = INK.background[st] ?? INK.background[0];
      f.fillRect(-r, -r, 2 * r, 2 * r);
      paintCells(f, r, sp, st, pixelsPerMicron(r, fo, sp), Math.min(1, Math.max(0, co)));
      f.restore();
    }
    c.fillStyle = BLACK;
    c.fillRect(0, 0, w, h);
    const px = BLUR_LEVELS[lv] ?? 0;
    c.filter = px > 0 ? `blur(${px}px)` : 'none';
    c.drawImage(bufferImage, 0, 0);
    c.filter = 'none';
    c.fillStyle = BLACK;
    c.beginPath();
    c.rect(0, 0, w, h);
    c.arc(w / 2, h / 2, r, 0, 2 * Math.PI, true);
    c.fill();
    paintOverlay(c, w, h, r, fo, mg);
    return true;
  };
}
