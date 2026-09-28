import { invoke, isTauri } from '@tauri-apps/api/core';

/** Mirrors `AppInfo` in `src-tauri/src/app_info.rs` (camelCase via serde). */
interface NativeAppInfo {
  name: string;
  version: string;
  targetOs: string;
  debugBuild: boolean;
}

export interface AppInfo extends NativeAppInfo {
  /** False when the UI runs in a normal browser (`npm run dev`) without the Rust backend. */
  native: boolean;
}

/**
 * Reads build information from the Rust backend. The UI must also work in a plain
 * browser (for UI development and tests), so this falls back gracefully.
 */
export async function getAppInfo(): Promise<AppInfo> {
  if (isTauri()) {
    try {
      const info = await invoke<NativeAppInfo>('app_info');
      return { ...info, native: true };
    } catch (err) {
      console.error('app_info command failed', err);
    }
  }
  return {
    name: 'STEM Sim Lab',
    version: __APP_VERSION__,
    targetOs: 'browser',
    debugBuild: import.meta.env.DEV,
    native: false,
  };
}
