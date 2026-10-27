import { describe, expect, it } from 'vitest';
import { loadScene } from '@/physics/registry';
import { columnsFor, visibleSeries } from './data';

const vi = (t: { vi: string }) => t.vi;

describe('series a parameter hides (UI-13)', () => {
  it('"1 vật": body B leaves the chart and the Số liệu / CSV columns', async () => {
    const s = await loadScene('uniformMotion');
    const one = { ...s.defaults, twoBodies: 0 };
    const two = { ...s.defaults, twoBodies: 1 };
    const ids = (p: typeof one) => columnsFor(s, vi, p).map((c) => c.id);
    expect(ids(one)).toEqual(['xA', 'vA', 'aA']);
    expect(ids(two)).toEqual(['xA', 'xB', 'vA', 'vB', 'aA', 'aB']);
    const position = s.graphs[0];
    if (!position) throw new Error('no graph');
    expect(visibleSeries(position, one).map((x) => x.label.vi)).toEqual(['x (A)']);
    expect(visibleSeries(position, two)).toHaveLength(2);
  });

  it('a scene without `when` keeps every series', async () => {
    const s = await loadScene('freeFall');
    const all = s.graphs.flatMap((g) => g.series.map((x) => x.id));
    expect(columnsFor(s, vi, s.defaults).map((c) => c.id)).toEqual([...new Set(all)]);
    for (const g of s.graphs) expect(visibleSeries(g, s.defaults)).toEqual(g.series);
  });
});
