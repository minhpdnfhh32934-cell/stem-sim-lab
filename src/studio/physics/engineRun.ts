import '@/workers/engines';
import { createEngine } from '@/core/sim/engine';
import type { Params } from '@/physics/types';

/** States recorded from one headless run of a registered simulation engine. */
export interface EngineTrace {
  times: number[];
  states: Float64Array[];
  /** True when the engine reported `finished()` before `tMax`. */
  finished: boolean;
  endTime: number;
}

export interface RunOptions {
  /** Longest simulated time in seconds. */
  tMax: number;
  /** Sampling interval in seconds, rounded to whole engine steps (the final state is always kept). */
  sampleDt: number;
}

/**
 * Runs the same engine the lab runs, on the main thread and without rendering. The engine's own
 * fixed step and end condition are used unchanged, so its numbers are the lab's numbers.
 */
export async function runEngine(
  engineId: string,
  engineParams: Params,
  opts: RunOptions,
): Promise<EngineTrace> {
  const engine = await createEngine(engineId);
  engine.reset(engineParams);
  const buf = new Float64Array(engine.stateSize);
  const times: number[] = [];
  const states: Float64Array[] = [];
  const record = () => {
    engine.readState(buf);
    times.push(engine.time());
    states.push(buf.slice());
  };
  record();
  const maxSteps = Math.ceil(opts.tMax / engine.dt);
  const every = Math.max(1, Math.round(opts.sampleDt / engine.dt));
  let finished = engine.finished?.() ?? false;
  for (let i = 1; i <= maxSteps && !finished; i++) {
    engine.step();
    finished = engine.finished?.() ?? false;
    if (finished || i % every === 0) record();
  }
  if (times[times.length - 1] !== engine.time()) record();
  return { times, states, finished, endTime: engine.time() };
}
