import { afterEach, describe, expect, it } from 'vitest';
import { LAYOUT_LIMITS, useLayoutStore } from '@/app/layout/layoutStore';
import { useProfileStore } from '@/app/learner/profileStore';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useBio3DPrefs } from '@/biology/view3d/prefs';
import { useProgressStore } from '@/learn/progressStore';
import { usePerfStore } from '@/perf/perfStore';

/**
 * A learner who updates from 0.7.1 (B8, #193): what that version saved, key by key, with the
 * shapes and versions of its stores (tag v0.7.1). Everything still meaningful is kept, nothing
 * throws, and the bench's own layout fields (0.8.1) start from their defaults.
 */
const SAVED_071: Record<string, { state: Record<string, unknown>; version: number }> = {
  'stemsim.layout': {
    // 0.7.1's fields only, plus a 0.4.3-era flag it still ignored.
    state: {
      leftWidth: 320,
      rightWidth: 360,
      bottomHeight: 900,
      leftTab: 'library',
      bottomTab: 'solution',
      leftOpen: false,
    },
    version: 1,
  },
  'stemsim.settings': {
    state: {
      theme: 'dark',
      locale: 'en',
      fontScale: 1.25,
      defaultGravity: 9.8,
      uiMode: 'advanced',
    },
    version: 2,
  },
  'stemsim.profile': {
    // Version 1 had no grade.
    state: {
      level: 'foundation',
      interests: ['biology'],
      onboarded: true,
      connectSeen: true,
      lastTopic: 'mitosis',
    },
    version: 1,
  },
  'stemsim.progress': {
    state: {
      visited: { freeFall: true },
      challenges: { freeFall: 2 },
      predictions: { freeFall: true },
    },
    version: 1,
  },
  'stemsim.perf': { state: { preference: 'high', benchmark: null }, version: 1 },
  'stemsim.bio3d': { state: { off: ['drift'] }, version: 1 },
};

const STORES = [
  useLayoutStore,
  useSettingsStore,
  useProfileStore,
  useProgressStore,
  usePerfStore,
  useBio3DPrefs,
];

afterEach(async () => {
  localStorage.clear();
  for (const store of STORES) await store.persist.rehydrate();
});

describe('opening the saves of 0.7.1 (#193)', () => {
  it('keeps what still means something; the bench fields start from their defaults', async () => {
    for (const [key, value] of Object.entries(SAVED_071))
      localStorage.setItem(key, JSON.stringify(value));
    for (const store of STORES) await store.persist.rehydrate();

    expect(useSettingsStore.getState()).toMatchObject({
      theme: 'dark',
      locale: 'en',
      fontScale: 1.25,
      defaultGravity: 9.8,
      uiMode: 'advanced',
    });
    // 0.8.0 added the grade: an older profile shows every grade, nothing else changes.
    expect(useProfileStore.getState()).toMatchObject({
      grade: 'all',
      interests: ['biology'],
      onboarded: true,
      connectSeen: true,
      lastTopic: 'mitosis',
    });
    expect(useProgressStore.getState()).toMatchObject({
      visited: { freeFall: true },
      challenges: { freeFall: 2 },
      predictions: { freeFall: true },
    });
    expect(usePerfStore.getState().preference).toBe('high');
    expect(useBio3DPrefs.getState().off).toEqual(['drift']);

    const layout = useLayoutStore.getState();
    // Sizes are re-clamped to today's limits; the bench's own fields were never saved.
    expect(layout.bottomHeight).toBe(LAYOUT_LIMITS.bottom.max);
    expect(layout).toMatchObject({
      trayFolded: false,
      trayWidth: LAYOUT_LIMITS.tray.default,
      notebookWidth: LAYOUT_LIMITS.notebook.default,
      notebookTabBySubject: {},
      challengeSeen: [],
    });
    expect(layout).not.toHaveProperty('leftOpen');
  });
});
