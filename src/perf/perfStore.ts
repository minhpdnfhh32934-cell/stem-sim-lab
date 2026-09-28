import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { BenchmarkResult } from './benchmark';
import { TIERS, type QualityPreference, type QualityTier, type TierConfig } from './tiers';

export interface PerfState {
  preference: QualityPreference;
  benchmark: BenchmarkResult | null;
  benchmarking: boolean;
  /** Smoothed frames per second while a simulation renders; null when idle. */
  fps: number | null;
  /** Actual simulated-time speed ratio vs requested (1 = on time, <1 = slow motion). */
  timeScale: number;
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

/** Tier actually in effect: the user's choice, else the benchmark's, else "medium". */
export function effectiveTier(s: Pick<PerfState, 'preference' | 'benchmark'>): QualityTier {
  if (s.preference !== 'auto') return s.preference;
  return s.benchmark?.tier ?? 'medium';
}

export function useTierConfig(): TierConfig {
  const tier = usePerfStore(effectiveTier);
  return TIERS[tier];
}
