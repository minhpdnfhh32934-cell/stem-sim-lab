/**
 * The 2D pictures of "Từ tế bào đến DNA" (Low tier, no WebGL 2, lost context, or the learner's
 * choice): the same sizes as the 3D scenes (`levels.ts`), flat, in nm with y up, fitted to the
 * canvas at one scale per level. The scale bar is drawn exactly `barNm` long at that scale; the
 * rest is illustration, as in 3D. Colours are theme tokens.
 */
import type { DrawContext } from '@/ui/canvas/useCanvas';
import { RADIUS, RISE, TWIST } from '../../central/dogma3d/bdna';
import { ROLES } from '../../view3d/palette';
import {
  COMPLEMENT,
  CORE_RADIUS_NM,
  DRAWN,
  HELIX_LENGTH_NM,
  LEVEL_PARTS,
  SIZE,
  WRAP_RADIUS_NM,
  baseAt,
  levelInfo,
  zoomSpot,
  type ZoomLevel,
  type ZoomPart,
} from './levels';

type V = readonly [number, number];

/** Room above the picture (the stage's chips) and below it (scale bar, caption). */
const TOP = 64;
const BOTTOM = 96;
const PAD = 24;

/** The drawn extent of each level (nm): width and height of the picture. */
function extent(level: ZoomLevel): V {
  switch (level) {
    case 'cell':
      return [DRAWN.cellNm, DRAWN.cellNm];
    case 'nucleus':
      return [SIZE.nucleusNm, SIZE.nucleusNm];
    case 'chromosome':
      return [2.6 * SIZE.chromatidNm, DRAWN.armNm[0] + DRAWN.armNm[1]];
    case 'fibre':
      return [SIZE.chromatidNm, SIZE.chromatidNm];
    case 'nucleosome':
      return [levelInfo(4).fieldNm, 2 * SIZE.fibreNm];
    case 'dna':
      return [HELIX_LENGTH_NM, 2 * RADIUS + 1];
  }
}

/** Where each named part is (nm), for its label. */
const ANCHOR: Record<ZoomLevel, Partial<Record<ZoomPart, V>>> = {
  cell: {
    membrane: [0, DRAWN.cellNm / 2],
    nucleus: [0, SIZE.nucleusNm / 2],
    mitochondrion: [DRAWN.cellNm * 0.3, DRAWN.cellNm * 0.12],
  },
  nucleus: {
    envelope: [SIZE.nucleusNm * 0.35, SIZE.nucleusNm * 0.35],
    pore: [0, SIZE.nucleusNm / 2],
    nucleolus: [-800, 1125],
    chromatin: [600, -400],
  },
  chromosome: {
    chromatid: [-SIZE.chromatidNm, DRAWN.armNm[1] * 0.7],
    centromere: [SIZE.chromatidNm * 0.3, 0],
  },
  fibre: { fibre: [-SIZE.chromatidNm * 0.35, SIZE.chromatidNm * 0.25], scaffold: [0, 300] },
  nucleosome: {
    histones: [0, 0],
    wrappedDna: [-WRAP_RADIUS_NM, WRAP_RADIUS_NM],
    linker: [(SIZE.fibreNm + DRAWN.linkerNm) / 2, 0],
  },
  dna: { backbone: [-HELIX_LENGTH_NM * 0.3, RADIUS], basePair: [HELIX_LENGTH_NM * 0.2, 0] },
};

/** nm → canvas pixels around the picture's centre (y up). */
class Pen {
  constructor(
    readonly ctx: CanvasRenderingContext2D,
    private readonly cx: number,
    private readonly cy: number,
    /** Pixels per nm. */
    readonly s: number,
  ) {}
  X(x: number) {
    return this.cx + x * this.s;
  }
  Y(y: number) {
    return this.cy - y * this.s;
  }
  circle(x: number, y: number, r: number) {
    this.ctx.beginPath();
    this.ctx.arc(this.X(x), this.Y(y), Math.max(0.5, r * this.s), 0, 2 * Math.PI);
  }
  line(pts: readonly V[]) {
    this.ctx.beginPath();
    pts.forEach(([x, y], i) => {
      if (i === 0) this.ctx.moveTo(this.X(x), this.Y(y));
      else this.ctx.lineTo(this.X(x), this.Y(y));
    });
  }
}

/** A small seeded generator (the same illustrative picture every time). */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Css = (name: string) => string;

