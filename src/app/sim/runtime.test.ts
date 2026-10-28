import { afterEach, describe, expect, it } from 'vitest';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { sim } from './runtime';
import { useSimStore } from './simStore';

/** Plays the open simulation for about `seconds` of simulated time (speed 1). */
function play(seconds: number): void {
  useWorkspaceStore.setState({ speed: 1 });
  if (!useWorkspaceStore.getState().playing) sim.togglePlay();
  for (let i = 0; i < Math.ceil(seconds * 60); i++) sim.tick(1 / 60);
}

afterEach(() => {
  sim.shutdown();
});

describe('changing g during a run', () => {
  it('restarts engines that cannot apply g live (pendulum), so the run never keeps the old g', async () => {
    await sim.open('simplePendulum', { params: { theta0: 0.1 } });
    play(1.2);
    expect(sim.latest?.t ?? 0).toBeGreaterThan(1);
    sim.setParam('g', 25);
    expect(useSimStore.getState().params.g).toBe(25);
    // A reset: back to t = 0 and paused, instead of silently running on with g = 9.81.
    expect(sim.latest?.t).toBe(0);
    expect(useWorkspaceStore.getState().playing).toBe(false);
  });

  it.each(['springPendulum', 'inclinedPlane', 'pulley', 'energyConservation'])(
    '%s has no live g',
    async (topic) => {
      await sim.open(topic);
      expect(useSimStore.getState().scene?.params.find((d) => d.key === 'g')?.live).toBeFalsy();
    },
  );

  it('applies g live to a projectile and marks the run as intervened', async () => {
    await sim.open('obliqueProjectile');
    play(0.5);
    const t = sim.latest?.t ?? 0;
    expect(t).toBeGreaterThan(0.4);
    sim.setParam('g', 20);
    play(0.2);
    expect(sim.latest?.t ?? 0).toBeGreaterThan(t);
    expect(useSimStore.getState().intervened).toBe(true);
  });
});

describe('history spacing follows the speed a frame really ran at (UI-22)', () => {
  /** Steps a paused run `n` times (one 1/240 s engine step each), whatever speed is chosen. */
  async function stepRows(speed: number, n: number): Promise<number> {
    await sim.open('springPendulum');
    useWorkspaceStore.setState({ speed: speed as never, playing: false });
    for (let i = 0; i < n; i++) {
      sim.step();
      sim.tick(1 / 60);
    }
    return sim.history.length;
  }

  it('Step records the same rows at ×4 and ×100 as at ×1', async () => {
    const one = await stepRows(1, 25);
    sim.shutdown();
    const four = await stepRows(4, 25);
    sim.shutdown();
    const hundred = await stepRows(100, 25);
    expect(one).toBeGreaterThanOrEqual(12);
    expect(four).toBe(one);
    expect(hundred).toBe(one);
  });

  it('a throttled frame records at the speed reached, not the one chosen', async () => {
    // ×1000 is capped by the substep limit (about ×128 here), well before the 60 s run ends.
    await sim.open('springPendulum');
    useWorkspaceStore.setState({ speed: 1000 as never });
    if (!useWorkspaceStore.getState().playing) sim.togglePlay();
    let reached = 0;
    for (let i = 0; i < 12; i++) {
      sim.tick(1 / 60);
      reached = Math.max(reached, sim.latest?.stats.effectiveSpeed ?? 0);
    }
    const t = sim.latest?.t ?? 0;
    expect(reached).toBeGreaterThan(0);
    expect(reached).toBeLessThan(1000);
    // Each throttled frame advances ~2 s, more than the 1/120 s × reached spacing: every frame
    // is a row (13 = start + 12). Spaced for the chosen ×1000 (8,3 s) only ~1 in 4 would be.
    expect(sim.history.length).toBeGreaterThanOrEqual(12);
    expect(sim.history.length).toBeGreaterThan(t / (1000 / 120) + 1);
  });
});
