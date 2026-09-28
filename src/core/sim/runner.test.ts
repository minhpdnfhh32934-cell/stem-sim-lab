import { describe, expect, it } from 'vitest';
import { FixedStepClock } from './clock';
import { OscillatorEngine } from './demoEngine';
import type { SimulationEngine } from './engine';
import { EngineRunner, isRunnerError } from './runner';

describe('FixedStepClock', () => {
  it('produces whole steps and an interpolation factor', () => {
    const c = new FixedStepClock(0.01);
    const a = c.advance(0.025);
    expect(a.steps).toBe(2);
    expect(a.alpha).toBeCloseTo(0.5, 9);
    expect(c.advance(0.005).steps).toBe(1);
  });

  it('applies playback speed', () => {
    const c = new FixedStepClock(0.01);
    expect(c.advance(0.1, 0.1).steps).toBe(1);
    expect(c.advance(0.1, 4).steps).toBe(32);
  });

  it('caps substeps and reports dropped time (no spiral of death)', () => {
    const c = new FixedStepClock(0.001, 10);
    const a = c.advance(0.1);
    expect(a.steps).toBe(10);
    expect(a.dropped).toBeCloseTo(0.09, 9);
  });
});

describe('EngineRunner', () => {
  const params = { mass: 2, k: 8, x0: 0.1, v0: 0 };

  it('runs the oscillator and matches x(t) = x0 cos(ωt)', () => {
    const runner = new EngineRunner(new OscillatorEngine(params), 1000);
    let frame;
    for (let i = 0; i < 120; i++) frame = runner.frame(1 / 60, 1);
    if (!frame || isRunnerError(frame)) throw new Error('unexpected');
    const omega = Math.sqrt(params.k / params.mass);
    expect(frame.t).toBeCloseTo(2, 9);
    expect(frame.curr[0]).toBeCloseTo(0.1 * Math.cos(omega * frame.t), 5);
    expect(frame.stats.maxRelDrift).toBeLessThan(1e-4);
    expect(frame.stats.intervened).toBe(false);
  });

  it('recovers from NaN by restoring the last valid state', () => {
    const engine = new OscillatorEngine(params);
    const runner = new EngineRunner(engine, 1000);
    runner.frame(0.1, 1);
    const good = (runner.frame(0, 1) as { curr: Float64Array }).curr[0];
    // Sabotage: next step produces NaN.
    const original = engine.step.bind(engine);
    engine.step = () => {
      original();
      engine.writeState(Float64Array.from([Number.NaN, 0]), engine.time());
    };
    const out = runner.frame(0.1, 1);
    expect(isRunnerError(out) && out.code).toBe('nonFinite');
    const s = new Float64Array(2);
    engine.readState(s);
    expect(s[0]).toBe(good);
  });

  it('pauses without advancing time', () => {
    const runner = new EngineRunner(new OscillatorEngine(params));
    const f = runner.frame(0.5, 1, true);
    expect(!isRunnerError(f) && f.t).toBe(0);
  });

  it('slows down honestly when the frame budget is exceeded', () => {
    const slow: SimulationEngine = Object.assign(new OscillatorEngine(params), {
      step(this: OscillatorEngine) {
        const end = performance.now() + 2;
        while (performance.now() < end) {
          /* busy */
        }
        OscillatorEngine.prototype.step.call(this);
      },
    });
    const runner = new EngineRunner(slow, 5);
    const f = runner.frame(0.1, 1);
    if (isRunnerError(f)) throw new Error('unexpected');
    expect(f.stats.throttled).toBe(true);
    expect(f.stats.effectiveSpeed).toBeLessThan(1);
  });

  it('marks user intervention and drops the energy reference', () => {
    const engine: SimulationEngine = new OscillatorEngine(params);
    engine.input = () => true;
    const runner = new EngineRunner(engine);
    runner.input({ kind: 'dragEnd' });
    const f = runner.frame(0.05, 1);
    expect(!isRunnerError(f) && f.stats.intervened).toBe(true);
  });
});
