import type { ExperimentDefinition } from './experiment';
import type { ExperimentEndReason, ExperimentRuntime, RunStatus } from './ExperimentRuntime';

/**
 * What results tables, graphs and exports read from a run: the live one (`ExperimentRuntime`)
 * or a recorded one (`RunRecord`). Only the first `sampleCount` samples are valid. Readers never
 * write to it.
 */
export interface RunData {
  readonly runId: string;
  readonly definition: ExperimentDefinition;
  readonly status: RunStatus;
  /** Simulated time reached (s). */
  readonly time: number;
  /** Everything the model was given: parameters, initial conditions, apparatus inputs. */
  readonly inputs: Readonly<Record<string, number>>;
  /** Measured results, once completed. */
  readonly results: Readonly<Record<string, number>> | null;
  readonly sampleTimes: Float64Array;
  readonly sampleValues: readonly Float64Array[];
  readonly sampleCount: number;
  /** The model's theory for this run's own inputs. */
  theory(): Readonly<Record<string, number>> | null;
}

interface RecordedRun extends RunData {
  /** The station (session) it was run at. */
  readonly sessionId: string;
  /** Its number at that station: run #1, #2, … */
  readonly sequence: number;
}

/**
 * A run that has ended, frozen: completed with its measured results, or stopped or failed with
 * only the samples it recorded (never claimed as a result). It owns copies of everything — the
 * inputs that produced it, its results, the theory for those inputs and its valid samples — so
 * nothing done later (dials, new runs, views, exports) can change it.
 */
export type RunRecord = RecordedRun &
  (
    | {
        readonly status: 'completed';
        readonly endReason: ExperimentEndReason;
        readonly results: Readonly<Record<string, number>>;
      }
    | { readonly status: 'stopped'; readonly results: null }
    | { readonly status: 'failed'; readonly error: string; readonly results: null }
  );

const frozen = <T extends object>(value: T): Readonly<T> => Object.freeze({ ...value });

/**
 * Freezes a run that has ended into a record. Called once, when it ends: the samples are copied
 * at their recorded length (the run's buffers are sized for the longest possible run), and the
 * theory is evaluated for the run's own inputs and kept, never recomputed from later settings.
 * JavaScript cannot freeze a typed array's contents, so the record keeps private copies that no
 * code writes to.
 */
export function recordRun(run: ExperimentRuntime, sessionId: string, sequence: number): RunRecord {
  const count = run.sampleCount;
  const prediction = run.theory();
  const theory = prediction ? frozen(prediction) : null;
  const base = {
    runId: run.runId,
    sessionId,
    sequence,
    definition: run.definition,
    time: run.time,
    inputs: frozen(run.inputs),
    sampleTimes: run.sampleTimes.slice(0, count),
    sampleValues: Object.freeze(run.sampleValues.map((s) => s.slice(0, count))),
    sampleCount: count,
    theory: () => theory,
  };
  if (run.status === 'completed' && run.results && run.endReason) {
    const results = frozen(run.results);
    return Object.freeze({ ...base, status: 'completed', endReason: run.endReason, results });
  }
  if (run.status === 'failed') {
    return Object.freeze({
      ...base,
      status: 'failed',
      error: run.error ?? 'unknown error',
      results: null,
    });
  }
  if (run.status === 'stopped') return Object.freeze({ ...base, status: 'stopped', results: null });
  throw new Error(`Run ${run.runId} has not ended (${run.status})`);
}
