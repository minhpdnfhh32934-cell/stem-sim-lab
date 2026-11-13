import { MemorySaveStorage, type SaveStorage } from '../persistence/SaveSystem';

/**
 * localStorage-backed saves. Falls back to memory (saves last until the tab closes) when the
 * browser blocks storage, e.g. some private modes; `persistent` tells the UI which one it got.
 */
export function createBrowserStorage(): { storage: SaveStorage; persistent: boolean } {
  try {
    const store = window.localStorage;
    const probe = 'simlab.probe';
    store.setItem(probe, '1');
    store.removeItem(probe);
    return {
      persistent: true,
      storage: {
        read: (key) => store.getItem(key),
        write: (key, value) => {
          store.setItem(key, value);
        },
        remove: (key) => {
          store.removeItem(key);
        },
      },
    };
  } catch {
    return { storage: new MemorySaveStorage(), persistent: false };
  }
}
