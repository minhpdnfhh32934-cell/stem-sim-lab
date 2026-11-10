import { describe, expect, it } from 'vitest';
import { isKnownUnit } from '@/core/units';
import { newtonLaws } from '@/physics/incline/scenes';
import { uniformAcceleration } from '@/physics/linear/scenes';
import { simplePendulum } from '@/physics/pendulum/scenes';
import { loadScene, sceneIds } from '@/physics/registry';
import { energyConservation } from '@/physics/track/scenes';
import { alignRuns, columnsFor, graphData, visibleSeries } from './data';

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

describe('a pinned run beside the current one (BENCH_DESIGN §2: dashed, own times)', () => {
  it('joins both runs on the union of their times, null where a run has no sample', () => {
    const a = [
      [0, 1, 2],
      [10, 11, 12],
    ];
    const b = [
      [0, 0.5, 2, 3],
      [20, 21, 22, 23],
    ];
    expect(alignRuns(a, b)).toEqual([
      [0, 0.5, 1, 2, 3],
      [10, null, 11, 12, null],
      [20, 21, null, 22, 23],
    ]);
  });

  it('reads the pinned run from its own samples and its own parameters', () => {
    const g = uniformAcceleration.graphs[0];
    if (!g) throw new Error('no graph');
    const states = [Float64Array.of(0, 0, 0, 0), Float64Array.of(1, 2, 3, 4)];
    const cols = graphData(g, uniformAcceleration.defaults, 4000, {
      times: [0, 0.5],
      states,
      length: 2,
    });
    expect(cols[0]).toEqual([0, 0.5]);
    expect(cols).toHaveLength(g.series.length + 1);
    g.series.forEach((ser, k) => {
      expect(cols[k + 1]?.[1]).toBe(
        ser.value(states[1] ?? Float64Array.of(), uniformAcceleration.defaults),
      );
    });
  });
});
