import { elementBySymbol } from '../data/elements';
import { parseFormula } from '../formula';

/**
 * Oxidation numbers from a formula alone, by the textbook's rules (SGK Hóa học 10 KNTT, Bài 15,
 * "Quy tắc xác định số oxi hóa" and Bảng 15.1):
 *  1. an element on its own (a free element, or a single-element ion) has the charge per atom;
 *  2. in compounds H is +1, O is −2, group 1 metals +1, group 2 metals +2, Al +3;
 *  3–4. the oxidation numbers add up to the species' charge.
 * The usual exceptions, all from the definition (bonding electrons go to the more electronegative
 * atom): F is always −1; O is −1 in a peroxide (O–O bond) and positive with F (OF₂); H is −1 in a
 * metal hydride; Cl, Br, I are −1 in a binary compound with a metal (metal halides).
 *
 * When the rules leave more than one unknown, or can only give an average that differs from atom
 * to atom (organic molecules, the same element written in two groups), the answer is a refusal
 * with its reason: the code never guesses.
 */

export type OxNote = 'peroxide' | 'hydride' | 'oxygenFluoride' | 'halide';
export type OxRefusal =
  'twoUnknown' | 'organic' | 'mixed' | 'fractional' | 'outOfRange' | 'inconsistent';

export type OxResult =
  | { ok: true; values: ReadonlyMap<string, number>; notes: OxNote[] }
  | { ok: false; reason: OxRefusal; elements: string[] };

const METALS = new Set([
  'alkaliMetal',
  'alkalineEarthMetal',
  'transitionMetal',
  'postTransitionMetal',
  'lanthanide',
  'actinide',
]);
export const isMetal = (el: string) => METALS.has(elementBySymbol(el)?.category ?? '');
const HALIDE = new Set(['Cl', 'Br', 'I']);

/** Bảng 15.1: elements whose oxidation number in compounds is fixed by their group. */
function fixedValue(el: string): number | null {
  const e = elementBySymbol(el);
  if (e?.category === 'alkaliMetal') return 1;
  if (e?.category === 'alkalineEarthMetal') return 2;
  if (el === 'Al') return 3;
  if (el === 'F') return -1;
  return null;
}

/** How many separate places the formula text writes the element in ("NH4NO3": N twice). */
function writtenTimes(formula: string, el: string): number {
  return [...formula.matchAll(/[A-Z][a-z]?/g)].filter((m) => {
    const sym = elementBySymbol(m[0]) ? m[0] : m[0].slice(0, 1);
    return sym === el;
  }).length;
}

/**
 * A main-group p-block element lies between (group − 18) and (group − 10): S from −2 to +6, Cl
 * from −1 to +7. A value outside means the formula hides an unusual bond (e.g. a peroxide group).
 */
function inRange(el: string, v: number): boolean {
  const e = elementBySymbol(el);
  if (!e || e.block !== 'p' || e.group === null || e.group < 13 || e.group > 17) return true;
  return v >= e.group - 18 && v <= e.group - 10;
}

export function oxidationNumbers(formula: string): OxResult {
  const { counts, charge } = parseFormula(formula);
  const els = [...counts.keys()];
  const count = (el: string) => counts.get(el) ?? 0;
  const only = els.length === 1 ? els[0] : undefined;
  if (only !== undefined) {
    const v = charge / count(only);
    return Number.isInteger(v)
      ? { ok: true, values: new Map([[only, v + 0]]), notes: [] }
      : { ok: false, reason: 'fractional', elements: [only] };
  }
  // Several carbon atoms with hydrogen: each C has its own value, the rules give only the mean.
  if (count('C') >= 2 && counts.has('H')) return { ok: false, reason: 'organic', elements: ['C'] };

  const values = new Map<string, number>();
  const notes: OxNote[] = [];
  for (const el of els) {
    const v = fixedValue(el);
    if (v !== null) values.set(el, v);
  }
  if (counts.has('H')) {
    const hydride = els.every((el) => el === 'H' || isMetal(el));
    values.set('H', hydride ? -1 : 1);
    if (hydride) notes.push('hydride');
  }
  // O is −2 unless F is present (then it is solved like any other element).
  const oTentative = counts.has('O') && !counts.has('F');
  if (oTentative) values.set('O', -2);
  let unknown = els.filter((el) => !values.has(el));
  if (unknown.length === 2 && els.length === 2) {
    const [a = '', b = ''] = unknown;
    const x = HALIDE.has(a) && isMetal(b) ? a : HALIDE.has(b) && isMetal(a) ? b : null;
    if (x) {
      values.set(x, -1);
      notes.push('halide');
      unknown = unknown.filter((el) => el !== x);
    }
  }
  if (unknown.length > 1) return { ok: false, reason: 'twoUnknown', elements: unknown };
  const knownSum = () =>
    [...values].reduce((s, [el, v]) => (unknown.includes(el) ? s : s + v * count(el)), 0);

  if (unknown.length === 0) {
    if (knownSum() === charge) return { ok: true, values, notes };
    if (!oTentative) return { ok: false, reason: 'inconsistent', elements: els };
    // The sum fails with O = −2: solve O instead (a peroxide gives −1).
    unknown = ['O'];
  }
  const el = unknown[0] ?? '';
  const v = (charge - knownSum()) / count(el);
  if (!Number.isInteger(v)) return { ok: false, reason: 'fractional', elements: [el] };
  if (count(el) > 1 && writtenTimes(formula, el) > 1)
    return { ok: false, reason: 'mixed', elements: [el] };
  if (el === 'O') {
    if (counts.has('F')) notes.push('oxygenFluoride');
    else if (v === -1) notes.push('peroxide');
    else return { ok: false, reason: 'inconsistent', elements: els };
  } else if (!inRange(el, v)) return { ok: false, reason: 'outOfRange', elements: [el] };
  values.set(el, v + 0);
  return { ok: true, values, notes };
}

/** "+3", "−2", "0" (typographic minus, as the textbook writes them). */
export const signed = (v: number) => (v > 0 ? `+${String(v)}` : v < 0 ? `−${String(-v)}` : '0');
