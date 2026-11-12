import { describe, expect, it } from 'vitest';
import { PendulumEngine } from './pendulum/engine';
import { TrackEngine } from './track/engine';
import { energyDrift } from './endlessRk4';

/**
 * #205 C1, the slow half (the user's choice A, 2026-11-12): the two RK4 lessons run for real to
 * t = 10⁵ s (2.4·10⁷ steps of 8 RK4 substeps each: minutes). Not part of `npm run check` or CI:
 * run `npm run test:slow` before every release (docs/RELEASE.md). The 10⁴ s run is in
 * endless.test.ts.
 */
const SLOW = import.meta.env.MODE === 'slow';

describe.runIf(SLOW)('RK4 lessons at t = 10⁵ s (#205 C1, slow)', { timeout: 30 * 60_000 }, () => {
  it('large-angle pendulum: energy holds', () => {
    const drift = energyDrift(new PendulumEngine(), { theta0: 2.5, c: 0 }, 1e5);
    expect(drift, `pendulum θ₀ = 2.5 rad, 10⁵ s: drift ${drift.toExponential(2)}`).toBeLessThan(
      1e-8,
    );
  });

  it('bead on the track: energy holds, still on the track', () => {
    const drift = energyDrift(new TrackEngine(), {}, 1e5);
    expect(drift, `track, 10⁵ s: drift ${drift.toExponential(2)}`).toBeLessThan(1e-8);
  });
});
