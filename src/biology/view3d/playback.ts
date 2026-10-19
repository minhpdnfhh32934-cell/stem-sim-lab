/**
 * Playback of a lesson's time in its 3D view: the model's whole time span plays in a few
 * seconds (the times shown are the model's own), can be paused and scrubbed. While it plays,
 * frame times feed the overload ladder.
 */
import { useEffect, useRef, useState } from 'react';
import { FrameMonitor } from '@/perf/frameMonitor';
import { reportOverload } from '@/perf/perfStore';
import { prefersReducedMotion } from './support';

export interface Playback {
  /** Model time (same unit as the lesson). */
  t: number;
  playing: boolean;
  setT: (t: number) => void;
  toggle: () => void;
  replay: () => void;
}

/**
 * `duration` of model time played in `seconds` of real time. Starts at `start` (default the end:
 * the 3D view first shows the outcome, like the 2D chart) unless `autoplay`.
 */
export function usePlayback(
  duration: number,
  opts: { seconds?: number; start?: number; autoplay?: boolean } = {},
): Playback {
  const span = Math.max(1e-9, duration);
  const seconds = opts.seconds ?? 8;
  const [t, setTState] = useState(() => Math.min(span, Math.max(0, opts.start ?? span)));
  const [playing, setPlaying] = useState(() => !!opts.autoplay && !prefersReducedMotion());
  const tRef = useRef(t);
  // A new time span (another model) keeps the moment's share of it.
  const spanRef = useRef(span);
  useEffect(() => {
    if (spanRef.current !== span) {
      const share = tRef.current / spanRef.current;
      spanRef.current = span;
      tRef.current = Math.min(span, share * span);
      setTState(tRef.current);
    }
  }, [span]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let prev = performance.now();
    const monitor = new FrameMonitor(1 / 30);
    const step = (now: number) => {
      const elapsed = Math.max(0, (now - prev) / 1000);
      prev = now;
      if (document.visibilityState === 'visible') {
        monitor.record(elapsed);
        if (monitor.overloaded) {
          reportOverload();
          monitor.resetOverload();
        }
      }
      const next = tRef.current + (Math.min(0.1, elapsed) * spanRef.current) / seconds;
      if (next >= spanRef.current) {
        tRef.current = spanRef.current;
        setTState(spanRef.current);
        setPlaying(false);
        return;
      }
      tRef.current = next;
      setTState(next);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [playing, seconds]);

  return {
    t,
    playing,
    setT: (v) => {
      tRef.current = Math.min(spanRef.current, Math.max(0, v));
      setTState(tRef.current);
      setPlaying(false);
    },
    toggle: () => {
      if (!playing && tRef.current >= spanRef.current) {
        tRef.current = 0;
        setTState(0);
      }
      setPlaying(!playing);
    },
    replay: () => {
      tRef.current = 0;
      setTState(0);
      setPlaying(!prefersReducedMotion());
    },
  };
}
