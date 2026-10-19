import { render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import type uPlotType from 'uplot';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { XYChart } from './XYChart';

// The plot itself (uPlot needs matchMedia and a canvas) is not under test here: by default it
// never loads; a test can hand in a fake uPlot that records its options.
const plot = vi.hoisted(() => ({ load: (): Promise<unknown> => new Promise(() => undefined) }));
vi.mock('./uplot', () => ({
  SERIES_VARS: ['--chart-1'],
  loadUPlot: () => plot.load(),
}));

afterEach(() => {
  plot.load = () => new Promise(() => undefined);
  vi.unstubAllGlobals();
});

const chart = (
  <XYChart x={[0, 1, 2]} series={[{ label: 'N', y: [1, 2, 4] }]} xLabel="t" yLabel="N" />
);

/** Renders a chart with a fake uPlot and returns the options it was built with. */
async function optionsOf(element: ReactElement): Promise<uPlotType.Options> {
  const captured: uPlotType.Options[] = [];
  class FakePlot {
    root = document.createElement('div');
    constructor(opts: uPlotType.Options) {
      captured.push(opts);
    }
    setSize() {}
    setData() {}
    destroy() {}
    static paths = {};
  }
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  plot.load = () => Promise.resolve(FakePlot);
  render(element);
  await waitFor(() => {
    expect(captured).toHaveLength(1);
  });
  const opts = captured[0];
  if (!opts) throw new Error('uPlot was not created');
  return opts;
}

type SpaceFn = (u: unknown, axis: number, lo: number, hi: number, dim: number) => number;

describe('XYChart CSV export', () => {
  it('is an Advanced-mode tool: Basic shows no CSV button', () => {
    useSettingsStore.setState({ uiMode: 'basic' });
    render(chart);
    expect(screen.queryByRole('button', { name: 'Xuất CSV' })).toBeNull();
  });

  it('Advanced offers it', () => {
    useSettingsStore.setState({ uiMode: 'advanced' });
    render(chart);
    expect(screen.getByRole('button', { name: 'Xuất CSV' })).toBeInTheDocument();
    useSettingsStore.setState({ uiMode: 'basic' });
  });
});

describe('XYChart axes', () => {
  it('axis titles carry the units passed in (not only the legend and the CSV)', async () => {
    const opts = await optionsOf(
      <XYChart
        x={[0, 1, 2]}
        series={[{ label: 'v', y: [0, 1, 2] }]}
        xLabel="[S]"
        yLabel="Tốc độ v"
        xUnit="mM"
        yUnit="mM/phút"
      />,
    );
    expect(opts.axes?.[0]?.label).toBe('[S] (mM)');
    expect(opts.axes?.[1]?.label).toBe('Tốc độ v (mM/phút)');
  });

  it('a chart without units keeps the bare titles', async () => {
    const opts = await optionsOf(chart);
    expect(opts.axes?.[0]?.label).toBe('t');
    expect(opts.axes?.[1]?.label).toBe('N');
  });

  it('the y axis spaces its ticks for the plot height (several numbers on a short chart)', async () => {
    const opts = await optionsOf(chart);
    const space = opts.axes?.[1]?.space;
    expect(typeof space).toBe('function');
    const at = (h: number) => (space as SpaceFn)(null, 1, 0, 1, h);
    expect(at(77)).toBeLessThan(30);
    expect(at(400)).toBe(30);
  });
});
