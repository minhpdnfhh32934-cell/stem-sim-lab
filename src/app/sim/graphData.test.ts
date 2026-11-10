import { afterEach, describe, expect, it } from 'vitest';
import type { GraphDef } from '@/physics/types';
import { graphData, phaseData } from './data';
import { sim } from './runtime';

const graph: GraphDef = {
  id: 'x',
  title: { vi: 'x', en: 'x' },
  yLabel: { vi: 'x (m)', en: 'x (m)' },
  series: [{ id: 'x', label: { vi: 'x', en: 'x' }, value: (s) => s[0] ?? 0 }],
};

describe('graph points (UI-22)', () => {
  afterEach(() => {
    sim.history.clear();
  });

  it('a minute of a 0,314 s oscillation at ×1 keeps ≥ 15 recorded points per period', () => {
    // Spring 0,25 kg, 100 N/m: ω = 20 rad/s; 60 s recorded every 1/120 s = 7201 samples.
    const T = (2 * Math.PI) / 20;
    for (let i = 0; i <= 7200; i++) {
      const t = i / 120;
      sim.history.push(t, Float64Array.of(0.05 * Math.cos(20 * t)));
    }
    const [t = [], x = []] = graphData(graph, {});
    expect(t.length / (60 / T)).toBeGreaterThanOrEqual(15);
    // Every point is a recorded engine state, not an interpolation.
    t.forEach((tt, i) => {
      expect(x[i]).toBe(0.05 * Math.cos(20 * tt));
    });
  });
});

describe('phase portraits (#54 item 3)', () => {
  afterEach(() => {
    sim.history.clear();
  });
  const phase: GraphDef = {
    ...graph,
    x: { label: { vi: 'x', en: 'x' }, value: (s) => s[0] ?? 0 },
    series: [{ id: 'y', label: { vi: 'y', en: 'y' }, value: (s) => s[1] ?? 0 }],
  };

  it('pairs x with each series, keeps the latest state and finds the scrubbed one', () => {
    for (let i = 0; i <= 10; i++) sim.history.push(i / 10, Float64Array.of(i, 2 * i));
    const d = phaseData(phase, {}, null, 4);
    expect(d.series[0]).toEqual([
      [0, 0],
      [3, 6],
      [6, 12],
      [9, 18],
      [10, 20],
    ]);
    expect(d.current).toEqual([[10, 20]]);
    expect(phaseData(phase, {}, 0.35).current).toEqual([[3, 6]]);
    expect(phaseData(phase, {}, 0).current).toEqual([[0, 0]]);
  });

  it('a time graph or an empty history has no phase points', () => {
    expect(phaseData(phase, {}, null)).toEqual({ series: [[]], current: null });
    sim.history.push(0, Float64Array.of(1, 2));
    expect(phaseData(graph, {}, null).current).toBeNull();
  });
});
