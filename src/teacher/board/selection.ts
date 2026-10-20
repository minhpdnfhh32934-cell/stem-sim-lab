/**
 * "Khoanh để hỏi" (item 2): the learner circles, underlines or taps part of the board and asks the
 * AI Teacher about it. Pure geometry and extraction, no DOM: a stroke in board units becomes a
 * region, the region is tested against the words, formula pieces and drawings that are really on
 * the board (written so far, not erased, on that face), and what was hit is read back exactly as
 * the board holds it (the text, the LaTeX, a drawing's own labels). Nothing here edits the board.
 *
 * A selection is a snapshot (ids and text at the time it was made): the layout is mutated in
 * place as the teacher writes, so it never holds references to the layout's objects.
 */
import { translate, type Locale } from '@/app/i18n';
import type { Box, BoardElement, ColumnId, DrawElement, Layout, TextElement } from './layout';
import type { Provenance } from './provenance';

/** A point in board units (x right, y down, as the sheet). */
export type Point = readonly [number, number];
export type StrokeShape = 'tap' | 'closed' | 'open';
/**
 * - `ok`: something readable was hit (the bar offers "Hỏi thầy chỗ này");
 * - `none`: nothing on the board was hit (the app says so, no AI call);
 * - `ambiguous`: too much was hit, or only parts of things: the learner picks;
 * - `picture`: only a drawing without labels or the learner's own strokes (no text to send).
 */
export type SelectionStatus = 'ok' | 'none' | 'ambiguous' | 'picture';

/** A stroke whose bounding box has a diagonal under this many units is a tap. */
export const TAP_SIZE = 14;
/** A stroke whose ends are this close (or `CLOSE_GAP_RATIO` of its size) is a loop. */
export const CLOSE_GAP = 48;
export const CLOSE_GAP_RATIO = 0.25;
/** Least share of its bounding box a loop must enclose (a line drawn twice encloses nothing). */
export const LOOP_FILL = 0.2;
/** How far around an open stroke (an underline, a tick) counts as touched. */
export const UNDERLINE_PAD = 14;
/** Height above a flat stroke that it selects (the line of writing it underlines). */
export const UNDERLINE_BAND = 46;
/** Grid step (board units) of the coverage samples. */
export const SAMPLE_STEP = 8;
/** Share of a word or formula piece inside the region for it to be selected. */
export const TOKEN_HIT = 0.5;
/** Share of an element (by width) selected for the whole element to count. */
export const WHOLE_ELEMENT = 0.8;
/** Share of a drawing inside the region for it to be selected… */
export const FIGURE_HIT = 0.35;
/** …or share of the region inside the drawing (a loop around part of a big figure). */
export const FIGURE_INSIDE = 0.6;
/** Partly touched things at least this much are offered as choices ("Ý em là…?"). */
export const CANDIDATE_HIT = 0.2;
/** More hits than this: the learner is asked which one. */
export const MAX_HITS = 6;
/** A loop over more than this share of what is written on the face (with 3+ hits) is too much. */
export const AMBIGUOUS_AREA = 0.6;
/** Share of a learner's stroke inside the region for it to count as circled. */
export const STROKE_INSIDE = 0.5;
/** Most neighbours sent (the face's title included). */
export const MAX_NEIGHBOURS = 4;
/** Longest selection block for each prompt size (characters, the fence included). */
export const CONTEXT_CHARS = { full: 2000, compact: 600, tight: 300 } as const;
export type ContextSize = keyof typeof CONTEXT_CHARS;
/** Longest excerpt kept with the question (chat history, the composer chip). */
export const EXCERPT_CHARS = 300;
/**
 * Shortest cut of a circled line kept in a full block (with "…"): less says nothing, and the
 * line is then counted among the parts left out.
 */
export const MIN_CUT_CHARS = 24;

/** Where the sheet's origin is on screen and how it is drawn (the viewport's fit times the zoom). */
export interface SheetView {
  /** Screen position of the sheet's top-left corner: it moves with the scroll. */
  left: number;
  top: number;
  /** Scale at which the whole board width fits the viewport. */
  fit: number;
  /** The learner's zoom (1 = fit to width). */
  zoom: number;
}

/** A pointer position on screen → board units, whatever the scale, the zoom and the scroll. */
export function toBoardPoint(clientX: number, clientY: number, view: SheetView): [number, number] {
  const scale = view.fit * view.zoom;
  return [(clientX - view.left) / scale, (clientY - view.top) / scale];
}

