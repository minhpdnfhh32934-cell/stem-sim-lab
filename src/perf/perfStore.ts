import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { BenchmarkResult } from './benchmark';
import {
  TIERS,
  lowerTier,
  type QualityPreference,
  type QualityTier,
  type TierConfig,
} from './tiers';

export interface PerfState {
  preference: QualityPreference;
  benchmark: BenchmarkResult | null;
  benchmarking: boolean;
  /** Smoothed frames per second while a simulation renders; null when idle. */
  fps: number | null;
  /** Actual simulated-time speed ratio vs requested (1 = on time, <1 = slow motion). */
  timeScale: number;
  /**
   * Degradation ladder, rung 1 (MASTER_PROMPT §5): drawing is one tier lower after sustained
   * overload. Visual only — the numbers never change. Cleared when another topic opens.
   */
  degraded: boolean;
  /** Last JS heap reading (MB) from the memory watchdog; null when not available. */
  memoryMB: number | null;
  setPreference: (p: QualityPreference) => void;
  setBenchmark: (b: BenchmarkResult) => void;
  setBenchmarking: (on: boolean) => void;
  setFps: (fps: number | null) => void;
  setTimeScale: (s: number) => void;
}

export const usePerfStore = create<PerfState>()(
  persist(
    (set) => ({
      preference: 'auto',
      benchmark: null,
      benchmarking: false,
      fps: null,
      timeScale: 1,
      degraded: false,
      memoryMB: null,
      setPreference: (preference) => {
        set({ preference });
      },
      setBenchmark: (benchmark) => {
        set({ benchmark, benchmarking: false });
      },
      setBenchmarking: (benchmarking) => {
        set({ benchmarking });
      },
      setFps: (fps) => {
        set({ fps });
      },
      setTimeScale: (timeScale) => {
        set({ timeScale });
      },
    }),
    {
      name: 'stemsim.perf',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ preference, benchmark }) => ({ preference, benchmark }),
    },
  ),
);

/** Tier chosen by the user, else by the benchmark, else "medium" (before degradation). */
export function chosenTier(s: Pick<PerfState, 'preference' | 'benchmark'>): QualityTier {
  if (s.preference !== 'auto') return s.preference;
  return s.benchmark?.tier ?? 'medium';
}

/** Tier actually in effect: the chosen tier, one step lower while degraded. */
export function effectiveTier(
  s: Pick<PerfState, 'preference' | 'benchmark'> & Partial<Pick<PerfState, 'degraded'>>,
): QualityTier {
  const tier = chosenTier(s);
  return s.degraded ? lowerTier(tier) : tier;
}

/** Called by render loops when a FrameMonitor reports sustained overload. */
export function reportOverload(): void {
  const s = usePerfStore.getState();
  if (!s.degraded && effectiveTier(s) !== 'low') usePerfStore.setState({ degraded: true });
}

export function useTierConfig(): TierConfig {
  const tier = usePerfStore(effectiveTier);
  return TIERS[tier];
}
