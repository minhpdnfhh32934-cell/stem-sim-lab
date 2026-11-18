import { fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AppearanceSettings } from '@/app/settings/GeneralSettings';
import { DEFAULT_SETTINGS, useSettingsStore } from '@/app/settings/settingsStore';
import { prefersReducedMotion } from '@/ui/three/availability';
import { withReducedMotion } from '@/ui/three/testing';
import { useApplyTheme } from './useApplyTheme';

/** Every stylesheet under src/. */
function sheets(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sheets(join(dir, e.name))
      : e.name.endsWith('.css')
        ? [join(dir, e.name)]
        : [],
  );
}

describe('motion in the app (#195 step 2)', () => {
  afterEach(() => {
    useSettingsStore.setState({ ...DEFAULT_SETTINGS });
  });

  it('defaults to the system; a saved state without it keeps that default', () => {
    expect(DEFAULT_SETTINGS.motion).toBe('system');
    const { partialize } = useSettingsStore.persist.getOptions();
    expect(partialize?.(useSettingsStore.getState())).toMatchObject({ motion: 'system' });
  });

  it('writes the resolved choice on <html>: the system decides only under "system"', () => {
    renderHook(() => useApplyTheme());
    // jsdom has no matchMedia: the system asks for nothing, so motion is full.
    expect(document.documentElement.dataset.motion).toBe('full');
    expect(prefersReducedMotion()).toBe(false);

    const restore = withReducedMotion();
    try {
      useSettingsStore.getState().setMotion('full');
      renderHook(() => useApplyTheme());
      // The app's "Đầy đủ" wins over the system's reduce, for JS and CSS alike.
      expect(document.documentElement.dataset.motion).toBe('full');
      expect(prefersReducedMotion()).toBe(false);

      useSettingsStore.getState().setMotion('system');
      renderHook(() => useApplyTheme());
      expect(document.documentElement.dataset.motion).toBe('reduce');
      expect(prefersReducedMotion()).toBe(true);
    } finally {
      restore();
    }

    useSettingsStore.getState().setMotion('reduce');
    renderHook(() => useApplyTheme());
    expect(document.documentElement.dataset.motion).toBe('reduce');
    expect(prefersReducedMotion()).toBe(true);
  });

  it('Settings → Giao diện → Chuyển động sets the choice', () => {
    useSettingsStore.setState({ locale: 'vi' });
    render(<AppearanceSettings />);
    const group = screen.getByRole('radiogroup', { name: 'Chuyển động trong app' });
    expect(within(group).getByRole('radio', { name: 'Theo hệ thống' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    fireEvent.click(within(group).getByRole('radio', { name: 'Giảm' }));
    expect(useSettingsStore.getState().motion).toBe('reduce');
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
  });

  it('stylesheets read the one source, data-motion, never the media query', () => {
    const src = resolve(__dirname, '../..');
    const direct = sheets(src).filter((f) =>
      readFileSync(f, 'utf8').includes('prefers-reduced-motion'),
    );
    expect(direct).toEqual([]);
    const tokens = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8');
    expect(tokens).toMatch(/:root\[data-motion='reduce'\] \{\s*--dur-fast: 0ms;\s*--dur-med: 0ms;/);
  });
});