function bboxOf(points: readonly Point[]): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Even-odd point in polygon (the polygon is closed implicitly). */
export function insidePolygon(x: number, y: number, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (!a || !b) continue;
    const [xi, yi] = a;
    const [xj, yj] = b;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segmentDistance(x: number, y: number, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len));
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}

function polylineDistance(x: number, y: number, points: readonly Point[]): number {
  if (points.length === 1 && points[0]) return Math.hypot(x - points[0][0], y - points[0][1]);
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b) best = Math.min(best, segmentDistance(x, y, a, b));
  }
  return best;
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const cross = (p: Point, q: Point, r: Point) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** The stroke crosses itself (a loop drawn past its start, a figure 8). Bounded work. */
function selfIntersects(points: readonly Point[]): boolean {
  // At most ~120 segments are compared (a long stroke is thinned first).
  const stepBy = Math.max(1, Math.ceil(points.length / 120));
  const p = points.filter((_, i) => i % stepBy === 0 || i === points.length - 1);
  for (let i = 1; i < p.length; i++) {
    for (let j = i + 2; j < p.length; j++) {
      const a = p[i - 1];
      const b = p[i];
      const c = p[j - 1];
      const d = p[j];
      if (a && b && c && d && segmentsCross(a, b, c, d)) return true;
    }
  }
  return false;
}

/** Something that can say whether a board point is selected. */
export interface Region {
  bbox: Box;
  contains: (x: number, y: number) => boolean;
}

export function polygonRegion(points: readonly Point[]): Region {
  return { bbox: bboxOf(points), contains: (x, y) => insidePolygon(x, y, points) };
}

/** Sample points on a grid over `box` (cell centres; at least 2 × 2, at most ~2 500). */
function samples(box: Box, step: number): Point[] {
  let nx = Math.max(2, Math.ceil(box.w / step));
  let ny = Math.max(2, Math.ceil(box.h / step));
  const total = nx * ny;
  if (total > 2500) {
    const k = Math.sqrt(2500 / total);
    nx = Math.max(2, Math.floor(nx * k));
    ny = Math.max(2, Math.floor(ny * k));
  }
  const out: Point[] = [];
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++)
      out.push([box.x + ((i + 0.5) * box.w) / nx, box.y + ((j + 0.5) * box.h) / ny]);
  return out;
}

function overlapsBox(a: Box, b: Box): boolean {
  return a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
}

/**
 * Share of `box` inside the region, by grid sampling (robust to concave and self-crossing hand
 * loops, unlike exact clipping). 0 for a box the region does not reach.
 */
export function coverage(box: Box, region: Region, step = SAMPLE_STEP): number {
  if (box.w <= 0 || box.h <= 0 || !overlapsBox(box, region.bbox)) return 0;
  const pts = samples(box, step);
  let inside = 0;
  for (const [x, y] of pts) if (region.contains(x, y)) inside++;
  return inside / pts.length;
}

/** Share of the region that lies inside `box` (a loop drawn inside a big figure). */
function regionInside(box: Box, region: Region, step = SAMPLE_STEP): number {
  const pts = samples(region.bbox, step).filter(([x, y]) => region.contains(x, y));
  if (pts.length === 0) return 0;
  const inBox = pts.filter(
    ([x, y]) => x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h,
  );
  return inBox.length / pts.length;
}

/** Tap, loop or open stroke (an underline, a tick), whatever the direction it was drawn in. */
export function strokeShape(points: readonly Point[]): StrokeShape {
  const box = bboxOf(points);
  const d = Math.hypot(box.w, box.h);
  if (points.length < 2 || d < TAP_SIZE) return 'tap';
  const first = points[0];
  const last = points[points.length - 1];
  const gap = first && last ? Math.hypot(first[0] - last[0], first[1] - last[1]) : Infinity;
  const ends = gap <= Math.max(CLOSE_GAP, CLOSE_GAP_RATIO * d);
  if (!ends && !selfIntersects(points)) return 'open';
  // A loop around anything is at least as tall and wide as a tap: a dash drawn back is a line.
  if (Math.min(box.w, box.h) < TAP_SIZE) return 'open';
  // A loop encloses something; a line drawn there and back (or a short dash) does not.
  return coverage(box, polygonRegion(points)) >= LOOP_FILL ? 'closed' : 'open';
}

/** A stroke as flat as an underline (it also selects the line of writing just above it). */
function isFlat(box: Box): boolean {
  return box.h <= Math.max(2 * UNDERLINE_PAD, 0.35 * box.w);
}