function cell(p: Pen, css: Css) {
  const { ctx } = p;
  p.circle(0, 0, DRAWN.cellNm / 2);
  ctx.fillStyle = css('--bio3d-glass');
  ctx.fill();
  ctx.strokeStyle = css('--subject-biology');
  ctx.lineWidth = 2;
  ctx.stroke();
  const rand = seeded(3);
  ctx.fillStyle = css('--chart-3');
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * 2 * Math.PI;
    const d = SIZE.nucleusNm / 2 + 2200 + rand() * 3500;
    ctx.beginPath();
    ctx.ellipse(
      p.X(Math.cos(a) * d),
      p.Y(Math.sin(a) * d),
      900 * p.s,
      380 * p.s,
      a,
      0,
      2 * Math.PI,
    );
    ctx.fill();
  }
  p.circle(0, 0, SIZE.nucleusNm / 2);
  ctx.fillStyle = css('--chart-6');
  ctx.fill();
}

function nucleus(p: Pen, css: Css) {
  const { ctx } = p;
  const R = SIZE.nucleusNm / 2;
  p.circle(0, 0, R);
  ctx.fillStyle = css('--bio3d-glass');
  ctx.fill();
  ctx.strokeStyle = css('--chart-6');
  ctx.lineWidth = 2;
  for (const r of [R, R - 90]) {
    p.circle(0, 0, r);
    ctx.stroke();
  }
  ctx.fillStyle = css('--bg-stage');
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * 2 * Math.PI;
    p.circle(Math.cos(a) * (R - 45), Math.sin(a) * (R - 45), 70);
    ctx.fill();
  }
  p.circle(-800, 550, 575);
  ctx.fillStyle = css('--chart-4');
  ctx.fill();
  const rand = seeded(5);
  ctx.strokeStyle = css('--chart-6');
  ctx.lineWidth = 1.5;
  for (let k = 0; k < 7; k++) {
    let x = (rand() - 0.5) * 2600;
    let y = (rand() - 0.5) * 2600;
    const pts: V[] = [[x, y]];
    for (let i = 0; i < 12; i++) {
      x += (rand() - 0.5) * 900;
      y += (rand() - 0.5) * 900;
      const d = Math.hypot(x, y);
      if (d > R * 0.8) {
        x *= (R * 0.78) / d;
        y *= (R * 0.78) / d;
      }
      pts.push([x, y]);
    }
    p.line(pts);
    ctx.stroke();
  }
}

