import { dopri5 } from '@/core/ode/dopri5';
import type { Params } from '../types';

/**
 * Capacitors (SGK Vật lí 11 KNTT, Bài 21 "Tụ điện"): C = Q/U (21.2); n uncharged capacitors in
 * series: U = U₁ + … + Uₙ, Q = Q₁ = … = Qₙ, 1/C = 1/C₁ + … + 1/Cₙ (21.3–21.5); in parallel:
 * U = U₁ = … = Uₙ, Q = Q₁ + … + Qₙ, C = C₁ + … + Cₙ (21.6–21.8); energy W = QU/2 = Q²/2C = CU²/2
 * (21.9), the area under U(q) while charging (Hình 21.9).
 */
export const MODE = { single: 0, series: 1, parallel: 2 } as const;

export interface Bank {
  mode: number;
  /** Capacitances in use (F). */
  caps: number[];
  /** Voltage of the source (V). */
  U: number;
  /** Highest voltage each capacitor may take (V), as printed on it ("2 µF – 200 V"). */
  Umax: number;
}

/**
 * Defaults: the textbook's worked example (tr. 86): C₁ = 2 µF, C₂ = 3 µF, C₃ = 4 µF in series; the
 * 36 V and the 200 V rating are those of question 1, tr. 85 ("2 µF – 200 V", at 36 V).
 */
export const BANK_DEFAULTS = {
  mode: MODE.series,
  count: 3,
  C1: 2e-6,
  C2: 3e-6,
  C3: 4e-6,
  U: 36,
  Umax: 200,
} as const;

export function bankInput(p: Params): Bank {
  const m = Math.round(p.mode ?? BANK_DEFAULTS.mode);
  const mode = m === MODE.single || m === MODE.parallel ? m : MODE.series;
  const count = mode === MODE.single ? 1 : Math.round(p.count ?? BANK_DEFAULTS.count) === 2 ? 2 : 3;
  const all = [p.C1 ?? BANK_DEFAULTS.C1, p.C2 ?? BANK_DEFAULTS.C2, p.C3 ?? BANK_DEFAULTS.C3];
  return {
    mode,
    caps: all.slice(0, count),
    U: p.U ?? BANK_DEFAULTS.U,
    Umax: p.Umax ?? BANK_DEFAULTS.Umax,
  };
}

/** The bank's capacitance (21.5, 21.8). */
export function equivalent(b: Bank): number {
  if (b.mode === MODE.parallel) return b.caps.reduce((s, c) => s + c, 0);
  return 1 / b.caps.reduce((s, c) => s + 1 / c, 0);
}

/** Q = CU of the bank. */
export const bankCharge = (b: Bank) => equivalent(b) * b.U;
/** W = CU²/2 of the bank (21.9). */
export const bankEnergy = (b: Bank) => 0.5 * equivalent(b) * b.U * b.U;

export interface Part {
  C: number;
  U: number;
  Q: number;
  W: number;
}

/** Each capacitor's voltage, charge and energy once the bank is charged. */
export function parts(b: Bank): Part[] {
  const Q = bankCharge(b);
  return b.caps.map((C) => {
    const U = b.mode === MODE.parallel ? b.U : Q / C;
    return { C, U, Q: C * U, W: 0.5 * C * U * U };
  });
}

export const isValid = (b: Bank) =>
  b.caps.every((c) => Number.isFinite(c) && c > 0) && Number.isFinite(b.U) && b.U >= 0;

/** Capacitors whose voltage is above the rating (1-based), so the dielectric may break down. */
export const overRated = (b: Bank) =>
  parts(b)
    .map((part, i) => (part.U > b.Umax * (1 + 1e-12) ? i + 1 : 0))
    .filter((i) => i > 0);

/**
 * Independent check of the bank's charge, from the laws of each connection without the
 * reciprocal formula: in series the common charge Q is found by bisection so that the
 * capacitors' voltages Q / Cᵢ add up to U (21.3, 21.4); in parallel each capacitor takes CᵢU.
 */
export function solvedCharge(b: Bank): number {
  if (b.mode === MODE.parallel) return b.caps.reduce((s, c) => s + c * b.U, 0);
  const sum = (Q: number) => b.caps.reduce((s, c) => s + Q / c, 0) - b.U;
  let lo = 0;
  let hi = Math.max(...b.caps) * b.U * 1.01 + 1e-300;
  for (let i = 0; i < 200 && hi - lo > 1e-15 * hi; i++) {
    const mid = 0.5 * (lo + hi);
    if (sum(mid) > 0) hi = mid;
    else lo = mid;
  }
  return 0.5 * (lo + hi);
}

/** Independent check of W: DOPRI5 adds U dq = (q/C) dq while charging from 0 to Q (Hình 21.9). */
export function integratedEnergy(b: Bank): number {
  const C = equivalent(b);
  const Q = solvedCharge(b);
  if (!(Q > 0)) return 0;
  return (
    dopri5(
      (q, _y, d) => {
        d[0] = q / C;
      },
      [0],
      0,
      Q,
      { rtol: 1e-12, atol: 1e-30 },
    ).y[0] ?? Number.NaN
  );
}