/** What a stroke selects. */
export function strokeRegion(points: readonly Point[], shape = strokeShape(points)): Region {
  if (shape === 'closed') return polygonRegion(points);
  const box = bboxOf(points);
  if (shape === 'tap') {
    const [cx, cy] = [box.x + box.w / 2, box.y + box.h / 2];
    return {
      bbox: { x: cx - TAP_SIZE, y: cy - TAP_SIZE, w: 2 * TAP_SIZE, h: 2 * TAP_SIZE },
      contains: (x, y) => Math.hypot(x - cx, y - cy) <= TAP_SIZE,
    };
  }
  const flat = isFlat(box);
  const top = flat ? box.y - UNDERLINE_BAND : box.y - UNDERLINE_PAD;
  return {
    bbox: {
      x: box.x - UNDERLINE_PAD,
      y: top,
      w: box.w + 2 * UNDERLINE_PAD,
      h: box.y + box.h + UNDERLINE_PAD - top,
    },
    contains: (x, y) =>
      polylineDistance(x, y, points) <= UNDERLINE_PAD ||
      (flat && x >= box.x && x <= box.x + box.w && y >= box.y - UNDERLINE_BAND && y <= box.y),
  };
}

/** One word or formula piece of a written element, where it is on the board. */
export interface TokenBox {
  box: Box;
  kind: 'text' | 'math';
  /** The word, or the piece's LaTeX. */
  value: string;
  /** Where it starts in the pen's unit count (a formula piece counts 1). */
  start: number;
  size: number;
}

/** The boxes of an element's words and formula pieces (the same arithmetic as `spanBox`). */
export function tokenBoxes(e: TextElement): TokenBox[] {
  const out: TokenBox[] = [];
  let count = 0;
  for (const line of e.lines) {
    let x = 0;
    for (const t of line.tokens) {
      x += t.space;
      const size = t.kind === 'math' ? 1 : t.value.length + 1;
      out.push({
        box: { x: e.x + x, y: e.y + line.y, w: t.w, h: line.h },
        kind: t.kind,
        value: t.value,
        start: count,
        size,
      });
      count += size;
      x += t.w;
    }
  }
  return out;
}

/** The token is written whole (a formula piece once it is fully revealed). */
function revealed(t: TokenBox, progress: number): boolean {
  return progress >= t.start + (t.kind === 'math' ? 1 : t.value.length);
}

/** The board state a selection reads (the board store has these fields). */
export interface SelectionBoard {
  layout: Layout;
  progress: Readonly<Record<string, number>>;
  erased: Readonly<Record<string, boolean>>;
  provenance: Readonly<Record<string, Provenance>>;
  marks: readonly { kind: string; face: number; box: Box }[];
  strokes: readonly { face: number; points: readonly Point[] }[];
}

/** Something selected on the board, as it was when it was selected. */
export interface SelectionHit {
  id: string;
  kind: 'text' | 'draw';
  column: ColumnId;
  /** The text's role, or the drawing's type. */
  role: string;
  /**
   * Exactly what the board holds: the selected words and formula pieces (inline formulas as
   * `$…$`; in a formula element the pieces' LaTeX), the element's whole source when all of it
   * was selected, or a drawing's own labels (`describeDrawing`); '' for a drawing without any.
   */
  text: string;
  /** A formula element (its `text` is LaTeX without `$`). */
  math: boolean;
  /** All of the element was selected (its full source is sent). */
  whole: boolean;
  /**
   * Part of an element was selected: the element as far as it is written (the line the circled
   * words stand in, so the AI reads them in their place).
   */
  within?: string;
  /** Its numbers' check on the board, if any. */
  status: Provenance['status'] | null;
  /** Struck out by a correction. */
  struck: boolean;
  coverage: number;
  /** Outlines drawn around what was selected (board units). */
  boxes: Box[];
  /** Position of the element: reading order and the layout's order. */
  x: number;
  y: number;
  index: number;
}

/** A neighbour of the selection: the face's title, or the step just before or after. */
export interface SelectionNeighbour {
  id: string;
  text: string;
  math: boolean;
  status: Provenance['status'] | null;
}

export interface BoardSelection {
  face: number;
  shape: StrokeShape;
  status: SelectionStatus;
  /** Why the learner is asked to choose: too much circled, or only parts of things. */
  reason?: 'many' | 'unsure';
  /** The stroke, board units (drawn as the dashed lasso). */
  points: Point[];
  bbox: Box;
  /** `ok`: what is asked about, in reading order; `ambiguous`: the choices. */
  hits: SelectionHit[];
  /** The face's title (its text), if it has one. */
  title: string | null;
  /** The steps just before and after, in reading order (the title is apart). */
  neighbours: SelectionNeighbour[];
  /** The learner's own strokes inside the region. */
  strokes: number;
  /** Drawings inside the region that have no label to read (only a picture shows them). */
  figures: string[];
}

