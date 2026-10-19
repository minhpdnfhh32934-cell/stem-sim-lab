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
