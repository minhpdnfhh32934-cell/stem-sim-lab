import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { freeFall } from '@/physics/projectile/scenes';
import { uniformMotion } from '@/physics/linear/scenes';
import type { Params, PhysicsScene } from '@/physics/types';
import { GraphPanel } from './GraphPanel';
import { useSimStore } from './simStore';

// A uPlot that records the series each chart is created with (jsdom has no ResizeObserver).
const created: string[][] = [];
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    disconnect() {}
  },
);
vi.mock('@/ui/charts/uplot', () => ({
  SERIES_VARS: ['--chart-1', '--chart-2'],
  loadUPlot: () =>
    Promise.resolve(
      class {
        over = document.createElement('div');
        constructor(opts: { series: { label?: string }[] }) {
          created.push(opts.series.map((s) => s.label ?? ''));
        }
        setData() {}
        setSize() {}
        destroy() {}
      },
    ),
}));

async function chartFor(scene: PhysicsScene, params: Params) {
  created.length = 0;
  useSimStore.setState({ scene, params });
  const view = render(<GraphPanel />);
  await waitFor(() => {
    expect(created.length).toBeGreaterThan(0);
  });
  view.unmount();
  return created.at(-1) ?? [];
}

describe('GraphPanel: series a parameter hides (UI-13)', () => {
  it('"1 vật": the chart and its legend have no body B', async () => {
    expect(await chartFor(uniformMotion, { ...uniformMotion.defaults, twoBodies: 0 })).toEqual([
      't',
      'x (A)',
    ]);
    expect(await chartFor(uniformMotion, { ...uniformMotion.defaults, twoBodies: 1 })).toEqual([
      't',
      'x (A)',
      'x (B)',
    ]);
  });

  it('a scene without `when` keeps every series of its first graph', async () => {
    const first = freeFall.graphs[0];
    const labels = await chartFor(freeFall, { ...freeFall.defaults, g: 9.81 });
    expect(labels).toEqual(['t', ...(first?.series.map((s) => s.label.vi) ?? [])]);
  });
});
