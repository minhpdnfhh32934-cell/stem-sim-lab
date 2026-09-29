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

  it('degradation lowers the drawing tier by one step, never below low', () => {
    expect(effectiveTier({ preference: 'high', benchmark: null, degraded: true })).toBe('medium');
    expect(effectiveTier({ preference: 'low', benchmark: null, degraded: true })).toBe('low');
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

describe('memory watchdog', () => {
  it('fires once when crossing the threshold and re-arms after recovering', async () => {
    const { MemoryWatchdog, thresholdMB, RAM_BUDGET_MB } = await import('./memory');
    const dog = new MemoryWatchdog();
    const at = (usedMB: number) => dog.check({ usedMB, limitMB: null });
    const limit = thresholdMB({ usedMB: 0, limitMB: null });
    expect(limit).toBeLessThan(RAM_BUDGET_MB);
    expect(at(limit - 1)).toBe('ok');
    expect(at(limit + 1)).toBe('high');
    expect(at(limit + 5)).toBe('ok'); // no repeated warnings
    expect(at(limit * 0.9)).toBe('ok'); // not yet recovered
    expect(at(limit * 0.5)).toBe('ok'); // re-armed
    expect(at(limit + 1)).toBe('high');
  });

  it('uses the heap limit when it is lower than the budget', async () => {
    const { thresholdMB } = await import('./memory');
    expect(thresholdMB({ usedMB: 0, limitMB: 100 })).toBeCloseTo(80);
  });

  it('releases registered caches', async () => {
    const { registerCacheRelease, releaseCaches } = await import('./memory');
    let freed = 0;
    const off = registerCacheRelease(() => {
      freed++;
    });
    expect(releaseCaches()).toBeGreaterThanOrEqual(1);
    expect(freed).toBe(1);
    off();
    releaseCaches();
    expect(freed).toBe(1);
  });
});