const COLUMN_RANK: Record<ColumnId, number> = { title: 0, side: 1, center: 2, right: 3, band: 4 };

/**
 * Reading order on a face: the title, then each region top to bottom (side, centre, right), a
 * full-width band after everything placed above it (the regions go on below it). Ties: left to
 * right, then the layout's order. The direction the stroke was drawn in never matters.
 */
export function readingOrder<T extends { column: ColumnId; x: number; y: number; index: number }>(
  items: readonly T[],
  bandYs: readonly number[],
): T[] {
  const bands = [...bandYs].sort((a, b) => a - b);
  const key = (e: T): [number, number] => {
    const above = bands.filter((y) => y < e.y).length;
    return [above, COLUMN_RANK[e.column]];
  };
  return [...items].sort((a, b) => {
    const [sa, ra] = key(a);
    const [sb, rb] = key(b);
    return sa - sb || ra - rb || a.y - b.y || a.x - b.x || a.index - b.index;
  });
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * A drawing in words, from its spec strings only (never a computed number): a plot's label or
 * formula and the domain the AI gave, a free-body diagram's body and forces, a flow's steps, a
 * table's cells, a vector's or axes' labels. '' when the spec has nothing to read.
 */
export function describeDrawing(e: DrawElement, locale: Locale): string {
  const s = e.spec;
  switch (e.type) {
    case 'plot': {
      const fn = str(s.fn);
      const label = str(s.label) || (fn ? `y = ${fn}` : '');
      if (!label) return '';
      const domain = Array.isArray(s.domain) ? s.domain.map((v) => String(v)) : [];
      return domain.length === 2
        ? translate(locale, 'board.ask.describe.plotOn', {
            label,
            from: domain[0] ?? '',
            to: domain[1] ?? '',
          })
        : translate(locale, 'board.ask.describe.plot', { label });
    }
    case 'axes': {
      const labels = [str(s.x), str(s.y)].filter(Boolean);
      return labels.length
        ? translate(locale, 'board.ask.describe.axes', { labels: labels.join(', ') })
        : '';
    }
    case 'free_body': {
      const body = str(s.body);
      const forces = strings(s.forces);
      if (!body && forces.length === 0) return '';
      return translate(locale, 'board.ask.describe.freeBody', {
        body: body || '…',
        forces: forces.join(', ') || '…',
      });
    }
    case 'flow': {
      const steps = strings(s.steps);
      return steps.length
        ? translate(locale, 'board.ask.describe.flow', { steps: steps.join(' → ') })
        : '';
    }
    case 'table': {
      const header = strings(s.header);
      const rows = Array.isArray(s.rows)
        ? s.rows.map((r) => strings(r)).filter((r) => r.length)
        : [];
      if (header.length === 0 && rows.length === 0) return '';
      const cells = [header, ...rows].map((r) => r.join(' | ')).join('; ');
      return translate(locale, 'board.ask.describe.table', { cells });
    }
    case 'vector': {
      const label = str(s.label);
      return label ? translate(locale, 'board.ask.describe.vector', { label }) : '';
    }
  }
}

/** The text of an element as far as it is written (all of it once written whole). */
function writtenText(e: TextElement, progress: number): string {
  if (progress >= e.length) return e.source;
  return tokenText(
    tokenBoxes(e).filter((t) => revealed(t, progress)),
    e.math,
  );
}

function tokenText(tokens: readonly TokenBox[], math: boolean): string {
  return tokens
    .map((t) => (t.kind === 'math' && !math ? `$${t.value}$` : t.value))
    .join(' ')
    .trim();
}

/** Elements the learner can see on the face: written at least in part, not erased. */
function visibleOn(board: SelectionBoard, face: number): { e: BoardElement; index: number }[] {
  const out: { e: BoardElement; index: number }[] = [];
  board.layout.elements.forEach((e, index) => {
    if (e.face === face && (board.progress[e.id] ?? 0) > 0 && !board.erased[e.id])
      out.push({ e, index });
  });
  return out;
}

function sameBox(a: Box, b: Box): boolean {
  return (
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.w - b.w) < 0.5 &&
    Math.abs(a.h - b.h) < 0.5
  );
}

