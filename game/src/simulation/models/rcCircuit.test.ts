import { describe, expect, it } from 'vitest';
import { rcCircuitModel as model } from './rcCircuit';

// RC charging and discharging: τ = RC worked out by hand, 63 % at one τ, the current's sign, the
// switch-over at 5τ, the refusals.

const INPUTS = { supply: 6, resistance: 1000, capacitance: 0.001 };

function at(inputs: Record<string, number>, t: number): Record<string, number> {
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  let left = t;
  while (left > 1e-12) left -= model.step(state, left, inputs);
  return Object.fromEntries(model.variables.map((v, i) => [v, state[i] ?? NaN]));
}

describe('RC circuit', () => {
  it('has τ = RC = 1 kΩ × 1000 µF = 1 s, and starts at E/R = 6 mA', () => {
    const p = model.predict?.(INPUTS) ?? {};
    expect(p.timeConstant).toBeCloseTo(1, 12);
    expect(p.peakCurrent).toBeCloseTo(0.006, 12);
    expect(p.halfTime).toBeCloseTo(Math.LN2, 12);
    expect(at(INPUTS, 0).current).toBeCloseTo(0.006, 12);
  });

  it('charges to 63 % of E at one τ, and to 99.3 % at 5τ', () => {
    expect(at(INPUTS, 1).voltage).toBeCloseTo(6 * (1 - Math.exp(-1)), 12); // 3.79 V
    expect(at(INPUTS, 1).timeConstantSeen).toBeCloseTo(1, 12);
    expect(at(INPUTS, 0.5).timeConstantSeen).toBe(0);
    expect(at(INPUTS, 4.99).voltage).toBeGreaterThan(5.95);
  });

  it('discharges after 5τ through the same R, the current reversed, to 37 % one τ later', () => {
    const top = 6 * (1 - Math.exp(-5));
    const later = at(INPUTS, 6);
    expect(later.switchPosition).toBe(-1);
    expect(later.voltage).toBeCloseTo(top * Math.exp(-1), 12);
    expect(later.current).toBeCloseTo(-(top * Math.exp(-1)) / 1000, 12);
    expect(at(INPUTS, 10).clock).toBe(10);
  });

  it('refuses what it cannot run', () => {
    const state = new Float64Array(model.variables.length);
    expect(() => model.init({ ...INPUTS, resistance: 100000 }, state)).toThrow(/too long/);
    expect(() => model.init({ ...INPUTS, supply: 0 }, state)).toThrow(/supply/);
  });
});
