/**
 * Keeps on-device Gemma from crashing the computer (audit GPU-01, 2026-10-13).
 *
 * Measured on the lead's laptop (AMD Radeon 780M integrated + RTX 5060, Edge/WebView2): long
 * WebGPU work from Gemma made the integrated card's driver time out (Windows TDR, event
 * LiveKernelEvent 141). Each time Windows reset the card; reloading the model and asking again
 * repeated it, and after several resets Windows stopped with a blue screen (bugcheck 0x119,
 * VIDEO_SCHEDULER_INTERNAL_ERROR). So:
 * - after one GPU fault, Gemma stays off until the app restarts (or the learner turns it back on
 *   knowingly in Settings) — never reload onto a card that just failed;
 * - on an integrated card the prompt is kept short (long prompts are the long GPU jobs);
 * - Settings recommends the discrete card when there is one.
 */
import type { GpuStatus, WebGpuInfo } from './gpu';
import { vendorKey } from './gpu';

const KEY = 'stemsim.gemma-gpu-fault';

/** Most prompt tokens Gemma reads in one go on an integrated card. */
export const INTEGRATED_INPUT_BUDGET = 1024;

export interface GpuFault {
  /** ISO time of the fault. */
  at: string;
  /** What failed: the GPU device was lost, the worker crashed, or the runtime lost its buffers. */
  reason: 'device-lost' | 'worker-crashed' | 'runtime-gpu-error';
  /** The card WebGPU used ("amd rdna-3"), when known. */
  adapter: string | null;
}

let blocked = false;

/** Messages from the runtime that mean the GPU itself failed (not a bad prompt). */
export function isGpuFailure(message: string): boolean {
  return /gpu-lost|worker-crashed|device (?:was )?lost|mapasync|failed to download data from buffer|dxgi_error|device_hung|device_removed/i.test(
    message,
  );
}

/** Records a fault and turns Gemma off for this session. */
export function noteGpuFault(reason: GpuFault['reason'], adapter: WebGpuInfo | null): void {
  blocked = true;
  const fault: GpuFault = {
    at: new Date().toISOString(),
    reason,
    adapter: adapter ? `${adapter.vendor} ${adapter.architecture}`.trim() : null,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(fault));
  } catch {
    /* storage blocked: the session block still holds */
  }
  try {
    window.dispatchEvent(new Event('stemsim:gemma-gpu-fault'));
  } catch {
    /* no window (worker or test) */
  }
}

/** True after a GPU fault in this session: Gemma must not load again by itself. */
export function gemmaBlockedByGpuFault(): boolean {
  return blocked;
}

/** The learner chose, knowing the risk, to let Gemma run again (Settings). */
export function allowGemmaAgain(): void {
  blocked = false;
  try {
    window.dispatchEvent(new Event('stemsim:gemma-gpu-fault'));
  } catch {
    /* no window */
  }
}

/** The last recorded fault (survives restarts, shown in Settings), or null. */
export function lastGpuFault(): GpuFault | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<GpuFault>;
    return typeof value.at === 'string' && typeof value.reason === 'string'
      ? {
          at: value.at,
          reason: value.reason,
          adapter: typeof value.adapter === 'string' ? value.adapter : null,
        }
      : null;
  } catch {
    return null;
  }
}

export function forgetGpuFault(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing stored */
  }
}

/**
 * Does Gemma run on an integrated card? From the card the Gemma worker reported (its vendor) and
 * the desktop app's adapter list; when the app chose no card, WebView2 uses the integrated one on
 * a hybrid laptop (measured 2026-10-12). Null when it cannot be told (browser, unknown kinds).
 */
export function gemmaOnIntegrated(
  status: GpuStatus | null,
  info: WebGpuInfo | null,
): boolean | null {
  const adapters = status?.adapters ?? [];
  if (adapters.length === 0) return null;
  if (info?.vendor) {
    const same = adapters.filter((a) => vendorKey(a.vendorId) === info.vendor.toLowerCase());
    if (same.length > 0 && same.every((a) => a.kind === 'integrated')) return true;
    if (same.length > 0 && same.every((a) => a.kind === 'discrete')) return false;
  }
  const chosen = status?.startupApplied
    ? adapters.find((a) => a.id === status.startupChoice)
    : undefined;
  if (chosen)
    return chosen.kind === 'integrated' ? true : chosen.kind === 'discrete' ? false : null;
  if (adapters.some((a) => a.kind === 'integrated')) return true;
  return adapters.every((a) => a.kind === 'discrete') ? false : null;
}
