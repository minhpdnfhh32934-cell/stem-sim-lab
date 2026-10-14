import { describe, expect, it } from 'vitest';
import type { ReleaseEntry, ReleaseStatus } from './releaseNotes';
import {
  WHATSNEW_KEY,
  decideWhatsNew,
  readStored,
  readTourDone,
  seenValue,
  snoozedValue,
  writeStored,
  type WhatsNewStored,
} from './rules';
import { compareVersions, isVersion, parseVersion } from './version';

describe('version numbers', () => {
  it('compare numerically, part by part', () => {
    expect(compareVersions('0.6.0', '0.5.2')).toBeGreaterThan(0);
    expect(compareVersions('0.5.2', '0.6.0')).toBeLessThan(0);
    expect(compareVersions('0.6.0', '0.6.0')).toBe(0);
    // Not text order: 0.10.0 is newer than 0.9.0, 1.0.0 newer than 0.99.99.
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '0.99.99')).toBeGreaterThan(0);
  });

  it('accept only x.y.z', () => {
    expect(parseVersion('0.6.0')).toEqual([0, 6, 0]);
    for (const bad of ['0.6', 'v0.6.0', '0.6.0-beta', '01.2.3', ' 0.6.0', '', null, 6, {}]) {
      expect(isVersion(bad), JSON.stringify(bad)).toBe(false);
    }
    expect(() => compareVersions('0.6', '0.6.0')).toThrow();
  });
});

/** A minimal entry: only what the rules read. */
function entry(version: string, notesReady: boolean, status: ReleaseStatus = 'released') {
  return { version, notesReady, status } as ReleaseEntry;
}

const VERSIONS = [
  entry('0.6.0', true, 'in-review'),
  entry('0.5.2', true),
  entry('0.5.1', false, 'merged-not-released'),
  entry('0.5.0', true),
  entry('0.4.3', false, 'unverified'),
  entry('0.4.1', true),
];

const decide = (stored: WhatsNewStored, opts: { tourDone?: boolean; current?: string } = {}) =>
  decideWhatsNew({
    current: opts.current ?? '0.6.0',
    stored,
    tourDone: opts.tourDone ?? true,
    versions: VERSIONS,
  });

const shown = (d: ReturnType<typeof decide>) =>
  d.kind === 'show' ? d.notes.map((n) => n.version) : d.kind;

