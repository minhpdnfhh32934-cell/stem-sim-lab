import { render, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import type uPlotType from 'uplot';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { GasBottom } from './particles/GasBottom';
import { useGasStore } from './particles/gasStore';
import { TrendBottom } from './periodic/TrendBottom';
import { usePeriodicStore } from './periodic/store';

// The chemistry charts pass both a label and a unit to XYChart, which writes the unit into the
// axis title. A fake uPlot records the options so the titles can be read without a canvas.
const plot = vi.hoisted(() => ({ load: (): Promise<unknown> => new Promise(() => undefined) }));
vi.mock('@/ui/charts/uplot', () => ({
  SERIES_VARS: ['--chart-1', '--chart-2', '--chart-3', '--chart-4'],
  loadUPlot: () => plot.load(),
}));

afterEach(() => {
  plot.load = () => new Promise(() => undefined);
  vi.unstubAllGlobals();
  useSettingsStore.setState({ locale: 'vi' });
});

/** Axis titles (x, y) of the first chart the element draws. */
async function axisTitles(element: ReactElement): Promise<[string, string]> {
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
    expect(captured.length).toBeGreaterThan(0);
  });
  const axes = captured[0]?.axes;
  return [String(axes?.[0]?.label ?? ''), String(axes?.[1]?.label ?? '')];
}

const count = (text: string, part: string) => text.split(part).length - 1;

describe('chemistry chart axes show each unit once', () => {
  it('periodic trend: covalent radius in pm', async () => {
    usePeriodicStore.setState({ colorBy: 'radius' });
    const [x, y] = await axisTitles(<TrendBottom />);
    expect(x).toBe('Z');
    expect(y).toBe('r (pm)');
  });

  it('periodic trend: first ionization energy in eV', async () => {
    usePeriodicStore.setState({ colorBy: 'ie' });
    const [, y] = await axisTitles(<TrendBottom />);
    expect(y).toBe('I₁ (eV)');
    expect(count(y, '(eV)')).toBe(1);
  });

  it('periodic trend: a property without a unit keeps a bare title', async () => {
    usePeriodicStore.setState({ colorBy: 'en' });
    const [, y] = await axisTitles(<TrendBottom />);
    expect(y).toBe('χ');
  });

  it('Maxwell–Boltzmann histogram: speed in m/s (Vietnamese)', async () => {
    useGasStore.setState({ mode: 'maxwell' });
    const [x, y] = await axisTitles(<GasBottom />);
    expect(x).toBe('Tốc độ v (m/s)');
    expect(count(x, '(m/s)')).toBe(1);
    expect(y).toBe('f(v) (s/m)');
  });

  it('Maxwell–Boltzmann histogram: speed in m/s (English)', async () => {
    useSettingsStore.setState({ locale: 'en' });
    useGasStore.setState({ mode: 'maxwell' });
    const [x] = await axisTitles(<GasBottom />);
    expect(x).toBe('Speed v (m/s)');
  });
});
