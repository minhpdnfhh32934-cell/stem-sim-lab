import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInThisContext } from 'node:vm';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { ThemeSwitch } from './ThemeSwitch';

const BOOT = readFileSync(resolve(__dirname, '../../../public/theme-boot.js'), 'utf8');

/** The theme `theme-boot.js` would apply on the next start, from what the switch saved. */
function bootTheme(): string | undefined {
  delete document.documentElement.dataset.theme;
  runInThisContext(BOOT);
  return document.documentElement.dataset.theme;
}

function systemIs(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: dark && query.includes('dark'),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe('bench theme switch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    act(() => {
      useSettingsStore.getState().setTheme('system');
    });
  });

  it('light, dark and "Theo máy": what it shows is what theme-boot.js restores', () => {
    systemIs(true);
    act(() => {
      useSettingsStore.getState().setTheme('system');
    });
    render(<ThemeSwitch system />);
    // An icon button (user decision 11/11/2026, #202): pressed = dark, moon ⇄ sun.
    const dark = screen.getByRole('button', { name: 'Giao diện tối' });
    const follow = screen.getByRole('button', { name: 'Theo máy' });
    const state = () => ({
      saved: useSettingsStore.getState().theme,
      dark: dark.getAttribute('aria-pressed') === 'true',
      follow: follow.getAttribute('aria-pressed'),
      boot: bootTheme(),
    });

    // Following a dark device.
    expect(state()).toEqual({ saved: 'system', dark: true, follow: 'true', boot: 'dark' });
    // Choosing a side leaves "Theo máy".
    fireEvent.click(dark);
    expect(state()).toEqual({ saved: 'light', dark: false, follow: 'false', boot: 'light' });
    fireEvent.click(dark);
    expect(state()).toEqual({ saved: 'dark', dark: true, follow: 'false', boot: 'dark' });
    fireEvent.click(follow);
    expect(state()).toEqual({ saved: 'system', dark: true, follow: 'true', boot: 'dark' });
    // Pressed again, "Theo máy" lets go and keeps the theme on screen.
    fireEvent.click(follow);
    expect(state()).toEqual({ saved: 'dark', dark: true, follow: 'false', boot: 'dark' });
  });

  it('on a light device, leaving "Theo máy" keeps light', () => {
    systemIs(false);
    render(<ThemeSwitch system />);
    const follow = screen.getByRole('button', { name: 'Theo máy' });
    expect(
      screen.getByRole('button', { name: 'Giao diện tối', pressed: false }),
    ).toBeInTheDocument();
    expect(bootTheme()).toBe('light');
    fireEvent.click(follow);
    expect(useSettingsStore.getState().theme).toBe('light');
    expect(bootTheme()).toBe('light');
  });

  it('the header copy has no "Theo máy" (that lives in Settings → Giao diện)', () => {
    render(<ThemeSwitch />);
    expect(screen.queryByRole('button', { name: 'Theo máy' })).toBeNull();
  });

  it('a moon while light, a sun while dark; the name is its tooltip', () => {
    systemIs(false);
    render(<ThemeSwitch />);
    const button = screen.getByRole('button', { name: 'Giao diện tối' });
    expect(button).toHaveAttribute('data-tip', 'Giao diện tối');
    const shown = () => button.querySelector('.icon-swap')?.getAttribute('data-alt');
    expect(button.querySelector('.lucide-moon')).not.toBeNull();
    expect(button.querySelector('.lucide-sun')).not.toBeNull();
    expect(shown()).toBe('false');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(shown()).toBe('true');
  });
});