describe('"Có gì mới" rules', () => {
  it('fresh install (no tour done, nothing seen): record the version silently, no popup', () => {
    expect(decide({}, { tourDone: false })).toEqual({ kind: 'fresh' });
  });

  it('a new version shows once; the same version again does not', () => {
    const first = decide({ lastSeen: '0.5.2' });
    expect(shown(first)).toEqual(['0.6.0']);
    expect(first.kind === 'show' && first.autoShow).toBe(true);
    // After "Đóng" / "Xem chi tiết" the version is recorded as seen.
    expect(decide(seenValue('0.6.0'))).toEqual({ kind: 'none' });
  });

  it('a multi-version upgrade lists each version with ready notes, newest first', () => {
    expect(shown(decide({ lastSeen: '0.4.1' }))).toEqual(['0.6.0', '0.5.2', '0.5.0']);
    // 0.5.1 (not released on its own) and 0.4.3 (unverified) have no ready notes.
    expect(shown(decide({ lastSeen: '0.4.0' }))).toEqual(['0.6.0', '0.5.2', '0.5.0', '0.4.1']);
  });

  it('an existing user who never saw the box (tour done, no record) gets the current notes only', () => {
    expect(shown(decide({}))).toEqual(['0.6.0']);
  });

  it('nothing with ready notes in the range: no popup and nothing recorded', () => {
    const notReady = [entry('0.6.0', false, 'in-review'), entry('0.5.2', true)];
    const d = decideWhatsNew({
      current: '0.6.0',
      stored: { lastSeen: '0.5.2' },
      tourDone: true,
      versions: notReady,
    });
    expect(d).toEqual({ kind: 'none' });
  });

  it('"Để sau": no auto-show for this version, but the notes stay reachable', () => {
    const later = snoozedValue({ lastSeen: '0.5.2' }, '0.6.0');
    expect(later).toEqual({ lastSeen: '0.5.2', snoozed: '0.6.0' });
    const d = decide(later);
    expect(shown(d)).toEqual(['0.6.0']);
    expect(d.kind === 'show' && d.autoShow).toBe(false);
  });

  it('a snoozed version is not lost when the next update arrives', () => {
    // Snoozed 0.5.2 (never recorded as seen), now running 0.6.0: both are shown again.
    const d = decide({ snoozed: '0.5.2' });
    expect(shown(d)).toEqual(['0.6.0', '0.5.2']);
    expect(d.kind === 'show' && d.autoShow).toBe(true);
  });

  it('an older app after a newer one (downgrade) shows nothing', () => {
    expect(decide({ lastSeen: '0.7.0' })).toEqual({ kind: 'none' });
  });

  it('a downgrade after "Để sau" in a newer version shows nothing either', () => {
    // 0.7.0 was put off with "Để sau", then 0.6.0 runs again: its notes were already offered.
    expect(decide({ snoozed: '0.7.0' })).toEqual({ kind: 'none' });
    expect(decide({ snoozed: '0.7.0' }, { tourDone: false })).toEqual({ kind: 'none' });
    expect(decide({ lastSeen: '0.5.2', snoozed: '0.7.0' })).toEqual({ kind: 'none' });
  });

  it('missing or invalid notes give no popup and do not crash', () => {
    expect(
      decideWhatsNew({
        current: '0.6.0',
        stored: { lastSeen: '0.5.2' },
        tourDone: true,
        versions: null,
      }),
    ).toEqual({ kind: 'none' });
    expect(
      decideWhatsNew({
        current: '0.6.0',
        stored: { lastSeen: '0.5.2' },
        tourDone: true,
        versions: [],
      }),
    ).toEqual({ kind: 'none' });
    // A broken current version (should never happen) is not compared at all.
    expect(decide({ lastSeen: '0.5.2' }, { current: 'dev' })).toEqual({ kind: 'none' });
  });
});

describe('stemsim.whatsnew storage', () => {
  function memory(initial: Record<string, string> = {}) {
    const data = new Map(Object.entries(initial));
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        data.set(k, v);
      },
      data,
    };
  }

  it('reads only valid versions; anything else counts as nothing stored', () => {
    expect(
      readStored(memory({ [WHATSNEW_KEY]: '{"lastSeen":"0.5.2","snoozed":"0.6.0"}' })),
    ).toEqual({ lastSeen: '0.5.2', snoozed: '0.6.0' });
    expect(readStored(memory({ [WHATSNEW_KEY]: '{"lastSeen":"latest","snoozed":6}' }))).toEqual({});
    expect(readStored(memory({ [WHATSNEW_KEY]: 'not json' }))).toEqual({});
    expect(readStored(memory({ [WHATSNEW_KEY]: '["0.5.2"]' }))).toEqual({});
    expect(readStored(memory())).toEqual({});
    expect(readStored(null)).toEqual({});
  });

  it('survives a storage that throws (private window, blocked site data)', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(readStored(broken)).toEqual({});
    expect(readTourDone(broken)).toBe(false);
    expect(writeStored(broken, { lastSeen: '0.6.0' })).toBe(false);
  });

  it('writes the record as JSON under stemsim.whatsnew and reads the tour flag', () => {
    const store = memory({ 'stemsim.tourDone': '1' });
    expect(writeStored(store, { lastSeen: '0.6.0' })).toBe(true);
    expect(store.data.get(WHATSNEW_KEY)).toBe('{"lastSeen":"0.6.0"}');
    expect(readTourDone(store)).toBe(true);
    expect(readTourDone(memory())).toBe(false);
  });
});
