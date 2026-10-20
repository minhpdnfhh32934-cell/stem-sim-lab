/**
 * Animation loops of the 3D views. One requestAnimationFrame loop runs only while something
 * moves (playback, illustrative motion); frame times feed the overload ladder (`FrameMonitor` →
 * `reportOverload`: the app lowers the quality tier by itself before it ever lowers accuracy).
 * A frame never advances more than 0.1 s (no jump after a pause), and frames of a hidden tab are
 * not measured.
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { StoreApi, UseBoundStore } from 'zustand';
import { FrameMonitor } from '@/perf/frameMonitor';
import { reportOverload } from '@/perf/perfStore';

export { prefersReducedMotion } from './availability';

/** Longest step one frame may take (s). */
export const MAX_FRAME_STEP = 0.1;

/**
 * Calls `onFrame(dt)` every animation frame while `running` (dt in seconds, at most 0.1).
 * `onFrame` returning false stops the loop until `running` changes. Raw frame times go to a
 * `FrameMonitor` (30 fps budget) while the page is visible.
 */
export function useFrameLoop(running: boolean, onFrame: (dt: number) => unknown): void {
  const ref = useRef(onFrame);
  useLayoutEffect(() => {
    ref.current = onFrame;
  });
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let prev = performance.now();
    const monitor = new FrameMonitor(1 / 30);
    const step = (now: number) => {
      const elapsed = Math.max(0, (now - prev) / 1000);
      prev = now;
      // The monitor gets the raw frame time (it skips pauses itself); hidden tabs are not frames.
      if (document.visibilityState === 'visible') {
        monitor.record(elapsed);
        if (monitor.overloaded) {
          reportOverload();
          monitor.resetOverload();
        }
      }
      if (ref.current(Math.min(MAX_FRAME_STEP, elapsed)) === false) return;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [running]);
}

/** The playback part of a lesson's transient 3D store. */
export interface PlaybackState {
  t: number;
  playing: boolean;
}

/**
 * Plays a store's time `t` from where it is to `total` at `speed` × real time while its
 * `playing` is true; stops (playing = false) at the end.
 */
export function usePlayback<S extends PlaybackState>(
  store: UseBoundStore<StoreApi<S>>,
  total: number,
  speed: number,
): void {
  const playing = store((s) => s.playing);
  useFrameLoop(playing, (dt) => {
    const next = store.getState().t + dt * speed;
    if (next >= total) {
      store.setState({ t: total, playing: false } as Partial<S>);
      return false;
    }
    store.setState({ t: next } as Partial<S>);
    return true;
  });
}
