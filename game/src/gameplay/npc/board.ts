import type { Vec3 } from '../../core/math';

/**
 * Where a worked example is written on a board (Phase Y-3), in the board's own frame (m: its
 * centre the origin, +x to the right as one faces it, +y up, its writing face towards +z). Shared
 * by the teacher (where his hand goes) and the renderer (where the letters go), so the hand is
 * where the ink appears. Pure.
 */
export interface BoardArea {
  /** The writing area's left edge and top (m). */
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  /** A line's height, and the letters' estimated width (m). */
  readonly lineHeight: number;
  readonly charWidth: number;
  /** The writing face (m, along +z). */
  readonly face: number;
}

/** Margins of the writing area inside a board's box (m): the frame, and the tray below. */
const SIDE_M = 0.06;
const TOP_M = 0.05;
const BOTTOM_M = 0.09;
/** The tallest a line is written (m), and lines a board is laid out for at least. */
const LINE_M = 0.085;
const MIN_LINES = 8;
/** A handwritten letter's width per line height (an estimate: the renderer measures). */
const CHAR_PER_LINE = 0.46;

/**
 * The writing area of a board of `size` (its item's box, m) for `lines` lines. Its writing face is
 * the whiteboard prop's white board (`render/props/rooms.ts`: the frame's depth off the wall, less
 * 6 mm), a hair in front of it.
 */
export function boardArea(size: Readonly<Vec3>, lines: number): BoardArea {
  const [w, h, d] = size;
  const height = h - TOP_M - BOTTOM_M;
  const lineHeight = Math.min(LINE_M, height / Math.max(lines, MIN_LINES));
  return {
    left: -w / 2 + SIDE_M,
    top: h / 2 - TOP_M,
    width: w - 2 * SIDE_M,
    height,
    lineHeight,
    charWidth: lineHeight * CHAR_PER_LINE,
    face: -d / 2 + Math.min(0.022, d) - 0.006 + 0.001,
  };
}

/** The narrowest a line's letters are written (of their width) before it is broken in two. */
const MIN_FIT = 0.8;

/** The letters a line of `area` holds, squeezed at most to MIN_FIT. */
export function lineCapacity(area: BoardArea): number {
  return Math.max(12, Math.floor(area.width / (area.charWidth * MIN_FIT)));
}

/**
 * `text` as board lines of at most `max` letters: broken after a "; " where one is not too near
 * the start, else at a space; the lines after the first indented. A word longer than a line stays
 * whole (it is squeezed).
 */
export function wrapLine(text: string, max: number): string[] {
  const out: string[] = [];
  let rest = text;
  while (rest.length > max) {
    const head = rest.slice(0, max + 1);
    const semi = head.lastIndexOf('; ');
    const cut = semi > max / 3 ? semi + 1 : head.lastIndexOf(' ');
    if (cut <= 2) break;
    out.push(rest.slice(0, cut).trimEnd());
    rest = `  ${rest.slice(cut).trimStart()}`;
  }
  out.push(rest);
  return out;
}

/**
 * Lines `texts` laid out on a board of `size`: each broken to fit (wrapLine) at the line height
 * the whole board then has. `from[i]` is the first board line of text i (and `from[n]` the count).
 */
export function layoutBoard(
  size: Readonly<Vec3>,
  texts: readonly string[],
): { lines: string[]; from: number[]; area: BoardArea } {
  let count = texts.length;
  let wrapped: string[][] = [];
  // More lines make them smaller and so hold more letters: settled in a few rounds.
  for (let round = 0; round < 4; round++) {
    const max = lineCapacity(boardArea(size, count));
    wrapped = texts.map((text) => wrapLine(text, max));
    const next = wrapped.reduce((n, w) => n + w.length, 0);
    if (next === count) break;
    count = next;
  }
  const from = [0];
  for (const w of wrapped) from.push((from.at(-1) ?? 0) + w.length);
  const lines = wrapped.flat();
  return { lines, from, area: boardArea(size, lines.length) };
}

/** How wide line `text` is written (m, estimated; never wider than the area: it is squeezed). */
export function lineWidth(area: BoardArea, characters: number): number {
  return Math.min(area.width, characters * area.charWidth);
}

/**
 * The point of line `line` after `written` of its `characters` letters (board frame, m, into
 * `out`): where the pen is. A line squeezed to fit keeps its letters in proportion.
 */
export function penAt(
  area: BoardArea,
  line: number,
  written: number,
  characters: number,
  out: Vec3,
): Vec3 {
  const width = lineWidth(area, characters);
  out[0] = area.left + (characters > 0 ? (width * written) / characters : 0);
  out[1] = area.top - (line + 0.65) * area.lineHeight;
  out[2] = area.face;
  return out;
}
