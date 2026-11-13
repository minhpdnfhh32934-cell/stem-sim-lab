import { describe, expect, it } from 'vitest';
import { airTrackCartModel as model } from './airTrackCart';

// The air-track glider: uniform motion with no hanging mass, a = m·g/(M + m) with one, the beam
// times worked out by hand from s = u·t + ½·a·t² (not through the model's own predict), at any
// step size; the layouts it refuses.

const PULLED = {
  gliderMass: 0.2,
  hangingMass: 0.01,
  launchSpeed: 0,
  pulleyMass: 0,
  gravity: 9.81,
  cardLength: 0.1,
  gateA: 0.2,
  gateB: 0.6,
  travel: 1.2,
  dropHeight: 0.8,
};
const COASTING = { ...PULLED, hangingMass: 0, launchSpeed: 0.3 };

/** Runs the model to its end in steps of dt; returns its final state by variable. */
function run(inputs: Record<string, number>, dt: number): Record<string, number> {
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  for (let i = 0; i < 1e6 && !model.isComplete?.(state, inputs); i++) model.step(state, dt, inputs);
  return Object.fromEntries(model.variables.map((v, i) => [v, state[i] ?? NaN]));
}

describe('air-track glider', () => {
  it('runs to completion, its state finite at every step', () => {
    for (const inputs of [PULLED, COASTING]) {
      const state = new Float64Array(model.variables.length);
      model.init(inputs, state);
      for (let i = 0; i < 1e5 && !model.isComplete?.(state, inputs); i++) {
        model.step(state, 0.001, inputs);
        expect([...state].every(Number.isFinite), `step ${i}`).toBe(true);
      }
    }
  });

  it.each([0.001, 0.013])('coasts at constant speed with nothing hanging (step %s s)', (dt) => {
    const end = run(COASTING, dt);
    // u = 0.3 m/s: each 0.1 m card blocks its gate for 1/3 s; A to B, 0.4 m, takes 4/3 s.
    expect(end.acceleration).toBe(0);
    expect(end.blockedA).toBeCloseTo(1 / 3, 12);
    expect(end.blockedB).toBeCloseTo(1 / 3, 12);
    expect(end.timeAB).toBeCloseTo(4 / 3, 12);
    expect(end.speedA).toBeCloseTo(0.3, 12);
    expect(end.speedB).toBeCloseTo(0.3, 12);
    expect(end.averageSpeed).toBeCloseTo(0.3, 12);
    expect(end.measuredAcceleration).toBeCloseTo(0, 12);
    expect(end.force).toBe(0);
    expect(end.clock).toBeCloseTo(0.65 / 0.3, 12); // until the card leaves gate B
  });

  // By hand: a = 0.01 · 9.81 / 0.21 = 0.467 142 857 m/s²; from rest, t(s) = √(2s/a).
  const a = (0.01 * 9.81) / 0.21;
  const t = (s: number) => Math.sqrt((2 * s) / a);

  it.each([0.001, 0.013])(
    'is pulled with a = m·g/(M + m), every beam timed exactly (step %s s)',
    (dt) => {
      const end = run(PULLED, dt);
      expect(end.acceleration).toBeCloseTo(a, 12);
      expect(end.blockedA).toBeCloseTo(t(0.25) - t(0.15), 12);
      expect(end.blockedB).toBeCloseTo(t(0.65) - t(0.55), 12);
      expect(end.timeAB).toBeCloseTo(t(0.55) - t(0.15), 12);
      expect(end.speedA).toBeCloseTo(0.1 / (t(0.25) - t(0.15)), 10);
      expect(end.speedB).toBeCloseTo(0.1 / (t(0.65) - t(0.55)), 10);
      expect(end.passed).toBe(1);
      expect(end.force).toBeCloseTo(0.0981, 12);
      expect(end.forcePerMass).toBeCloseTo(a, 12);
      expect(end.tension).toBeCloseTo(0.2 * a, 12); // the string's pull on the glider, M·a
    },
  );

  it('works out from the gates an acceleration a hair over a (card-average speeds)', () => {
    const end = run(PULLED, 0.001);
    // v² at mid-passage is short of v² at the gate by a²·Δt²/4, more at the slower gate A.
    const short = (dt: number) => (a * a * dt * dt) / 4;
    const expected = a + (short(end.blockedA ?? 0) - short(end.blockedB ?? 0)) / (2 * 0.4);
    expect(end.measuredAcceleration).toBeCloseTo(expected, 10);
    expect(end.measuredAcceleration).toBeGreaterThan(a);
    expect(end.measuredAcceleration).toBeLessThan(a * 1.01);
    expect(end.measuredAcceleration).toBeCloseTo(
      model.predict?.(PULLED).measuredAcceleration ?? 0,
      10,
    );
  });

  it('slows the pull with a pulley that has inertia: a = m·g/(M + m + μ)', () => {
    const p = model.predict?.({ ...PULLED, pulleyMass: 0.005 }) ?? {};
    expect(p.acceleration).toBeCloseTo((0.01 * 9.81) / 0.215, 12);
    expect(p.unitSlope).toBeCloseTo(0.21 / 0.215, 12);
    expect(model.predict?.(PULLED).unitSlope).toBe(1);
  });

  it('refuses a glider that would not move, or a layout a run cannot finish', () => {
    expect(() => model.predict?.({ ...COASTING, launchSpeed: 0 })).toThrow(/must push/);
    expect(() => model.predict?.({ ...PULLED, gateA: 0.04 })).toThrow(/before light gate A/);
    expect(() => model.predict?.({ ...PULLED, gateB: 0.25 })).toThrow(/past gate A/);
    expect(() => model.predict?.({ ...PULLED, gateB: 1.2 })).toThrow(/pulley end/);
    expect(() => model.predict?.({ ...PULLED, dropHeight: 0.6 })).toThrow(/floor/);
    expect(() => model.predict?.({ ...PULLED, gliderMass: Number.NaN })).toThrow(/gliderMass/);
  });
});
