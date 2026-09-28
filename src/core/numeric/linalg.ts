/**
 * Small dense linear algebra for implicit ODE solvers (systems of a few dozen unknowns).
 * Row-major Float64Array matrices.
 */

export class SingularMatrixError extends Error {
  override name = 'SingularMatrixError';
}

export interface LU {
  n: number;
  /** Combined L (unit diagonal, below) and U (on/above diagonal). */
  lu: Float64Array;
  piv: Int32Array;
}

/** LU decomposition with partial pivoting. Does not modify `a`. */
export function luDecompose(a: Float64Array, n: number): LU {
  const lu = Float64Array.from(a);
  const piv = new Int32Array(n);
  for (let i = 0; i < n; i++) piv[i] = i;

  for (let k = 0; k < n; k++) {
    // Pivot: row with the largest |a[i][k]|.
    let p = k;
    let max = Math.abs(lu[k * n + k] ?? 0);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(lu[i * n + k] ?? 0);
      if (v > max) {
        max = v;
        p = i;
      }
    }
    if (max === 0 || !Number.isFinite(max)) throw new SingularMatrixError('Matrix is singular');
    if (p !== k) {
      for (let j = 0; j < n; j++) {
        const t = lu[k * n + j] ?? 0;
        lu[k * n + j] = lu[p * n + j] ?? 0;
        lu[p * n + j] = t;
      }
      const t = piv[k] ?? 0;
      piv[k] = piv[p] ?? 0;
      piv[p] = t;
    }
    const pivot = lu[k * n + k] ?? 0;
    for (let i = k + 1; i < n; i++) {
      const f = (lu[i * n + k] ?? 0) / pivot;
      lu[i * n + k] = f;
      if (f === 0) continue;
      for (let j = k + 1; j < n; j++) {
        lu[i * n + j] = (lu[i * n + j] ?? 0) - f * (lu[k * n + j] ?? 0);
      }
    }
  }
  return { n, lu, piv };
}

/** Solves A x = b using a precomputed LU. Writes the solution into `out`. */
export function luSolve({ n, lu, piv }: LU, b: Float64Array, out: Float64Array): Float64Array {
  // Forward substitution with permutation (L y = P b).
  for (let i = 0; i < n; i++) {
    let s = b[piv[i] ?? 0] ?? 0;
    for (let j = 0; j < i; j++) s -= (lu[i * n + j] ?? 0) * (out[j] ?? 0);
    out[i] = s;
  }
  // Back substitution (U x = y).
  for (let i = n - 1; i >= 0; i--) {
    let s = out[i] ?? 0;
    for (let j = i + 1; j < n; j++) s -= (lu[i * n + j] ?? 0) * (out[j] ?? 0);
    out[i] = s / (lu[i * n + i] ?? 1);
  }
  return out;
}

export function solve(a: Float64Array, b: Float64Array, n: number): Float64Array {
  return luSolve(luDecompose(a, n), b, new Float64Array(n));
}
