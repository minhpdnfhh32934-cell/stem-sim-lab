import { fail, ok, type Result } from '../core/schema';
import { describeError } from '../core/SystemRunner';
import type { ExperimentDefinition, ExperimentParameter } from './experiment';
import { checkExperimentAgainstModel, ExperimentRuntime, isDriven } from './ExperimentRuntime';
import { recordRun, type RunRecord } from './RunRecord';
import type { SimulationModel } from './SimulationModel';

/**
 * idle: not ready (e.g. no projectile loaded) · configured: ready to run · running ·
 * stopped: halted by the user (or failed) with the data so far kept · completed: finished.
 */
export type SessionState = 'idle' | 'configured' | 'running' | 'stopped' | 'completed';

/**
 * An apparatus's own limits, checked against the theory before a run starts (e.g. the shot must
 * land inside the range). Returns the reason the run cannot start, or null.
 */
export type RunCheck = (
  inputs: Readonly<Record<string, number>>,
  theory: Readonly<Record<string, number>>,
) => string | null;

/** The model's t = 0 state for settings not yet run: drawn, never recorded or shown as a value. */
export interface SessionPreview {
  readonly preview: true;
  readonly sample: Readonly<Record<string, number>>;
}

const DECIMALS = 1e9; // dial values are rounded to this, so repeated 0.1 steps do not drift

/**
 * Ended runs a session keeps; beyond it the oldest record goes. Records hold only the samples
 * recorded: 20 pendulum runs are 0.9 MB at 1 m and 30°, 4.0 MB at the longest the dials allow
 * (3 m, 60°, Moon); a projectile record is 6–58 kB (its 12 s limit).
 */
export const RUN_HISTORY_LIMIT = 20;

/**
 * One experiment set up somewhere (a station): the configured parameters, whether the apparatus
 * is ready, its current run and the history of its ended runs. Explicit states — stopping keeps
 * the data, reset clears the current run, and a new run needs a reset first. Every run that ends
 * (completed, stopped, failed — also by a reset while running) is frozen into the history once,
 * at that moment; the history outlives resets and dial changes. Pure: no events, no game
 * objects; ExperimentSystem announces what happens and stations decide when to call it.
 */
export class ExperimentSession {
  private readonly values: Record<string, number> = {};
  private prepared = false;
  private current: ExperimentRuntime | null = null;
  private runs = 0;
  private readonly records: RunRecord[] = [];

  constructor(
    readonly id: string,
    readonly definition: ExperimentDefinition,
    private readonly model: SimulationModel,
    /** Ended runs of this station kept from before (the run history store), in any order. */
    kept: readonly RunRecord[] = [],
  ) {
    const problems = checkExperimentAgainstModel(definition, model);
    if (problems.length > 0) {
      throw new Error(`Experiment "${definition.id}": ${problems.join('; ')}`);
    }
    for (const p of definition.parameters) this.values[p.id] = p.default;
    const own = kept.filter((r) => r.sessionId === id && r.definition.id === definition.id);
    own.sort((a, b) => a.sequence - b.sequence);
    this.records.push(...own.slice(-RUN_HISTORY_LIMIT));
    // Numbers go on from the kept runs, so a run id is never used twice.
    this.runs = own.at(-1)?.sequence ?? 0;
  }

  get state(): SessionState {
    const run = this.current;
    if (!run) return this.prepared ? 'configured' : 'idle';
    if (run.status === 'completed') return 'completed';
    if (run.status === 'stopped' || run.status === 'failed') return 'stopped';
    return 'running';
  }

  get parameters(): Readonly<Record<string, number>> {
    return this.values;
  }

  /** The current or last run (null after a reset). */
  get run(): ExperimentRuntime | null {
    return this.current;
  }

  /** Ended runs, oldest first, at most RUN_HISTORY_LIMIT; the current run once it has ended. */
  get history(): readonly RunRecord[] {
    return this.records;
  }

  get ready(): boolean {
    return this.prepared;
  }

