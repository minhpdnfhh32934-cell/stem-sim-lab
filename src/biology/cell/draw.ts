/**
 * The 2D cell picture (canvas). Shapes, positions and how many ribosomes or mitochondria are
 * drawn are illustration only (CELL_ILLUSTRATION); which parts a cell shows comes from
 * `partsFor` (parts.ts), and a test checks that the picture draws exactly those parts.
 * Coordinates are in cell units (y down, the cell about 1 unit in radius); colours are theme
 * tokens.
 */
import type { DrawContext } from '@/ui/canvas/useCanvas';
import type { CellKind, PartId } from './parts';

type V = readonly [number, number];

/** A part drawn on the picture: where its name label points, and how to draw it. */
interface Shape {
  at: V;
  draw: (g: Pen) => void;
}

interface Figure {
  /** Bounding box [x0, y0, x1, y1] in cell units (appendages included). */
  box: readonly [number, number, number, number];
  /** Drawn in this order (background first). */
  parts: Partial<Record<PartId, Shape>>;
}

/** Canvas helper: cell units → pixels; the highlight pass paints in the accent colour. */
class Pen {
  constructor(
    readonly ctx: CanvasRenderingContext2D,
    private readonly cx: number,
    private readonly cy: number,
    readonly u: number,
    private readonly css: (name: string) => string,
    private readonly hi: string | null,
  ) {}
  X(x: number) {
    return this.cx + x * this.u;
  }
  Y(y: number) {
    return this.cy + y * this.u;
  }
  /** Fills (at `alpha`) and/or strokes the current path; `width` in cell units. */
  paint(fill: string | null, stroke: string | null, width = 0.012, alpha = 1) {
    const { ctx } = this;
    if (fill) {
      ctx.globalAlpha = this.hi ? 0.35 : alpha;
      ctx.fillStyle = this.hi ?? this.css(fill);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (stroke) {
      ctx.lineWidth = Math.max(1, width * this.u) + (this.hi ? 3 : 0);
      ctx.strokeStyle = this.hi ?? this.css(stroke);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }
  circle(x: number, y: number, r: number) {
    this.ctx.beginPath();
    this.ctx.arc(this.X(x), this.Y(y), r * this.u, 0, 2 * Math.PI);
  }
  ellipse(x: number, y: number, rx: number, ry: number, rot: number) {
    this.ctx.beginPath();
    this.ctx.ellipse(this.X(x), this.Y(y), rx * this.u, ry * this.u, rot, 0, 2 * Math.PI);
  }
  /** Rounded rectangle centred on the cell, half sizes hw × hh, corner radius r. */
  rrect(hw: number, hh: number, r: number, x = 0, y = 0) {
    const { ctx, u } = this;
    ctx.beginPath();
    ctx.roundRect(this.X(x - hw), this.Y(y - hh), 2 * hw * u, 2 * hh * u, r * u);
  }
  arc(x: number, y: number, r: number, a0: number, a1: number) {
    this.ctx.beginPath();
    this.ctx.arc(this.X(x), this.Y(y), r * this.u, a0, a1);
  }
  poly(points: readonly V[], close = false) {
    const { ctx } = this;
    ctx.beginPath();
    points.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(this.X(x), this.Y(y));
      else ctx.lineTo(this.X(x), this.Y(y));
    });
    if (close) ctx.closePath();
  }
}

