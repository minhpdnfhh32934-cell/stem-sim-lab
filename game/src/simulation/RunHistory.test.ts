import { describe, expect, it } from 'vitest';
import { bundledContent } from '../content';
import { type ExperimentDefinition, ExperimentDefinitionSchema } from './experiment';
import { ExperimentSession, RUN_HISTORY_LIMIT } from './ExperimentSession';
import { pendulumModel } from './models/pendulum';
import { projectileModel } from './models/projectile';
import type { RunRecord } from './RunRecord';
import type { SimulationModel } from './SimulationModel';

const parse = (id: string): ExperimentDefinition =>
  ExperimentDefinitionSchema.parse(
    (bundledContent.experiments as { id: string }[]).find((e) => e.id === id),
  );
const projectile = parse('projectile-motion');
const pendulum = parse('pendulum');
const LAUNCH = { height: 0.59 };

const station = (model: SimulationModel = projectileModel, definition = projectile) => {
  const s = new ExperimentSession('station', definition, model);
  s.setReady(true);
  return s;
};
/** Advances a running session until its run ends (real-time frames). */
const finish = (s: ExperimentSession, dt = 1 / 60) => {
  for (let i = 0; s.state === 'running' && i < 100_000; i++) s.advance(dt);
};

/** Everything a record holds, copied out, to compare with later. */
const contents = (r: RunRecord) => ({
  status: r.status,
  time: r.time,
  inputs: { ...r.inputs },
  results: r.results && { ...r.results },
  theory: { ...r.theory() },
  times: Array.from(r.sampleTimes),
  values: r.sampleValues.map((v) => Array.from(v)),
});

/** Bytes of sample memory a history keeps alive (whole buffers, not just the views on them). */
const bytes = (history: readonly RunRecord[]) =>
  history.reduce(
    (sum, r) =>
      sum +
      r.sampleTimes.buffer.byteLength +
      r.sampleValues.reduce((s, v) => s + v.buffer.byteLength, 0),
    0,
  );

