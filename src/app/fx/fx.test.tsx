import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNavigationStore } from '@/app/navigationStore';
import { usePerfStore } from '@/perf/perfStore';
import {
  closeTeacher,
  openTeacherOn,
  openTeacherWithQuestion,
  useTeacherStore,
} from '@/teacher/teacherStore';
import { effectsOn, screenChange, transitionOrigin, usePortalStore } from './fx';
import { PORTAL_MS, ScreenPortal } from './ScreenPortal';

type Start = (update: () => void) => ViewTransition;

/** A view transition that keeps its update until `run()` (the browser waits a frame). */
function fakeTransitions() {
  const pending: (() => void)[] = [];
  const start = vi.fn<Start>((update) => {
    pending.push(update);
    return {
      ready: Promise.resolve(),
      finished: Promise.resolve(),
      updateCallbackDone: Promise.resolve(),
      skipTransition: () => undefined,
    } as unknown as ViewTransition;
  });
  Object.defineProperty(document, 'startViewTransition', { value: start, configurable: true });
  return {
    start,
    run: () => {
      act(() => {
        for (const update of pending.splice(0)) update();
      });
    },
  };
}

beforeEach(() => {
  // As in the app (not a unit test, not an automated browser).
  vi.stubEnv('MODE', 'development');
  Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
  Reflect.deleteProperty(document, 'startViewTransition');
  delete document.documentElement.dataset.motion;
  usePerfStore.setState({ preference: 'auto', degraded: false });
  useNavigationStore.setState({ screen: 'home', previousScreen: null });
  useTeacherStore.setState({ open: false, layout: 'talk', draft: null });
  usePortalStore.setState({ key: 0 });
});

describe('when the effects play', () => {
  it('not in unit tests, automated browsers or on the Low tier', () => {
    expect(effectsOn()).toBe(true);
    vi.stubEnv('MODE', 'test');
    expect(effectsOn()).toBe(false);
    vi.stubEnv('MODE', 'development');
    Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true });
    expect(effectsOn()).toBe(false);
    Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true });
    usePerfStore.setState({ preference: 'low' });
    expect(effectsOn()).toBe(false);
  });
});

describe('screenChange', () => {
  it('without view transitions runs the change at once', () => {
    const update = vi.fn();
    void screenChange(update);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('runs the whole change inside one transition, with the ring, and nested changes inline', () => {
    const { start, run } = fakeTransitions();
    const inner = vi.fn();
    const outer = vi.fn(() => {
      void screenChange(inner);
    });
    void screenChange(outer);
    // The browser keeps the old screen first: nothing has changed yet.
    expect(outer).not.toHaveBeenCalled();
    run();
    expect(outer).toHaveBeenCalledTimes(1);
    expect(inner).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
    expect(usePortalStore.getState().key).toBe(1);
  });

  it('with reduced motion: a transition (a cross-fade) but no ring', () => {
    const { start, run } = fakeTransitions();
    document.documentElement.dataset.motion = 'reduce';
    void screenChange(() => undefined);
    run();
    expect(start).toHaveBeenCalledTimes(1);
    expect(usePortalStore.getState().key).toBe(0);
  });

  it('AI Teacher keeps the question and the page it was opened with', () => {
    const { run } = fakeTransitions();
    openTeacherWithQuestion('Vì sao trời xanh?');
    run();
    expect(useNavigationStore.getState().screen).toBe('teacher');
    expect(useTeacherStore.getState()).toMatchObject({ open: true, draft: 'Vì sao trời xanh?' });
    openTeacherOn('board');
    run();
    expect(useTeacherStore.getState().layout).toBe('board');
    closeTeacher();
    run();
    expect(useNavigationStore.getState().screen).toBe('home');
    expect(useTeacherStore.getState().open).toBe(false);
  });
});

describe('transitionOrigin', () => {
  it('opens from the press, far enough for the farthest corner', () => {
    expect(transitionOrigin(1000, 600, { x: 100, y: 100 }, null)).toEqual({
      x: 100,
      y: 100,
      r: Math.hypot(900, 500),
    });
  });
  it('else from the focused control, else from the middle', () => {
    const rect = { left: 200, top: 300, width: 100, height: 40 } as DOMRect;
    expect(transitionOrigin(1000, 600, null, rect)).toMatchObject({ x: 250, y: 320 });
    expect(transitionOrigin(1000, 600, null, null)).toEqual({
      x: 500,
      y: 300,
      r: Math.hypot(500, 300),
    });
  });
});

describe('ScreenPortal', () => {
  it('draws the ring for each change and removes it when it has flown out', () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<ScreenPortal />);
      expect(container.querySelector('.fx-portal')).toBeNull();
      act(() => {
        usePortalStore.setState({ key: 1 });
      });
      expect(container.querySelector('.fx-portal')?.getAttribute('aria-hidden')).toBe('true');
      act(() => {
        vi.advanceTimersByTime(PORTAL_MS);
      });
      expect(container.querySelector('.fx-portal')).toBeNull();
      act(() => {
        usePortalStore.setState({ key: 2 });
      });
      expect(container.querySelector('.fx-portal')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
