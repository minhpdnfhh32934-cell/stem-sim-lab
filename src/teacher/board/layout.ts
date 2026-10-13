/**
 * Deterministic board layout (PROMPT_PHAN_2 B7.2). The AI only names zones and relations; this
 * code decides where things go, like a teacher who divides the board before the lesson:
 *
 *   ┌──────────────────────────── title ─────────────────────────────┐
 *   │ side_notes │      main / steps (numbered)      │ diagram, example │
 *   │ (given,    │                                   │ table, plot      │
 *   │  formulas, │                                   │ ─ ─ scratch ─ ─  │
 *   │  notes)    │                                   │                  │
 *
 * Each column fills top to bottom, so nothing ever overlaps; the board grows downwards and the
 * camera follows the pen. `<newboard>` starts a new face (the old one stays in history).
 * Widths come from an injected `Measure`, so the same code runs in tests and in the browser.
 */
import type { BoardAction, DrawType, Role, Zone } from './teachscript';

export const BOARD_W = 1200;
export const COLUMN_TOP = 130;
const GAP = 18;
const MARGIN_BOTTOM = 60;

export type ColumnId = 'title' | 'side' | 'center' | 'right';

export const COLUMNS: Record<ColumnId, { x: number; w: number }> = {
  title: { x: 40, w: 1120 },
  side: { x: 40, w: 260 },
  center: { x: 340, w: 480 },
  right: { x: 860, w: 300 },
};

export function columnOf(zone: Zone): ColumnId {
  if (zone === 'title') return 'title';
  if (zone === 'side_notes') return 'side';
  if (zone === 'diagram' || zone === 'example' || zone === 'scratch') return 'right';
  return 'center';
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
  /** Width of the space before this token on its line (0 for the first). */
  space: number;
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
  /** Formula scale when it was shrunk to fit its column (1 = natural size). */
  scale: number;
  lines: Line[];
  /** Characters to write (text characters + one unit per formula), for the pen timing. */
  length: number;
  speed: 'slow' | 'normal' | 'fast';
  /** The source text (for provenance checks and the chat copy). */
  source: string;
  math: boolean;
}

export interface DrawElement extends ElementBase {
  kind: 'draw';
  type: DrawType;
  spec: Record<string, unknown>;
}

export type BoardElement = TextElement | DrawElement;

export interface Face {
  title?: string;
  cursors: Record<Exclude<ColumnId, 'title'>, number>;
  titleBottom: number;
  height: number;
}

export interface Layout {
  faces: Face[];
  elements: BoardElement[];
}

export function emptyLayout(): Layout {
  return { faces: [newFace()], elements: [] };
}

function newFace(title?: string): Face {
  return {
    ...(title ? { title } : {}),
    cursors: { side: COLUMN_TOP, center: COLUMN_TOP, right: COLUMN_TOP },
    titleBottom: COLUMN_TOP - 20,
    height: COLUMN_TOP + MARGIN_BOTTOM,
  };
}

/** Splits text with inline `$…$` formulas into words and formulas. */
export function tokenize(text: string, math: boolean, px: number, heading: boolean, m: Measure) {
  if (math) {
    const s = m.math(text, px);
    return [{ kind: 'math' as const, value: text, w: s.w, h: s.h, space: 0 }];
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
    const token = current.length ? t : { ...t, space: 0 };
    current.push(token);
    w += (current.length > 1 ? token.space : 0) + token.w;
  }
  push();
  return lines;
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

export interface PlaceResult {
  layout: Layout;
  element: BoardElement | null;
}

/** Where an element goes on the current face (never on top of anything already written). */
function slot(
  layout: Layout,
  column: ColumnId,
  h: number,
  near?: BoardElement,
): { face: number; y: number } {
  const face = layout.faces.length - 1;
  const f = layout.faces[face];
  if (!f) return { face: 0, y: COLUMN_TOP };
  if (column === 'title') return { face, y: 30 };
  const cursor = f.cursors[column];
  const y = near && near.face === face ? Math.max(cursor, near.y) : cursor;
  f.cursors[column] = y + h + GAP;
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

/** Places one board action (write / draw / plot / newboard / correct); marks are not placed. */
export function place(layout: Layout, action: BoardAction, m: Measure): PlaceResult {
  if (action.kind === 'newboard') {
    layout.faces.push(newFace(action.title));
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
    let px = zone === 'title' ? FONT.title : FONT[role];
    if (zone === 'title') {
      // One title per face, at most two lines; anything else becomes a heading in the middle.
      const taken = layout.elements.some(
        (e) => e.face === faceIndex && e.kind === 'text' && e.role === 'title',
      );
      let lines = wrap(tokenize(text, math, px, true, m), COLUMNS.title.w, px);
      if (lines.length > 1) {
        px = FONT.heading;
        lines = wrap(tokenize(text, math, px, true, m), COLUMNS.title.w, px);
      }
      if (taken || lines.length > 2) {
        zone = 'steps';
        px = FONT.heading;
      }
    }
    const column = columnOf(zone);
    const titleRole = column === 'title';
    const col = COLUMNS[column];
    let tokens = tokenize(text, math, px, titleRole || role === 'heading', m);
    // Formulas wider than the column are scaled down (never below 60 %), then wrapped.
    const widest = Math.max(...tokens.map((t) => t.w), 1);
    const scale = Math.max(0.6, Math.min(1, col.w / widest));
    if (scale < 1)
      tokens = tokens.map((t) =>
        t.kind === 'math' ? { ...t, w: t.w * scale, h: t.h * scale } : t,
      );
    const lines = wrap(tokens, col.w, px);
    const w = Math.min(col.w, Math.max(...lines.map((l) => l.w), 1));
    const h = lines.reduce((sum, l) => sum + l.h, 0);
    const noteFor = action.kind === 'write' ? action.noteFor : undefined;
    const near = target ?? (noteFor ? findElement(layout, noteFor) : undefined);
    const { face, y } = slot(layout, column, h, near);
    const id = isCorrection ? freeId(layout, `${action.target}_fix`) : freeId(layout, action.id);
    const length = tokens.reduce((n, t) => n + (t.kind === 'math' ? 1 : t.value.length + 1), 0);
    const element: TextElement = {
      kind: 'text',
      id,
      face,
      column,
      x: col.x,
      y,
      w,
      h,
      role: titleRole
        ? 'title'
        : zone === 'steps' && action.kind === 'write' && action.zone === 'title'
          ? 'heading'
          : role,
      fontSize: px,
      scale,
      lines,
      length,
      speed: action.kind === 'write' ? action.speed : 'normal',
      source: text,
      math,
    };
    if (titleRole) {
      const f = layout.faces[face];
      if (f) {
        f.titleBottom = y + h;
        const top = Math.max(COLUMN_TOP, y + h + 24);
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
    let column = columnOf(action.zone);
    if (column === 'title' || column === 'side') column = 'right';
    let size = drawSize(type, spec, COLUMNS[column].w, m);
    // A wide table moves to the middle of the board rather than becoming unreadable.
    if (size.w > COLUMNS[column].w && column === 'right') {
      column = 'center';
      size = drawSize(type, spec, COLUMNS[column].w, m);
    }
    const scale = Math.min(1, COLUMNS[column].w / size.w);
    const w = size.w * scale;
    const h = size.h * scale;
    const { face, y } = slot(layout, column, h);
    const element: DrawElement = {
      kind: 'draw',
      id: freeId(layout, action.id),
      face,
      column,
      x: COLUMNS[column].x,
      y,
      w,
      h,
      type,
      spec,
    };
    layout.elements.push(element);
    return { layout, element };
  }
  return { layout, element: null };
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
