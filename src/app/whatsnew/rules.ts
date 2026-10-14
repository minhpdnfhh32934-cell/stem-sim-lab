import type { ReleaseEntry } from './releaseNotes';
import { compareVersions, isVersion } from './version';

/**
 * When does the "SimLab đã được cập nhật" box appear? Pure rules (release-notes/README.md):
 *
 * - fresh install (no `stemsim.tourDone`, nothing recorded) → record the version, no box;
 * - upgrade (recorded version older than the running one) → every version in
 *   (recorded, running] whose notes are ready, newest first;
 * - a user from before this box (tour done, nothing recorded) → the running version only;
 * - "Để sau" (`snoozed` = running version) → no automatic box, the notes stay in the menu;
 * - nothing ready, the same version again, an older app (than the recorded or the snoozed
 *   version) or unreadable data → no box.
 */

export const WHATSNEW_KEY = 'stemsim.whatsnew';
const TOUR_KEY = 'stemsim.tourDone';

/** Stored under `stemsim.whatsnew`. */
export interface WhatsNewStored {
  /** Newest version whose notes were closed ("Đóng", "Xem chi tiết") or recorded on install. */
  lastSeen?: string;
  /** Version whose notes were put off with "Để sau". */
  snoozed?: string;
}

export type WhatsNewDecision =
  | { kind: 'none' }
  /** First start of a new install: remember the version, show nothing. */
  | { kind: 'fresh' }
  /** Unseen notes, newest first; `autoShow` false after "Để sau" for this version. */
  | { kind: 'show'; notes: ReleaseEntry[]; autoShow: boolean };

export interface WhatsNewInput {
  /** The running web version (`__APP_VERSION__`). */
  current: string;
  stored: WhatsNewStored;
  /** `stemsim.tourDone` is set: someone used this app before. */
  tourDone: boolean;
  /** Bundled versions.json, or null when it could not be read. */
  versions: readonly ReleaseEntry[] | null;
}

export function decideWhatsNew({
  current,
  stored,
  tourDone,
  versions,
}: WhatsNewInput): WhatsNewDecision {
  if (!isVersion(current)) return { kind: 'none' };
  const lastSeen = isVersion(stored.lastSeen) ? stored.lastSeen : undefined;
  const snoozed = isVersion(stored.snoozed) ? stored.snoozed : undefined;
  if (!lastSeen && !snoozed && !tourDone) return { kind: 'fresh' };
  if (lastSeen && compareVersions(lastSeen, current) >= 0) return { kind: 'none' };
  // A newer version was put off with "Để sau" and this app is older (a downgrade): its notes
  // were already offered in that newer version.
  if (snoozed && compareVersions(snoozed, current) > 0) return { kind: 'none' };
  if (!versions) return { kind: 'none' };

  // Without a record, the earliest unseen version is the snoozed one, else the running one.
  const from = snoozed ?? current;
  const inRange = (v: string) =>
    compareVersions(v, current) <= 0 &&
    (lastSeen ? compareVersions(v, lastSeen) > 0 : compareVersions(v, from) >= 0);

  const seen = new Set<string>();
  const notes = versions
    .filter((v) => isVersion(v.version) && v.notesReady && inRange(v.version))
    .filter((v) => (seen.has(v.version) ? false : (seen.add(v.version), true)))
    .sort((a, b) => compareVersions(b.version, a.version));
  if (!notes.length) return { kind: 'none' };
  return { kind: 'show', notes, autoShow: snoozed !== current };
}

/** Record after "Đóng" / "Xem chi tiết" (also on a fresh install). */
export const seenValue = (current: string): WhatsNewStored => ({ lastSeen: current });

/** Record after "Để sau": keeps what was seen before, so later updates still list this one. */
export function snoozedValue(stored: WhatsNewStored, current: string): WhatsNewStored {
  return isVersion(stored.lastSeen)
    ? { lastSeen: stored.lastSeen, snoozed: current }
    : { snoozed: current };
}

type Readable = Pick<Storage, 'getItem'>;
type Writable = Pick<Storage, 'setItem'>;

/** The stored record; unreadable or invalid data counts as nothing stored. */
export function readStored(storage: Readable | null | undefined): WhatsNewStored {
  try {
    const raw = storage?.getItem(WHATSNEW_KEY);
    if (!raw) return {};
    const value = JSON.parse(raw) as unknown;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    const { lastSeen, snoozed } = value as Record<string, unknown>;
    return {
      ...(isVersion(lastSeen) ? { lastSeen } : {}),
      ...(isVersion(snoozed) ? { snoozed } : {}),
    };
  } catch {
    return {};
  }
}

/** False when the record could not be saved (the box may then show again; harmless). */
export function writeStored(storage: Writable | null | undefined, value: WhatsNewStored): boolean {
  try {
    if (!storage) return false;
    storage.setItem(WHATSNEW_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readTourDone(storage: Readable | null | undefined): boolean {
  try {
    return storage?.getItem(TOUR_KEY) === '1';
  } catch {
    return false;
  }
}
