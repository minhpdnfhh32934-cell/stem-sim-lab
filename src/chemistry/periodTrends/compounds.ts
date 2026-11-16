import { elementByZ } from '../data/elements';
import { PERIOD3_ROWS, type HydroxideCharacter, type OxideCharacter } from '../data/period3';
import { isMetal, oxidationNumbers } from '../redox/oxidation';

/**
 * HH10 Bài 7: the highest oxide and hydroxide of each period 3 element. The highest oxidation
 * number (the book's "hóa trị cao nhất") is the A-group number; the oxide and a metal's hydroxide
 * follow from it by code. An acid's formula (how many H and O) is not fixed by the group, so it is
 * the book's (Bảng 7.1) and the code checks it: H +1, O −2 must leave the element at the group
 * number. The acid–base character is the book's Bảng 7.2.
 */

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/** A-group number (1 for IA … 7 for VIIA) of a main-group element in IUPAC group 1–2 or 13–17. */
export function groupA(group: number): number {
  if (group === 1 || group === 2) return group;
  if (group >= 13 && group <= 17) return group - 10;
  throw new RangeError(`group ${String(group)} is not a main group IA–VIIA`);
}

export const romanGroup = (n: number) => `${ROMAN[n - 1] ?? String(n)}A`;

/** E₂Oₙ for an odd n, EOₙ⁄₂ for an even one ("Na2O", "MgO", "SO3", "Cl2O7"). */
export function oxideFormula(symbol: string, n: number): string {
  if (n % 2 === 0) return `${symbol}O${n === 2 ? '' : String(n / 2)}`;
  return `${symbol}2O${n === 1 ? '' : String(n)}`;
}

/** E(OH)ₙ ("NaOH", "Mg(OH)2", "Al(OH)3"). */
export const hydroxideFormula = (symbol: string, n: number) =>
  n === 1 ? `${symbol}OH` : `${symbol}(OH)${String(n)}`;

export interface CompoundRow {
  z: number;
  symbol: string;
  /** A-group number = highest oxidation number. */
  n: number;
  oxide: string;
  hydroxide: string;
  /** "rule": E(OH)ₙ of a metal; "book": an acid's formula from Bảng 7.1. */
  hydroxideFrom: 'rule' | 'book';
  /** The oxidation-number rules give the element +n in its hydroxide or acid. */
  checked: boolean;
  oxideCharacter: OxideCharacter;
  hydroxideCharacter: HydroxideCharacter;
  /** The book's formulas, to compare with the computed ones. */
  textbook: { oxide: string; hydroxide: string };
}

export function period3Compounds(): CompoundRow[] {
  return PERIOD3_ROWS.map((row) => {
    const group = elementByZ(row.z)?.group;
    if (!group) throw new Error(`no group for Z = ${String(row.z)}`);
    const n = groupA(group);
    const metal = isMetal(row.symbol);
    const hydroxide = metal ? hydroxideFormula(row.symbol, n) : row.hydroxide_textbook;
    const ox = oxidationNumbers(hydroxide);
    return {
      z: row.z,
      symbol: row.symbol,
      n,
      oxide: oxideFormula(row.symbol, n),
      hydroxide,
      hydroxideFrom: metal ? 'rule' : 'book',
      checked: ox.ok && ox.values.get(row.symbol) === n,
      oxideCharacter: row.oxide_character,
      hydroxideCharacter: row.hydroxide_character,
      textbook: { oxide: row.oxide_textbook, hydroxide: row.hydroxide_textbook },
    };
  });
}
