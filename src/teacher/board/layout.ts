/**
 * Deterministic board layout (PROMPT_PHAN_2 B7.2). The AI only names zones and relations; this
 * code decides where things go, like a teacher who divides the board before the lesson. Each face
 * is divided by what it will hold (`planFaces`, item 3 "the AI Teacher uses the whole board"):
 *
 *   wide        ┌──────────────────────── title ────────────────────────┐
 *               │ main / steps, across the whole board                   │
 *   sideMain    │ side_notes │ main / steps                              │
 *   mainRight   │ main / steps                  │ diagram, table, plot   │
 *   three       │ side_notes │ main / steps     │ diagram, example       │
 *
 * Each region fills top to bottom, so nothing ever overlaps; the board grows downwards and the
 * camera follows the pen. Something the face's plan has no region for (a "Viết tiếp" side note on
 * a face planned for steps only) goes in a full-width band below everything. An element's box is
 * the true width of its ink: a line too wide for its region moves to a band, and is written
 * smaller only when even the whole board is too narrow (`squeezed`). A long equality chain is
 * written on several lines (formulaSplit.ts). Placed elements never move (marks and the learner's
 * strokes are board coordinates); a resize or a zoom only scales the sheet.
 * `<newboard>` starts a new face (the old one stays in history). Widths come from an injected
 * `Measure`, so the same code runs in tests and in the browser.
 */
import { splitFormula } from './formulaSplit';
import type { BoardAction, DrawType, Role, Zone } from './teachscript';

export const BOARD_W = 1200;
export const COLUMN_TOP = 130;
/** Space left and right of the writing, and between two regions of a face. */
export const MARGIN = 40;
export const GUTTER = 40;
const GAP = 18;
const MARGIN_BOTTOM = 60;
/** Smallest formula scale in a region; below it the formula goes to a full-width band. */
const MIN_SCALE = 0.6;
/** Widest a drawing (not a table) is drawn: a full-width free-body diagram would fill the face. */
const DRAW_MAX_W = 480;

export type RegionId = 'side' | 'center' | 'right';
/** Where an element stands: the title strip, a region of its face, or a full-width band. */
export type ColumnId = 'title' | RegionId | 'band';
export type TemplateId = 'wide' | 'sideMain' | 'mainRight' | 'three';

export interface Span {
  x: number;
  w: number;
}
export type Regions = Partial<Record<RegionId, Span>>;

/** The whole writing width (title strip and bands). */
const FULL: Span = { x: MARGIN, w: BOARD_W - 2 * MARGIN };

/** How a face can be divided (board units; regions are ordered side < center < right). */
export const TEMPLATES: Record<TemplateId, Regions> = {
  wide: { center: FULL },
  sideMain: { side: { x: 40, w: 300 }, center: { x: 380, w: 780 } },
  mainRight: { center: { x: 40, w: 680 }, right: { x: 760, w: 400 } },
  three: { side: { x: 40, w: 260 }, center: { x: 340, w: 480 }, right: { x: 860, w: 300 } },
};

export const REGION_ORDER: readonly RegionId[] = ['side', 'center', 'right'];

/** The 'three' template with the title strip and the band (a face nobody planned). */
export const COLUMNS: Record<ColumnId, Span> = {
  title: FULL,
  side: { x: 40, w: 260 },
  center: { x: 340, w: 480 },
  right: { x: 860, w: 300 },
  band: FULL,
};

export function columnOf(zone: Zone): 'title' | RegionId {
  if (zone === 'title') return 'title';
  if (zone === 'side_notes') return 'side';
  if (zone === 'diagram' || zone === 'example' || zone === 'scratch') return 'right';
  return 'center';
}

/** Region of a drawing: title and side zones draw on the right, as a teacher would. */
function drawColumn(zone: Zone): RegionId {
  const column = columnOf(zone);
  return column === 'title' || column === 'side' ? 'right' : column;
}

export const FONT: Record<Role | 'title', number> = {
  title: 44,
  heading: 34,
  body: 30,
  keyword: 30,
  note: 27,
  result: 32,
};

