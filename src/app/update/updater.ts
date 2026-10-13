import { invoke, isTauri } from '@tauri-apps/api/core';
import { create } from 'zustand';

/**
 * In-app updates (src-tauri/src/webupdate.rs). The web part (interface, simulations, data)
 * is replaced by a signed download — no new executable, so Windows Smart App Control has
 * nothing to block. Changes to the native part still need the installer.
 * A copy installed from the Microsoft Store (`channel: 'store'`) is updated by the Store only:
 * no check, no download — the dialog points to the Store instead.
 */

export interface UpdateStatus {
  native: string;
  embedded: string;
  downloaded: string | null;
  running: string;
  /** 'store': installed from the Microsoft Store, which updates it. Missing before 0.5.1. */
  channel?: 'store' | 'github';
}

export interface UpdateManifest {
  webVersion: string;
  minNative: string;
  size: number;
  notes: string;
  date: string;
  /** Web versions older than this must update (signed; empty = none). */
  minRequired?: string;
}

interface CheckResult {
  status: UpdateStatus;
  manifest: UpdateManifest;
  available: boolean;
  needsInstaller: boolean;
  /** The running version is below the signed mandatory floor. */
  required?: boolean;
}

export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'upToDate'
  | 'available'
  | 'needsInstaller'
  | 'downloading'
  | 'ready'
  | 'error'
  /** A Microsoft Store copy: updates come from the Store. */
  | 'store';

export interface UpdateState {
  phase: UpdatePhase;
  status: UpdateStatus | null;
  manifest: UpdateManifest | null;
  error: string | null;
  dialogOpen: boolean;
  /** A mandatory update: the dialog cannot be dismissed until the app is updated. */
  required: boolean;
}

export const useUpdateStore = create<UpdateState>()(() => ({
  phase: 'idle',
  status: null,
  manifest: null,
  error: null,
  dialogOpen: false,
  required: false,
}));

export const updatesSupported = (): boolean => isTauri();

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function refreshStatus(): Promise<UpdateStatus | null> {
  if (!updatesSupported()) return null;
  try {
    const status = await invoke<UpdateStatus>('web_update_status');
    useUpdateStore.setState({ status });
    return status;
  } catch (e) {
    console.error('update status', e);
    return null;
  }
}

const fromStore = (status: UpdateStatus | null) => status?.channel === 'store';

let checkSeq = 0;

/**
 * Asks the release server for the newest version. `quiet` (start-up check): the dialog only
 * opens when there is something to update — with "Để sau", or without it when the update is
 * mandatory.
 */
export async function checkForUpdate(quiet = false): Promise<void> {
  if (!updatesSupported()) return;
  const mine = ++checkSeq;
  if (!quiet) useUpdateStore.setState({ dialogOpen: true });
  if (fromStore(useUpdateStore.getState().status ?? (await refreshStatus()))) {
    // The Store installs updates; a quiet start-up check has nothing to say.
    if (!quiet) useUpdateStore.setState({ phase: 'store', error: null });
    return;
  }
  useUpdateStore.setState({ phase: 'checking', error: null });
  try {
    const r = await invoke<CheckResult>('web_update_check');
    if (mine !== checkSeq) return;
    const phase = r.available ? 'available' : r.needsInstaller ? 'needsInstaller' : 'upToDate';
    const required = r.required === true && phase !== 'upToDate';
    useUpdateStore.setState((s) => ({
      status: r.status,
      manifest: r.manifest,
      phase,
      required,
      dialogOpen: s.dialogOpen || phase !== 'upToDate',
    }));
  } catch (e) {
    if (mine !== checkSeq) return;
    // A quiet check without internet is not worth bothering the user about, unless the
    // update dialog is open.
    const silent = quiet && !useUpdateStore.getState().dialogOpen;
    useUpdateStore.setState({ phase: silent ? 'idle' : 'error', error: message(e) });
  }
}

export async function applyUpdate(): Promise<void> {
  useUpdateStore.setState({ phase: 'downloading', error: null, dialogOpen: true });
  try {
    await invoke<string>('web_update_apply');
    await refreshStatus();
    useUpdateStore.setState({ phase: 'ready' });
  } catch (e) {
    useUpdateStore.setState({ phase: 'error', error: message(e) });
  }
}

export async function resetToBuiltIn(): Promise<void> {
  try {
    await invoke('web_update_reset');
    await restartApp();
  } catch (e) {
    useUpdateStore.setState({ phase: 'error', error: message(e) });
  }
}

export async function restartApp(): Promise<void> {
  await invoke('app_restart');
}

export async function openReleasesPage(): Promise<void> {
  await invoke('open_releases_page');
}

/** Store copies: opens "Thư viện → Cập nhật" in the Microsoft Store app. */
export async function openStoreUpdates(): Promise<void> {
  await invoke('open_known_page', { id: 'store-updates' });
}

/** Checks once, a little after start-up, without disturbing the user when offline. */
export function scheduleAutoCheck(delayMs = 8000): () => void {
  if (!updatesSupported()) return () => undefined;
  const status = refreshStatus();
  const id = setTimeout(() => {
    void status.then((s) => {
      if (navigator.onLine && !fromStore(s)) void checkForUpdate(true);
    });
  }, delayMs);
  return () => {
    clearTimeout(id);
  };
}
