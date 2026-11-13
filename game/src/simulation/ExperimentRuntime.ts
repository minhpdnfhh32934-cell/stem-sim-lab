import { describeError } from '../core/SystemRunner';
import type { ExperimentDefinition } from './experiment';
import type { SimulationModel } from './SimulationModel';

export type RunStatus = 'ready' | 'running' | 'paused' | 'completed' | 'stopped' | 'failed';
/**
 * `model`: the process finished (e.g. ball landed). `time-limit`: maxDuration cut it short.
 * `player`: a driven run the player finished by hand (results at the last fed value).
 */
export type ExperimentEndReason = 'model' | 'time-limit' | 'player';

/** Whether runs of `definition` with `model` are driven (fed by the player), not stepped. */
export const isDriven = (definition: ExperimentDefinition, model: SimulationModel) =>
  definition.presentation === 'physical-lab' && model.driven !== undefined;

const TIME = -1; // variable slot for the runtime clock
const MAX_SAMPLES = 1_000_000;
/** Caps work per frame: a slow frame makes the run lag behind real time instead of freezing. */
const MAX_STEPS_PER_ADVANCE = 2000;
const EPS = 1e-9;

/** Problems that make a definition unrunnable with a model; shared with content validation. */
export function checkExperimentAgainstModel(
  definition: ExperimentDefinition,
  model: SimulationModel,
): string[] {
  const problems: string[] = [];
  const provided = new Set([
    ...Object.keys(definition.initialConditions),
    ...definition.parameters.map((p) => p.id),
  ]);
  for (const input of model.inputs) {
    if (!provided.has(input)) problems.push(`model input "${input}" is not provided`);
  }
  for (const m of [...definition.measurements, ...definition.results]) {
    if (m.variable !== 'time' && !model.variables.includes(m.variable)) {
      problems.push(`"${m.id}" reads unknown model variable "${m.variable}"`);
    }
  }
  for (const r of definition.results) {
    if (r.theory !== undefined && !(model.predictions ?? []).includes(r.theory)) {
      problems.push(`"${r.id}" compares with unknown model prediction "${r.theory}"`);
    }
  }
  for (const m of definition.instruments) {
    if (model.inputs.includes(m.resolution)) {
      problems.push(
        `instrument resolution "${m.resolution}" is a model input: it would change the run`,
      );
    }
  }
  for (const g of definition.graphs) {
    if (g.mark !== undefined && !(model.predictions ?? []).includes(g.mark)) {
      problems.push(`graph "${g.id}" marks unknown model prediction "${g.mark}"`);
    }
  }
  const { period0, periodDamped, decayRate, envelope0, dampingRatio } =
    definition.oscillation ?? {};
  for (const [use, prediction] of [
    ...definition.analyses.flatMap((a) => [
      [`analysis "${a.id}" slope`, a.slope.theory],
      [`analysis "${a.id}" intercept`, a.slope.intercept],
      [`analysis "${a.id}" derived value`, a.derived?.theory],
    ]),
    ...Object.entries({ period0, periodDamped, decayRate, envelope0, dampingRatio }).map(
      ([name, id]) => [`oscillation ${name}`, id],
    ),
  ]) {
    if (prediction !== undefined && !(model.predictions ?? []).includes(prediction)) {
      problems.push(`${use} compares with unknown model prediction "${prediction}"`);
    }
  }
  // A driven run starts from its `drive` transfer: one without, or a drive without the mode, never runs.
  if (isDriven(definition, model) !== (definition.workspace?.drive !== undefined)) {
    problems.push(
      model.driven
        ? `model "${model.id}" is driven here: the workspace needs a "drive" (what feeds it)`
        : `model "${model.id}" has no driven mode for the workspace's "drive"`,
    );
  }
  const { maxDuration, sampleInterval } = definition.simulation;
  if (maxDuration / sampleInterval > MAX_SAMPLES) {
    problems.push(`maxDuration / sampleInterval exceeds ${MAX_SAMPLES} samples`);
  }
  return problems;
}