export interface Measure {
  /** Width of handwritten text at `px` (font size in board units). */
  text(s: string, px: number, heading: boolean): number;
  /** Size of a KaTeX formula at `px`. */
  math(tex: string, px: number): { w: number; h: number };
}

export interface Token {
  kind: 'text' | 'math';
  value: string;
  w: number;
  h: number;
  /** Width of the space before this token on its line (the indent when it starts a line). */
  space: number;
  /** A formula's continuation piece starts its line indented by this much (when it fits). */
  indent?: number;
}

export interface Line {
  tokens: Token[];
  /** Top of the line, relative to the element. */
  y: number;
  w: number;
  h: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ElementBase extends Box {
  id: string;
  face: number;
  column: ColumnId;
}

export interface TextElement extends ElementBase {
  kind: 'text';
  role: Role | 'title';
  fontSize: number;
  /** Formula scale when it was shrunk to fit its region (1 = natural size). */
  scale: number;
  lines: Line[];
  /** Characters to write (text characters + one unit per formula piece), for the pen timing. */
  length: number;
  speed: 'slow' | 'normal' | 'fast';
  /** The source text (for provenance checks and the chat copy); a split formula stays whole. */
  source: string;
  math: boolean;
  /** Written smaller than usual: even the whole board's width was too narrow (very rare). */
  squeezed?: true;
}

export interface DrawElement extends ElementBase {
  kind: 'draw';
  type: DrawType;
  spec: Record<string, unknown>;
  /** Scale of the drawing's natural size (a wide table is drawn smaller to fit). */
  scale: number;
}

export type BoardElement = TextElement | DrawElement;

export interface Face {
  title?: string;
  /** How the face is divided, planned from what it will hold (`planFaces`). */
  template: TemplateId;
  cursors: Record<RegionId, number>;
  titleBottom: number;
  height: number;
}

export interface Layout {
  faces: Face[];
  elements: BoardElement[];
  /** Plans of the faces the lesson's `<newboard>`s will open, in order. */
  upcoming: TemplateId[];
}

export function emptyLayout(): Layout {
  return { faces: [newFace()], elements: [], upcoming: [] };
}

function newFace(title?: string, template: TemplateId = 'three'): Face {
  return {
    ...(title ? { title } : {}),
    template,
    cursors: { side: COLUMN_TOP, center: COLUMN_TOP, right: COLUMN_TOP },
    titleBottom: COLUMN_TOP - 20,
    height: COLUMN_TOP + MARGIN_BOTTOM,
  };
}

/** The span of `column` on `face`: undefined when the face's plan has no such region. */
export function regionOf(face: Face | undefined, column: ColumnId): Span | undefined {
  if (column === 'title' || column === 'band') return FULL;
  return TEMPLATES[face?.template ?? 'three'][column];
}

/**
 * The regions each face will use, one set per face (split at `<newboard>`): writes by their zone
 * (titles excepted: the title strip is on every face), corrections on the side, drawings and plots
 * on the right (or in the middle when the AI asked for it).
 */
export function regionUsage(actions: readonly BoardAction[]): Set<RegionId>[] {
  let current = new Set<RegionId>();
  const usage = [current];
  for (const a of actions) {
    if (a.kind === 'newboard') {
      current = new Set();
      usage.push(current);
    } else if (a.kind === 'write') {
      const column = columnOf(a.zone);
      if (column !== 'title') current.add(column);
    } else if (a.kind === 'correct') current.add('side');
    else if (a.kind === 'draw' || a.kind === 'plot') current.add(drawColumn(a.zone));
  }
  return usage;
}

/** The plan for a face from the regions it uses (steps alone get the whole width). */
export function templateFor(used: ReadonlySet<RegionId>): TemplateId {
  const side = used.has('side');
  const right = used.has('right');
  if (side && right) return 'three';
  if (side) return 'sideMain';
  if (right) return 'mainRight';
  return 'wide';
}

/**
 * Divides the faces before the teacher writes on them, from the actions still to play (a lesson,
 * or the new part of "Viết tiếp"): the current face is planned when nothing but its title is on
 * it yet (a face already written keeps its plan, so nothing on it moves), and each `<newboard>`
 * opens a face planned from its own part. Mutates and returns `layout`.
 */
export function planFaces(layout: Layout, actions: readonly BoardAction[]): Layout {
  const usage = regionUsage(actions);
  const last = layout.faces.length - 1;
  const face = layout.faces[last];
  const first = usage[0];
  const written = layout.elements.some(
    (e) => e.face === last && !(e.kind === 'text' && e.role === 'title'),
  );
  if (face && first && !written) face.template = templateFor(first);
  layout.upcoming = usage.slice(1).map(templateFor);
  return layout;
}

/** Splits text with inline `$…$` formulas into words and formulas. */
export function tokenize(
  text: string,
  math: boolean,
  px: number,
  heading: boolean,
  m: Measure,
  /** A formula wider than this is cut into pieces at its relations (one per line if need be). */
  width = Infinity,
): Token[] {
  if (math) {
    const s = m.math(text, px);
    const pieces = s.w > width ? splitFormula(text) : [text];
    if (pieces.length < 2) return [{ kind: 'math', value: text, w: s.w, h: s.h, space: 0 }];
    const space = m.text(' ', px, heading);
    return pieces.map((value, i) => {
      const size = m.math(value, px);
      const token: Token = { kind: 'math', value, w: size.w, h: size.h, space: i ? space : 0 };
      if (i) token.indent = px;
      return token;
    });
  }
  const tokens: Token[] = [];
  const space = m.text(' ', px, heading);
  for (const part of text.split(/(\$[^$]+\$)/g)) {
    if (!part) continue;
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
      const s = m.math(part.slice(1, -1), px);
      tokens.push({ kind: 'math', value: part.slice(1, -1), w: s.w, h: s.h, space });
      continue;
    }
    for (const word of part.split(/\s+/)) {
      if (!word) continue;
      tokens.push({ kind: 'text', value: word, w: m.text(word, px, heading), h: px * 1.3, space });
    }
  }
  if (tokens[0]) tokens[0].space = 0;
  return tokens;
}

