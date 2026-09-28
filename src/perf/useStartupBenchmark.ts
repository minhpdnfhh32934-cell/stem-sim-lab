import { useEffect } from 'react';
import { runBenchmark } from './benchmark';
import { usePerfStore } from './perfStore';

/** Runs the quick hardware benchmark once (first launch) to pick the quality tier. */
export function useStartupBenchmark(): void {
  useEffect(() => {
    const { benchmark, benchmarking } = usePerfStore.getState();
    if (benchmark || benchmarking || import.meta.env.MODE === 'test') return;
    // Let the first frame paint before measuring.
    const id = window.setTimeout(() => {
      void remeasure();
    }, 800);
    return () => {
      window.clearTimeout(id);
    };
  }, []);
}

export async function remeasure(): Promise<void> {
  const store = usePerfStore.getState();
  if (store.benchmarking) return;
  store.setBenchmarking(true);
  try {
    store.setBenchmark(await runBenchmark());
  } catch (e) {
    console.error('Benchmark failed', e);
    store.setBenchmarking(false);
  }
}