/**
 * One run of an experiment: resolves inputs, steps the model on a fixed timestep, records
 * measurement samples into preallocated buffers and reduces results. Never fabricates values:
 * a model error or a non-finite state ends the run as `failed` with the reason.
 */
export class ExperimentRuntime {
  status: RunStatus = 'ready';
  endReason: ExperimentEndReason | null = null;
  error: string | null = null;
  time = 0;
  readonly inputs: Readonly<Record<string, number>>;
  /** Sample buffers; only the first `sampleCount` entries are valid. */
  readonly sampleTimes: Float64Array;
  readonly sampleValues: readonly Float64Array[];

  private readonly state: Float64Array;
  private readonly measurementSlots: number[];
  private readonly resultSlots: number[];
  private readonly extremes: Float64Array;
  private samples = 0;
  private nextSampleTime = 0;
  private accumulator = 0;
  private finalResults: Record<string, number> | null = null;
  /** The driven mode when this run is fed by the player (`isDriven`), else null: stepped. */
  private readonly drive: SimulationModel['driven'] | null;
  /** Sample spacing (s); a driven run doubles it each time its buffer fills (`halveSamples`). */
  private interval: number;
  /** A driven run's end is applied on its next tick (`advance`), where its system announces it. */
  private ending: ExperimentEndReason | null = null;
  /** A driven run's failure (a refused feed), applied on its next tick like its end. */
  private failing: string | null = null;

  constructor(
    readonly runId: string,
    readonly definition: ExperimentDefinition,
    private readonly model: SimulationModel,
    overrides: Readonly<Record<string, number>> = {},
  ) {
    const problems = checkExperimentAgainstModel(definition, model);
    if (problems.length > 0) {
      throw new Error(`Experiment "${definition.id}": ${problems.join('; ')}`);
    }
    this.inputs = resolveInputs(definition, overrides);
    const slot = (variable: string) =>
      variable === 'time' ? TIME : model.variables.indexOf(variable);
    this.measurementSlots = definition.measurements.map((m) => slot(m.variable));
    this.resultSlots = definition.results.map((r) => slot(r.variable));
    this.state = new Float64Array(model.variables.length);
    this.extremes = new Float64Array(definition.results.length);
    const { maxDuration, sampleInterval } = definition.simulation;
    const capacity = Math.ceil(maxDuration / sampleInterval) + 2;
    this.sampleTimes = new Float64Array(capacity);
    this.sampleValues = definition.measurements.map(() => new Float64Array(capacity));
    this.drive = isDriven(definition, model) ? (model.driven ?? null) : null;
    this.interval = sampleInterval;
    this.reset();
  }

  get sampleCount(): number {
    return this.samples;
  }

  /** Fed by the player (`feed`), not stepped: no time limit, no no-progress check. */
  get driven(): boolean {
    return this.drive !== null;
  }

  get results(): Readonly<Record<string, number>> | null {
    return this.finalResults;
  }

  /** Current value of a model variable (or `time`): what visuals follow. NaN if unknown. */
  value(variable: string): number {
    return this.read(variable === 'time' ? TIME : this.model.variables.indexOf(variable));
  }

  /** The model's theory for this run's inputs, or null if the model has none. */
  theory(): Record<string, number> | null {
    return this.model.predict?.(this.inputs) ?? null;
  }

  reset(): void {
    this.model.init(this.inputs, this.state);
    this.time = 0;
    this.accumulator = 0;
    this.samples = 0;
    this.status = 'ready';
    this.endReason = null;
    this.error = null;
    this.finalResults = null;
    this.ending = null;
    this.failing = null;
    this.interval = this.definition.simulation.sampleInterval;
    this.resultSlots.forEach((s, i) => (this.extremes[i] = this.read(s)));
    this.recordSample();
    this.nextSampleTime = this.interval;
  }