/** Greedy line breaking within `width`; a token wider than the line gets its own line. */
export function wrap(tokens: Token[], width: number, px: number): Line[] {
  const lines: Line[] = [];
  let current: Token[] = [];
  let w = 0;
  const lineH = (ts: Token[]) => Math.max(px * 1.35, ...ts.map((t) => t.h * 1.1));
  const push = () => {
    if (!current.length) return;
    const y = lines.reduce((sum, l) => sum + l.h, 0);
    lines.push({ tokens: current, y, w, h: lineH(current) });
    current = [];
    w = 0;
  };
  for (const t of tokens) {
    const add = (current.length ? t.space : 0) + t.w;
    if (current.length && w + add > width) push();
    // At the start of a line: no space, or the indent of a formula's continuation when it fits.
    const lead = t.indent !== undefined && t.indent + t.w <= width ? t.indent : 0;
    const token = current.length ? t : { ...t, space: lead };
    current.push(token);
    w += token.space + token.w;
  }
  push();
  return lines;
}

/** A text laid out in a width: its tokens, lines and true ink width. */
interface Fit {
  lines: Line[];
  length: number;
  scale: number;
  fontSize: number;
  w: number;
  h: number;
  fits: boolean;
}

function fitText(
  text: string,
  math: boolean,
  px: number,
  heading: boolean,
  width: number,
  m: Measure,
  minScale = MIN_SCALE,
): Fit {
  let tokens = tokenize(text, math, px, heading, m, width);
  // Formulas wider than the region are scaled down (never below `minScale`), then wrapped.
  const widest = Math.max(0, ...tokens.filter((t) => t.kind === 'math').map((t) => t.w));
  const scale = widest > width ? Math.max(minScale, width / widest) : 1;
  if (scale < 1)
    tokens = tokens.map((t) => (t.kind === 'math' ? { ...t, w: t.w * scale, h: t.h * scale } : t));
  const lines = wrap(tokens, width, px);
  const w = Math.max(...lines.map((l) => l.w), 1);
  return {
    lines,
    length: tokens.reduce((n, t) => n + (t.kind === 'math' ? 1 : t.value.length + 1), 0),
    scale,
    fontSize: px,
    w,
    h: lines.reduce((sum, l) => sum + l.h, 0),
    // A hair of rounding is not an overflow.
    fits: w <= width + 0.5,
  };
}