function bandYsOn(layout: Layout, face: number): number[] {
  return layout.elements.filter((e) => e.face === face && e.column === 'band').map((e) => e.y);
}

/** The face's title and the steps around the hits (same column; a band: the next in reading). */
export function neighbours(
  board: SelectionBoard,
  face: number,
  hitIds: readonly string[],
  locale: Locale,
): { title: string | null; neighbours: SelectionNeighbour[] } {
  const visible = visibleOn(board, face);
  const ordered = readingOrder(
    visible.map(({ e, index }) => ({ e, index, column: e.column, x: e.x, y: e.y })),
    bandYsOn(board.layout, face),
  );
  const titleEl = ordered.find((o) => o.e.kind === 'text' && o.e.role === 'title');
  const textOf = (e: BoardElement): string =>
    e.kind === 'text' ? writtenText(e, board.progress[e.id] ?? 0) : describeDrawing(e, locale);
  const title = titleEl ? textOf(titleEl.e) : null;
  const hits = new Set(hitIds);
  const picked: SelectionNeighbour[] = [];
  const room = MAX_NEIGHBOURS - (title ? 1 : 0);
  const add = (o: (typeof ordered)[number] | undefined) => {
    if (!o || picked.length >= room) return;
    const e = o.e;
    if (hits.has(e.id) || e.id === titleEl?.e.id || picked.some((p) => p.id === e.id)) return;
    const text = textOf(e);
    if (!text) return;
    picked.push({
      id: e.id,
      text,
      math: e.kind === 'text' && e.math,
      status: board.provenance[e.id]?.status ?? null,
    });
  };
  for (const id of hitIds) {
    const at = ordered.findIndex((o) => o.e.id === id);
    const o = ordered[at];
    if (!o) continue;
    const peers =
      o.e.column === 'band' ? ordered : ordered.filter((p) => p.e.column === o.e.column);
    const i = peers.indexOf(o);
    add(peers[i - 1]);
    add(peers[i + 1]);
  }
  return { title, neighbours: picked };
}

interface Scored {
  hit: SelectionHit;
  /** Element box area and the share of it the region covers (for "too much"). */
  area: number;
  covered: number;
}

function hitOfText(
  e: TextElement,
  index: number,
  board: SelectionBoard,
  region: Region,
  tap: Point | null,
): { hit: Scored | null; weak: Scored | null } {
  const progress = board.progress[e.id] ?? 0;
  const tokens = tokenBoxes(e).filter((t) => revealed(t, progress));
  if (tokens.length === 0) return { hit: null, weak: null };
  const scores = tokens.map((t) =>
    tap
      ? t.box.x <= tap[0] &&
        tap[0] <= t.box.x + t.box.w &&
        t.box.y <= tap[1] &&
        tap[1] <= t.box.y + t.box.h
        ? 1
        : 0
      : coverage(t.box, region),
  );
  const selected = tokens.filter((_, i) => (scores[i] ?? 0) >= TOKEN_HIT);
  const totalW = tokens.reduce((n, t) => n + t.box.w, 0);
  const selectedW = selected.reduce((n, t) => n + t.box.w, 0);
  const share = totalW > 0 ? selectedW / totalW : 0;
  const box = { x: e.x, y: e.y, w: e.w, h: e.h };
  const all = tokenText(tokens, e.math);
  const base = (chosen: readonly TokenBox[], cov: number, whole: boolean): SelectionHit => ({
    id: e.id,
    kind: 'text',
    column: e.column,
    role: e.role,
    text: whole ? e.source : tokenText(chosen, e.math),
    math: e.math,
    whole,
    ...(!whole && chosen.length < tokens.length ? { within: all } : {}),
    status: board.provenance[e.id]?.status ?? null,
    struck: board.marks.some((m) => m.kind === 'strike' && m.face === e.face && sameBox(m.box, e)),
    coverage: cov,
    boxes: whole ? [box] : chosen.map((t) => t.box),
    x: e.x,
    y: e.y,
    index,
  });
  const written = progress >= e.length;
  if (selected.length > 0) {
    const whole = written && (share >= WHOLE_ELEMENT || tokens.length === 1);
    return {
      hit: { hit: base(selected, share, whole), area: e.w * e.h, covered: share },
      weak: null,
    };
  }
  const best = Math.max(0, ...scores);
  if (best >= CANDIDATE_HIT) {
    // Offered as a choice: the element as far as it is written.
    return {
      hit: null,
      weak: { hit: base(tokens, best, written), area: e.w * e.h, covered: 0 },
    };
  }
  return { hit: null, weak: null };
}