/** Deterministic scatter in [0, 1) (no randomness: the picture never changes between frames). */
const hash = (i: number) => {
  const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** Up to `n` dots inside `ok`, sampled from a fixed sequence over the box. */
function scatter(n: number, box: readonly [number, number, number, number], ok: (p: V) => boolean) {
  const out: V[] = [];
  for (let i = 0; out.length < n && i < n * 20; i++) {
    const p: V = [
      box[0] + hash(2 * i) * (box[2] - box[0]),
      box[1] + hash(2 * i + 1) * (box[3] - box[1]),
    ];
    if (ok(p)) out.push(p);
  }
  return out;
}

const dist = (a: V, b: V) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function dots(g: Pen, points: readonly V[], r: number, color: string) {
  for (const [x, y] of points) {
    g.circle(x, y, r);
    // The outline (same colour) is what the highlight pass turns into a visible accent ring.
    g.paint(color, color, 0.004);
  }
}

/** A mitochondrion: outer membrane and a zigzag of cristae along its long axis. */
function mitochondrion(g: Pen, x: number, y: number, rot: number) {
  g.ellipse(x, y, 0.16, 0.075, rot);
  g.paint('--chart-4', '--chart-4', 0.012, 0.25);
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const zig: V[] = [];
  for (let k = 0; k <= 8; k++) {
    const a = -0.12 + (0.24 * k) / 8;
    const b = k % 2 === 0 ? -0.04 : 0.04;
    zig.push([x + a * c - b * s, y + a * s + b * c]);
  }
  g.poly(zig);
  g.paint(null, '--chart-4', 0.007);
}

/** A chloroplast: two membranes (one outline here) and small stacks of thylakoids (grana). */
function chloroplast(g: Pen, x: number, y: number, rot: number) {
  g.ellipse(x, y, 0.16, 0.08, rot);
  g.paint('--chart-3', '--chart-3', 0.012, 0.3);
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (const a of [-0.08, 0, 0.08]) {
    const px = x + a * c;
    const py = y + a * s;
    g.poly([
      [px - 0.035 * s, py + 0.035 * c],
      [px + 0.035 * s, py - 0.035 * c],
    ]);
    g.paint(null, '--chart-3', 0.025);
  }
}

/** The Golgi apparatus: a stack of curved flat sacs and two vesicles. */
function golgi(g: Pen, x: number, y: number) {
  const { ctx } = g;
  for (let k = 0; k < 4; k++) {
    const yk = y + 0.055 * k;
    const w = 0.16 - 0.015 * k;
    ctx.beginPath();
    ctx.moveTo(g.X(x - w), g.Y(yk));
    ctx.quadraticCurveTo(g.X(x), g.Y(yk - 0.07), g.X(x + w), g.Y(yk));
    g.paint(null, '--chart-2', 0.028);
  }
  for (const [vx, vy] of [
    [x + 0.2, y + 0.04],
    [x + 0.2, y + 0.14],
  ] as const) {
    g.circle(vx, vy, 0.025);
    g.paint('--chart-2', '--chart-2', 0.008, 0.6);
  }
}

/** Endoplasmic reticulum: folded sheets around the nucleus, from angle a0 to a1. */
function er(g: Pen, nx: number, ny: number, r0: number, a0: number, a1: number) {
  for (let k = 0; k < 3; k++) {
    g.arc(nx, ny, r0 + 0.065 * k, a0, a1);
    g.paint(null, '--chart-5', 0.022);
  }
}

function nucleus(g: Pen, x: number, y: number, r: number) {
  g.circle(x, y, r);
  g.paint('--chart-1', '--chart-1', 0.016, 0.22);
  // Pores of the nuclear envelope: small gaps drawn as dots on the edge.
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 + 0.3;
    g.circle(x + r * Math.cos(a), y + r * Math.sin(a), 0.012);
    g.paint('--bg-stage', null);
  }
}

/** Points along the outer ER sheet (rough ER carries ribosomes). */
function onArc(nx: number, ny: number, r: number, a0: number, a1: number, n: number): V[] {
  return Array.from({ length: n }, (_, i) => {
    const a = a0 + ((a1 - a0) * (i + 0.5)) / n;
    return [nx + r * Math.cos(a), ny + r * Math.sin(a)] as const;
  });
}

// --- Bacterium (H 7.2): a rod with appendages. -------------------------------------------
const BA = 1.1; // half length of the outer surface
const BB = 0.5; // half height
const capsule = (g: Pen, inset: number) => {
  g.rrect(BA - inset, BB - inset, BB - inset);
};
const NUCLEOID_C: V = [-0.12, 0];
const bacteriumRibosomes = [
  [0.55, 0.28] as V,
  ...scatter(44, [-0.85, -0.3, 0.85, 0.3], (p) => {
    const ex = (p[0] / 0.82) ** 2 + (p[1] / 0.3) ** 2;
    return ex < 1 && dist(p, [0.55, 0.28]) > 0.06;
  }),
];
const PILI: readonly (readonly [V, V])[] = [
  ...[-0.55, -0.25, 0.05, 0.35].flatMap((x): (readonly [V, V])[] => [
    [
      [x, -BB],
      [x - 0.04, -BB - 0.14],
    ],
    [
      [x + 0.12, BB],
      [x + 0.16, BB + 0.14],
    ],
  ]),
  ...[150, 180, 210].map((deg): readonly [V, V] => {
    const a = (deg * Math.PI) / 180;
    return [
      [-(BA - BB) + BB * Math.cos(a), BB * Math.sin(a)],
      [-(BA - BB) + (BB + 0.14) * Math.cos(a), (BB + 0.14) * Math.sin(a)],
    ];
  }),
];

