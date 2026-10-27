import { getUnit, isKnownUnit, sameDimension } from '@/core/units';
import type { GraphDef, Params, PhysicsScene } from '@/physics/types';
import { sim } from './runtime';

/** Builds uPlot data arrays [t, s1, s2, …] from the recorded history. */
export function graphData(graph: GraphDef, p: Params, maxPoints = 1500): number[][] {
  const h = sim.history;
  const n = h.length;
  const stride = Math.max(1, Math.ceil(n / maxPoints));
  const cols: number[][] = [[], ...graph.series.map(() => [])];
  for (let i = 0; i < n; i += stride) {
    const s = h.states[i];
    const t = h.times[i];
    if (!s || t === undefined) continue;
    cols[0]?.push(t);
    graph.series.forEach((ser, k) => cols[k + 1]?.push(ser.value(s, p)));
  }
  return cols;
}

export interface Column {
  id: string;
  header: string;
  value: (s: Float64Array, p: Params) => number;
}

/** The series the parameters show (body B's curves leave the chart, table and CSV when "1 vật"). */
export const visibleSeries = (g: GraphDef, p: Params) =>
  g.series.filter((s) => s.when?.(p) ?? true);

/**
 * Flattens the graph series into table columns (deduplicated by id): those the parameters `p` show
 * (the Số liệu table and CSV pass them), every series when `p` is left out.
 */
export function columnsFor(
  scene: PhysicsScene,
  label: (t: { vi: string; en: string }) => string,
  p?: Params,
) {
  const cols: Column[] = [];
  const seen = new Set<string>();
  for (const g of scene.graphs) {
    for (const s of p ? visibleSeries(g, p) : g.series) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      const unit = /\(([^)]+)\)/.exec(label(g.yLabel))?.[1] ?? '';
      const name = label(s.label);
      // The last bracket of a series label is its own unit only when it reads as one ("F_ms (N)");
      // "x (A)" or "α (chính xác)" still need the axis unit. A list of units from the axis
      // ("N; m/s²") belongs to no single column.
      const own = /\(([^()]*)\)\s*$/.exec(name)?.[1];
      // "(A)" is also the ampere: a bracket counts only with the axis unit's dimension.
      const axisDim = isKnownUnit(unit) ? getUnit(unit).dim : null;
      const hasUnit =
        own !== undefined &&
        (own === unit ||
          (isKnownUnit(own) && (axisDim === null || sameDimension(getUnit(own).dim, axisDim))));
      const header = hasUnit || !unit || unit.includes(';') ? name : `${name} (${unit})`;
      cols.push({ id: s.id, header, value: s.value });
    }
  }
  return cols;
}

/** CSV (RFC 4180, dot decimal, UTF-8 BOM so Excel opens Vietnamese headers correctly). */
export { toCsv } from '@/ui/charts/csv';
