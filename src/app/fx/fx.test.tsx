import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNavigationStore } from '@/app/navigationStore';
import { usePerfStore } from '@/perf/perfStore';
import {
  closeTeacher,
  openTeacherOn,
  openTeacherWithQuestion,
  useTeacherStore,
} from '@/teacher/teacherStore';
import { openLab } from '@/app/topics';
import { effectsOn } from './fx';

beforeEach(() => {
  // As in the app (not a unit test, not an automated browser).
  vi.stubEnv('MODE', 'development');
  Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
  Reflect.deleteProperty(document, 'startViewTransition');
  usePerfStore.setState({ preference: 'auto', degraded: false });
  useNavigationStore.setState({ screen: 'home', previousScreen: null });
  useTeacherStore.setState({ open: false, layout: 'talk', draft: null });
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

describe('screen changes (no transition: removed on the user’s request, 19/11/2026)', () => {
  it('change at once, with no view transition even where the browser has one', () => {
    const start = vi.fn();
    Object.defineProperty(document, 'startViewTransition', { value: start, configurable: true });
    openLab();
    expect(useNavigationStore.getState().screen).toBe('lab');
    openTeacherWithQuestion('Vì sao trời xanh?');
    expect(useNavigationStore.getState().screen).toBe('teacher');
    expect(useTeacherStore.getState()).toMatchObject({ open: true, draft: 'Vì sao trời xanh?' });
    openTeacherOn('board');
    expect(useTeacherStore.getState().layout).toBe('board');
    closeTeacher();
    expect(useNavigationStore.getState().screen).toBe('lab');
    expect(useTeacherStore.getState().open).toBe(false);
    expect(start).not.toHaveBeenCalled();
  });
});
