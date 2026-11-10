import { create } from 'zustand';

/**
 * A locked prediction waiting for its run (bench, docs/BENCH_DESIGN.md §9.4): "Chốt dự đoán" in
 * the notebook leaves its run here, and the bench's main action becomes "Chạy để kiểm tra" until
 * it runs. Null: no prediction waiting.
 */
export const usePoeRun = create<{ run: (() => void) | null }>(() => ({ run: null }));

/** Runs the waiting prediction once (the main action), then nothing waits any more. */
export function runLockedPrediction(): boolean {
  const run = usePoeRun.getState().run;
  if (!run) return false;
  usePoeRun.setState({ run: null });
  run();
  return true;
}
