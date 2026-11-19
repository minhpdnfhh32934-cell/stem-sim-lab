import { describe, expect, it } from 'vitest';
import { IGNITE, Plan, STUNT, TAU_START } from './plan';

describe('the rocket opening’s script', () => {
  const plan = new Plan();

  it('runs the rocket’s clock forward only, from its start to Khoa’s moments', () => {
    expect(plan.tauAt(0)).toBeCloseTo(TAU_START, 9);
    let last = -Infinity;
    for (let t = 0; t < plan.end; t += 0.01) {
      const tau = plan.tauAt(t);
      expect(tau).toBeGreaterThanOrEqual(last);
      last = tau;
    }
    expect(plan.tauAt(plan.release)).toBeCloseTo(STUNT.release, 2);
    expect(plan.tauAt(plan.land)).toBeCloseTo(STUNT.land, 2);
    expect(plan.tauAt(plan.standing)).toBeCloseTo(STUNT.standing, 2);
    expect(plan.timeOf(plan.tauAt(12.3))).toBeCloseTo(12.3, 2);
  });

  it('slows time nearly to a stop for the notes, just after the engines light', () => {
    expect(plan.timeOf(IGNITE)).toBeLessThan(4.05);
    for (const [which, from, to] of plan.notes) {
      if (which === 'bio') continue;
      expect(plan.at(from).scale).toBeLessThan(0.05);
      expect(plan.at(to - 0.01).scale).toBeLessThan(0.05);
    }
    // Real speed as he comes down; the impact held a moment; real speed again after.
    expect(plan.at(plan.timeOf(STUNT.land - 0.05)).scale).toBeCloseTo(1, 6);
    expect(plan.at(plan.timeOf(STUNT.land + 0.08)).scale).toBeLessThan(0.25);
    expect(plan.at(plan.timeOf(STUNT.land + 0.6)).scale).toBeCloseTo(1, 6);
  });

  it('cuts from shot to shot in order, each note inside its own shot', () => {
    const starts = plan.shots.map(([, t]) => t);
    starts.forEach((t, i) => i > 0 && expect(t).toBeGreaterThan(starts[i - 1]!));
    expect(plan.end).toBeGreaterThan(plan.standing);
    for (const [which, from, to] of plan.notes) {
      const shot = which === 'bio' ? 'cabin' : which;
      expect(plan.at(from).shot).toBe(shot);
      expect(plan.at(to - 0.01).shot).toBe(shot);
      expect(plan.at(from + 0.1).notes).toBe(which);
    }
    // The door opens while the camera is in the cabin; he lets go in the hanging shot.
    expect(plan.at(plan.timeOf(STUNT.doorFrom)).shot).toBe('cabin');
    expect(plan.at(plan.release - 0.01).shot).toBe('hang');
    expect(plan.at(plan.land).shot).toBe('land');
  });
});
