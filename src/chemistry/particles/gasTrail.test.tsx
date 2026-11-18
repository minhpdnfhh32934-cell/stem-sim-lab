import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { GasStage } from './GasStage';
import { FOLLOWED, TRAIL_TAU, gasRuntime, recordTrail, resetGas, useGasStore } from './gasStore';

afterEach(() => {
  useGasStore.setState({ follow: false, running: false, mode: 'maxwell' });
});

describe('"Theo dõi một hạt" (#195 step 6)', () => {
  it("records the model's own positions of one particle, only the last TRAIL_TAU", () => {
    useGasStore.setState({ mode: 'maxwell', n: 100 });
    resetGas();
    const g = gasRuntime.gas;
    if (!g) throw new Error('no gas');
    for (let i = 0; i < 400; i++) {
      g.advance(0.1);
      recordTrail();
      const last = gasRuntime.trail.at(-1);
      // No number of its own: exactly where the model put that particle at that time.
      expect(last).toEqual({ x: g.x[FOLLOWED], y: g.y[FOLLOWED], t: g.time });
    }
    const first = gasRuntime.trail[0];
    expect(g.time - (first?.t ?? 0)).toBeLessThanOrEqual(TRAIL_TAU + 1e-9);
    expect(gasRuntime.trail.length).toBeGreaterThan(TRAIL_TAU / 0.1 - 2);
    resetGas();
    expect(gasRuntime.trail).toEqual([]);
  });

  it('the stage button turns it on with its illustration label, and off again', () => {
    useSettingsStore.setState({ locale: 'vi' });
    render(<GasStage mode="maxwell" />);
    const btn = screen.getByRole('button', { name: 'Theo dõi một hạt' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btn);
    expect(useGasStore.getState().follow).toBe(true);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Một hạt của mô hình và đường nó vừa đi/)).toBeInTheDocument();
    fireEvent.click(btn);
    expect(useGasStore.getState().follow).toBe(false);
    expect(screen.queryByText(/Một hạt của mô hình/)).toBeNull();
  });
});
