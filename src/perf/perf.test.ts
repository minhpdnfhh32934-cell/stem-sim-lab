import { describe, expect, it } from 'vitest';
import { classify, cpuProbe } from './benchmark';
import { FrameMonitor } from './frameMonitor';
import { effectiveTier } from './perfStore';
import { TIERS, lowerTier } from './tiers';

describe('quality tiers', () => {
  it('tiers only get richer from low to high', () => {
    expect(TIERS.low.pixelRatioCap).toBeLessThan(TIERS.high.pixelRatioCap);
    expect(TIERS.low.maxParticles).toBeLessThan(TIERS.medium.maxParticles);
    expect(lowerTier('high')).toBe('medium');
    expect(lowerTier('low')).toBe('low');
  });

  it('classifies weak and strong machines', () => {
    expect(classify(2, 30, true, 4)).toBe('low');
    expect(classify(20, 300, false, 8)).toBe('low'); // no WebGL2 → low
    expect(classify(8, 100, true, 4)).toBe('medium');
    expect(classify(20, 300, true, 8)).toBe('high');
  });

  it('user preference overrides the benchmark', () => {
    expect(effectiveTier({ preference: 'auto', benchmark: null })).toBe('medium');
    expect(effectiveTier({ preference: 'low', benchmark: null })).toBe('low');
  });

  it('cpu probe returns a positive score within its budget', () => {
    const t0 = performance.now();
    expect(cpuProbe(30)).toBeGreaterThan(0);
    expect(performance.now() - t0).toBeLessThan(500);
  });
});

describe('FrameMonitor', () => {
  it('computes fps and detects sustained overload only', () => {
    const m = new FrameMonitor(1 / 60, 5);
    for (let i = 0; i < 100; i++) m.record(1 / 60);
    expect(m.fps).toBeCloseTo(60, 0);
    expect(m.overloaded).toBe(false);
    for (let i = 0; i < 4; i++) m.record(1 / 20);
    expect(m.overloaded).toBe(false);
    m.record(1 / 20);
    expect(m.overloaded).toBe(true);
    m.record(1 / 60);
    expect(m.overloaded).toBe(false);
  });
});
