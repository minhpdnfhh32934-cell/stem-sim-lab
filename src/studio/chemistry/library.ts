import { balance, checkCoefficients, type ParsedEquation } from '@/chemistry/balance';
import { REACTIONS, type Reaction } from '@/chemistry/data/reactions';
import { formatFormula, parseFormula } from '@/chemistry/formula';

/**
 * What the bench may say about a mix: only what a curated library record states for exactly
 * these starting substances. No record → "not in the verified database", never a guess.
 */
export type MixOutcome =
  | { kind: 'library'; reaction: Reaction; precipitate: boolean; check: EquationCheck }
  | { kind: 'ambiguous'; reactions: Reaction[] }
  | { kind: 'unknown' };

export interface EquationCheck {
  /** Every element and the total charge are conserved with the library's coefficients. */
  conserved: boolean;
  /** Elements (or 'charge') that are not conserved. */
  unbalanced: string[];
  /** The exact null-space balancer finds the same (smallest whole-number) coefficients. */
  minimal: boolean;
}

/** Element counts and charge, so "NaCl" and "ClNa" are the same species. */
export function speciesKey(formula: string): string {
  const p = parseFormula(formula);
  const counts = [...p.counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([el, n]) => `${el}${String(n)}`)
    .join('');
  return `${counts}${p.charge === 0 ? '' : `(${String(p.charge)})`}`;
}

/** Order-independent key of a set of substances. */
export function mixKey(formulas: readonly string[]): string {
  return formulas.map(speciesKey).sort().join('+');
}

/** Library records whose starting substances are exactly `formulas` (any order). */
export function recordsFor(
  formulas: readonly string[],
  library: readonly Reaction[] = REACTIONS,
): Reaction[] {
  const want = mixKey(formulas);
  return library.filter(
    (r) =>
      r.reactants.length === formulas.length && mixKey(r.reactants.map((t) => t.formula)) === want,
  );
}

function toEquation(r: Reaction): ParsedEquation {
  const side = (terms: Reaction['reactants']) =>
    terms.map((t) => ({ text: t.formula, formula: parseFormula(t.formula), given: t.coef }));
  return { reactants: side(r.reactants), products: side(r.products), reversible: r.reversible };
}

/** Checks a library equation with `balance.ts` (conservation + the balancer's own answer). */
export function checkEquation(r: Reaction): EquationCheck {
  const eq = toEquation(r);
  const coefs = [...r.reactants, ...r.products].map((t) => t.coef);
  const { ok, unbalanced } = checkCoefficients(eq, coefs);
  const solved = balance(eq);
  const minimal = solved.kind === 'balanced' && solved.coefficients.every((c, i) => c === coefs[i]);
  return { conserved: ok, unbalanced, minimal };
}

export function mixOutcome(
  formulas: readonly string[],
  library: readonly Reaction[] = REACTIONS,
): MixOutcome {
  const found = recordsFor(formulas, library);
  if (found.length > 1) return { kind: 'ambiguous', reactions: found };
  const reaction = found[0];
  if (!reaction) return { kind: 'unknown' };
  return {
    kind: 'library',
    reaction,
    // The library's own classification; the bench never infers solubility.
    precipitate: reaction.category === 'precipitation',
    check: checkEquation(reaction),
  };
}

/** "AgNO₃ + NaCl → AgCl + NaNO₃" from the record's coefficients (1 is not written). */
export function equationString(r: Pick<Reaction, 'reactants' | 'products' | 'reversible'>) {
  const side = (terms: Reaction['reactants']) =>
    terms.map((t) => `${t.coef > 1 ? String(t.coef) : ''}${formatFormula(t.formula)}`).join(' + ');
  return `${side(r.reactants)} ${r.reversible ? '⇌' : '→'} ${side(r.products)}`;
}

/** Model id used in evidence for a library record, and back. */
export const LIBRARY_MODEL = 'reactions';

export function libraryModelId(r: Pick<Reaction, 'id'>): string {
  return `${LIBRARY_MODEL}/${r.id}`;
}

export function reactionIdOf(model: string): string | null {
  const prefix = `${LIBRARY_MODEL}/`;
  return model.startsWith(prefix) && model.length > prefix.length
    ? model.slice(prefix.length)
    : null;
}
