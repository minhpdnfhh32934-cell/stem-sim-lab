import { afterEach, describe, expect, it, vi } from 'vitest';
import { chooseLevel, compactAttr, fitToolbar, MAX_COMPACT_LEVEL, onOneRow } from './toolbarFit';

const box = (top: number, height: number) => ({ top, bottom: top + height });

describe('toolbar fit: one row', () => {
  it('items of different heights centred on one row are one row', () => {
    expect(onOneRow([box(0, 40), box(10, 20), box(0, 40)])).toBe(true);
  });

  it('an item below the first row is a second row, even the shortest one', () => {
    expect(onOneRow([box(0, 40), box(44, 40)])).toBe(false);
    expect(onOneRow([box(0, 40), box(54, 20)])).toBe(false);
  });

  it('boxes with no height (the flexible gap, hidden items) are on no row', () => {
    expect(onOneRow([box(0, 40), box(90, 0)])).toBe(true);
    expect(onOneRow([box(0, 0), box(0, 0)])).toBe(true);
    expect(onOneRow([])).toBe(true);
  });
});

describe('toolbar fit: the level', () => {
  it('is the first level from the floor up that fits, trying each in order', () => {
    const tried: number[] = [];
    const fits = (level: number) => {
      tried.push(level);
      return level >= 1;
    };
    expect(chooseLevel(0, 2, fits)).toBe(1);
    expect(tried).toEqual([0, 1]);
    tried.length = 0;
    // A narrow board starts at its floor: lower levels are not tried.
    expect(chooseLevel(1, 2, fits)).toBe(1);
    expect(tried).toEqual([1]);
  });

  it('is the last level when nothing fits (the toolbar wraps); the last one is not measured', () => {
    const fits = vi.fn(() => false);
    expect(chooseLevel(0, 2, fits)).toBe(2);
    expect(fits).toHaveBeenCalledTimes(2);
    expect(chooseLevel(5, 2, fits)).toBe(2);
    expect(chooseLevel(-1, 2, () => true)).toBe(0);
  });

  it('lists every level in force for CSS', () => {
    expect(compactAttr(0)).toBe('');
    expect(compactAttr(1)).toBe('1');
    expect(compactAttr(2)).toBe('1 2');
  });
});

describe('toolbar fit: on the page', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  /**
   * A toolbar of three items 100 px wide in a toolbar `width` px wide; each level folds one
   * item to 40 px. Items that do not fit go to a second row, as `flex-wrap` does.
   */
  function toolbarOf(width: number) {
    const toolbar = document.createElement('div');
    const items = [0, 1, 2].map(() => toolbar.appendChild(document.createElement('button')));
    document.body.append(toolbar);
    items.forEach((item, i) => {
      item.getBoundingClientRect = () => {
        const level = (toolbar.dataset.compact ?? '').split(' ').filter(Boolean).length;
        const widths = items.map((_, j) => (j < level ? 40 : 100));
        const left = widths.slice(0, i).reduce((a, w) => a + w, 0);
        const top = left + (widths[i] ?? 0) > width ? 44 : 0;
        return { top, bottom: top + 40 } as DOMRect;
      };
    });
    return toolbar;
  }

  it('folds no name when everything fits', () => {
    const toolbar = toolbarOf(400);
    expect(fitToolbar(toolbar)).toBe(0);
    expect(toolbar.dataset.compact).toBe('');
  });

  it('folds as little as needed, and unfolds again when there is room', () => {
    const toolbar = toolbarOf(250);
    expect(fitToolbar(toolbar)).toBe(1);
    expect(toolbar.dataset.compact).toBe('1');
    const wide = toolbarOf(400);
    wide.dataset.compact = '1 2';
    expect(fitToolbar(wide)).toBe(0);
  });

  it('folds everything it may when even that does not fit', () => {
    const toolbar = toolbarOf(100);
    expect(fitToolbar(toolbar)).toBe(MAX_COMPACT_LEVEL);
    expect(toolbar.dataset.compact).toBe('1 2');
  });

  it('starts from the floor a narrow board asks for in CSS', () => {
    const toolbar = toolbarOf(400);
    toolbar.style.setProperty('--board-compact-floor', '1');
    expect(fitToolbar(toolbar)).toBe(1);
    expect(toolbar.dataset.compact).toBe('1');
  });
});
