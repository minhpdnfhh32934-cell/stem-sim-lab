import { describe, expect, it } from 'vitest';
import { stillRun } from './stillRun';

describe('a still of a topic at its defaults (docs/BENCH_DESIGN.md §9.1, §9.3)', () => {
  it('keeps the states its own engine computed, up to mid-flight, once per topic', async () => {
    const run = await stillRun('obliqueProjectile');
    expect(run?.scene.id).toBe('obliqueProjectile');
    const states = run?.states ?? [];
    expect(states.length).toBeGreaterThan(10);
    expect(states.length).toBeLessThanOrEqual(301);
    expect(states.every((s) => s.every(Number.isFinite))).toBe(true);
    // Mid-flight: the ball is above the ground, not back on it.
    const y = run?.scene.trail?.(states.at(-1) ?? Float64Array.of(), run.scene.defaults)[0]?.y;
    expect(y).toBeGreaterThan(0);
    expect(stillRun('obliqueProjectile')).toBe(stillRun('obliqueProjectile'));
  });

  it('a topic without a scene gives no picture', async () => {
    expect(await stillRun('noSuchTopic')).toBeNull();
  });
});
