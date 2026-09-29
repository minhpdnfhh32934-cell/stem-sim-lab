import { invoke, isTauri } from '@tauri-apps/api/core';
import { create } from 'zustand';
import { useSimStore } from '@/app/sim/simStore';
import { useModuleStore } from '@/modules/moduleStore';
import { subjectOf } from '@/app/topics';
import { activeTopicId, serializeSnapshot, takeSnapshot } from './snapshot';

/**
 * "Lịch sử": every simulation the user opens is recorded (SQLite in the desktop app,
 * localStorage in the browser). The entry's snapshot follows the user's edits, so
 * reopening it restores the last state.
 */

export interface HistoryEntry {
  id: number;
  /** UTC "YYYY-MM-DD HH:MM:SS" (SQLite) or ISO string. */
  createdAt: string;
  topicId: string;
  subject: string;
  /** Problem text excerpt, or empty. */
  title: string;
  snapshot: string;
}

interface HistoryInput {
  topicId: string;
  subject: string;
  title: string;
  snapshot: string;
}

/** SQLite gives UTC "YYYY-MM-DD HH:MM:SS"; the browser fallback stores ISO strings. */
export function parseCreatedAt(s: string): Date {
  return new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);
}

const LS_KEY = 'stemsim.history';
const LS_MAX = 100;

function lsRead(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}
function lsWrite(list: HistoryEntry[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, LS_MAX)));
  } catch {
    // Storage full or blocked: history is a convenience, never an error for the user.
  }
}

export const historyBackend = {
  async add(e: HistoryInput): Promise<number> {
    if (isTauri()) return invoke<number>('history_add', { entry: e });
    const list = lsRead();
    const id = (list[0]?.id ?? 0) + 1;
    lsWrite([{ ...e, id, createdAt: new Date().toISOString() }, ...list]);
    return id;
  },
  async update(id: number, snapshot: string): Promise<void> {
    if (isTauri()) {
      await invoke('history_update', { id, snapshot });
      return;
    }
    lsWrite(lsRead().map((x) => (x.id === id ? { ...x, snapshot } : x)));
  },
  async list(limit = 100): Promise<HistoryEntry[]> {
    if (isTauri()) return invoke<HistoryEntry[]>('history_list', { limit });
    return lsRead().slice(0, limit);
  },
  async remove(id: number): Promise<void> {
    if (isTauri()) {
      await invoke('history_delete', { id });
      return;
    }
    lsWrite(lsRead().filter((x) => x.id !== id));
  },
  async clear(): Promise<void> {
    if (isTauri()) {
      await invoke('history_clear');
      return;
    }
    lsWrite([]);
  },
};

export const useHistoryStore = create<{ entries: HistoryEntry[]; loaded: boolean }>()(() => ({
  entries: [],
  loaded: false,
}));

export async function refreshHistory(): Promise<void> {
  try {
    useHistoryStore.setState({ entries: await historyBackend.list(), loaded: true });
  } catch (e) {
    console.error('history', e);
    useHistoryStore.setState({ loaded: true });
  }
}

export async function deleteHistory(id: number): Promise<void> {
  await historyBackend.remove(id);
  await refreshHistory();
}

export async function clearHistory(): Promise<void> {
  await historyBackend.clear();
  await refreshHistory();
}

/** Entry of the topic currently open (its snapshot is kept up to date). */
let currentId: number | null = null;
let currentIdentity: unknown = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const SAVE_DELAY_MS = 1500;

function identity(): unknown {
  return useModuleStore.getState().active?.view ?? useSimStore.getState().scene;
}

async function onTopicChanged() {
  const id = activeTopicId();
  const who = identity();
  if (who === currentIdentity) return;
  currentIdentity = who;
  currentId = null;
  clearTimeout(saveTimer);
  if (!id) return;
  const snap = takeSnapshot();
  if (!snap) return;
  try {
    currentId = await historyBackend.add({
      topicId: id,
      subject: subjectOf(id) ?? 'physics',
      title: snap.physics?.problem?.text.slice(0, 120) ?? '',
      snapshot: serializeSnapshot(snap),
    });
    await refreshHistory();
  } catch (e) {
    console.error('history', e);
  }
}

function scheduleSave() {
  if (currentId === null) return;
  clearTimeout(saveTimer);
  const id = currentId;
  saveTimer = setTimeout(() => {
    const snap = takeSnapshot();
    if (!snap || snap.topicId !== activeTopicId()) return;
    void historyBackend
      .update(id, serializeSnapshot(snap))
      .then(refreshHistory)
      .catch((e: unknown) => {
        console.error('history', e);
      });
  }, SAVE_DELAY_MS);
}

/** Starts recording. Returns a cleanup function. */
export function initHistory(): () => void {
  void refreshHistory();
  let offBinding: (() => void) | undefined;
  const follow = () => {
    offBinding?.();
    offBinding = useModuleStore.getState().active?.view.state?.subscribe(scheduleSave);
    void onTopicChanged();
  };
  const offs = [
    useModuleStore.subscribe((s, prev) => {
      if (s.active !== prev.active) follow();
    }),
    useSimStore.subscribe((s, prev) => {
      if (s.scene !== prev.scene) follow();
      else if (s.params !== prev.params) scheduleSave();
    }),
  ];
  return () => {
    for (const off of offs) off();
    offBinding?.();
    clearTimeout(saveTimer);
  };
}