function hitOfDrawing(
  e: DrawElement,
  index: number,
  board: SelectionBoard,
  region: Region,
  tap: Point | null,
  locale: Locale,
): { hit: Scored | null; weak: Scored | null } {
  const box = { x: e.x, y: e.y, w: e.w, h: e.h };
  const cov = tap
    ? tap[0] >= e.x && tap[0] <= e.x + e.w && tap[1] >= e.y && tap[1] <= e.y + e.h
      ? 1
      : 0
    : coverage(box, region);
  const insideShare = tap ? 0 : regionInside(box, region);
  const hit: SelectionHit = {
    id: e.id,
    kind: 'draw',
    column: e.column,
    role: e.type,
    text: describeDrawing(e, locale),
    math: false,
    whole: true,
    status: board.provenance[e.id]?.status ?? null,
    struck: false,
    coverage: cov,
    boxes: [box],
    x: e.x,
    y: e.y,
    index,
  };
  if (cov >= FIGURE_HIT || insideShare >= FIGURE_INSIDE)
    return { hit: { hit, area: e.w * e.h, covered: cov }, weak: null };
  if (cov >= CANDIDATE_HIT) return { hit: null, weak: { hit, area: e.w * e.h, covered: 0 } };
  return { hit: null, weak: null };
}

/**
 * What the learner selected with one stroke on `face`: the words, formula pieces and drawings
 * written there (only what is already written), in reading order, with the face's title and the
 * steps around them. Nothing on the board is changed.
 */
export function hitTest(
  board: SelectionBoard,
  face: number,
  points: readonly Point[],
  locale: Locale,
): BoardSelection {
  const shape = strokeShape(points);
  const region = strokeRegion(points, shape);
  const tap: Point | null =
    shape === 'tap' ? [region.bbox.x + TAP_SIZE, region.bbox.y + TAP_SIZE] : null;
  const hits: Scored[] = [];
  const weak: Scored[] = [];
  let writtenArea = 0;
  for (const { e, index } of visibleOn(board, face)) {
    writtenArea += e.w * e.h;
    const r =
      e.kind === 'text'
        ? hitOfText(e, index, board, region, tap)
        : hitOfDrawing(e, index, board, region, tap, locale);
    if (r.hit) hits.push(r.hit);
    if (r.weak) weak.push(r.weak);
  }
  const strokes = tap
    ? 0
    : board.strokes.filter((s) => {
        if (s.face !== face || s.points.length === 0) return false;
        const inside = s.points.filter(([x, y]) => region.contains(x, y)).length;
        return inside / s.points.length >= STROKE_INSIDE;
      }).length;
  const bands = bandYsOn(board.layout, face);
  const ordered = readingOrder(
    hits.map((s) => s.hit),
    bands,
  );
  const readable = ordered.filter((h) => h.text !== '');
  const figures = ordered.filter((h) => h.text === '').map((h) => h.id);
  const coveredArea = hits.reduce((n, s) => n + s.area * s.covered, 0);
  const tooMuch =
    readable.length > MAX_HITS ||
    (readable.length >= 3 && writtenArea > 0 && coveredArea / writtenArea > AMBIGUOUS_AREA);
  let status: SelectionStatus;
  let chosen: SelectionHit[];
  let reason: BoardSelection['reason'];
  if (readable.length > 0) {
    status = tooMuch ? 'ambiguous' : 'ok';
    chosen = readable;
    if (tooMuch) reason = 'many';
  } else if (figures.length > 0 || strokes > 0) {
    status = 'picture';
    chosen = [];
  } else {
    const choices = readingOrder(
      weak.map((s) => s.hit).filter((h) => h.text !== ''),
      bands,
    );
    status = choices.length > 0 ? 'ambiguous' : 'none';
    chosen = choices;
    if (choices.length > 0) reason = 'unsure';
  }
  // Around what is asked about (a picture: around its drawings); a choice reads them once picked.
  const around =
    status === 'none'
      ? { title: null, neighbours: [] }
      : neighbours(
          board,
          face,
          status === 'ok' ? chosen.map((h) => h.id) : status === 'picture' ? figures : [],
          locale,
        );
  return {
    face,
    shape,
    status,
    ...(reason ? { reason } : {}),
    points: points.map(([x, y]) => [x, y] as const),
    bbox: region.bbox,
    hits: chosen,
    title: around.title,
    neighbours: around.neighbours,
    strokes,
    figures,
  };
}

