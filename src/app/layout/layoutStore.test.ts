import { beforeEach, describe, expect, it } from 'vitest';
import { LAYOUT_LIMITS, clampSize, useLayoutStore } from './layoutStore';

describe('clampSize()', () => {
  it('keeps sizes inside the allowed range', () => {
    expect(clampSize('left', 10)).toBe(LAYOUT_LIMITS.left.min);
    expect(clampSize('left', 9999)).toBe(LAYOUT_LIMITS.left.max);
    expect(clampSize('bottom', 300.6)).toBe(301);
  });

  it('falls back to the default for NaN / Infinity', () => {
    expect(clampSize('right', Number.NaN)).toBe(LAYOUT_LIMITS.right.default);
    expect(clampSize('right', Number.POSITIVE_INFINITY)).toBe(LAYOUT_LIMITS.right.default);
  });
});

describe('useLayoutStore', () => {
  beforeEach(() => {
    useLayoutStore.getState().resetLayout();
    useLayoutStore.getState().setPresentation(false);
  });

  it('toggles panels', () => {
    const { toggle } = useLayoutStore.getState();
    toggle('left');
    expect(useLayoutStore.getState().leftOpen).toBe(false);
    toggle('left');
    expect(useLayoutStore.getState().leftOpen).toBe(true);
  });

  it('clamps sizes set through the store', () => {
    useLayoutStore.getState().setSize('right', 5);
    expect(useLayoutStore.getState().rightWidth).toBe(LAYOUT_LIMITS.right.min);
  });

  it('opening a tab also opens its panel', () => {
    useLayoutStore.getState().toggle('bottom');
    useLayoutStore.getState().setBottomTab('solution');
    const s = useLayoutStore.getState();
    expect(s.bottomOpen).toBe(true);
    expect(s.bottomTab).toBe('solution');
  });

  it('persists sizes but never the presentation flag', () => {
    useLayoutStore.getState().setSize('left', 333);
    useLayoutStore.getState().setPresentation(true);
    const saved = JSON.parse(localStorage.getItem('stemsim.layout') ?? '{}') as {
      state: Record<string, unknown>;
    };
    expect(saved.state.leftWidth).toBe(333);
    expect(saved.state).not.toHaveProperty('presentation');
  });

  it('resetLayout restores defaults', () => {
    useLayoutStore.getState().setSize('left', 400);
    useLayoutStore.getState().resetLayout();
    expect(useLayoutStore.getState().leftWidth).toBe(LAYOUT_LIMITS.left.default);
  });
});