const BACTERIUM: Figure = {
  box: [-1.26, -0.66, 1.75, 0.66],
  parts: {
    prokCytoplasm: {
      at: [-0.45, 0.22],
      draw: (g) => {
        capsule(g, 0.13);
        g.paint('--chart-2', null, 0, 0.12);
      },
    },
    pili: {
      at: [0.01, -BB - 0.14],
      draw: (g) => {
        for (const seg of PILI) {
          g.poly(seg);
          g.paint(null, '--text-muted', 0.008);
        }
      },
    },
    flagellum: {
      at: [1.62, 0.07],
      draw: (g) => {
        for (const y0 of [-0.1, 0.1]) {
          const pts: V[] = [];
          for (let k = 0; k <= 30; k++) {
            const x = BA - 0.02 + (0.62 * k) / 30;
            pts.push([x, y0 + Math.sign(y0) * 0.04 * k * 0.05 + 0.06 * Math.sin(k * 0.7)]);
          }
          g.poly(pts);
          g.paint(null, '--chart-4', 0.018);
        }
      },
    },
    outerMembrane: {
      at: [-1.01, -0.29],
      draw: (g) => {
        capsule(g, 0);
        g.paint(null, '--chart-6', 0.016);
      },
    },
    bacterialWall: {
      at: [-0.87, 0.33],
      draw: (g) => {
        capsule(g, 0.07);
        g.paint(null, '--border-strong', 0.06);
      },
    },
    membrane: {
      at: [-0.95, 0.13],
      draw: (g) => {
        capsule(g, 0.13);
        g.paint(null, '--text-muted', 0.014);
      },
    },
    nucleoid: {
      at: [-0.36, 0],
      draw: (g) => {
        const pts: V[] = [];
        for (let k = 0; k <= 120; k++) {
          const t = (k / 120) * 2 * Math.PI;
          const r = 0.15 + 0.05 * Math.sin(7 * t) + 0.025 * Math.sin(3 * t + 1);
          pts.push([NUCLEOID_C[0] + 1.9 * r * Math.cos(t), NUCLEOID_C[1] + r * Math.sin(t)]);
        }
        g.poly(pts, true);
        g.paint(null, '--chart-1', 0.016);
      },
    },
    plasmid: {
      at: [0.62, -0.17],
      draw: (g) => {
        for (const [x, y] of [
          [0.62, -0.17],
          [0.72, 0.13],
        ] as const) {
          g.circle(x, y, 0.05);
          g.paint(null, '--chart-5', 0.014);
        }
      },
    },
    ribosome: {
      at: bacteriumRibosomes[0] ?? [0.55, 0.28],
      draw: (g) => {
        dots(g, bacteriumRibosomes, 0.022, '--text');
      },
    },
  },
};

// --- Animal cell (H 8.1b). ----------------------------------------------------------------
const AN_NUC: V = [-0.18, -0.08];
const AN_ER = { r0: 0.4, a0: -0.15 * Math.PI, a1: 0.55 * Math.PI };
const AN_CHORDS: readonly (readonly [number, number])[] = [
  [200, 290],
  [250, 340],
  [20, 110],
  [70, 160],
  [130, 230],
  [310, 40],
];
const chord = ([a, b]: readonly [number, number]): readonly [V, V] => {
  const p = (deg: number): V => [
    0.9 * Math.cos((deg * Math.PI) / 180),
    0.9 * Math.sin((deg * Math.PI) / 180),
  ];
  return [p(a), p(b)];
};
const animalRibosomes: V[] = [
  [-0.42, 0.66],
  ...scatter(30, [-0.9, -0.9, 0.9, 0.9], (p) => {
    return Math.hypot(...p) < 0.86 && dist(p, AN_NUC) > 0.62 && dist(p, [-0.42, 0.66]) > 0.06;
  }),
  ...onArc(AN_NUC[0], AN_NUC[1], AN_ER.r0 + 0.165, AN_ER.a0, AN_ER.a1, 12),
];
const membranePath = (g: Pen) => {
  const pts: V[] = [];
  for (let k = 0; k < 96; k++) {
    const t = (k / 96) * 2 * Math.PI;
    const r = 1 + 0.015 * Math.sin(3 * t) + 0.01 * Math.sin(5 * t + 1);
    pts.push([r * Math.cos(t), r * Math.sin(t)]);
  }
  g.poly(pts, true);
};

