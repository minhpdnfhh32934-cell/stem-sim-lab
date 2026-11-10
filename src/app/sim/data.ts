import { getUnit, isKnownUnit, sameDimension } from '@/core/units';
import type { GraphDef, Params, PhysicsScene } from '@/physics/types';
import type { History } from './history';
import { sim } from './runtime';

/**
 * Builds uPlot data arrays [t, s1, s2, …] from the recorded history: recorded states only, at
 * most `maxPoints` of them (every k-th). 4000 keeps ≥ 15 points per period of a 0,3 s
 * oscillation over a minute at ×1 (UI-22); 1500 left 6, so peaks looked angular.
 */
export function graphData(
  graph: GraphDef,
  p: Params,
  maxPoints = 4000,
  h: Pick<History, 'times' | 'states' | 'length'> = sim.history,
): number[][] {
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

/**
 * One uPlot table for two runs that kept their own times (the current run `a` and the pinned run
 * `b`): x is the union of both, sorted; each run's series are null at the other run's times, so
 * nothing is interpolated (the chart joins a run's own points with `spanGaps`).
 */
export function alignRuns(a: number[][], b: number[][]): (number | null)[][] {
  const ax = a[0] ?? [];
  const bx = b[0] ?? [];
  const as = a.slice(1);
  const bs = b.slice(1);
  const x: number[] = [];
  const outA: (number | null)[][] = as.map(() => []);
  const outB: (number | null)[][] = bs.map(() => []);
  let i = 0;
  let j = 0;
  while (i < ax.length || j < bx.length) {
    const ta = ax[i];
    const tb = bx[j];
    const takeA = ta !== undefined && (tb === undefined || ta <= tb);
    const takeB = tb !== undefined && (ta === undefined || tb <= ta);
    x.push((takeA ? ta : tb) ?? 0);
    as.forEach((col, k) => outA[k]?.push(takeA ? (col[i] ?? null) : null));
    bs.forEach((col, k) => outB[k]?.push(takeB ? (col[j] ?? null) : null));
    if (takeA) i++;
    if (takeB) j++;
  }
  return [x, ...outA, ...outB];
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
