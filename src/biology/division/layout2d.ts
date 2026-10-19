/**
 * Where the 2D division picture puts chromosomes that are not lined up (prophase, telophase): a
 * grid of equal slots inside the cell, one chromosome per slot, with a small seeded jitter that
 * never leaves the slot. Random places (the old picture) let chromosomes overlap at prophase.
 * Positions are illustrative only; nothing here changes a count.
 */

export interface ScatterSlot {
  x: number;
  y: number;
}

export interface ScatterLayout {
  slots: ScatterSlot[];
  /** Factor (≤ 1) the chromosomes are drawn at so that each fits its slot. */
  fit: number;
}

/**
 * `n` slots centred at (cx, cy) inside a box of half-size (hw, hh), for items of size
 * itemW × itemH (the largest chromosome drawn). Rows and columns follow the box's shape.
 */
export function scatterLayout(
  n: number,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  itemW: number,
  itemH: number,
  rand: () => number,
): ScatterLayout {
  if (n <= 0) return { slots: [], fit: 1 };
  const w = Math.max(1e-6, 2 * hw);
  const h = Math.max(1e-6, 2 * hh);
  // Columns × rows ≥ n with slots as close as possible to the items' own shape.
  let best = { cols: n, rows: 1, fit: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const fit = Math.min(1, w / cols / itemW, h / rows / itemH);
    if (fit > best.fit + 1e-9) best = { cols, rows, fit };
  }
  const { cols, rows, fit } = best;
  const sw = w / cols;
  const sh = h / rows;
  // Free room inside a slot once the (scaled) item is in it: the jitter stays within it.
  const jx = Math.max(0, (sw - itemW * fit) / 2) * 0.8;
  const jy = Math.max(0, (sh - itemH * fit) / 2) * 0.8;
  const slots: ScatterSlot[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    // The last row is centred when it is not full.
    const inRow = r === rows - 1 ? n - r * cols : cols;
    const c = i - r * cols;
    const x0 = cx - (inRow * sw) / 2 + sw * (c + 0.5);
    const y0 = cy - h / 2 + sh * (r + 0.5);
    slots.push({ x: x0 + (rand() * 2 - 1) * jx, y: y0 + (rand() * 2 - 1) * jy });
  }
  return { slots, fit };
}
