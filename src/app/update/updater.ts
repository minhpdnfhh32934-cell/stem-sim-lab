import { invoke, isTauri } from '@tauri-apps/api/core';
import { create } from 'zustand';

/**
 * In-app updates (src-tauri/src/webupdate.rs). The web part (interface, simulations, data)
 * is replaced by a signed download — no new executable, so Windows Smart App Control has
 * nothing to block. Changes to the native part still need the installer.
 */

export interface UpdateStatus {
  native: string;
  embedded: string;
  downloaded: string | null;
  running: string;
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
  | 'error';

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

export async function refreshStatus(): Promise<void> {
  if (!updatesSupported()) return;
  try {
    useUpdateStore.setState({ status: await invoke<UpdateStatus>('web_update_status') });
  } catch (e) {
    console.error('update status', e);
  }
}

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

/** Checks once, a little after start-up, without disturbing the user when offline. */
export function scheduleAutoCheck(delayMs = 8000): () => void {
  if (!updatesSupported()) return () => undefined;
  void refreshStatus();
  const id = setTimeout(() => {
    if (navigator.onLine) void checkForUpdate(true);
  }, delayMs);
  return () => {
    clearTimeout(id);
  };
}
