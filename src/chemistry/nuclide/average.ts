import type { Isotope } from '../data/isotopes';

export interface Average {
  /** Σ xᵢ·Aᵢ / Σ xᵢ. */
  value: number;
  /** Σ xᵢ, % (100 when the data lists every natural isotope). */
  abundanceSum: number;
}

/**
 * Average atomic mass Ā = Σ xᵢ·Aᵢ / Σ xᵢ (HH10 Bài 2), with Aᵢ the mass numbers (as the textbook
 * does) or the isotope masses. Σ xᵢ is 100 % except for Mg and S (100.001 %, 99.9938 %: the
 * data's rounding) and Ta (99.988 %: the metastable ¹⁸⁰ᵐTa is not in the data); dividing by the
 * sum keeps the textbook's formula, and the screen says the sum.
 */
export function averageMass(isotopes: readonly Isotope[], by: 'massNumber' | 'mass'): Average {
  let sum = 0;
  let weighted = 0;
  for (const i of isotopes) {
    sum += i.abundance_pct;
    weighted += i.abundance_pct * (by === 'mass' ? i.mass_u : i.a);
  }
  return { value: weighted / sum, abundanceSum: sum };
}

/** True when the listed abundances do not add up to 100 % (beyond the data's rounding). */
export const abundanceGap = (sum: number) => Math.abs(sum - 100) > 5e-4;

export type TwoIsotopeAnswer =
  { ok: true; x1: number; x2: number } | { ok: false; reason: 'outside' | 'notFinite' };

/**
 * The textbook's reverse problem: two isotopes of mass numbers a1 < a2 and the average Ā give
 * the abundances exactly, x₁ = 100·(a2 − Ā)/(a2 − a1), x₂ = 100 − x₁. Ā must lie strictly
 * between a1 and a2 (at a bound one isotope would be 0 %, outside it a share would be negative).
 */
export function twoIsotopeAbundances(a1: number, a2: number, avg: number): TwoIsotopeAnswer {
  if (!(a1 < a2)) throw new Error(`mass numbers out of order: ${a1}, ${a2}`);
  if (!Number.isFinite(avg)) return { ok: false, reason: 'notFinite' };
  if (!(avg > a1 && avg < a2)) return { ok: false, reason: 'outside' };
  const x1 = (100 * (a2 - avg)) / (a2 - a1);
  return { ok: true, x1, x2: 100 - x1 };
}
