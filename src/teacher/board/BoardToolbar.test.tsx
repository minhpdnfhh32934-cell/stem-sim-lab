import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardToolbar } from './BoardToolbar';
import { MAX_ZOOM, useBoardStore } from './boardStore';

/**
 * The toolbar folds names until it fits on one row (toolbarFit.ts), whatever the UI font. jsdom
 * has no layout, so the page is laid out here as `flex-wrap` would: a name costs `CHAR` px a
 * character, an icon-only button 40 px, items 4 px apart, a toolbar `width` px wide.
 */
let CHAR = 8;
let width = 2000;

function itemWidth(el: Element, level: number): number {
  if (el.classList.contains('board__toolbar-gap')) return 0;
  if (el.classList.contains('board__speed')) return 64;
  if (el.classList.contains('board__zoom'))
    return Array.from(el.children).reduce((w, c) => w + itemWidth(c, level), 0);
  const from = Number((el as HTMLElement).dataset.compactFrom ?? Infinity);
  const name = el.querySelector('.board__tool-label')?.textContent ?? '';
  return level >= from || name === '' ? 40 : 40 + CHAR * name.length;
}

/** How many times an item was measured. */
let measured = 0;

function layout(this: Element): DOMRect {
  measured += 1;
  const toolbar = this.parentElement;
  const none = { top: 0, bottom: 0 } as DOMRect;
  if (!toolbar?.classList.contains('board__toolbar')) return none;
  const level = (toolbar.dataset.compact ?? '').split(' ').filter(Boolean).length;
  let x = 0;
  let row = 0;
  for (const item of Array.from(toolbar.children)) {
    const w = itemWidth(item, level);
    if (x > 0 && x + w > width) {
      row += 1;
      x = 0;
    }
    if (item === this) {
      const height = item.classList.contains('board__toolbar-gap') ? 0 : 40;
      const top = row * 44 + (40 - height) / 2;
      return { top, bottom: top + height } as DOMRect;
    }
    x += w + 4;
  }
  return none;
}

const toolbar = () => document.querySelector<HTMLElement>('.board__toolbar');
const level = () => toolbar()?.dataset.compact;

beforeEach(() => {
  width = 2000;
  CHAR = 8;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(layout);
  // The widest state: zoomed in ("Vừa khung") and paused to ask ("Quay lại bài giảng").
  useBoardStore.setState({ status: 'paused', pausedForAsk: true, zoom: MAX_ZOOM });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useBoardStore.setState({ status: 'idle', pausedForAsk: false, zoom: 1 });
});

describe('board toolbar: one row whatever the font', () => {
  it('a wide board shows every name', () => {
    render(<BoardToolbar hasLesson />);
    expect(level()).toBe('');
  });

  it('folds "Bút của em" and "Vừa khung" first, then the playback button; the main tools keep their names', () => {
    width = 800;
    const view = render(<BoardToolbar hasLesson />);
    expect(level()).toBe('1');
    // Each folded button keeps its name for screen readers and its tooltip.
    for (const name of ['Bút của em', 'Vừa khung'])
      expect(screen.getByRole('button', { name }).dataset.compactFrom).toBe('1');
    const back = screen.getByRole('button', { name: 'Quay lại bài giảng' });
    expect(back.dataset.compactFrom).toBe('2');
    expect(back.title).toBe('Quay lại bài giảng');
    for (const name of ['Khoanh để hỏi', 'Viết nhanh'])
      expect(screen.getByRole('button', { name }).dataset.compactFrom).toBeUndefined();

    view.unmount();
    width = 650;
    render(<BoardToolbar hasLesson />);
    expect(level()).toBe('1 2');
  });

  it('a change of state is fitted at once: a shorter name unfolds the playback button again', () => {
    width = 680;
    render(<BoardToolbar hasLesson />);
    expect(level()).toBe('1 2');
    act(() => {
      useBoardStore.setState({ status: 'playing', pausedForAsk: false });
    });
    expect(screen.getByRole('button', { name: 'Tạm dừng' })).toBeTruthy();
    expect(level()).toBe('1');
  });

  it('a board too narrow even for the main tools folds all it may and lets the row wrap', () => {
    width = 300;
    render(<BoardToolbar hasLesson />);
    expect(level()).toBe('1 2');
  });

  it('a narrower board or a wider font is fitted on the next frame; leaving stops listening', () => {
    const observers: { callback: () => void; observed: number; disconnected: number }[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        entry: { callback: () => void; observed: number; disconnected: number };
        constructor(callback: () => void) {
          this.entry = { callback, observed: 0, disconnected: 0 };
          observers.push(this.entry);
        }
        observe() {
          this.entry.observed += 1;
        }
        unobserve() {
          return undefined;
        }
        disconnect() {
          this.entry.disconnected += 1;
        }
      },
    );
    const frames = new Map<number, () => void>();
    let next = 0;
    vi.stubGlobal('requestAnimationFrame', (run: () => void) => {
      next += 1;
      frames.set(next, run);
      return next;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      frames.delete(id);
    });
    const runFrames = () => {
      const pending = [...frames.values()];
      frames.clear();
      for (const run of pending) run();
    };

    const view = render(<BoardToolbar hasLesson />);
    expect(level()).toBe('');
    expect(observers).toHaveLength(1);
    width = 650;
    act(() => {
      for (const o of observers) o.callback();
    });
    // Not inside the observer (that would be a resize loop): on the next frame.
    expect(level()).toBe('');
    runFrames();
    expect(level()).toBe('1 2');

    // A frame still waiting when the board goes away is dropped.
    act(() => {
      for (const o of observers) o.callback();
    });
    view.unmount();
    expect(frames.size).toBe(0);
    for (const o of observers) expect(o.disconnected).toBe(o.observed);
  });

  it('a render that changes nothing measures nothing (0.7 fix)', () => {
    const view = render(<BoardToolbar hasLesson />);
    const before = measured;
    expect(before).toBeGreaterThan(0);
    view.rerender(<BoardToolbar hasLesson />);
    view.rerender(<BoardToolbar hasLesson />);
    expect(measured).toBe(before);
  });

  it('names that get narrower once a font has loaded unfold again at the same size (0.7 fix)', () => {
    const fonts = new EventTarget();
    Object.defineProperty(document, 'fonts', { value: fonts, configurable: true });
    const frames: (() => void)[] = [];
    vi.stubGlobal('requestAnimationFrame', (run: () => void) => frames.push(run));
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    try {
      width = 680;
      const view = render(<BoardToolbar hasLesson />);
      expect(level()).toBe('1 2');
      // The board font arrives: every name is narrower, the toolbar keeps its size.
      CHAR = 5;
      act(() => {
        fonts.dispatchEvent(new Event('loadingdone'));
      });
      for (const run of frames.splice(0)) run();
      // The playback button has room for its name again.
      expect(level()).toBe('1');
      view.unmount();
    } finally {
      Reflect.deleteProperty(document, 'fonts');
    }
  });
});
