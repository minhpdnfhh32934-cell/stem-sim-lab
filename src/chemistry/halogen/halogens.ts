import { C } from '@/core/constants';
import { elementByZ } from '../data/elements';
import { nistEnthalpy } from '../data/enthalpy';
import { HALOGENS, type Halogen } from '../data/halogens';
import { REACTIONS, type Reaction } from '../data/reactions';

/**
 * HH10 Bài 21–22. The book's values come from data/halogens.json; the book gives no ionisation
 * energy for F…I, so I₁ is the NIST value of data/elements.json, written in the book's unit kJ/mol
 * (I₁ · e · N_A, CODATA 2022 constants).
 */

/** eV per atom → kJ/mol. */
export const evToKjPerMol = (ev: number) => (ev * C.e * C.NA) / 1000;

export interface HalogenRow extends Halogen {
  /** First ionisation energy, kJ/mol (NIST ASD via data/elements.json), or null. */
  ie_kj_mol: number | null;
  /** Covalent radius (Cordero 2008) and melting/boiling points (CRC) to compare with the book. */
  other: { radius_pm: number | null; melting_c: number | null; boiling_c: number | null };
}

const celsius = (k: number | null) => (k === null ? null : Number((k - 273.15).toFixed(2)));

export const HALOGEN_ROWS: readonly HalogenRow[] = HALOGENS.map((h) => {
  const e = elementByZ(h.z);
  return {
    ...h,
    ie_kj_mol: e?.ionization_energy_ev ? evToKjPerMol(e.ionization_energy_ev) : null,
    other: {
      radius_pm: e?.covalent_radius_pm ?? null,
      melting_c: celsius(e?.melting_point_k ?? null),
      boiling_c: celsius(e?.boiling_point_k ?? null),
    },
  };
});

/**
 * Cross-check of the book's H–X bond energy (Bảng 22.1) by Hess's law with the NIST WebBook
 * (CODATA) formation enthalpies: D(H–X) = ΔfH°(H, g) + ΔfH°(X, g) − ΔfH°(HX, g), at 298 K.
 */
export function bondEnthalpyFromFormation(symbol: string): number | undefined {
  const h = nistEnthalpy('H', 'g');
  const x = nistEnthalpy(symbol, 'g');
  const hx = nistEnthalpy(`H${symbol}`, 'g');
  if (h === undefined || x === undefined || hx === undefined) return undefined;
  return Number((h + x - hx).toFixed(3));
}

/** The library's AgNO₃ test for the halide ion X⁻ (only AgCl is in the library so far). */
export function silverHalideReaction(symbol: string): Reaction | undefined {
  return REACTIONS.find(
    (r) =>
      r.reactants.some((t) => t.formula === 'AgNO3') &&
      r.products.some((t) => t.formula === `Ag${symbol}`),
  );
}
