import { describe, expect, it } from 'vitest';
import { EngineRunner } from '@/core/sim/runner';
import { distance, meetingTime, stateAt, stopTime } from './analytic';
import { LS, LinearEngine } from './engine';
import { numericPosition, uniformAcceleration, uniformMotion } from './scenes';

describe('1D kinematics — closed form', () => {
  it('two cars 100 m apart at 10 m/s and −15 m/s meet after 4 s at x = 40 m', () => {
    const a = { x0: 0, v0: 10, a: 0, stopAtRest: false };
    const b = { x0: 100, v0: -15, a: 0, stopAtRest: false };
    const t = meetingTime(a, b, 10)!;
    expect(t).toBeCloseTo(4, 12);
    expect(stateAt(a, t).x).toBeCloseTo(40, 11);
  });

  it('braking from 20 m/s at −2 m/s²: stops at t = 10 s after 100 m, then stays', () => {
    const m = { x0: 0, v0: 20, a: -2, stopAtRest: true };
    expect(stopTime(m)).toBe(10);
    expect(stateAt(m, 15)).toEqual({ x: 100, v: 0, a: 0 });
    expect(distance(m, 15)).toBe(100);
  });

  it('without braking-to-rest the body reverses and distance counts both legs', () => {
    const m = { x0: 0, v0: 10, a: -2, stopAtRest: false };
    // Turns at t = 5 s (x = 25 m) and is back at x = 0 at t = 10 s → distance 50 m.
    expect(stateAt(m, 10).x).toBeCloseTo(0, 12);
    expect(distance(m, 10)).toBeCloseTo(50, 12);
  });

  it('v² − v0² = 2 a s holds', () => {
    const m = { x0: 3, v0: 4, a: 1.5, stopAtRest: false };
    const s = stateAt(m, 7);
    expect(s.v ** 2 - 16).toBeCloseTo(2 * 1.5 * (s.x - 3), 10);
  });

  it('closed form agrees with Dormand–Prince', () => {
    const m = { x0: -12, v0: 3, a: 0.7, stopAtRest: false };
    expect(numericPosition(m, 9)).toBeCloseTo(stateAt(m, 9).x, 9);
  });
});

describe('linear engine', () => {
  it('reproduces the braking car exactly, including the stop inside a step', () => {
    const e = new LinearEngine();
    e.reset({ xA: 0, vA: 20, aA: -2, stopAtRest: 1, twoBodies: 0, tEnd: 12 });
    const r = new EngineRunner(e, 1000);
    for (let i = 0; i < 2000 && !e.finished(); i++) r.frame(1 / 60, 1);
    const s = new Float64Array(6);
    e.readState(s);
    expect(s[LS.xA]).toBeCloseTo(100, 9);
    expect(s[LS.vA]).toBe(0);
  });
});

describe('linear scenes', () => {
  it('uniform motion default reports the meeting time and position', () => {
    const sol = uniformMotion.solve(uniformMotion.defaults, 'vi');
    expect(sol.answers.find((a) => a.id === 'meet_time')!.value).toBeCloseTo(4, 10);
    expect(sol.answers.find((a) => a.id === 'meet_position')!.value).toBeCloseTo(40, 10);
  });

  it('accelerated motion default reports stop time and distance', () => {
    const sol = uniformAcceleration.solve(uniformAcceleration.defaults, 'en');
    expect(sol.answers.find((a) => a.id === 'stop_time_A')!.value).toBeCloseTo(10, 12);
    expect(sol.answers.find((a) => a.id === 'stop_distance_A')!.value).toBeCloseTo(100, 12);
    for (const a of sol.answers) {
      if (a.check !== undefined) expect(a.check).toBeCloseTo(a.value, 8);
    }
  });
});
