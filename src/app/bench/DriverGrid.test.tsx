import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { DriverGrid } from './DriverGrid';
import { nearestBasicSpeed } from './speeds';

describe('bench edge speed', () => {
  afterEach(() => {
    act(() => {
      useSettingsStore.getState().setUiMode('basic');
      useWorkspaceStore.getState().setSpeed(1);
    });
  });

  it('the nearest Basic step', () => {
    expect([0.1, 0.25, 0.5, 1, 2, 4, 10, 1000].map(nearestBasicSpeed)).toEqual([
      0.5, 0.5, 0.5, 1, 2, 2, 2, 2,
    ]);
  });

  it('switching to Basic lands a speed set in Advanced on one of its steps', () => {
    act(() => {
      useSettingsStore.getState().setUiMode('advanced');
      useWorkspaceStore.getState().setSpeed(10);
    });
    render(<DriverGrid />);
    expect(screen.getByRole('combobox', { name: 'Tốc độ phát' })).toHaveValue('10');
    act(() => {
      useSettingsStore.getState().setUiMode('basic');
    });
    expect(useWorkspaceStore.getState().speed).toBe(2);
    expect(screen.getByRole('radio', { name: '2×' })).toBeChecked();

    act(() => {
      useSettingsStore.getState().setUiMode('advanced');
      useWorkspaceStore.getState().setSpeed(0.25);
    });
    act(() => {
      useSettingsStore.getState().setUiMode('basic');
    });
    expect(screen.getByRole('radio', { name: '0,5×' })).toBeChecked();
  });
});
