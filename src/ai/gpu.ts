/**
 * Graphics card (GPU) used by the in-app AI.
 *
 * WebView2 ignores a page's `powerPreference` on hybrid laptops (measured 2026-10-12: always the
 * integrated card), so the desktop app picks the adapter for the whole WebView2 GPU process at
 * start-up (`src-tauri/src/gpu.rs`, Chromium `--use-adapter-luid`). A change needs a restart.
 * The page only reports what WebGPU really uses — it never claims a card it did not see.
 */
import { invoke, isTauri } from '@tauri-apps/api/core';
import { create } from 'zustand';

export type GpuKind = 'integrated' | 'discrete' | 'unknown';

export interface GpuAdapter {
  /** `vendor:device:subsystem` in hex (stable across boots). */
  id: string;
  name: string;
  vendorId: number;
  deviceId: number;
  kind: GpuKind;
  dedicatedMb: number;
  sharedMb: number;
}

export interface GpuStatus {
  supported: boolean;
  adapters: GpuAdapter[];
  choice: string | null;
  choiceName: string | null;
  startupChoice: string | null;
  startupApplied: boolean;
  restartNeeded: boolean;
}

/** What WebGPU reports about the adapter it really uses (`GPUAdapter.info`). */
export interface WebGpuInfo {
  vendor: string;
  architecture: string;
}

/** PCI vendor ids → the `vendor` string WebGPU reports. */
const VENDORS: Record<number, string> = {
  0x10de: 'nvidia',
  0x1002: 'amd',
  0x1022: 'amd',
  0x8086: 'intel',
  0x5143: 'qualcomm',
  0x106b: 'apple',
  0x13b5: 'arm',
};

export function vendorKey(vendorId: number): string | null {
  return VENDORS[vendorId] ?? null;
}

/**
 * Does WebGPU run on the expected card? Compared by vendor (WebGPU hides the exact model).
 * `unknown` when either side is missing or two listed cards share the vendor.
 */
export function compareWithWebGpu(
  expected: GpuAdapter | undefined,
  info: WebGpuInfo | null,
  adapters: GpuAdapter[],
): 'match' | 'mismatch' | 'unknown' {
  if (!expected || !info?.vendor) return 'unknown';
  const want = vendorKey(expected.vendorId);
  if (!want) return 'unknown';
  if (want === info.vendor.toLowerCase()) {
    const sameVendor = adapters.filter((a) => vendorKey(a.vendorId) === want).length;
    return sameVendor > 1 ? 'unknown' : 'match';
  }
  return 'mismatch';
}

/** Names the card WebGPU uses: the listed adapter of that vendor when it is the only one. */
export function webGpuName(info: WebGpuInfo, adapters: GpuAdapter[]): string {
  const vendor = info.vendor.toLowerCase();
  const matches = adapters.filter((a) => vendorKey(a.vendorId) === vendor);
  if (matches.length === 1 && matches[0]) return matches[0].name;
  const label = vendor ? vendor.toUpperCase() : '?';
  return info.architecture ? `${label} · ${info.architecture}` : label;
}

/** The card worth suggesting for Gemma: the discrete card with the most video memory. */
export function suggestedAdapter(adapters: GpuAdapter[]): GpuAdapter | undefined {
  return adapters
    .filter((a) => a.kind === 'discrete')
    .sort((a, b) => b.dedicatedMb - a.dedicatedMb)[0];
}

/**
 * A discrete card whose own memory is clearly below the model's weights (plus ~20 % for the
 * runtime) will fail or spill to shared memory. Integrated cards use system RAM: no check.
 */
export function vramTooSmall(adapter: GpuAdapter | undefined, modelBytes: number): boolean {
  if (!adapter || adapter.kind !== 'discrete') return false;
  return adapter.dedicatedMb * 1024 * 1024 < modelBytes * 1.2;
}

/** Reads the adapter WebGPU gives this page (null without WebGPU). */
export async function readWebGpuInfo(): Promise<WebGpuInfo | null> {
  try {
    // Older WebViews and test environments have no WebGPU, whatever the DOM types say.
    const gpu = (navigator as { gpu?: GPU }).gpu;
    if (!gpu) return null;
    const adapter = await gpu.requestAdapter();
    if (!adapter) return null;
    return { vendor: adapter.info.vendor, architecture: adapter.info.architecture };
  } catch {
    return null;
  }
}

interface GpuStore {
  status: GpuStatus | null;
  /** Adapter the in-app Gemma worker reported after its last load (this session). */
  gemmaInfo: WebGpuInfo | null;
  /** The restart reminder was closed for this session ("Để sau"). */
  reminderHidden: boolean;
  setStatus: (status: GpuStatus | null) => void;
  setGemmaInfo: (info: WebGpuInfo | null) => void;
  hideReminder: () => void;
}

export const useGpuStore = create<GpuStore>((set) => ({
  status: null,
  gemmaInfo: null,
  reminderHidden: false,
  setStatus: (status) => {
    set({ status });
  },
  setGemmaInfo: (gemmaInfo) => {
    set({ gemmaInfo });
  },
  hideReminder: () => {
    set({ reminderHidden: true });
  },
}));

/** Desktop only: lists the cards and the saved choice (null in a browser). */
export async function loadGpuStatus(): Promise<GpuStatus | null> {
  if (!isTauri()) return null;
  const status = await invoke<GpuStatus>('gpu_status');
  useGpuStore.getState().setStatus(status);
  return status;
}

/** Saves the card (null = automatic). Takes effect after a restart. */
export async function saveGpuChoice(id: string | null): Promise<GpuStatus> {
  const status = await invoke<GpuStatus>('gpu_set_choice', { id });
  useGpuStore.setState({ status, reminderHidden: false });
  return status;
}

export async function restartForGpu(): Promise<void> {
  await invoke('app_restart');
}
