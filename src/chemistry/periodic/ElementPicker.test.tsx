import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { ElementPicker } from './ElementPicker';

afterEach(() => {
  cleanup();
  act(() => {
    useSettingsStore.setState({ locale: 'vi' });
  });
});

describe('ElementPicker', () => {
  it('adds the Vietnamese name only in Vietnamese', () => {
    act(() => {
      useSettingsStore.setState({ locale: 'vi' });
    });
    render(<ElementPicker max={2} />);
    expect(screen.getByRole('option', { name: /^1 · H — Hydrogen \(hiđro\)$/ })).toBeTruthy();
    cleanup();
    act(() => {
      useSettingsStore.setState({ locale: 'en' });
    });
    render(<ElementPicker max={2} />);
    expect(screen.getByRole('option', { name: /^1 · H — Hydrogen$/ })).toBeTruthy();
    expect(screen.getByRole('combobox').textContent).not.toMatch(/hiđro|heli/);
  });
});