/** Last resort: the element is written smaller until it fits the whole board's width. */
function squeeze(text: string, math: boolean, px: number, heading: boolean, m: Measure): Fit {
  let fit = fitText(text, math, px, heading, FULL.w, m, 0);
  for (let n = 0; n < 8 && !fit.fits; n++) {
    fit = fitText(text, math, fit.fontSize * (FULL.w / fit.w) * 0.98, heading, FULL.w, m, 0);
  }
  return fit;
}

export interface PlaceResult {
  layout: Layout;
  element: BoardElement | null;
}

/** Where an element goes in a region of the current face (never on top of anything written). */
function slot(
  layout: Layout,
  column: RegionId,
  h: number,
  near?: BoardElement,
): { face: number; y: number } {
  const face = layout.faces.length - 1;
  const f = layout.faces[face];
  if (!f) return { face: 0, y: COLUMN_TOP };
  const cursor = f.cursors[column];
  const y = near && near.face === face ? Math.max(cursor, near.y) : cursor;
  f.cursors[column] = y + h + GAP;
  f.height = Math.max(f.height, y + h + MARGIN_BOTTOM);
  return { face, y };
}

/** A full-width band below everything on the current face; every region goes on below it. */
function bandSlot(layout: Layout, h: number): { face: number; y: number } {
  const face = layout.faces.length - 1;
  const f = layout.faces[face];
  if (!f) return { face: 0, y: COLUMN_TOP };
  const y = Math.max(
    COLUMN_TOP,
    f.titleBottom + 24,
    f.cursors.side,
    f.cursors.center,
    f.cursors.right,
  );
  const next = y + h + GAP;
  f.cursors = { side: next, center: next, right: next };
  f.height = Math.max(f.height, y + h + MARGIN_BOTTOM);
  return { face, y };
}

export function findElement(layout: Layout, id: string): BoardElement | undefined {
  // The newest element with that id (a correction keeps the id's history).
  for (let i = layout.elements.length - 1; i >= 0; i--) {
    const e = layout.elements[i];
    if (e?.id === id) return e;
  }
  return undefined;
}

/** A free id: the AI's id, or `<id>_2`, `<id>_3`… when it is already used (validator §7). */
export function freeId(layout: Layout, id: string): string {
  if (!findElement(layout, id)) return id;
  for (let n = 2; ; n++) {
    const candidate = `${id}_${String(n)}`;
    if (!findElement(layout, candidate)) return candidate;
  }
}

function drawSize(type: DrawType, spec: Record<string, unknown>, width: number, m: Measure) {
  if (type === 'table') {
    const header = Array.isArray(spec.header) ? spec.header.map(String) : [];
    const rows = Array.isArray(spec.rows)
      ? spec.rows.map((r) => (Array.isArray(r) ? r.map(String) : []))
      : [];
    const cols = Math.max(header.length, ...rows.map((r) => r.length), 1);
    const colW = Array.from({ length: cols }, (_, i) =>
      Math.max(...[header, ...rows].map((r) => m.text(r[i] ?? '', 24, false) + 24), 40),
    );
    return { w: colW.reduce((a, b) => a + b, 0), h: (rows.length + 1) * 40 + 8 };
  }
  if (type === 'flow') {
    const steps = Array.isArray(spec.steps) ? spec.steps.length : 3;
    return { w: width, h: Math.max(1, steps) * 76 };
  }
  if (type === 'vector') return { w: width, h: 130 };
  if (type === 'free_body') return { w: width, h: Math.round(width * 0.85) };
  return { w: width, h: Math.round(width * 0.72) };
}

