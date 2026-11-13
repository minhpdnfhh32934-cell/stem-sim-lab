import { describe, expect, it } from 'vitest';
import { atwoodModel as model } from './atwood';

// The Atwood machine against a = Δm·g/(2M + Δm), worked out by hand (not through the model's own
// predict), at any step size: the fall time, the gate, the two pulls, g estimated back.

const INPUTS = {
  mass: 0.2,
  extraMass: 0.02,
  pulleyMass: 0,
  gravity: 9.81,
  dropHeight: 0.6,
  cardLength: 0.02,
  gateAbovePad: 0.05,
};

/** Runs the model to its end in steps of dt; returns its final state by variable. */
function run(inputs: Record<string, number>, dt: number): Record<string, number> {
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  for (let i = 0; i < 1e6 && !model.isComplete?.(state, inputs); i++) model.step(state, dt, inputs);
  return Object.fromEntries(model.variables.map((v, i) => [v, state[i] ?? NaN]));
}

// By hand: a = 0.02 · 9.81 / 0.42 = 0.467 142 857 m/s²; t(x) = √(2x/a).
const a = (0.02 * 9.81) / 0.42;
const t = (x: number) => Math.sqrt((2 * x) / a);

describe('Atwood machine', () => {
  it('runs to completion, its state finite at every step', () => {
    const state = new Float64Array(model.variables.length);
    model.init(INPUTS, state);
    for (let i = 0; i < 1e5 && !model.isComplete?.(state, INPUTS); i++) {
      model.step(state, 0.001, INPUTS);
      expect([...state].every(Number.isFinite), `step ${i}`).toBe(true);
    }
  });

  it.each([0.001, 0.017])('falls with a = Δm·g/(2M + Δm), timed exactly (step %s s)', (dt) => {
    const end = run(INPUTS, dt);
    expect(end.acceleration).toBeCloseTo(a, 12);
    expect(end.fallTime).toBeCloseTo(t(0.6), 12); // ≈ 1.603 s
    expect(end.measuredAcceleration).toBeCloseTo(a, 12);
    expect(end.fall).toBe(0.6);
    expect(end.landed).toBe(1);
    // The gate 5 cm above the pad: the 2 cm card blocks it from a fall of 0.54 to 0.56 m.
    expect(end.blocked).toBeCloseTo(t(0.56) - t(0.54), 12);
    expect(end.gateSpeed).toBeCloseTo(0.02 / (t(0.56) - t(0.54)), 10);
    // g back from a and the masses: exact for an ideal pulley.
    expect(end.gravityEstimate).toBeCloseTo(9.81, 10);
  });

  it('pulls each side by its own tension, equal over an ideal pulley', () => {
    const p = model.predict?.(INPUTS) ?? {};
    expect(p.tensionLeft).toBeCloseTo(0.2 * (9.81 + a), 12);
    expect(p.tensionRight).toBeCloseTo(0.22 * (9.81 - a), 12);
    expect(p.tensionLeft).toBeCloseTo(p.tensionRight ?? 0, 12);
    expect(p.massRatio).toBeCloseTo(0.02 / 0.42, 12);
    expect(p.ratioSlope).toBeCloseTo(9.81, 12);
  });

  it('with a heavy pulley, falls slower and its g estimate comes out low', () => {
    const heavy = { ...INPUTS, pulleyMass: 0.01 };
    const p = model.predict?.(heavy) ?? {};
    expect(p.acceleration).toBeCloseTo((0.02 * 9.81) / 0.43, 12);
    expect(p.gravityEstimate).toBeCloseTo((9.81 * 0.42) / 0.43, 12);
    expect((p.tensionLeft ?? 0) < (p.tensionRight ?? 0)).toBe(true); // the pulley needs a net pull
  });

  it('refuses sides of equal mass and a gate the card cannot pass', () => {
    expect(() => model.predict?.({ ...INPUTS, extraMass: 0 })).toThrow(/heavier/);
    expect(() => model.predict?.({ ...INPUTS, gateAbovePad: 0.6 })).toThrow(/start above/);
    expect(() => model.predict?.({ ...INPUTS, gateAbovePad: 0.005 })).toThrow(
      /before the mass lands/,
    );
  });
});
