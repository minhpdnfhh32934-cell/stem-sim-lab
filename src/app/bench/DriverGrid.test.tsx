import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { DriverGrid } from './DriverGrid';

describe('bench edge speed', () => {
  afterEach(() => {
    act(() => {
      useSettingsStore.getState().setUiMode('basic');
      useWorkspaceStore.setState({ speed: 1, suggestedSpeed: null });
    });
  });

  it('Advanced is a select of every speed; Basic shows 0,5× · 1× · 2×', () => {
    act(() => {
      useSettingsStore.getState().setUiMode('advanced');
    });
    render(<DriverGrid />);
    expect(screen.getByRole('combobox', { name: 'Tốc độ phát' })).toHaveValue('1');
    act(() => {
      useSettingsStore.getState().setUiMode('basic');
    });
    expect(
      screen
        .getAllByRole('radio')
        .map((r) => r.getAttribute('aria-label') ?? r.closest('label')?.textContent),
    ).toEqual(['0,5×', '1×', '2×']);
  });

  it('the lesson’s own speed stays a step after another is chosen, and can be chosen again', () => {
    act(() => {
      useWorkspaceStore.setState({ speed: 1000, suggestedSpeed: 1000 });
    });
    render(<DriverGrid />);
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.getByRole('radio', { name: '1.000×' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: '1×' }));
    expect(useWorkspaceStore.getState().speed).toBe(1);
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    fireEvent.click(screen.getByRole('radio', { name: '1.000×' }));
    expect(useWorkspaceStore.getState().speed).toBe(1000);
  });
});
