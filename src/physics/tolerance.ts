/**
 * One rule for "khớp" (issue #119): the solution panel's label and the physics tests both ask
 * `compareCheck`, so an answer the panel calls "khớp" is one the tests hold to the same tolerance.
 */

/** Relative gap allowed between an answer and its independent numerical check. */
export const CHECK_TOL = 1e-8;

/** Absolute gap (SI) that always agrees: round-off around an answer that is exactly 0. */
export const CHECK_FLOOR = 1e-12;

export interface CheckVerdict {
  agrees: boolean;
  /** True: `deviation` is a fraction of the answer; false: it is absolute, in SI (an answer near 0). */
  relative: boolean;
  deviation: number;
}

/**
 * Agreement within `tol` relative, or CHECK_FLOOR absolute when that is larger. `tol` is wider only
 * for an answer that declares it (`Answer.checkTol`, explained in its Science Card). NaN never agrees.
 */
export function compareCheck(value: number, check: number, tol = CHECK_TOL): CheckVerdict {
  const gap = Math.abs(check - value);
  const relative = tol * Math.abs(value) > CHECK_FLOOR;
  return {
    agrees: gap <= Math.max(tol * Math.abs(value), CHECK_FLOOR),
    relative,
    deviation: relative ? gap / Math.abs(value) : gap,
  };
}
