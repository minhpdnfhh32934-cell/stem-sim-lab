/**
 * Axis helpers for the small uPlot charts (pure, tested without a canvas).
 */

/** Axis title: the quantity and, when it has one, its unit in brackets ("[S] (mM)"). */
export function axisLabel(label: string, unit?: string): string {
  return unit ? `${label} (${unit})` : label;
}

/** Fewest pixels between two y-axis ticks (closer, the numbers would touch). */
const MIN_SPACE = 14;
/** uPlot's own spacing, kept for tall charts. */
const MAX_SPACE = 30;

/**
 * Pixels between y-axis ticks for a plot area this tall. uPlot's default (30 px) leaves a short
 * chart in the bottom panel with one or two numbers; a quarter of the height gives about four,
 * so a value can be read off the axis at any panel height.
 */
export function yTickSpace(plotHeight: number): number {
  if (!(plotHeight > 0)) return MAX_SPACE;
  return Math.max(MIN_SPACE, Math.min(MAX_SPACE, plotHeight / 4));
}