/** Places one board action (write / draw / plot / newboard / correct); marks are not placed. */
export function place(layout: Layout, action: BoardAction, m: Measure): PlaceResult {
  if (action.kind === 'newboard') {
    layout.faces.push(newFace(action.title, layout.upcoming.shift() ?? 'three'));
    if (action.title) {
      return place(
        layout,
        {
          kind: 'write',
          id: freeId(layout, 'board_title'),
          zone: 'title',
          role: 'heading',
          math: false,
          text: action.title,
          speed: 'normal',
        },
        m,
      );
    }
    return { layout, element: null };
  }
  if (action.kind === 'write' || action.kind === 'correct') {
    const isCorrection = action.kind === 'correct';
    const target = isCorrection ? findElement(layout, action.target) : undefined;
    if (isCorrection && !target) return { layout, element: null };
    let zone: Zone = isCorrection ? 'side_notes' : action.zone;
    const role = isCorrection ? 'result' : action.role;
    const math = isCorrection ? false : action.math;
    const text = action.text;
    const faceIndex = layout.faces.length - 1;
    const face = layout.faces[faceIndex];
    let px = zone === 'title' ? FONT.title : FONT[role];
    if (zone === 'title') {
      // One title per face, at most two lines; anything else becomes a heading in the middle.
      // So does a title that comes after the face was written on and is too tall for the strip
      // above it (it would cover what is there).
      const onFace = layout.elements.filter((e) => e.face === faceIndex);
      const taken = onFace.some((e) => e.kind === 'text' && e.role === 'title');
      let lines = wrap(tokenize(text, math, px, true, m, FULL.w), FULL.w, px);
      if (lines.length > 1) {
        px = FONT.heading;
        lines = wrap(tokenize(text, math, px, true, m, FULL.w), FULL.w, px);
      }
      const tall = 30 + lines.reduce((sum, l) => sum + l.h, 0) > COLUMN_TOP;
      if (taken || lines.length > 2 || (tall && onFace.length > 0)) {
        zone = 'steps';
        px = FONT.heading;
      }
    }
    let column: ColumnId = columnOf(zone);
    const titleRole = column === 'title';
    const heading = titleRole || role === 'heading';
    let region = regionOf(face, column);
    if (!region) {
      // The face's plan has no region for it (e.g. a side note of "Viết tiếp" on a face
      // planned for steps only): a full-width band below everything.
      column = 'band';
      region = FULL;
    }
    let fit = fitText(text, math, px, heading, region.w, m);
    if (!fit.fits && column !== 'title' && column !== 'band') {
      // Something in it is too wide for its region even at the smallest formula scale.
      column = 'band';
      region = FULL;
      fit = fitText(text, math, px, heading, FULL.w, m);
    }
    const squeezed = !fit.fits;
    if (squeezed) fit = squeeze(text, math, px, heading, m);
    const noteFor = action.kind === 'write' ? action.noteFor : undefined;
    const near = target ?? (noteFor ? findElement(layout, noteFor) : undefined);
    const at =
      column === 'title'
        ? { face: faceIndex, y: 30 }
        : column === 'band'
          ? bandSlot(layout, fit.h)
          : slot(layout, column, fit.h, near);
    const id = isCorrection ? freeId(layout, `${action.target}_fix`) : freeId(layout, action.id);
    const element: TextElement = {
      kind: 'text',
      id,
      face: at.face,
      column,
      x: region.x,
      y: at.y,
      w: fit.w,
      h: fit.h,
      role: titleRole
        ? 'title'
        : zone === 'steps' && action.kind === 'write' && action.zone === 'title'
          ? 'heading'
          : role,
      fontSize: fit.fontSize,
      scale: fit.scale,
      lines: fit.lines,
      length: fit.length,
      speed: action.kind === 'write' ? action.speed : 'normal',
      source: text,
      math,
      ...(squeezed ? { squeezed: true as const } : {}),
    };
    if (titleRole) {
      const f = layout.faces[at.face];
      if (f) {
        f.titleBottom = at.y + fit.h;
        const top = Math.max(COLUMN_TOP, at.y + fit.h + 24);
        f.cursors = {
          side: Math.max(f.cursors.side, top),
          center: Math.max(f.cursors.center, top),
          right: Math.max(f.cursors.right, top),
        };
      }
    }
    layout.elements.push(element);
    return { layout, element };
  }
  if (action.kind === 'draw' || action.kind === 'plot') {
    const type: DrawType = action.kind === 'plot' ? 'plot' : action.type;
    const spec: Record<string, unknown> =
      action.kind === 'plot'
        ? { fn: action.fn, domain: action.domain, ...(action.label ? { label: action.label } : {}) }
        : action.spec;
    const face = layout.faces[layout.faces.length - 1];
    let column: RegionId | 'band' = drawColumn(action.zone);
    let region = regionOf(face, column);
    if (!region) {
      column = 'band';
      region = FULL;
    }
    const size = drawSize(type, spec, Math.min(region.w, DRAW_MAX_W), m);
    if (type === 'table') {
      // A wide table moves to the middle of the board rather than becoming unreadable, and to a
      // full-width band when even the middle is too narrow.
      const center = regionOf(face, 'center');
      if (size.w > region.w && column === 'right' && center) {
        column = 'center';
        region = center;
      }
      if (size.w > region.w && column !== 'band') {
        column = 'band';
        region = FULL;
      }
    }
    const scale = Math.min(1, region.w / size.w);
    const w = size.w * scale;
    const h = size.h * scale;
    const { face: faceIndex, y } =
      column === 'band' ? bandSlot(layout, h) : slot(layout, column, h);
    const element: DrawElement = {
      kind: 'draw',
      id: freeId(layout, action.id),
      face: faceIndex,
      column,
      x: region.x,
      y,
      w,
      h,
      type,
      spec,
      scale,
    };
    layout.elements.push(element);
    return { layout, element };
  }
  return { layout, element: null };
}