/**
 * The learner picked from the choices ("Ý em là…?"): one of them, or all of them ("Cả phần
 * này"). The neighbours are read again around what was picked.
 */
export function pickHits(
  selection: BoardSelection,
  ids: readonly string[] | 'all',
  board: SelectionBoard,
  locale: Locale,
): BoardSelection {
  const hits = ids === 'all' ? selection.hits : selection.hits.filter((h) => ids.includes(h.id));
  if (hits.length === 0) return selection;
  const around = neighbours(
    board,
    selection.face,
    hits.map((h) => h.id),
    locale,
  );
  return {
    face: selection.face,
    shape: selection.shape,
    status: 'ok',
    points: selection.points,
    bbox: selection.bbox,
    hits,
    title: around.title,
    neighbours: around.neighbours,
    strokes: selection.strokes,
    figures: selection.figures,
  };
}

/**
 * Board text cannot close its block or open another one (nor a knowledge excerpt's): repeated
 * until nothing changes, as `chatService.fenced`.
 */
export function fenceBoardText(text: string): string {
  let out = text;
  for (;;) {
    const next = out
      .replace(/<\s*\/?\s*(?:board_selection|reference)\b[^>]*>/gi, '')
      .replace(/<(?=\s*\/?\s*(?:board_selection|reference))/gi, '');
    if (next === out) return out;
    out = next;
  }
}

/** Labels of the selection block (prompt text, read by the AI only). */
const LABELS: Record<
  Locale,
  {
    selected: string;
    around: string;
    title: string;
    unverified: string;
    struck: string;
    within: string;
    picture: string;
    /** `n` circled parts that did not fit in the block (said, never dropped silently). */
    more: (n: number) => string;
  }
> = {
  vi: {
    within: 'trong dòng',
    selected: 'Phần em khoanh',
    around: 'Ngay trước/sau trên bảng',
    title: 'Tiêu đề',
    unverified: '(số chưa kiểm chứng)',
    struck: '(đã gạch, đã sửa)',
    picture:
      'Em khoanh một hình vẽ hoặc nét viết tay của em (ảnh vùng khoanh đi kèm câu hỏi, nếu có).',
    more: (n) => `(… và ${String(n)} chỗ khác em khoanh, không đủ chỗ ghi ở đây)`,
  },
  en: {
    within: 'in the line',
    selected: 'What the learner circled',
    around: 'Just before/after on the board',
    title: 'Title',
    unverified: '(numbers not verified)',
    struck: '(struck out, corrected)',
    picture:
      'The learner circled a drawing or their own handwriting (a picture of the circled area comes with the question, if any).',
    more: (n) => `(… and ${String(n)} more circled part${n === 1 ? '' : 's'}, left out for space)`,
  },
};

const OPEN = '<board_selection>';
const CLOSE = '</board_selection>';

/** Board text on one line, fenced; a formula as `$…$`. */
function inline(text: string, math: boolean): string {
  const plain = fenceBoardText(text).replace(/\s+/g, ' ').trim();
  return math ? `$${plain}$` : plain;
}

/** One line of the block: formulas as `$…$`, with the board's own marks. */
function line(
  item: {
    text: string;
    math: boolean;
    status: Provenance['status'] | null;
    struck?: boolean;
    within?: string;
  },
  locale: Locale,
): string {
  const L = LABELS[locale];
  const marks = [
    item.within ? `(${L.within}: ${inline(item.within, item.math)})` : '',
    item.status === 'unverified' ? L.unverified : '',
    item.struck ? L.struck : '',
  ].filter(Boolean);
  return `- ${[inline(item.text, item.math), ...marks].join(' ')}`;
}

const NUMERIC = /[\d.,]/;

/**
 * Cuts `text` to at most `max` characters with "…": at the last space, else where no number is
 * split ("12345" is never sent as "12…"): what is left out is marked, nothing is changed.
 */
export function cut(text: string, max: number): string {
  if (text.length <= max) return text;
  if (max <= 1) return '';
  let end = max - 1;
  const space = text.lastIndexOf(' ', end);
  if (space > 0) end = space;
  else
    while (end > 0 && NUMERIC.test(text.charAt(end - 1)) && NUMERIC.test(text.charAt(end))) end--;
  return `${text.slice(0, end).trimEnd()}…`;
}

