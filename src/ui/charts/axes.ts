/**
 * Axis helpers for the small uPlot charts (pure, tested without a canvas).
 */

/**
 * Axis title: the quantity and, when it has one, its unit in brackets ("[S] (mM)"). A label that
 * already ends with that unit in brackets is kept as it is, so the unit never shows twice.
 */
export function axisLabel(label: string, unit?: string): string {
  if (!unit) return label;
  const suffix = ` (${unit})`;
  // The space matters: "f(v)" is a function of v, not a quantity already in the unit "v".
  return label.trimEnd().endsWith(suffix) ? label : `${label}${suffix}`;
}

/** Fewest pixels between two y-axis ticks (closer, the numbers would touch). */
const MIN_SPACE = 14;
/** uPlot's own spacing, kept for tall charts. */
const MAX_SPACE = 30;

/**
 * Pixels between y-axis ticks for a plot area this tall. uPlot's default (30 px) leaves a short
 * chart in the bottom panel with one or two numbers. Nice steps (1, 2, 5 × 10ᵏ) can be up to
 * 2.5 times the smallest step that fits, so a sixth of the height still leaves at least three
 * numbers on the bottom panel's charts (about 75 px of plot).
 */
export function yTickSpace(plotHeight: number): number {
  if (!(plotHeight > 0)) return MAX_SPACE;
  return Math.max(MIN_SPACE, Math.min(MAX_SPACE, plotHeight / 6));
}

/**
 * x axis sizes: room for the tick values (`size`) and the title (`labelSize`), in px. uPlot's
 * defaults (50 + 30) took more than half of a chart in the bottom panel.
 */
export const X_AXIS_SIZE = { size: 32, labelSize: 20, gap: 4 } as const;