/**
 * The dashed rules of a face: one in the middle of each gutter between two neighbouring regions
 * that both hold something on that face, from below the title to the lowest of them, broken
 * around full-width bands. A face written across its whole width has none.
 */
export function boardRules(
  layout: Layout,
  faceIndex: number,
): { x: number; y1: number; y2: number }[] {
  const face = layout.faces[faceIndex];
  if (!face) return [];
  const regions = TEMPLATES[face.template];
  const on = layout.elements.filter((e) => e.face === faceIndex);
  const bands = on.filter((e) => e.column === 'band').sort((a, b) => a.y - b.y);
  const present = REGION_ORDER.filter((r) => regions[r]);
  const rules: { x: number; y1: number; y2: number }[] = [];
  for (let i = 0; i + 1 < present.length; i++) {
    const a = present[i];
    const b = present[i + 1];
    const ra = a && regions[a];
    const rb = b && regions[b];
    if (!ra || !rb) continue;
    const held = on.filter((e) => e.column === a || e.column === b);
    if (!held.some((e) => e.column === a) || !held.some((e) => e.column === b)) continue;
    const x = (ra.x + ra.w + rb.x) / 2;
    const bottom = Math.max(...held.map((e) => e.y + e.h)) + 12;
    let y = Math.max(COLUMN_TOP - 8, face.titleBottom + 8);
    for (const band of bands) {
      if (band.y - 12 > y && band.y < bottom) rules.push({ x, y1: y, y2: band.y - 12 });
      y = Math.max(y, band.y + band.h + 12);
    }
    if (y < bottom) rules.push({ x, y1: y, y2: bottom });
  }
  return rules;
}

/** The part of a text element covering `span` (for "gạch chân đúng chữ đó"), else the whole box. */
export function spanBox(e: BoardElement, span: string | undefined, m: Measure): Box {
  if (!span || e.kind !== 'text') return { x: e.x, y: e.y, w: e.w, h: e.h };
  for (const line of e.lines) {
    let x = 0;
    for (let i = 0; i < line.tokens.length; i++) {
      const t = line.tokens[i];
      if (!t) continue;
      x += t.space;
      const rest = line.tokens
        .slice(i)
        .map((k) => k.value)
        .join(' ');
      if (t.kind === 'text' && rest.startsWith(span)) {
        const w = m.text(span, e.fontSize, e.role === 'heading' || e.role === 'title');
        return { x: e.x + x, y: e.y + line.y, w: Math.min(w, e.w - x), h: line.h };
      }
      x += t.w;
    }
  }
  return { x: e.x, y: e.y, w: e.w, h: e.h };
}

/** Boxes of two different elements never intersect (used by the property test). */
export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