const ANIMAL: Figure = {
  box: [-1.05, -1.05, 1.05, 1.05],
  parts: {
    cytoplasm: {
      at: [-0.2, 0.84],
      draw: (g) => {
        membranePath(g);
        g.paint('--chart-2', null, 0, 0.12);
      },
    },
    cytoskeleton: {
      at: [-0.27, -0.58],
      draw: (g) => {
        for (const c of AN_CHORDS) {
          g.poly(chord(c));
          g.paint(null, '--text-faint', 0.006);
        }
      },
    },
    membrane: {
      at: [-0.94, -0.34],
      draw: (g) => {
        membranePath(g);
        g.paint(null, '--text-muted', 0.02);
      },
    },
    er: {
      at: [AN_NUC[0] + 0.465 * Math.cos(0.2), AN_NUC[1] + 0.465 * Math.sin(0.2)],
      draw: (g) => {
        er(g, AN_NUC[0], AN_NUC[1], AN_ER.r0, AN_ER.a0, AN_ER.a1);
      },
    },
    nucleus: {
      at: AN_NUC,
      draw: (g) => {
        nucleus(g, AN_NUC[0], AN_NUC[1], 0.3);
      },
    },
    golgi: {
      at: [0.55, 0.36],
      draw: (g) => {
        golgi(g, 0.52, 0.34);
      },
    },
    mitochondrion: {
      at: [0.62, -0.3],
      draw: (g) => {
        mitochondrion(g, 0.62, -0.3, 1.0);
        mitochondrion(g, -0.62, 0.38, -0.5);
        mitochondrion(g, 0.12, 0.7, 0.1);
      },
    },
    lysosome: {
      at: [0.78, 0.04],
      draw: (g) => {
        for (const [x, y] of [
          [0.78, 0.04],
          [-0.62, -0.52],
        ] as const) {
          g.circle(x, y, 0.06);
          g.paint('--chart-7', '--text-muted', 0.01, 0.9);
        }
      },
    },
    peroxysome: {
      at: [-0.8, 0.0],
      draw: (g) => {
        for (const [x, y] of [
          [-0.8, 0.0],
          [0.44, 0.68],
        ] as const) {
          g.circle(x, y, 0.045);
          g.paint('--chart-6', '--chart-1', 0.01, 0.8);
        }
      },
    },
    centrosome: {
      at: [0.3, -0.62],
      draw: (g) => {
        g.rrect(0.07, 0.022, 0.01, 0.27, -0.62);
        g.paint('--chart-3', '--chart-3', 0.008, 0.6);
        g.rrect(0.022, 0.07, 0.01, 0.38, -0.62);
        g.paint('--chart-3', '--chart-3', 0.008, 0.6);
      },
    },
    ribosome: {
      at: animalRibosomes[0] ?? [-0.42, 0.66],
      draw: (g) => {
        dots(g, animalRibosomes, 0.016, '--text');
      },
    },
  },
};

// --- Plant cell (H 8.1a). -----------------------------------------------------------------
const PW = 1.2; // half width of the wall's outer face
const PH = 0.9;
const PL_NUC: V = [-0.68, -0.36];
const PL_ER = { r0: 0.28, a0: -0.05 * Math.PI, a1: 0.6 * Math.PI };
const VAC = { x: 0.2, y: 0.08, hw: 0.5, hh: 0.42 };
const inVacuole = (p: V) =>
  Math.abs(p[0] - VAC.x) < VAC.hw + 0.05 && Math.abs(p[1] - VAC.y) < VAC.hh + 0.05;
