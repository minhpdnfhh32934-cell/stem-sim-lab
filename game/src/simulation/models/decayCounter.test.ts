import { describe, expect, it } from 'vitest';
import { decayCounterModel as model, poisson } from './decayCounter';

// The decay counter: Poisson counts of the right mean and variance, the same draw the same
// counts, the half-life fitted back from them, the refusals.

const SOURCE = {
  halfLife: 69.54,
  initialRate: 40,
  background: 0.4,
  countInterval: 10,
  duration: 300,
  draw: 1,
  timeLapse: 10,
};

function counted(inputs: Record<string, number>) {
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  const counts: number[] = [];
  let last = 0;
  while (!model.isComplete?.(state, inputs)) {
    model.step(state, 0.05, inputs);
    const k = state[model.variables.indexOf('intervals')] ?? 0;
    if (k > last) counts.push(state[model.variables.indexOf('counts')] ?? NaN);
    last = k;
  }
  return { counts, end: Object.fromEntries(model.variables.map((v, i) => [v, state[i] ?? NaN])) };
}

describe('Poisson sampling', () => {
  it('has the mean and the variance of its mean', () => {
    for (const mean of [3, 40, 400]) {
      const draws = Array.from({ length: 4000 }, (_, i) => poisson(mean, (i + 0.5) / 4000));
      const m = draws.reduce((a, b) => a + b, 0) / draws.length;
      const v = draws.reduce((a, b) => a + (b - m) ** 2, 0) / draws.length;
      expect(m).toBeCloseTo(mean, 0);
      expect(v / mean).toBeGreaterThan(0.95);
      expect(v / mean).toBeLessThan(1.05);
    }
  });
});

describe('decay counter', () => {
  it('counts 30 intervals of 10 s, the same for the same draw, other counts for another', () => {
    const a = counted(SOURCE);
    expect(a.counts).toHaveLength(30);
    expect(a.end.labTime).toBe(300);
    expect(counted(SOURCE).counts).toEqual(a.counts);
    expect(counted({ ...SOURCE, draw: 2 }).counts).not.toEqual(a.counts);
    expect(a.end.totalCounts).toBe(a.counts.reduce((x, y) => x + y, 0));
  });

  it('the first interval averages R0/λ·(1 − e^(−λΔt)) + B·Δt over many draws', () => {
    const p = model.predict?.(SOURCE) ?? {};
    const lambda = Math.LN2 / 69.54;
    expect(p.firstCount).toBeCloseTo((40 / lambda) * (1 - Math.exp(-lambda * 10)) + 4, 9);
    let sum = 0;
    const n = 400;
    for (let s = 0; s < n; s++) sum += counted({ ...SOURCE, draw: s, duration: 20 }).counts[0]!;
    const sigma = Math.sqrt(p.firstCount! / n);
    expect(Math.abs(sum / n - p.firstCount!)).toBeLessThan(4 * sigma);
  });

  it('fits the half-life back within a few per cent from a strong source, every draw', () => {
    for (let s = 0; s < 10; s++) {
      const { end } = counted({ ...SOURCE, initialRate: 60, draw: s, duration: 200 });
      expect(Math.abs(end.halfLifeSeen! / 69.54 - 1)).toBeLessThan(0.08);
    }
  });

  it('refuses more counts per interval than it samples', () => {
    const state = new Float64Array(model.variables.length);
    expect(() => model.init({ ...SOURCE, initialRate: 1000, countInterval: 60 }, state)).toThrow(
      /shorter interval/,
    );
  });
});
