import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { XYChart } from './XYChart';

// The plot itself (uPlot needs matchMedia and a canvas) is not under test here.
vi.mock('./uplot', () => ({
  SERIES_VARS: ['--chart-1'],
  loadUPlot: () => new Promise(() => undefined),
}));

const chart = (
  <XYChart x={[0, 1, 2]} series={[{ label: 'N', y: [1, 2, 4] }]} xLabel="t" yLabel="N" />
);

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
