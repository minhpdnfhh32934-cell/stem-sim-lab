import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, FONT_SCALES, nextFontScale, useSettingsStore } from './settingsStore';

describe('settings', () => {
  beforeEach(() => {
    useSettingsStore.setState({ ...DEFAULT_SETTINGS });
  });

  it('defaults to Vietnamese, system theme, 100% font', () => {
    const s = useSettingsStore.getState();
    expect(s.locale).toBe('vi');
    expect(s.theme).toBe('system');
    expect(s.fontScale).toBe(1);
  });

  it('font scale steps are clamped at both ends', () => {
    const max = FONT_SCALES[FONT_SCALES.length - 1]!;
    const min = FONT_SCALES[0];
    expect(nextFontScale(max, 1)).toBe(max);
    expect(nextFontScale(min, -1)).toBe(min);
    expect(nextFontScale(1, 1)).toBe(1.1);
  });

  it('toggleTheme flips the currently shown theme', () => {
    useSettingsStore.getState().toggleTheme('light');
    expect(useSettingsStore.getState().theme).toBe('dark');
    useSettingsStore.getState().toggleTheme('dark');
    expect(useSettingsStore.getState().theme).toBe('light');
  });
});
