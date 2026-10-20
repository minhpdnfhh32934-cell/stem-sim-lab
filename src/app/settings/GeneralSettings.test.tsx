import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSettingsStore } from './settingsStore';
import { SimulationSettings } from './GeneralSettings';

describe('Simulation settings', () => {
  it('shows standard gravity with all its digits (9,80665, never a rounded 9,807)', () => {
    useSettingsStore.setState({ locale: 'vi' });
    render(<SimulationSettings />);
    expect(screen.getByRole('radio', { name: /^9,80665 \(chuẩn\)$/ })).toBeInTheDocument();
    expect(screen.queryByText(/9,807\b/)).toBeNull();
  });
});
