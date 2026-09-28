import { describe, expect, it } from 'vitest';
import { SingularMatrixError, luDecompose, solve } from './linalg';

describe('linear solver', () => {
  it('solves a system that needs pivoting', () => {
    // [0 2 1; 1 1 1; 2 1 0] x = [5 4 4] → x = [1 2 1]
    const a = Float64Array.from([0, 2, 1, 1, 1, 1, 2, 1, 0]);
    const x = solve(a, Float64Array.from([5, 4, 4]), 3);
    expect(Array.from(x).map((v) => Number(v.toFixed(12)))).toEqual([1, 2, 1]);
  });

  it('detects singular matrices', () => {
    expect(() => luDecompose(Float64Array.from([1, 2, 2, 4]), 2)).toThrow(SingularMatrixError);
  });
});
