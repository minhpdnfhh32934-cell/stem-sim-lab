import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { electricField } from '@/physics/field/scenes';
import { freeFall } from '@/physics/projectile/scenes';
import { uniformMotion } from '@/physics/linear/scenes';
import type { Params, PhysicsScene } from '@/physics/types';
import { GraphPanel } from './GraphPanel';
import { useSimStore } from './simStore';

// A uPlot that records the series each chart is created with (jsdom has no ResizeObserver).
const created: string[][] = [];
const dashes: (number[] | null)[][] = [];
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
        root = document.createElement('div');
        constructor(opts: { series: { label?: string; dash?: number[] }[] }) {
          created.push(opts.series.map((s) => s.label ?? ''));
          dashes.push(opts.series.map((s) => s.dash ?? null));
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

describe('GraphPanel: a curve that can lie on another is dashed (UI-23)', () => {
  it('Eₓ is dashed over E (the same line while E_y = 0); a scene without `dash` stays solid', async () => {
    const labels = await chartFor(electricField, electricField.defaults);
    const dash = dashes.at(-1) ?? [];
    expect(dash[labels.indexOf('Eₓ')]).toEqual([7, 5]);
    expect(dash[labels.indexOf('E')]).toBeNull();
    await chartFor(freeFall, { ...freeFall.defaults, g: 9.81 });
    expect((dashes.at(-1) ?? []).every((d) => d === null)).toBe(true);
  });
});
