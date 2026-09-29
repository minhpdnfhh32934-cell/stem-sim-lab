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

/** Flattens every graph series into table columns (deduplicated by id). */
export function columnsFor(scene: PhysicsScene, label: (t: { vi: string; en: string }) => string) {
  const cols: Column[] = [];
  const seen = new Set<string>();
  for (const g of scene.graphs) {
    for (const s of g.series) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      const unit = /\(([^)]+)\)/.exec(label(g.yLabel))?.[1] ?? '';
      cols.push({
        id: s.id,
        header: `${label(s.label)}${unit ? ` (${unit})` : ''}`,
        value: s.value,
      });
    }
  }
  return cols;
}

/** CSV (RFC 4180, dot decimal, UTF-8 BOM so Excel opens Vietnamese headers correctly). */
export { toCsv } from '@/ui/charts/csv';
