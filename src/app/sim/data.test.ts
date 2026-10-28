import { describe, expect, it } from 'vitest';
import { isKnownUnit } from '@/core/units';
import { newtonLaws } from '@/physics/incline/scenes';
import { uniformAcceleration } from '@/physics/linear/scenes';
import { simplePendulum } from '@/physics/pendulum/scenes';
import { loadScene, sceneIds } from '@/physics/registry';
import { energyConservation } from '@/physics/track/scenes';
import { columnsFor, visibleSeries } from './data';

const vi = (t: { vi: string }) => t.vi;
const headers = (scene: Parameters<typeof columnsFor>[0]) =>
  columnsFor(scene, vi).map((c) => c.header);

describe('series a parameter hides (UI-13)', () => {
  it('"1 vật": body B leaves the chart and the Số liệu / CSV columns', async () => {
    const s = await loadScene('uniformMotion');
    const one = { ...s.defaults, twoBodies: 0 };
    const two = { ...s.defaults, twoBodies: 1 };
    const ids = (p: typeof one) => columnsFor(s, vi, p).map((c) => c.id);
    expect(ids(one)).toEqual(['xA', 'vA', 'aA']);
    expect(ids(two)).toEqual(['xA', 'xB', 'vA', 'vB', 'aA', 'aB']);
    // Without parameters (main's call): every series, as before.
    expect(columnsFor(s, vi).map((c) => c.id)).toEqual(ids(two));
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

describe('Số liệu headers (UI-21)', () => {
  it('a series label with its own unit, or an axis with several units, adds no second unit', () => {
    expect(headers(newtonLaws)).toContain('F_ms (N)');
    for (const h of [...headers(newtonLaws), ...headers(energyConservation)]) {
      expect(h).not.toMatch(/\((N|m|J|m\/s|m\/s²)\)\s*\(/);
      expect(h).not.toContain(';');
    }
  });

  it('a bracket that is not a unit ("x (A)", "α (chính xác)") still gets the axis unit', () => {
    expect(headers(uniformAcceleration)).toContain('x (A) (m)');
    expect(headers(simplePendulum).some((h) => /^α \(chính xác\) \(rad\)$/.test(h))).toBe(true);
  });

  it('every scene: a column whose axis has one unit ends with a unit', async () => {
    for (const id of sceneIds()) {
      const scene = await loadScene(id);
      const cols = columnsFor(scene, vi);
      for (const g of scene.graphs) {
        const unit = /\(([^)]+)\)/.exec(vi(g.yLabel))?.[1] ?? '';
        if (!unit || unit.includes(';')) continue;
        for (const s of g.series) {
          const header = cols.find((c) => c.id === s.id)?.header ?? '';
          const last = /\(([^()]*)\)\s*$/.exec(header)?.[1] ?? '';
          expect(isKnownUnit(last) || last === unit, `${id}: "${header}"`).toBe(true);
        }
      }
    }
  });
});
