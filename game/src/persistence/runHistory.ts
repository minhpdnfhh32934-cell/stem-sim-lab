import { z } from 'zod';
import type { Registry } from '../core/Registry';
import { fail, formatIssues, ok, type Result } from '../core/schema';
import type { ExperimentDefinition } from '../simulation/experiment';
import type { RunRecord } from '../simulation/RunRecord';

/**
 * Run history store version, its own: the IndexedDB database version, unrelated to SAVE_VERSION.
 * Changing StoredRunSchema incompatibly means: bump this and upgrade the records in the store's
 * `onupgradeneeded` (never delete the database to make it fit).
 */
export const RUN_HISTORY_VERSION = 1;

const NumbersSchema = z.record(z.string(), z.number());
const SamplesSchema = z.custom<Float64Array>(
  (v) => v instanceof Float64Array,
  'not a Float64Array',
);

/**
 * A RunRecord as plain data for the run history store (IndexedDB keeps typed arrays as they are):
 * the definition by id, the theory by its kept value. Nothing runtime — no closure, no session.
 */
const StoredRunSchema = z
  .object({
    runId: z.string().min(1),
    sessionId: z.string().min(1),
    sequence: z.number().int().positive(),
    experimentId: z.string().min(1),
    status: z.enum(['completed', 'stopped', 'failed']),
    endReason: z.enum(['model', 'time-limit', 'player']).nullable(),
    error: z.string().nullable(),
    time: z.number(),
    inputs: NumbersSchema,
    results: NumbersSchema.nullable(),
    theory: NumbersSchema.nullable(),
    sampleTimes: SamplesSchema,
    sampleValues: z.array(SamplesSchema),
    sampleCount: z.number().int().nonnegative(),
  })
  .refine(
    (run) =>
      run.sampleTimes.length === run.sampleCount &&
      run.sampleValues.every((s) => s.length === run.sampleCount),
    'sample buffers do not match sampleCount',
  )
  .refine(
    (run) => (run.status === 'completed') === (run.results !== null && run.endReason !== null),
    'only a completed run has results and an end reason',
  );

export type StoredRun = z.infer<typeof StoredRunSchema>;

/**
 * Where ended runs are kept between visits (IndexedDB in the browser), apart from the save slot:
 * a failure here never touches the progression save. `put` replaces by `runId`, so writing the
 * same run twice keeps one.
 */
export interface RunHistoryStore {
  /** Every stored run, unchecked (a stored value is data from outside the program). */
  load(): Promise<unknown[]>;
  put(run: StoredRun): Promise<void>;
  delete(runId: string): Promise<void>;
}

/** For tests and browsers without IndexedDB: copies on the way in and out, as IndexedDB does. */
export class MemoryRunHistoryStore implements RunHistoryStore {
  readonly runs = new Map<string, StoredRun>();
  load(): Promise<unknown[]> {
    return Promise.resolve([...this.runs.values()].map((run) => structuredClone(run)));
  }
  put(run: StoredRun): Promise<void> {
    this.runs.set(run.runId, structuredClone(run));
    return Promise.resolve();
  }
  delete(runId: string): Promise<void> {
    this.runs.delete(runId);
    return Promise.resolve();
  }
}

/** The plain copy of a record the store keeps (its buffers are copied by the store). */
export function toStoredRun(record: RunRecord): StoredRun {
  return {
    runId: record.runId,
    sessionId: record.sessionId,
    sequence: record.sequence,
    experimentId: record.definition.id,
    status: record.status,
    endReason: record.status === 'completed' ? record.endReason : null,
    error: record.status === 'failed' ? record.error : null,
    time: record.time,
    inputs: { ...record.inputs },
    results: record.results ? { ...record.results } : null,
    theory: record.theory() ? { ...record.theory() } : null,
    sampleTimes: record.sampleTimes,
    sampleValues: [...record.sampleValues],
    sampleCount: record.sampleCount,
  };
}

/**
 * Stations that moved room in Phase T-1a (the Physics wing rebuilt): a run kept under the old
 * station id belongs to the same station, now under its new id. A snapshot of that change.
 */
export const MOVED_STATIONS: Readonly<Record<string, string>> = {
  'projectile-range/refraction': 'waves-optics/refraction',
  'projectile-range/mirror': 'waves-optics/mirror',
  'projectile-range/lens': 'waves-optics/lens',
  'projectile-range/circuit': 'physics-lab/circuit',
  'projectile-range/power': 'physics-lab/power',
  'projectile-range/incline': 'physics-lab/incline',
  'projectile-range/buoyancy': 'physics-lab/buoyancy',
  'projectile-range/energy': 'physics-lab/energy',
  'projectile-range/collision': 'physics-lab/collision',
  'projectile-range/whirl': 'pendulum-bay/whirl',
};

/**
 * A stored run back as a frozen RunRecord, if it is valid and its experiment still exists. The
 * record owns the stored buffers (the store hands out copies).
 */
export function fromStoredRun(
  value: unknown,
  experiments: Registry<ExperimentDefinition>,
): Result<RunRecord> {
  const parsed = StoredRunSchema.safeParse(value);
  if (!parsed.success) return fail(`Invalid stored run: ${formatIssues(parsed.error).join('; ')}`);
  const run = parsed.data;
  const definition = experiments.tryGet(run.experimentId);
  if (!definition) return fail(`Stored run ${run.runId}: no experiment "${run.experimentId}"`);
  const frozen = <T extends object>(v: T): Readonly<T> => Object.freeze({ ...v });
  const theory = run.theory ? frozen(run.theory) : null;
  const base = {
    runId: run.runId,
    sessionId: MOVED_STATIONS[run.sessionId] ?? run.sessionId,
    sequence: run.sequence,
    definition,
    time: run.time,
    inputs: frozen(run.inputs),
    sampleTimes: run.sampleTimes,
    sampleValues: Object.freeze(run.sampleValues),
    sampleCount: run.sampleCount,
    theory: () => theory,
  };
  if (run.status === 'completed' && run.results && run.endReason) {
    const results = frozen(run.results);
    return ok(Object.freeze({ ...base, status: 'completed', endReason: run.endReason, results }));
  }
  if (run.status === 'failed') {
    return ok(
      Object.freeze({
        ...base,
        status: 'failed',
        error: run.error ?? 'unknown error',
        results: null,
      }),
    );
  }
  return ok(Object.freeze({ ...base, status: 'stopped', results: null }));
}