  /** Readiness comes from outside (the apparatus); true if it changed. */
  setReady(ready: boolean): boolean {
    if (this.prepared === ready) return false;
    this.prepared = ready;
    return true;
  }

  parameter(id: string): ExperimentParameter | undefined {
    return this.definition.parameters.find((p) => p.id === id);
  }

  /** Sets a parameter; returns why it cannot be set, or null. */
  setParameter(id: string, value: number): string | null {
    const p = this.parameter(id);
    if (!p) return `"${this.definition.name}" has no parameter "${id}".`;
    if (this.state === 'running') return 'Stop the run before changing its parameters.';
    if (!Number.isFinite(value) || value < p.min || value > p.max) {
      return `${p.label} must be within ${p.min}–${p.max} ${p.unit}.`;
    }
    this.values[id] = value;
    return null;
  }

  /**
   * Whether `value` is one a control may set: one of the presets when the parameter has presets,
   * otherwise a point of the step grid from min (or max itself, where a dial clamps), in range.
   */
  accepts(id: string, value: number): boolean {
    return this.settingFor(id, value) !== null;
  }

  /** The setting `value` stands for (the preset's own value, or the rounded grid point), or null. */
  settingFor(id: string, value: number): number | null {
    const p = this.parameter(id);
    if (!p || !Number.isFinite(value) || value < p.min || value > p.max) return null;
    if (p.presets.length > 0) {
      return p.presets.find((s) => Math.abs(s.value - value) < 1e-9)?.value ?? null;
    }
    if (value === p.max) return value;
    const step = p.step ?? (p.max - p.min) / 20;
    const k = Math.round((value - p.min) / step);
    if (Math.abs((value - p.min) / step - k) >= 1e-6) return null;
    return Math.round((p.min + k * step) * DECIMALS) / DECIMALS;
  }

  /** Sets a parameter to a preset (or a step-grid value); returns why it cannot, or null. */
  set(id: string, value: number): string | null {
    const p = this.parameter(id);
    const setting = this.settingFor(id, value);
    if (p && setting === null) return `${value} ${p.unit} is not a setting of ${p.label}.`;
    return this.setParameter(id, setting ?? value);
  }

  /**
   * The model's state at t = 0 for the current settings, for visuals before a run: every model
   * variable by name, flagged `preview` — never a run, never recorded, never shown as a number.
   * Null where the model refuses these settings. Allocates: call it on a change, not per frame.
   */
  preview(apparatus: Readonly<Record<string, number>> = {}): SessionPreview | null {
    const state = new Float64Array(this.model.variables.length);
    try {
      this.model.init(this.inputs(apparatus), state);
    } catch (error) {
      if ((error as Error | null)?.constructor !== Error) throw error;
      return null;
    }
    const sample: Record<string, number> = {};
    this.model.variables.forEach((variable, i) => (sample[variable] = state[i] ?? NaN));
    return { preview: true, sample };
  }

  /**
   * The value one dial click away: the next or previous preset when the parameter has presets,
   * otherwise one `step` (on the step grid from min), clamped to the range.
   */
  nextValue(id: string, direction: 1 | -1): number | null {
    const p = this.parameter(id);
    const value = this.values[id];
    if (!p || value === undefined) return null;
    if (p.presets.length > 0) {
      const presets = p.presets.map((s) => s.value).sort((a, b) => a - b);
      const next =
        direction > 0
          ? presets.find((v) => v > value + 1e-9)
          : presets.reverse().find((v) => v < value - 1e-9);
      return next ?? value;
    }
    const step = p.step ?? (p.max - p.min) / 20;
    // The next grid point in the direction of the click, also from an off-grid value.
    const at = (value - p.min) / step;
    const k = direction > 0 ? Math.floor(at + 1e-9) + 1 : Math.ceil(at - 1e-9) - 1;
    const next = Math.min(p.max, Math.max(p.min, p.min + k * step));
    return Math.round(next * DECIMALS) / DECIMALS;
  }

