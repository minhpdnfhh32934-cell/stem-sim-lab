import { describe, expect, it } from 'vitest';
import { ellipticK, findRoot, pendulumPeriodExact, pendulumPeriodSmallAngle } from './special';

describe('ellipticK', () => {
  it('K(0) = π/2', () => {
    expect(ellipticK(0)).toBeCloseTo(Math.PI / 2, 15);
  });

  it('K(1/√2) = Γ(1/4)² / (4√π) (lemniscatic case)', () => {
    const gammaQuarter = 3.625609908221908; // Γ(1/4)
    expect(ellipticK(Math.SQRT1_2)).toBeCloseTo(gammaQuarter ** 2 / (4 * Math.sqrt(Math.PI)), 13);
  });

  it('rejects k outside [0,1)', () => {
    expect(() => ellipticK(1)).toThrow(RangeError);
  });
});

describe('pendulum periods', () => {
  it('exact period tends to the small-angle period as θ₀ → 0', () => {
    expect(pendulumPeriodExact(1, 9.81, 1e-6)).toBeCloseTo(pendulumPeriodSmallAngle(1, 9.81), 12);
  });

  it('small-angle error is below 0.2% at 10° and about 7.3% at 60°', () => {
    const T0 = pendulumPeriodSmallAngle(1, 9.81);
    const rel = (deg: number) => pendulumPeriodExact(1, 9.81, (deg * Math.PI) / 180) / T0 - 1;
    expect(rel(10)).toBeLessThan(0.002);
    expect(rel(60)).toBeCloseTo(0.0732, 3);
  });
});

describe('findRoot', () => {
  it('finds √2', () => {
    expect(findRoot((x) => x * x - 2, 0, 2)).toBeCloseTo(Math.SQRT2, 13);
  });
  it('requires a bracket', () => {
    expect(() => findRoot((x) => x * x + 1, 0, 1)).toThrow(RangeError);
  });
});