describe('run history', () => {
  it('records a completed run once, frozen, with its own copies of everything', () => {
    const s = station();
    s.start(LAUNCH);
    s.advance(0.2);
    expect(s.history).toEqual([]); // still running: not history yet
    finish(s);
    expect(s.history).toHaveLength(1);
    const run = s.run!;
    const r = s.history[0]!;
    expect(r).toMatchObject({
      runId: 'station#1',
      sessionId: 'station',
      sequence: 1,
      status: 'completed',
      endReason: 'model',
      time: run.time,
      sampleCount: run.sampleCount,
    });
    expect(r.definition).toBe(projectile);
    expect(r.inputs).toEqual(run.inputs);
    expect(r.results).toEqual(run.results);
    expect(r.theory()).toEqual(run.theory());
    // Copies of exactly the recorded samples, not the run's buffers (sized for the longest run).
    expect(r.sampleTimes).not.toBe(run.sampleTimes);
    expect(r.sampleTimes.length).toBe(run.sampleCount);
    expect(run.sampleTimes.length).toBeGreaterThan(run.sampleCount);
    expect(Array.from(r.sampleTimes)).toEqual(
      Array.from(run.sampleTimes.subarray(0, run.sampleCount)),
    );
    r.sampleValues.forEach((values, i) => {
      const live = run.sampleValues[i]!;
      expect(values).not.toBe(live);
      expect(Array.from(values)).toEqual(Array.from(live.subarray(0, run.sampleCount)));
    });
    // Its own memory, sized to the samples: a write to the run's buffers cannot reach it.
    for (const [own, live] of [
      [r.sampleTimes, run.sampleTimes],
      [r.sampleValues[0]!, run.sampleValues[0]!],
    ] as const) {
      expect(own.buffer).not.toBe(live.buffer);
      expect(own.buffer.byteLength).toBe(run.sampleCount * 8);
      const kept = own[1];
      live[1] = -1;
      expect(own[1]).toBe(kept);
    }
    // Frozen: nothing in it can be reassigned (ES modules are strict, so writes throw).
    for (const part of [r, r.inputs, r.results, r.theory(), r.sampleValues]) {
      expect(Object.isFrozen(part)).toBe(true);
    }
    expect(() => ((r.inputs as Record<string, number>).velocity = 1)).toThrow(TypeError);
    expect(() => ((r.theory() as Record<string, number>).range = 1)).toThrow(TypeError);
    expect(() => ((r as { status: string }).status = 'stopped')).toThrow(TypeError);
    expect(() => ((r as { sampleTimes: Float64Array }).sampleTimes = new Float64Array())).toThrow(
      TypeError,
    );
    s.advance(1); // more frames after the end, then a reset: still one record
    s.reset();
    expect(s.history).toHaveLength(1);
  });

  it('keeps a stopped run as incomplete: the samples so far, no results claimed', () => {
    const s = station();
    s.start(LAUNCH);
    s.advance(0.3);
    expect(s.stop()).toBe(true);
    const run = s.run!;
    expect(s.history).toHaveLength(1);
    const r = s.history[0]!;
    expect(r.status).toBe('stopped');
    expect(r.results).toBeNull();
    expect(r.time).toBe(run.time);
    expect(r.sampleCount).toBe(run.sampleCount);
    expect(r.sampleCount).toBeGreaterThan(20);
    expect(r.theory()).toEqual(run.theory()); // what the run was set up to show
    s.reset();
    expect(s.history).toHaveLength(1);
  });

  it('records a run that RESET cuts short, as stopped', () => {
    const s = station();
    s.start(LAUNCH);
    s.advance(0.25);
    expect(s.reset()).toBe(true);
    expect(s.run).toBeNull();
    expect(s.history.map((r) => [r.sequence, r.status])).toEqual([[1, 'stopped']]);
  });

  it('records a failed run with its error, never as a result', () => {
    let calls = 0;
    const failing: SimulationModel = {
      ...projectileModel,
      step(state, dt, inputs) {
        if (++calls > 50) throw new Error('integrator broke');
        return projectileModel.step(state, dt, inputs);
      },
    };
    const s = station(failing);
    s.start(LAUNCH);
    s.advance(0.1);
    expect(s.state).toBe('stopped');
    const r = s.history[0]!;
    expect(r.status).toBe('failed');
    expect(r.status === 'failed' && r.error).toContain('integrator broke');
    expect(r.results).toBeNull();
  });

  it('keeps the history through RESET: only the current run is cleared', () => {
    const s = station();
    s.start(LAUNCH);
    finish(s);
    s.reset();
    s.setParameter('angle', 30);
    s.start(LAUNCH);
    finish(s);
    expect(s.history.map((r) => r.runId)).toEqual(['station#1', 'station#2']);
    expect(s.history.at(-1)?.runId).toBe(s.run?.runId); // the current run, once ended
    expect(s.reset()).toBe(true);
    expect(s.run).toBeNull();
    expect(s.state).toBe('configured');
    expect(s.history.map((r) => r.runId)).toEqual(['station#1', 'station#2']);
  });

  it('never changes a recorded run: not the dials, a new run, nor its theory', () => {
    const s = station();
    s.start(LAUNCH);
    finish(s);
    const first = s.history[0]!;
    const before = contents(first);
    s.reset();
    s.setParameter('velocity', 12);
    s.setParameter('angle', 30);
    s.setParameter('gravity', 3.71);
    s.start(LAUNCH);
    s.advance(0.5);
    finish(s);
    expect(s.history).toHaveLength(2);
    expect(contents(first)).toEqual(before);
    // Its theory is for its own settings (8 m/s, 45°, Earth), not the dials now.
    expect(first.theory()).toEqual(projectileModel.predict!(first.inputs));
    expect(first.theory()?.range).not.toBeCloseTo(s.predict(LAUNCH)?.range ?? NaN, 3);
    expect(first.inputs).toMatchObject({ velocity: 8, angle: 45, gravity: 9.81 });
    expect(s.history[1]?.inputs).toMatchObject({ velocity: 12, angle: 30, gravity: 3.71 });
  });

  it(`keeps the last ${RUN_HISTORY_LIMIT} runs: the oldest goes first, never the current`, () => {
    expect(RUN_HISTORY_LIMIT).toBe(20);
    const s = station();
    for (let n = 1; n <= 25; n++) {
      if (n > 1) s.reset();
      s.start(LAUNCH);
      finish(s, 0.1);
      expect(s.history.length).toBe(Math.min(n, RUN_HISTORY_LIMIT));
    }
    expect(s.history.map((r) => r.sequence)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 6), // #6 … #25: #1 … #5 went, oldest first
    );
    expect(s.history.at(-1)?.runId).toBe(s.run?.runId); // the current run is kept
  });

  it('bounds memory: compact copies, under 4 MB for 20 of the longest pendulum runs', () => {
    const longest = station(pendulumModel, pendulum);
    longest.setParameter('length', 3);
    longest.setParameter('angle', 60);
    longest.setParameter('gravity', 1.62);
    const typical = station(pendulumModel, pendulum);
    typical.setParameter('angle', 30);
    for (const s of [longest, typical]) {
      for (let n = 1; n <= RUN_HISTORY_LIMIT + 1; n++) {
        if (n > 1) s.reset();
        s.start({ mass: 0.5 });
        finish(s, 0.1);
      }
      expect(s.history).toHaveLength(RUN_HISTORY_LIMIT);
      const columns = pendulum.measurements.length + 1; // and time
      const samples = s.history.reduce((sum, r) => sum + r.sampleCount, 0);
      expect(bytes(s.history)).toBe(samples * columns * 8); // nothing beyond the recorded samples
    }
    // 3 m on the Moon at 60°: three periods of 9.18 s, 2754 samples each.
    expect(longest.history[0]?.sampleCount).toBe(2754);
    expect(bytes(longest.history)).toBeLessThan(4_000_000);
    expect(bytes(typical.history)).toBeLessThan(1_000_000); // 1 m at 30°: 614 samples a run
  });
});