function chromosome(p: Pen, css: Css) {
  const { ctx } = p;
  const w = SIZE.chromatidNm;
  const [a, b] = DRAWN.armNm;
  ctx.lineCap = 'round';
  ctx.strokeStyle = css('--chart-6');
  ctx.lineWidth = Math.max(1, w * p.s);
  for (const side of [-1, 1]) {
    // Each chromatid: a round-ended rod as wide as the measured chromatid (its centre line).
    const x = side * w * 0.5;
    p.line([
      [x + side * a * 0.05, -a + w / 2],
      [x, 0],
      [x + side * b * 0.05, b - w / 2],
    ]);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

function fibre(p: Pen, css: Css) {
  const { ctx } = p;
  const R = SIZE.chromatidNm / 2;
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = css('--text-muted');
  ctx.lineWidth = 1;
  ctx.strokeRect(p.X(-R), p.Y(R), 2 * R * p.s, 2 * R * p.s);
  ctx.setLineDash([]);
  ctx.strokeStyle = css('--chart-6');
  ctx.lineWidth = Math.max(1, SIZE.fibreNm * p.s);
  const n = DRAWN.loopsPerRing;
  for (let k = 0; k < n; k++) {
    const y0 = ((k + 0.5) / n - 0.5) * 2 * R * 0.9;
    for (const side of [-1, 1]) {
      const pts: V[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const reach = (R - SIZE.fibreNm) * Math.sin(Math.PI * t);
        pts.push([side * reach, y0 + 14 * Math.sin(2 * Math.PI * t)]);
      }
      p.line(pts);
      ctx.stroke();
    }
  }
  ctx.fillStyle = css('--bio3d-protein');
  ctx.fillRect(p.X(-12), p.Y(R), 24 * p.s, 2 * R * p.s);
}

function nucleosomes(p: Pen, css: Css) {
  const { ctx } = p;
  const step = SIZE.fibreNm + DRAWN.linkerNm;
  const nn = DRAWN.nucleosomes;
  const half = levelInfo(4).fieldNm / 2;
  ctx.strokeStyle = css('--chart-6');
  ctx.lineWidth = Math.max(1, SIZE.dnaNm * p.s);
  p.line([
    [-half, 0],
    [half, 0],
  ]);
  ctx.stroke();
  for (let k = 0; k < nn; k++) {
    const cx = (k - (nn - 1) / 2) * step;
    p.circle(cx, 0, CORE_RADIUS_NM);
    ctx.fillStyle = css('--bio3d-protein');
    ctx.fill();
    p.circle(cx, 0, WRAP_RADIUS_NM);
    ctx.stroke();
  }
}

function helix(p: Pen, css: Css) {
  const { ctx } = p;
  const n = DRAWN.helixBp;
  const x0 = -HELIX_LENGTH_NM / 2;
  const base = (b: string) =>
    css(ROLES[b === 'A' ? 'baseA' : b === 'T' ? 'baseT' : b === 'G' ? 'baseG' : 'baseC'].token);
  ctx.lineWidth = Math.max(2, 0.25 * p.s);
  for (let i = 0; i < n; i++) {
    const x = x0 + i * RISE;
    const y = RADIUS * Math.cos(i * TWIST);
    const b = baseAt(i);
    ctx.strokeStyle = base(b);
    p.line([
      [x, y],
      [x, 0],
    ]);
    ctx.stroke();
    ctx.strokeStyle = base(COMPLEMENT[b]);
    p.line([
      [x, 0],
      [x, -y],
    ]);
    ctx.stroke();
  }
  ctx.lineWidth = Math.max(2, 0.24 * p.s);
  for (const [sign, tok] of [
    [1, '--dna3d-coding'],
    [-1, '--dna3d-template'],
  ] as const) {
    const pts: V[] = [];
    for (let i = 0; i <= 4 * (n - 1); i++) {
      const t = i / 4;
      pts.push([x0 + t * RISE, sign * RADIUS * Math.cos(t * TWIST)]);
    }
    ctx.strokeStyle = css(tok);
    p.line(pts);
    ctx.stroke();
  }
}

const DRAW: Record<ZoomLevel, (p: Pen, css: Css) => void> = {
  cell,
  nucleus,
  chromosome,
  fibre,
  nucleosome: nucleosomes,
  dna: helix,
};

/** What a drawn picture measures (tests: the scale bar's pixels are barNm × pxPerNm). */
export interface Drawn2D {
  pxPerNm: number;
  barPx: number;
}

/**
 * Draws level `index`: the picture, the next level's spot (dashed accent ring), the part names
 * (`names`, or null: none) and the scale bar with its text.
 */
export function drawZoom(
  d: DrawContext,
  index: number,
  names: Readonly<Partial<Record<ZoomPart, string>>> | null,
  barText: string,
): Drawn2D {
  const { ctx, width, height, css } = d;
  const info = levelInfo(index);
  const [w, h] = extent(info.id);
  const s = Math.max(1e-9, Math.min((width - 2 * PAD) / w, (height - TOP - BOTTOM) / h));
  const p = new Pen(ctx, width / 2, TOP + (height - TOP - BOTTOM) / 2, s);
  DRAW[info.id](p, css);

  const spot = zoomSpot(info.id);
  if (spot) {
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = css('--accent');
    ctx.lineWidth = 2;
    p.circle(spot.center[0], spot.center[1], spot.radiusNm * 1.15);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const k = Number(css('--font-scale')) || 1;
  ctx.font = `${String(13 * k)}px ${css('--font-sans') || 'sans-serif'}`;
  ctx.textBaseline = 'middle';
  if (names)
    for (const part of LEVEL_PARTS[info.id]) {
      const at = ANCHOR[info.id][part];
      const text = names[part];
      if (!at || !text) continue;
      const x = p.X(at[0]);
      const y = p.Y(at[1]);
      ctx.fillStyle = css('--text');
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.textAlign = x < width / 2 ? 'right' : 'left';
      ctx.fillText(text, x + (x < width / 2 ? -6 : 6), y - 10);
    }

  // Scale bar: exactly barNm at this picture's scale, under the picture.
  const barPx = info.barNm * s;
  const y = height - BOTTOM + 28;
  const x0 = width / 2 - barPx / 2;
  ctx.strokeStyle = css('--text');
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x0 + barPx, y);
  ctx.moveTo(x0, y - 6);
  ctx.lineTo(x0, y + 6);
  ctx.moveTo(x0 + barPx, y - 6);
  ctx.lineTo(x0 + barPx, y + 6);
  ctx.stroke();
  ctx.fillStyle = css('--text');
  ctx.textAlign = 'center';
  ctx.fillText(barText, width / 2, y + 18);
  return { pxPerNm: s, barPx };
}