/**
 * The selection as one fenced block for the prompt, at most `CONTEXT_CHARS[size]` characters:
 * what was circled (in reading order; unverified numbers and struck lines marked as the board
 * marks them), the face's title, then the steps around it. What was circled comes first: the
 * neighbours, then the title, are left out before any of it. When not all of it fits, it takes
 * the whole block (no title, no neighbours): a line is cut at a space (never inside a number) and
 * the parts left out are counted in a marked line, never dropped silently.
 */
export function selectionContext(
  selection: BoardSelection,
  locale: Locale,
  size: ContextSize = 'full',
): string {
  const max = CONTEXT_CHARS[size];
  const L = LABELS[locale];
  const room = max - OPEN.length - CLOSE.length - 2;
  const parts: string[] = [];
  let used = 0;
  const push = (text: string, limit = room): boolean => {
    const cost = text.length + 1;
    if (used + cost > limit) return false;
    parts.push(text);
    used += cost;
    return true;
  };
  push(`${L.selected}:`);
  if (selection.hits.length === 0) push(`- ${L.picture}`);
  const lines = selection.hits.map((hit) => line(hit, locale));
  const complete = used + lines.reduce((sum, l) => sum + l.length + 1, 0) <= room;
  if (complete) for (const l of lines) push(l);
  else {
    // Room is kept for the line that says how many parts were left out (its longest form).
    const reserve = lines.length > 1 ? L.more(lines.length - 1).length + 1 : 0;
    const limit = room - reserve;
    let kept = 0;
    for (const l of lines) {
      if (push(l, limit)) {
        kept += 1;
        continue;
      }
      // The line that no longer fits whole: cut to the room left when that still says something
      // (the first one always goes, cut).
      const left = limit - used - 1;
      const piece = cut(l, left);
      if ((kept === 0 || left >= MIN_CUT_CHARS) && piece && push(piece, limit)) kept += 1;
      break;
    }
    if (kept < lines.length) push(L.more(lines.length - kept));
  }
  if (complete) {
    // The title once: not again when it is what was circled.
    if (selection.title && !selection.hits.some((h) => h.role === 'title'))
      push(`${L.title}: ${cut(fenceBoardText(selection.title), 160)}`);
    const around = selection.neighbours.map((n) => line(n, locale));
    if (around.length > 0 && used + L.around.length + 2 + (around[0]?.length ?? 0) + 1 <= room) {
      push(`${L.around}:`);
      for (const n of around) if (!push(n)) break;
    }
  }
  return `${OPEN}\n${parts.join('\n')}\n${CLOSE}`;
}

/** The selection's own text (what was circled; '' for a picture). */
export function selectionText(selection: BoardSelection): string {
  return selection.hits
    .map((h) => (h.math ? `$${h.text}$` : h.text))
    .join('\n')
    .trim();
}

/** A short excerpt of what was circled (chat history, the composer chip), at most `max` chars. */
export function selectionExcerpt(selection: BoardSelection, max = EXCERPT_CHARS): string {
  const text = selection.hits
    .map((h) => (h.math ? `$${h.text}$` : h.text).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' · ');
  return cut(fenceBoardText(text), max);
}

/** The selection can be asked about: readable text, or a picture for an AI that reads pictures. */
export function askable(selection: BoardSelection | null, readsPictures: boolean): boolean {
  if (!selection) return false;
  return selection.status === 'ok' || (selection.status === 'picture' && readsPictures);
}

/**
 * A picture (a drawing without labels, the learner's handwriting) that no AI here reads: the
 * learner may still ask about it in their own words. Only the board's text around it (title,
 * steps before/after) goes with the question, never a picture.
 */
export function asksInWords(selection: BoardSelection | null, readsPictures: boolean): boolean {
  return selection?.status === 'picture' && !readsPictures;
}

/** Where the selection bar goes over the board. */
export type AskBarSide = 'top' | 'bottom';

/**
 * The side of the board's view the selection bar goes on: away from what was circled (the loop and
 * the parts it read), so that stays in view under the bar. `view`: the viewport's scroll top and
 * height (px) and the scale the sheet is drawn at. Below the middle of the view → the top.
 */
export function askBarSide(
  selection: BoardSelection,
  view: { top: number; height: number; scale: number },
): AskBarSide {
  let top = selection.bbox.y;
  let bottom = selection.bbox.y + selection.bbox.h;
  for (const hit of selection.hits)
    for (const box of hit.boxes) {
      top = Math.min(top, box.y);
      bottom = Math.max(bottom, box.y + box.h);
    }
  const middle = ((top + bottom) / 2) * view.scale - view.top;
  return view.height > 0 && middle > view.height / 2 ? 'top' : 'bottom';
}
