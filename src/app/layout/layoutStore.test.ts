import { beforeEach, describe, expect, it } from 'vitest';
import { LAYOUT_LIMITS, clampSize, notebookPushes, useLayoutStore } from './layoutStore';

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

  it('clamps sizes set through the store', () => {
    useLayoutStore.getState().setSize('right', 5);
    expect(useLayoutStore.getState().rightWidth).toBe(LAYOUT_LIMITS.right.min);
  });

  it('switches tabs', () => {
    useLayoutStore.getState().setBottomTab('solution');
    useLayoutStore.getState().setLeftTab('history');
    const s = useLayoutStore.getState();
    expect(s.bottomTab).toBe('solution');
    expect(s.leftTab).toBe('history');
  });

  it('panels hidden by an older version are shown again; bad values are ignored', async () => {
    // Until 0.4.3 the panels could be hidden and that choice was saved.
    localStorage.setItem(
      'stemsim.layout',
      JSON.stringify({
        state: {
          leftWidth: 333,
          leftOpen: false,
          rightOpen: false,
          bottomOpen: false,
          bottomTab: 'nope',
        },
        version: 1,
      }),
    );
    await useLayoutStore.persist.rehydrate();
    const s = useLayoutStore.getState() as unknown as Record<string, unknown>;
    expect(s.leftWidth).toBe(333);
    expect(s).not.toHaveProperty('leftOpen');
    expect(s).not.toHaveProperty('rightOpen');
    expect(s).not.toHaveProperty('bottomOpen');
    expect(s.bottomTab).toBe('graphs');
    // The next save drops the old flags from storage.
    useLayoutStore.getState().setSize('right', 300);
    expect(localStorage.getItem('stemsim.layout')).not.toContain('Open');
  });

  it('a bottom height saved under the new 210 px minimum (UI-24) is raised on load', async () => {
    localStorage.setItem(
      'stemsim.layout',
      JSON.stringify({ state: { bottomHeight: 150 }, version: 1 }),
    );
    await useLayoutStore.persist.rehydrate();
    expect(useLayoutStore.getState().bottomHeight).toBe(LAYOUT_LIMITS.bottom.min);
    expect(LAYOUT_LIMITS.bottom.min).toBe(210);
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

describe('bench layout fields (0.8.1)', () => {
  beforeEach(() => {
    useLayoutStore.getState().resetLayout();
  });

  it('a state saved before the bench keeps its sizes and gets the bench defaults', async () => {
    localStorage.setItem(
      'stemsim.layout',
      JSON.stringify({ state: { leftWidth: 300, rightWidth: 333 }, version: 1 }),
    );
    await useLayoutStore.persist.rehydrate();
    const s = useLayoutStore.getState();
    expect(s.leftWidth).toBe(300);
    expect(s.rightWidth).toBe(333);
    expect(s.trayFolded).toBe(false);
    expect(s.trayWidth).toBe(LAYOUT_LIMITS.tray.default);
    expect(s.notebookWidth).toBe(LAYOUT_LIMITS.notebook.default);
    expect(s.notebookTabBySubject).toEqual({});
  });

  it('clamps the bench sizes, drops NaN and unknown tabs on load', async () => {
    localStorage.setItem(
      'stemsim.layout',
      JSON.stringify({
        state: {
          trayFolded: 'yes',
          trayWidth: 9999,
          notebookWidth: 'wide',
          notebookTabBySubject: { physics: 'graphs', chemistry: 'nope', alchemy: 'graphs' },
        },
        version: 1,
      }),
    );
    await useLayoutStore.persist.rehydrate();
    const s = useLayoutStore.getState();
    expect(s.trayFolded).toBe(false);
    expect(s.trayWidth).toBe(LAYOUT_LIMITS.tray.max);
    expect(s.notebookWidth).toBe(LAYOUT_LIMITS.notebook.default);
    expect(s.notebookTabBySubject).toEqual({ physics: 'graphs' });
    expect(clampSize('notebook', Number.NaN)).toBe(352);
    expect(clampSize('tray', 100)).toBe(256);
  });

  it('persists the tray, sizes and tabs, never the open notebook; resetLayout restores them', () => {
    const st = useLayoutStore.getState();
    st.setTrayFolded(true);
    st.setSize('tray', 400);
    st.setNotebookTab('biology', 'module');
    st.setNotebookOpen(true);
    const saved = JSON.parse(localStorage.getItem('stemsim.layout') ?? '{}') as {
      state: Record<string, unknown>;
      version: number;
    };
    expect(saved.version).toBe(1);
    expect(saved.state).toMatchObject({
      trayFolded: true,
      trayWidth: 400,
      notebookTabBySubject: { biology: 'module' },
    });
    expect(saved.state).not.toHaveProperty('notebookOpen');
    useLayoutStore.getState().resetLayout();
    const s = useLayoutStore.getState();
    expect([s.trayFolded, s.trayWidth, s.notebookTabBySubject]).toEqual([false, 304, {}]);
  });

  it('the notebook pushes the stage only while the stage keeps 560 px; otherwise it overlays', () => {
    const d = { trayFolded: false, trayWidth: 304, notebookWidth: 352 };
    // 1366 − 64 rail − 352 drawer − 304 tray = 646 px of stage.
    expect(notebookPushes(1366, d)).toBe(true);
    expect(notebookPushes(1366, { ...d, trayWidth: 420, notebookWidth: 520 })).toBe(false);
    // Folding the tray to its spine gives the stage back its width.
    expect(
      notebookPushes(1366, { ...d, trayFolded: true, trayWidth: 420, notebookWidth: 520 }),
    ).toBe(true);
    expect(notebookPushes(1024, d)).toBe(false);
    expect(notebookPushes(1366, d, 790)).toBe(false);
  });
});
