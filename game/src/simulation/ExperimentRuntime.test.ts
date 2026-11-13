import { describe, expect, it } from 'vitest';
import { bundledContent } from '../content';
import { type ExperimentDefinition, ExperimentDefinitionSchema } from './experiment';
import { checkExperimentAgainstModel, ExperimentRuntime } from './ExperimentRuntime';
import { freeFallModel } from './models/freeFall';
import type { SimulationModel } from './SimulationModel';

const shipped = ExperimentDefinitionSchema.parse((bundledContent.experiments as unknown[])[0]);
/** The shipped free-fall definition with h opened to 0.1–100 m: these test the runtime, not the tower. */
const freeFall = (patch: Partial<ExperimentDefinition> = {}): ExperimentDefinition => ({
  ...shipped,
  parameters: shipped.parameters.map((p) => (p.id === 'height' ? { ...p, min: 0.1, max: 100 } : p)),
  ...patch,
});

const fallTime = (h: number, g: number, v0 = 0) => (v0 + Math.sqrt(v0 * v0 + 2 * g * h)) / g;

describe('ExperimentRuntime with the free-fall model', () => {
  it('matches the analytic fall time and impact velocity', () => {
    const run = new ExperimentRuntime('r', freeFall(), freeFallModel, {
      height: 10,
      gravity: 9.81,
    });
    run.runToCompletion();
    expect(run.status).toBe('completed');
    expect(run.endReason).toBe('model');
    const t = fallTime(10, 9.81);
    expect(run.results?.['fall-time']).toBeCloseTo(t, 12);
    expect(run.results?.['impact-velocity']).toBeCloseTo(-Math.sqrt(2 * 9.81 * 10), 10);
  });

  it('gives the same result when advanced in real-time frames', () => {
    const instant = new ExperimentRuntime('a', freeFall(), freeFallModel);
    instant.runToCompletion();
    const framed = new ExperimentRuntime('b', freeFall(), freeFallModel);
    framed.start();
    for (let i = 0; i < 120 && framed.status === 'running'; i++) framed.advance(1 / 60);
    expect(framed.status).toBe('completed');
    expect(framed.results).toEqual(instant.results);
  });

  it('records samples from t = 0 to landing at the sample interval', () => {
    const run = new ExperimentRuntime('r', freeFall(), freeFallModel, { height: 1.5 });
    run.runToCompletion();
    const n = run.sampleCount;
    const t = fallTime(1.5, 9.81);
    expect(n).toBe(Math.floor(t / 0.01) + 2); // every 10 ms, plus the landing sample
    expect(run.sampleTimes[0]).toBe(0);
    expect(run.sampleValues[0]?.[0]).toBe(1.5);
    expect(run.sampleTimes[1]).toBeCloseTo(0.01, 9);
    expect(run.sampleTimes[n - 1]).toBeCloseTo(t, 12);
    expect(run.sampleValues[0]?.[n - 1]).toBe(0);
  });

  it('tracks a max result between samples (upward throw)', () => {
    const def = freeFall({
      parameters: [],
      initialConditions: { height: 2, gravity: 9.81, initialVelocity: 5 },
      results: [{ id: 'apex', label: 'Apex', unit: 'm', variable: 'y', reduce: 'max' }],
    });
    const run = new ExperimentRuntime('r', def, freeFallModel);
    run.runToCompletion();
    expect(run.results?.apex).toBeCloseTo(2 + 25 / (2 * 9.81), 5);
    expect(run.time).toBeCloseTo(fallTime(2, 9.81, 5), 12);
  });

  it('ends with time-limit when maxDuration cuts the run short', () => {
    const def = freeFall({ simulation: { timeStep: 0.001, maxDuration: 1, sampleInterval: 0.01 } });
    const run = new ExperimentRuntime('r', def, freeFallModel, { height: 100 });
    run.runToCompletion();
    expect(run.status).toBe('completed');
    expect(run.endReason).toBe('time-limit');
    expect(run.time).toBeCloseTo(1, 9);
  });

  it('follows the lifecycle: ready → running ⇄ paused → stopped, and reset', () => {
    const run = new ExperimentRuntime('r', freeFall(), freeFallModel);
    expect(run.status).toBe('ready');
    expect(run.pause()).toBe(false);
    expect(run.start()).toBe(true);
    run.advance(0.1);
    expect(run.pause()).toBe(true);
    const t = run.time;
    run.advance(0.1);
    expect(run.time).toBe(t);
    expect(run.resume()).toBe(true);
    expect(run.stop()).toBe(true);
    expect(run.start()).toBe(false);
    run.reset();
    expect(run.status).toBe('ready');
    expect(run.time).toBe(0);
    expect(run.sampleCount).toBe(1);
    expect(run.results).toBeNull();
  });

  it('rejects unknown or out-of-range parameters', () => {
    expect(() => new ExperimentRuntime('r', freeFall(), freeFallModel, { mass: 1 })).toThrow(
      'has no parameter "mass"',
    );
    expect(() => new ExperimentRuntime('r', freeFall(), freeFallModel, { height: 500 })).toThrow(
      /must be within 0\.1–100 m/,
    );
    expect(() => new ExperimentRuntime('r', freeFall(), freeFallModel, { height: NaN })).toThrow();
  });

  it('reports definitions that do not fit the model', () => {
    const def = freeFall({
      initialConditions: {},
      measurements: [{ id: 'x', label: 'x', unit: 'm', variable: 'x' }],
    });
    expect(checkExperimentAgainstModel(def, freeFallModel)).toEqual([
      'model input "initialVelocity" is not provided',
      '"x" reads unknown model variable "x"',
    ]);
    expect(() => new ExperimentRuntime('r', def, freeFallModel)).toThrow(/initialVelocity/);
  });
});

describe('ExperimentRuntime failure handling', () => {
  const model = (step: SimulationModel['step']): SimulationModel => ({
    ...freeFallModel,
    id: 'test.broken',
    step,
    isComplete: () => false,
  });

  it('fails instead of reporting a non-finite state', () => {
    const run = new ExperimentRuntime(
      'r',
      freeFall(),
      model((s, dt) => ((s[0] = NaN), dt)),
    );
    run.runToCompletion();
    expect(run.status).toBe('failed');
    expect(run.error).toMatch(/Non-finite value for "y"/);
    expect(run.results).toBeNull();
  });

  it('fails when the model throws or stalls', () => {
    const throwing = new ExperimentRuntime(
      'r',
      freeFall(),
      model(() => {
        throw new Error('singular matrix');
      }),
    );
    throwing.runToCompletion();
    expect(throwing.error).toBe('Model "test.broken" threw: singular matrix');

    const stalled = new ExperimentRuntime(
      'r',
      freeFall(),
      model(() => 0),
    );
    stalled.runToCompletion();
    expect(stalled.error).toMatch(/made no progress/);
  });
});