  /** Inputs a run would get: parameters plus initial conditions, overridden by the apparatus. */
  inputs(apparatus: Readonly<Record<string, number>> = {}): Record<string, number> {
    return { ...this.definition.initialConditions, ...this.values, ...apparatus };
  }

  /** Theory for the current configuration (null if the model has none, or refuses it). */
  predict(apparatus: Readonly<Record<string, number>> = {}): Record<string, number> | null {
    const theory = this.prediction(apparatus);
    return theory.ok ? theory.value : null;
  }

  /**
   * The theory for the current configuration (null if the model has none), or the model's own
   * message where its predict refuses them (throws a plain `Error`, as every model does for
   * settings outside what it covers): those never run. Any other throw is a bug and propagates.
   */
  prediction(
    apparatus: Readonly<Record<string, number>> = {},
  ): Result<Record<string, number> | null> {
    try {
      return ok(this.model.predict?.(this.inputs(apparatus)) ?? null);
    } catch (error) {
      if ((error as Error | null)?.constructor !== Error) throw error;
      return fail(`Model "${this.model.id}" refuses: ${describeError(error)}`);
    }
  }

  /**
   * Every model variable now, by name, into `out` (no allocation once it has their keys): the
   * run's current value, NaN for each without a run.
   */
  sample(out: Record<string, number>): void {
    const run = this.current;
    for (const variable of this.model.variables) out[variable] = run ? run.value(variable) : NaN;
  }

  /** Starts a run with the current parameters; returns why it cannot start, or null. */
  start(apparatus: Readonly<Record<string, number>> = {}, check?: RunCheck): string | null {
    const state = this.state;
    if (state === 'running') return 'A run is already in progress.';
    if (state === 'stopped' || state === 'completed') return 'Press RESET before the next run.';
    if (state === 'idle') return 'The apparatus is not ready.';
    const inputs = this.inputs(apparatus);
    const theory = this.prediction(apparatus);
    if (!theory.ok) return theory.error;
    const problem = check?.(inputs, theory.value ?? {}) ?? null;
    if (problem) return problem;
    const run = new ExperimentRuntime(`${this.id}#${++this.runs}`, this.definition, this.model, {
      ...this.values,
      ...apparatus,
    });
    run.start();
    this.current = run;
    return null;
  }

  /** Halts a running run, keeping its data (and recording it); false if nothing was running. */
  stop(): boolean {
    const stopped = this.current?.stop() ?? false;
    if (stopped) this.keep();
    return stopped;
  }

  /**
   * Clears the current run (stopping and recording it first if it was running): back to
   * configured, or idle if not ready. The history stays.
   */
  reset(): boolean {
    if (!this.current) return false;
    if (this.current.stop()) this.keep();
    this.current = null;
    return true;
  }

  /** Its runs are fed by the player in a physical lab (`ExperimentRuntime.feed`), not stepped. */
  get driven(): boolean {
    return isDriven(this.definition, this.model);
  }

  /**
   * Feeds the running driven run its drive value `x` (the volume in the flask, mL): false if there
   * is none. An end it reaches is applied, and recorded, on the next `advance`.
   */
  feed(x: number): boolean {
    return this.current?.feed(x) ?? false;
  }

  /** The player finishes the running driven run (end reason `player`) on the next `advance`. */
  finish(): boolean {
    return this.current?.finish() ?? false;
  }

  /** Advances a running run by real time `dt` (fixed internal steps); records it if it ends. */
  advance(dt: number): void {
    if (this.current?.status !== 'running') return;
    this.current.advance(dt);
    if (this.state !== 'running') this.keep(); // it completed or failed in these steps
  }

  /** Freezes the current run, which has just ended, into the history: once, oldest out first. */
  private keep(): void {
    const run = this.current;
    if (!run || this.records.at(-1)?.runId === run.runId) return;
    // A new run starts only after a reset, so the count is still this run's number.
    this.records.push(recordRun(run, this.id, this.runs));
    if (this.records.length > RUN_HISTORY_LIMIT) this.records.shift();
  }
}
