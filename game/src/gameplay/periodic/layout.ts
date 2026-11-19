/**
 * Where each element stands on the hub's periodic table display, shared by what draws it
 * (props/hub.ts, render/periodicBoard.ts) and what reads a click on it (PeriodicTableSystem):
 * 18 columns, periods 1–7 in rows 0–6, lanthanum to lutetium and actinium to lawrencium in rows
 * 7.5 and 8.5 under the table from column 2 (group 3 of periods 6 and 7 left as the gap they come
 * from). Board coordinates: metres on the board's face from its centre, +x right, +y up.
 */

export const COLUMNS = 18;
/** Rows of cells, the f block's half-row gap included. */
export const ROWS = 9.5;
/** The board's margin round the cells (m, all sides together). */
const MARGIN = 0.3;
/** A tile's share of its cell (the rest is the gap between tiles). */
export const TILE_SHARE = 0.86;

/** The last atomic number of each period. */
const PERIOD_ENDS = [2, 10, 18, 36, 54, 86, 118] as const;

export interface Place {
  readonly column: number;
  readonly row: number;
}

/** Element `z`'s cell. */
export function placeOf(z: number): Place {
  if (!Number.isInteger(z) || z < 1 || z > 118) throw new Error(`No element ${z}`);
  if (z === 1) return { column: 0, row: 0 };
  if (z === 2) return { column: 17, row: 0 };
  const period = PERIOD_ENDS.findIndex((end) => z <= end) + 1;
  const start = (PERIOD_ENDS[period - 2] ?? 0) + 1;
  const k = z - start;
  if (period <= 3) return { column: k < 2 ? k : k + 10, row: period - 1 };
  if (period <= 5) return { column: k, row: period - 1 };
  // Periods 6 and 7: the f block's fifteen go under the table.
  const fFirst = period === 6 ? 57 : 89;
  if (z >= fFirst && z < fFirst + 15)
    return { column: 2 + z - fFirst, row: period === 6 ? 7.5 : 8.5 };
  return { column: k < 2 ? k : k - 14, row: period - 1 };
}

/** The element in each cell (0: a gap), by column and half-row: read every frame, no allocation. */
const HALF_ROWS = 18;
const BY_CELL = new Int16Array(COLUMNS * HALF_ROWS);
for (let z = 1; z <= 118; z++) {
  const { column, row } = placeOf(z);
  BY_CELL[column * HALF_ROWS + row * 2] = z;
}

/** The side of a cell (m) on a board w × h (the display's face, its frame included). */
export const cellSize = (w: number, h: number): number =>
  Math.min((w - MARGIN) / COLUMNS, (h - MARGIN) / ROWS);

/** A cell's centre on the board's face. */
export function cellCentre(place: Place, unit: number): readonly [number, number] {
  return [(place.column - (COLUMNS - 1) / 2) * unit, ((ROWS - 1) / 2 - place.row) * unit];
}

/** The element whose tile is at (x, y) on a board w × h, or null (a gap, between tiles, off it). */
export function elementAt(x: number, y: number, w: number, h: number): number | null {
  const unit = cellSize(w, h);
  const column = Math.round(x / unit + (COLUMNS - 1) / 2);
  // Rows are whole, but for the f block's two (7.5, 8.5).
  const r = (ROWS - 1) / 2 - y / unit;
  const row = r > 7 ? Math.round(r - 0.5) + 0.5 : Math.round(r);
  if (column < 0 || column >= COLUMNS || row < 0 || row * 2 >= HALF_ROWS) return null;
  const z = BY_CELL[column * HALF_ROWS + row * 2] ?? 0;
  if (z === 0) return null;
  const half = (TILE_SHARE * unit) / 2;
  const cx = (column - (COLUMNS - 1) / 2) * unit;
  const cy = ((ROWS - 1) / 2 - row) * unit;
  return Math.abs(x - cx) <= half && Math.abs(y - cy) <= half ? z : null;
}

/** An element's card (m): its size on the board's face, and how far before the face it floats. */
export const CARD = { w: 1.0, h: 1.5, out: 0.12 } as const;

/** Where element `z`'s card stands on a board w × h. */
export interface CardPlace {
  /** Its centre on the board's face. */
  readonly x: number;
  readonly y: number;
  /** The side of its tile it stands on: right (1) or left (−1), towards the board's middle. */
  readonly side: 1 | -1;
}

/** Element `z`'s card: beside its tile towards the board's middle, within the board's height. */
export function cardPlace(z: number, w: number, h: number): CardPlace {
  const unit = cellSize(w, h);
  const [cx, cy] = cellCentre(placeOf(z), unit);
  const side = cx < 0 ? 1 : -1;
  return {
    x: cx + side * (unit / 2 + 0.05 + CARD.w / 2),
    y: Math.min(h / 2 - CARD.h / 2, Math.max(-h / 2 + CARD.h / 2, cy)),
    side,
  };
}
