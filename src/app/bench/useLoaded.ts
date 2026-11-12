import { useEffect, useState, type ComponentType } from 'react';
import { toast } from '@/ui/toast';

/** A dialog's code, loaded the first time it is needed (start-up stays light). */
export interface Loaded {
  Component: ComponentType | null;
}

/**
 * Loads `slot`'s code once `when` holds; true once it is there. By hand rather than with
 * `lazy()`: React retries a suspended `lazy()` at a low priority that never expires, and a 3D
 * lesson that runs without end (an update every frame, no idle time between frames) starved it
 * for good: Ctrl+K and "Nguồn & Giả định" opened nothing (#205; every time with a desktop GPU,
 * not with software WebGL, whose slower frames leave room). A failed load (offline, files
 * replaced by an update) says `failText` and calls `reset`, which withdraws the request, so the
 * next open tries again.
 */
export function useLoaded(
  slot: Loaded,
  when: boolean,
  load: () => Promise<ComponentType>,
  failText: string,
  reset: () => void,
): boolean {
  const [loaded, setLoaded] = useState(slot.Component !== null);
  useEffect(() => {
    if (!when || loaded) return;
    let live = true;
    load().then(
      (c) => {
        slot.Component = c;
        if (live) setLoaded(true);
      },
      () => {
        if (!live) return;
        toast(failText, 'error');
        reset();
      },
    );
    return () => {
      live = false;
    };
  }, [when, loaded, slot, load, failText, reset]);
  return loaded;
}
