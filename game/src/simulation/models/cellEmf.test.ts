import { describe, expect, it } from 'vitest';
import { cellEmfModel as model } from './cellEmf';

// EMF and internal resistance: I = E/(R + r) and U = E − I·r worked out by hand, E on the open
// voltmeter, the U–I line of slope −r through E, the refusals.

const INPUTS = { cell: 0, rheostat: 2, switchTime: 0.5, duration: 3 };

function at(inputs: Record<string, number>, t: number): Record<string, number> {
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  if (t > 0) model.step(state, t, inputs);
  return Object.fromEntries(model.variables.map((v, i) => [v, state[i] ?? NaN]));
}

describe('cell EMF', () => {
  it('reads E open, and U = E − I·r closed: 1.5 V, 0.3 Ω into 2 Ω gives 0.652 A and 1.304 V', () => {
    expect(at(INPUTS, 0.2).voltage).toBe(1.5);
    expect(at(INPUTS, 0.2).current).toBe(0);
    const closed = at(INPUTS, 1);
    expect(closed.current).toBeCloseTo(1.5 / 2.3, 12); // 0.652 17
    expect(closed.voltage).toBeCloseTo(1.5 - (1.5 / 2.3) * 0.3, 12); // 1.304 35
    expect(closed.voltage).toBeCloseTo(closed.current! * 2, 12); // = I·R
  });

  it('puts runs at several R on U = E − r·I: slope −r, intercept E', () => {
    const points = [1, 2, 4, 8].map((R) => model.predict?.({ ...INPUTS, rheostat: R }) ?? {});
    for (const p of points) expect(p.voltage).toBeCloseTo(1.5 - 0.3 * (p.current ?? NaN), 12);
    const [a, b] = [points[0] ?? {}, points[3] ?? {}];
    const slope = ((b.voltage ?? 0) - (a.voltage ?? 0)) / ((b.current ?? 0) - (a.current ?? 0));
    expect(slope).toBeCloseTo(-0.3, 12);
    expect(model.predict?.({ ...INPUTS, cell: 1 }).negativeInternalResistance).toBe(-1.2);
  });

  it('refuses what it cannot run', () => {
    const state = new Float64Array(model.variables.length);
    expect(() => model.init({ ...INPUTS, cell: 3 }, state)).toThrow(/cell/);
    expect(() => model.init({ ...INPUTS, rheostat: 0 }, state)).toThrow(/rheostat/);
  });
});
