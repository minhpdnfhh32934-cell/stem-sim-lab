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

/**
 * Room above the picture (the stage's chips and notice) and below it: the scale bar with its
 * text, then the zoom buttons and the two-line caption that sit over the canvas's bottom edge.
 */
const TOP = 72;
const BOTTOM = 168;
const PAD = 24;

/** The drawn extent of each level (nm): width and height of the picture. */
function extent(level: ZoomLevel): V {
  switch (level) {
    case 'cell':
      return [DRAWN.cellNm, DRAWN.cellNm];
    case 'nucleus':
      return [SIZE.nucleusNm, SIZE.nucleusNm];
    case 'chromosome':
      return [
        2 * SIZE.chromatidNm * 1.1 + 2 * DRAWN.splay * DRAWN.armNm[1],
        DRAWN.armNm[0] + DRAWN.armNm[1],
      ];
    case 'fibre':
      return [SIZE.chromatidNm, SIZE.chromatidNm];
    case 'nucleosome':
      return [levelInfo(4).fieldNm, 2 * SIZE.fibreNm];
    case 'dna':
      return [HELIX_LENGTH_NM, 2 * RADIUS + 1];
  }
}

/**
 * Illustrative parts of the pictures, computed once (seeded: the same picture every time). The
 * drawing and the name labels read the same lists, so a name always points at its part.
 */
/** Mitochondria of the cell: centre (nm) and the angle of the long axis; semi-axes MITO_AXES. */
export const MITO_2D: readonly { x: number; y: number; a: number }[] = (() => {
  const rand = seeded(3);
  return Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * 2 * Math.PI;
    const d = SIZE.nucleusNm / 2 + 2200 + rand() * 3500;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, a };
  });
})();
export const MITO_AXES: V = [900, 380];
/** Outer membrane radius of the nucleus and the gap to the inner one (illustration). */
const ENVELOPE_GAP = 90;
/** Nuclear pores: centres in the envelope, each PORE_R nm in radius. */
export const PORE_R = 70;
export const PORES_2D: readonly V[] = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * 2 * Math.PI;
  const r = SIZE.nucleusNm / 2 - ENVELOPE_GAP / 2;
  return [Math.cos(a) * r, Math.sin(a) * r];
});
/** Nucleolus of the nucleus picture: centre and radius (nm). */
export const NUCLEOLUS_2D = { x: -800, y: 550, r: 575 } as const;
/** Chromatin threads of the nucleus picture (polylines, nm). */
export const CHROMATIN_2D: readonly (readonly V[])[] = (() => {
  const R = SIZE.nucleusNm / 2;
  const rand = seeded(5);
  return Array.from({ length: 7 }, () => {
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
    return pts;
  });
})();
/** Steps along each loop of the fibre picture. */
export const LOOP_STEPS = 16;
/** A point of loop row `k` (0 … loopsPerRing − 1) on side ±1, at t ∈ [0, 1] along the loop. */
export function loopPoint(k: number, side: -1 | 1, t: number): V {
  const R = SIZE.chromatidNm / 2;
  const y0 = ((k + 0.5) / DRAWN.loopsPerRing - 0.5) * 2 * R * 0.9;
  const reach = (R - SIZE.fibreNm) * Math.sin(Math.PI * t);
  return [side * reach, y0 + 14 * Math.sin(2 * Math.PI * t)];
}
/** x of base pair i of the drawn helix (nm). */
export const helixX = (i: number): number => -HELIX_LENGTH_NM / 2 + i * RISE;

/** Where each named part is (nm), for its label: on the drawn part itself. */
export const ANCHOR_2D: Record<ZoomLevel, Partial<Record<ZoomPart, V>>> = {
  cell: {
    membrane: [0, DRAWN.cellNm / 2],
    nucleus: [0, SIZE.nucleusNm / 2],
    mitochondrion: [MITO_2D[0]?.x ?? 0, MITO_2D[0]?.y ?? 0],
  },
  nucleus: {
    envelope: [
      (SIZE.nucleusNm / 2 - ENVELOPE_GAP / 2) * Math.SQRT1_2,
      (SIZE.nucleusNm / 2 - ENVELOPE_GAP / 2) * Math.SQRT1_2,
    ],
    // Pore 4 (80°), near the top.
    pore: PORES_2D[4] ?? [0, 0],
    nucleolus: [NUCLEOLUS_2D.x, NUCLEOLUS_2D.y + NUCLEOLUS_2D.r],
    chromatin: CHROMATIN_2D[0]?.[6] ?? [0, 0],
  },
  chromosome: {
    chromatid: [0, DRAWN.armNm[1] * 0.8],
    centromere: [SIZE.chromatidNm * 0.3, 0],
  },
  fibre: { fibre: loopPoint(6, -1, 0.25), scaffold: [0, 300] },
  nucleosome: {
    histones: [0, 0],
    wrappedDna: [-WRAP_RADIUS_NM * Math.SQRT1_2, WRAP_RADIUS_NM * Math.SQRT1_2],
    linker: [(SIZE.fibreNm + DRAWN.linkerNm) / 2, 0],
  },
  dna: {
    // Pair 10: cos(10 · TWIST) = 1, the coding strand at its top; pair 13: the middle of a rung half.
    backbone: [helixX(10), RADIUS * Math.cos(10 * TWIST)],
    basePair: [helixX(13), 0.5 * RADIUS * Math.cos(13 * TWIST)],
  },
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
  ctx.fillStyle = css('--chart-3');
  for (const m of MITO_2D) {
    ctx.beginPath();
    ctx.ellipse(p.X(m.x), p.Y(m.y), MITO_AXES[0] * p.s, MITO_AXES[1] * p.s, -m.a, 0, 2 * Math.PI);
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
  for (const r of [R, R - ENVELOPE_GAP]) {
    p.circle(0, 0, r);
    ctx.stroke();
  }
  ctx.fillStyle = css('--bg-stage');
  for (const [x, y] of PORES_2D) {
    p.circle(x, y, PORE_R);
    ctx.fill();
  }
  p.circle(NUCLEOLUS_2D.x, NUCLEOLUS_2D.y, NUCLEOLUS_2D.r);
  ctx.fillStyle = css('--chart-4');
  ctx.fill();
  ctx.strokeStyle = css('--chart-6');
  ctx.lineWidth = 1.5;
  for (const pts of CHROMATIN_2D) {
    p.line(pts);
    ctx.stroke();
  }
}

const SPLAY = DRAWN.splay;

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
      [x + side * a * SPLAY, -a + w / 2],
      [x, 0],
      [x + side * b * SPLAY, b - w / 2],
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
  for (let k = 0; k < DRAWN.loopsPerRing; k++)
    for (const side of [-1, 1] as const) {
      p.line(Array.from({ length: LOOP_STEPS + 1 }, (_, i) => loopPoint(k, side, i / LOOP_STEPS)));
      ctx.stroke();
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
  // The chromosome's arms differ in length: its middle is above the centromere (y = 0).
  const mid = info.id === 'chromosome' ? (DRAWN.armNm[1] - DRAWN.armNm[0]) / 2 : 0;
  const p = new Pen(ctx, width / 2, TOP + (height - TOP - BOTTOM) / 2 + mid * s, s);
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
      const at = ANCHOR_2D[info.id][part];
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
  const y = height - BOTTOM + 24;
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
