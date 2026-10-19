import { useEffect } from 'react';
import { create } from 'zustand';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { useNavigationStore } from '@/app/navigationStore';
import { useSimStore } from '@/app/sim/simStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { useModuleStore } from '@/modules/moduleStore';
import { useTeacherStore } from '@/teacher/teacherStore';
import { parseReleaseNotes, type ReleaseEntry, type ReleaseNotes } from './releaseNotes';
import {
  decideWhatsNew,
  readStored,
  readTourDone,
  seenValue,
  snoozedValue,
  writeStored,
} from './rules';
import { compareVersions, isVersion } from './version';

/**
 * The "SimLab đã được cập nhật" box after an update (menu item "Có gì mới"), and the data of
 * Settings → "Lịch sử phiên bản".
 * The notes are the bundled release-notes/versions.json (its own chunk, loaded on demand; no
 * network). Rules: ./rules.ts. Unrelated to the update dialog ("có phiên bản mới"), which
 * offers a newer version; this box describes the version that is already running.
 */
export interface WhatsNewState {
  /** The running web version. */
  current: string;
  /** Parsed versions.json, once loaded. */
  notes: ReleaseNotes | null;
  loadState: 'idle' | 'loading' | 'ready' | 'error';
  /** Unseen notes, newest first (non-empty → "Có gì mới" in the ☰ menu). */
  pending: ReleaseEntry[];
  /** The box should open by itself at the next calm moment. */
  waiting: boolean;
  open: boolean;
}

export const useWhatsNewStore = create<WhatsNewState>()(() => ({
  current: __APP_VERSION__,
  notes: null,
  loadState: 'idle',
  pending: [],
  waiting: false,
  open: false,
}));

const bundled = (): Promise<unknown> =>
  import('../../../release-notes/versions.json').then((m) => m.default as unknown);

let loader: () => Promise<unknown> = bundled;
let loading: Promise<ReleaseNotes | null> | null = null;

/** Loads and validates the bundled notes once; null when they are missing or broken. */
export function loadReleaseNotes(): Promise<ReleaseNotes | null> {
  if (!loading) {
    useWhatsNewStore.setState({ loadState: 'loading' });
    loading = loader()
      .then(parseReleaseNotes, () => null)
      .then((notes) => {
        useWhatsNewStore.setState({ notes, loadState: notes ? 'ready' : 'error' });
        return notes;
      });
  }
  return loading;
}

/** Tests: replace the bundled file (null = the real one) and forget what was loaded. */
export function resetWhatsNewForTests(load: (() => Promise<unknown>) | null = null): void {
  loader = load ?? bundled;
  loading = null;
  useWhatsNewStore.setState({
    current: __APP_VERSION__,
    notes: null,
    loadState: 'idle',
    pending: [],
    waiting: false,
    open: false,
  });
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Start-up: decides whether there is something new to tell (no network, no popup yet). */
export async function initWhatsNew(): Promise<void> {
  const { current } = useWhatsNewStore.getState();
  const stored = readStored(storage());
  // Already seen (the usual start): nothing to load.
  if (isVersion(current) && stored.lastSeen && compareVersions(stored.lastSeen, current) >= 0) {
    return;
  }
  const tourDone = readTourDone(storage());
  const notes = await loadReleaseNotes();
  const decision = decideWhatsNew({ current, stored, tourDone, versions: notes?.versions ?? null });
  if (decision.kind === 'fresh') writeStored(storage(), seenValue(current));
  if (decision.kind === 'show') {
    useWhatsNewStore.setState({ pending: decision.notes, waiting: decision.autoShow });
  }
}

/**
 * A calm moment: the launch page or the lab home (nothing open, nothing playing), no dialog or
 * tour on screen, not presenting. Never in the middle of a lesson or a simulation.
 */
export function calmMoment(): boolean {
  if (typeof document !== 'undefined') {
    if (document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) return false;
  }
  if (useLayoutStore.getState().presentation || useTeacherStore.getState().open) return false;
  const screen = useNavigationStore.getState().screen;
  if (screen === 'home') return true;
  if (screen !== 'lab') return false;
  const sim = useSimStore.getState();
  const mod = useModuleStore.getState();
  return sim.scene === null && !sim.loading && mod.active === null && !mod.loading;
}

/** Opens the waiting box when the moment is calm; true when it opened. */
export function tryAutoShow(isCalm: () => boolean = calmMoment): boolean {
  const s = useWhatsNewStore.getState();
  if (!s.waiting || s.open || s.pending.length === 0 || !isCalm()) return false;
  useWhatsNewStore.setState({ open: true, waiting: false });
  return true;
}

/** From the ☰ menu: shows the unseen notes again. */
export function openWhatsNew(): void {
  if (useWhatsNewStore.getState().pending.length === 0) return;
  useWhatsNewStore.setState({ open: true, waiting: false });
}

/** "Đóng" (and Esc): the notes of this version are seen. */
export function closeWhatsNew(): void {
  writeStored(storage(), seenValue(useWhatsNewStore.getState().current));
  useWhatsNewStore.setState({ open: false, waiting: false, pending: [] });
}

/** "Để sau": no automatic box again for this version; the menu keeps "Có gì mới". */
export function snoozeWhatsNew(): void {
  const { current } = useWhatsNewStore.getState();
  writeStored(storage(), snoozedValue(readStored(storage()), current));
  useWhatsNewStore.setState({ open: false, waiting: false });
}

/** "Xem chi tiết": seen, then Settings → "Lịch sử phiên bản". */
export function showVersionHistory(): void {
  closeWhatsNew();
  useWorkspaceStore.getState().openSettingsAt('versions');
}

/** AppShell: decide once at start-up, then wait for a calm moment to open the box. */
export function useWhatsNewStartup(intervalMs = 1000): void {
  useEffect(() => {
    void initWhatsNew();
  }, []);
  const waiting = useWhatsNewStore((s) => s.waiting);
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => {
      tryAutoShow();
    }, intervalMs);
    return () => {
      clearInterval(id);
    };
  }, [waiting, intervalMs]);
}