const plantRibosomes: V[] = [
  [0.45, 0.68],
  ...scatter(26, [-1.0, -0.72, 1.0, 0.72], (p) => {
    return !inVacuole(p) && dist(p, PL_NUC) > 0.5 && dist(p, [0.45, 0.68]) > 0.06;
  }),
  ...onArc(PL_NUC[0], PL_NUC[1], PL_ER.r0 + 0.165, PL_ER.a0, PL_ER.a1, 9),
];
const PL_CYTO: readonly (readonly [V, V])[] = [
  [
    [-1.0, 0.45],
    [-0.5, 0.78],
  ],
  [
    [0.72, -0.78],
    [1.04, -0.25],
  ],
  [
    [0.55, 0.78],
    [1.04, 0.25],
  ],
  [
    [-0.3, -0.78],
    [0.25, -0.5],
  ],
];

const PLANT: Figure = {
  box: [-PW - 0.02, -PH - 0.02, PW + 0.02, PH + 0.02],
  parts: {
    cytoplasm: {
      at: [-0.92, 0.66],
      draw: (g) => {
        g.rrect(PW - 0.1, PH - 0.1, 0.08);
        g.paint('--chart-2', null, 0, 0.12);
      },
    },
    cytoskeleton: {
      at: [-0.75, 0.615],
      draw: (g) => {
        for (const seg of PL_CYTO) {
          g.poly(seg);
          g.paint(null, '--text-faint', 0.006);
        }
      },
    },
    plantWall: {
      at: [-PW + 0.03, -0.1],
      draw: (g) => {
        g.rrect(PW - 0.04, PH - 0.04, 0.14);
        g.paint(null, '--subject-biology', 0.07, 1);
      },
    },
    membrane: {
      at: [-PW + 0.1, 0.25],
      draw: (g) => {
        g.rrect(PW - 0.1, PH - 0.1, 0.08);
        g.paint(null, '--text-muted', 0.016);
      },
    },
    vacuole: {
      at: [VAC.x + 0.1, VAC.y],
      draw: (g) => {
        g.rrect(VAC.hw, VAC.hh, 0.25, VAC.x, VAC.y);
        g.paint('--chart-6', '--chart-6', 0.016, 0.3);
      },
    },
    er: {
      at: [PL_NUC[0] + 0.345 * Math.cos(0.9), PL_NUC[1] + 0.345 * Math.sin(0.9)],
      draw: (g) => {
        er(g, PL_NUC[0], PL_NUC[1], PL_ER.r0, PL_ER.a0, PL_ER.a1);
      },
    },
    nucleus: {
      at: PL_NUC,
      draw: (g) => {
        nucleus(g, PL_NUC[0], PL_NUC[1], 0.22);
      },
    },
    golgi: {
      at: [-0.72, 0.36],
      draw: (g) => {
        golgi(g, -0.75, 0.32);
      },
    },
    chloroplast: {
      at: [0.86, -0.55],
      draw: (g) => {
        chloroplast(g, 0.86, -0.55, 0.3);
        chloroplast(g, 0.88, 0.52, -0.3);
        chloroplast(g, -0.05, -0.66, 0.05);
        chloroplast(g, -0.22, 0.66, 0.1);
      },
    },
    mitochondrion: {
      at: [0.94, -0.02],
      draw: (g) => {
        mitochondrion(g, 0.94, -0.02, 1.45);
        mitochondrion(g, 0.32, -0.64, 0);
      },
    },
    peroxysome: {
      at: [0.6, -0.66],
      draw: (g) => {
        for (const [x, y] of [
          [0.6, -0.66],
          [-0.96, 0.08],
        ] as const) {
          g.circle(x, y, 0.045);
          g.paint('--chart-6', '--chart-1', 0.01, 0.8);
        }
      },
    },
    ribosome: {
      at: plantRibosomes[0] ?? [0.45, 0.68],
      draw: (g) => {
        dots(g, plantRibosomes, 0.016, '--text');
      },
    },
  },
};

export const FIGURES: Record<CellKind, Figure> = {
  bacterium: BACTERIUM,
  animal: ANIMAL,
  plant: PLANT,
};

/**
 * Space kept free at the top (overlay chips) and bottom (caption), in CSS pixels at font scale 1;
 * both grow with `--font-scale` (Settings → Cỡ chữ, presentation mode), like the overlays.
 * shortcut: assumes a one-line caption; measure the caption if the stage can get narrow enough to wrap it.
 */