  start(): boolean {
    return this.transition('ready', 'running');
  }
  pause(): boolean {
    return this.transition('running', 'paused');
  }
  resume(): boolean {
    return this.transition('paused', 'running');
  }
  stop(): boolean {
    return this.transition('running', 'stopped') || this.transition('paused', 'stopped');
  }

  /**
   * Advances by real time `dt` (seconds) in fixed steps; leftover time carries over. A driven run
   * is not stepped: lab time only stamps its samples, and an end it was fed is applied here.
   */
  advance(dt: number): void {
    if (this.status !== 'running') return;
    if (this.drive) {
      this.time += dt;
      if (this.failing !== null) this.fail(this.failing);
      else if (this.ending) this.complete(this.ending);
      return;
    }
    const h = this.definition.simulation.timeStep;
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= h && this.isRunning) {
      if (steps++ >= MAX_STEPS_PER_ADVANCE) {
        this.accumulator = 0;
        break;
      }
      this.accumulator -= h;
      this.stepOnce();
    }
  }

  /** Runs to the end immediately (headless use, tests). */
  runToCompletion(): void {
    if (this.drive) throw new Error(`Run ${this.runId} is driven: it is fed, never stepped`);
    if (this.status === 'ready') this.start();
    while (this.status === 'running') this.stepOnce();
  }

  /**
   * A driven run's model at drive value `x` (e.g. the volume in the flask, mL), from the player's
   * action; a sample is recorded at the sample interval of lab time, and always at the model's
   * own end, which completes the run on its next tick (`advance`). A value the model refuses, or
   * a non-finite state, fails the run with the reason on its next tick. False if nothing was fed.
   */
  feed(x: number): boolean {
    const drive = this.drive;
    if (!drive || this.status !== 'running' || this.ending || this.failing !== null) return false;
    let done: boolean;
    try {
      done = drive.set(this.state, this.inputs, x);
    } catch (error) {
      this.failing = `Model "${this.model.id}" refused ${x}: ${describeError(error)}`;
      return false;
    }
    for (let i = 0; i < this.state.length; i++) {
      if (!Number.isFinite(this.state[i])) {
        this.failing = `Non-finite value for "${this.model.variables[i] ?? `#${i}`}" at ${x}`;
        return false;
      }
    }
    this.trackExtremes();
    if (done || this.time >= this.nextSampleTime - EPS) {
      this.recordSample();
      while (this.nextSampleTime <= this.time + EPS) this.nextSampleTime += this.interval;
    }
    if (done) this.ending = 'model';
    return true;
  }

  /**
   * The player ends a driven run by hand (e.g. the burette tap closed and the reading recorded):
   * it completes as `player` on its next tick, its results read at the last fed value. STOP is
   * not this: a stopped run has no readings. False if it is not a running driven run.
   */
  finish(): boolean {
    if (!this.drive || this.status !== 'running' || this.ending || this.failing !== null) {
      return false;
    }
    this.ending = 'player';
    return true;
  }

  private stepOnce(): void {
    const { timeStep, maxDuration, sampleInterval } = this.definition.simulation;
    const dt = Math.min(timeStep, maxDuration - this.time);
    let advanced: number;
    try {
      advanced = this.model.step(this.state, dt, this.inputs);
    } catch (error) {
      this.fail(`Model "${this.model.id}" threw: ${describeError(error)}`);
      return;
    }
    if (!(advanced >= 0 && advanced <= dt + EPS)) {
      this.fail(`Model "${this.model.id}" returned an invalid step of ${advanced} s`);
      return;
    }
    this.time += advanced;
    for (let i = 0; i < this.state.length; i++) {
      if (!Number.isFinite(this.state[i])) {
        const name = this.model.variables[i] ?? `#${i}`;
        this.fail(`Non-finite value for "${name}" at t = ${this.time.toFixed(4)} s`);
        return;
      }
    }
    this.trackExtremes();

    const modelDone = this.model.isComplete?.(this.state, this.inputs) ?? false;
    const timeUp = this.time >= maxDuration - EPS;
    if (advanced === 0 && !modelDone && !timeUp) {
      this.fail(`Model "${this.model.id}" made no progress at t = ${this.time} s`);
      return;
    }
    if (modelDone || timeUp || this.time >= this.nextSampleTime - EPS) {
      this.recordSample();
      while (this.nextSampleTime <= this.time + EPS) this.nextSampleTime += sampleInterval;
    }
    if (modelDone || timeUp) this.complete(modelDone ? 'model' : 'time-limit');
  }

  private complete(reason: ExperimentEndReason): void {
    const results: Record<string, number> = {};
    this.definition.results.forEach((r, i) => {
      results[r.id] =
        r.reduce === 'final' ? this.read(this.resultSlots[i] ?? TIME) : (this.extremes[i] ?? NaN);
    });
    this.finalResults = results;
    this.endReason = reason;
    this.status = 'completed';
  }

  private fail(message: string): void {
    this.error = message;
    this.status = 'failed';
  }

  private trackExtremes(): void {
    this.definition.results.forEach((r, i) => {
      if (r.reduce === 'final') return;
      const value = this.read(this.resultSlots[i] ?? TIME);
      const current = this.extremes[i] ?? value;
      if (r.reduce === 'min' ? value < current : value > current) this.extremes[i] = value;
    });
  }

  private recordSample(): void {
    if (this.samples >= this.sampleTimes.length) {
      if (!this.drive) return;
      this.halveSamples();
    }
    this.sampleTimes[this.samples] = this.time;
    this.measurementSlots.forEach((slot, i) => {
      const series = this.sampleValues[i];
      if (series) series[this.samples] = this.read(slot);
    });
    this.samples++;
  }

  /**
   * A driven run has no time limit, so its buffer can fill: it keeps every other sample (the
   * first among them) and samples half as often from then on — the whole run at a coarser
   * spacing, in place. Recorded values are kept as they are, never averaged.
   */
  private halveSamples(): void {
    const kept = Math.ceil(this.samples / 2);
    for (let i = 1; i < kept; i++) {
      this.sampleTimes[i] = this.sampleTimes[2 * i] ?? NaN;
      for (const series of this.sampleValues) series[i] = series[2 * i] ?? NaN;
    }
    this.samples = kept;
    this.interval *= 2;
  }

  // A getter, so the loop re-reads status after each step (stepOnce may end the run).
  private get isRunning(): boolean {
    return this.status === 'running';
  }

  private read(slot: number): number {
    if (slot === TIME) return this.time;
    return slot >= 0 ? (this.state[slot] ?? NaN) : NaN;
  }

  private transition(from: RunStatus, to: RunStatus): boolean {
    if (this.status !== from) return false;
    this.status = to;
    return true;
  }
}

function resolveInputs(
  definition: ExperimentDefinition,
  overrides: Readonly<Record<string, number>>,
): Record<string, number> {
  const inputs: Record<string, number> = { ...definition.initialConditions };
  for (const p of definition.parameters) inputs[p.id] = p.default;
  for (const [id, value] of Object.entries(overrides)) {
    const p = definition.parameters.find((param) => param.id === id);
    if (!p) {
      // An apparatus may supply an initial condition (e.g. the launch height it is built with).
      if (!(id in definition.initialConditions)) {
        throw new Error(`Experiment "${definition.id}" has no parameter "${id}"`);
      }
      if (!Number.isFinite(value)) throw new Error(`Initial condition "${id}" is not finite`);
      inputs[id] = value;
      continue;
    }
    if (!Number.isFinite(value) || value < p.min || value > p.max) {
      throw new Error(`Parameter "${id}" must be within ${p.min}–${p.max} ${p.unit}, got ${value}`);
    }
    inputs[id] = value;
  }
  return inputs;
}