const TOP = 52;
const BOTTOM = 52;
const PAD = 16;
const GAP = 22;
const LINE = 22;

interface Label {
  id: PartId;
  text: string;
  at: V;
  left: boolean;
}

/**
 * Stacks the labels of one side top to bottom near their anchors' heights, at least `LINE`
 * apart and within [lo, hi].
 */
export function stack(want: readonly number[], lo: number, hi: number): number[] {
  const y = [...want];
  for (let i = 0; i < y.length; i++)
    y[i] = Math.max(y[i] ?? lo, i === 0 ? lo : (y[i - 1] ?? lo) + LINE);
  for (let i = y.length - 1; i >= 0; i--)
    y[i] = Math.min(y[i] ?? hi, i === y.length - 1 ? hi : (y[i + 1] ?? hi) - LINE);
  // Only a stage too short for the column breaks the spacing; it never leaves [lo, hi].
  return y.map((v) => Math.max(lo, v));
}

/**
 * Draws the cell. `names` holds the label of every part of this cell (localized); the labels
 * shown are all of them with "Hiện tên", otherwise only the selected part's.
 */
export function drawCell(
  d: DrawContext,
  kind: CellKind,
  names: Partial<Record<PartId, string>>,
  selected: PartId | null,
  showNames: boolean,
): void {
  const { ctx, width, height, css } = d;
  const fig = FIGURES[kind];
  const [x0, y0, x1, y1] = fig.box;
  const k = Number(css('--font-scale')) || 1;
  const top = TOP * k;
  const bottom = BOTTOM * k;
  const font = `${13 * k}px ${css('--font-sans') || 'sans-serif'}`;
  ctx.font = font;
  const all: Label[] = [];
  for (const [id, shape] of Object.entries(fig.parts) as [PartId, Shape][]) {
    const text = names[id];
    if (text) all.push({ id, text, at: shape.at, left: shape.at[0] < (x0 + x1) / 2 });
  }
  const labels = all.filter((l) => showNames || l.id === selected);
  // Room for every label of this cell, so showing or picking one never moves the cell.
  const side = (left: boolean) =>
    Math.max(0, ...all.filter((l) => l.left === left).map((l) => ctx.measureText(l.text).width));
  const room = (left: boolean) => (side(left) > 0 ? side(left) + GAP : 0);
  const roomL = room(true);
  const roomR = room(false);
  const u = Math.max(
    10,
    Math.min((width - 2 * PAD - roomL - roomR) / (x1 - x0), (height - top - bottom) / (y1 - y0)),
  );
  const cx = PAD + roomL + (width - 2 * PAD - roomL - roomR - (x1 - x0) * u) / 2 - x0 * u;
  const cy = top + (height - top - bottom - (y1 - y0) * u) / 2 - y0 * u;

  const base = new Pen(ctx, cx, cy, u, css, null);
  for (const shape of Object.values(fig.parts)) shape.draw(base);
  const chosen = selected ? fig.parts[selected] : undefined;
  if (chosen) chosen.draw(new Pen(ctx, cx, cy, u, css, css('--accent')));

  // Name labels with leader lines, in a column on each side of the cell.
  for (const left of [true, false]) {
    const list = labels.filter((l) => l.left === left).sort((a, b) => a.at[1] - b.at[1]);
    const ys = stack(
      list.map((l) => base.Y(l.at[1])),
      top,
      height - bottom,
    );
    const colX = left ? base.X(x0) - GAP / 2 : base.X(x1) + GAP / 2;
    list.forEach((l, i) => {
      const y = ys[i] ?? 0;
      const on = l.id === selected;
      const color = on ? css('--accent') : css('--text');
      ctx.beginPath();
      ctx.moveTo(base.X(l.at[0]), base.Y(l.at[1]));
      ctx.lineTo(colX, y);
      ctx.strokeStyle = on ? color : css('--text-muted');
      ctx.lineWidth = on ? 2 : 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(base.X(l.at[0]), base.Y(l.at[1]), 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.font = `${on ? '600 ' : ''}${font}`;
      ctx.textAlign = left ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(l.text, colX + (left ? -4 : 4), y);
    });
  }
}
