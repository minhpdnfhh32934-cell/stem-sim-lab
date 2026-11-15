import { balancedCoefficients, type Reaction } from '../data/reactions';
import { parseFormula } from '../formula';
import { oxidationNumbers, type OxResult } from './oxidation';

/**
 * Redox analysis of a library equation: every species' oxidation numbers (`oxidation.ts`), the
 * coefficients from the exact balancer, then which atoms change, the electrons they give or take,
 * and the oxidising and reducing agents. Nothing is decided when one species is refused.
 */

export interface SpeciesOx {
  formula: string;
  coef: number;
  side: 'reactant' | 'product';
  ox: OxResult;
}

/** Atoms of one element going from one oxidation number to another (coefficients applied). */
export interface Change {
  el: string;
  from: number;
  to: number;
  atoms: number;
  /** Electrons given (from < to) or taken (from > to): |to − from| · atoms. */
  electrons: number;
  /** Reactant species carrying the atoms before, and product species after. */
  fromSpecies: string[];
  toSpecies: string[];
  /**
   * The book's Bước 2–3 (SGK tr. 74): one process is written for `unit` atoms (2 for O₂ → 2O,
   * 2Cl → Cl₂, else 1) and multiplied by `multiplier` so the electrons given equal those taken.
   */
  unit: number;
  multiplier: number;
}

export type RedoxAnalysis = {
  species: SpeciesOx[];
  coefficientsBy: 'balancer' | 'library';
} & (
  | { kind: 'undecided'; refused: SpeciesOx[] }
  | { kind: 'notRedox' }
  /** An element with several values on both sides: the atoms cannot be paired from formulas. */
  | { kind: 'ambiguous'; elements: string[] }
  | {
      kind: 'redox';
      /** Oxidation (the number goes up: electrons given) and reduction (it goes down). */
      oxidised: Change[];
      reduced: Change[];
      electrons: number;
      /** Reactants that are oxidised (reducing agents) and reduced (oxidising agents). */
      reducingAgents: string[];
      oxidisingAgents: string[];
    }
);

interface Entry {
  value: number;
  atoms: number;
  formula: string;
}

const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];

type Draft = Omit<Change, 'electrons' | 'unit' | 'multiplier'>;

/** Adds a change, merging it with an earlier one of the same element, start and end. */
function push(list: Draft[], c: Draft): void {
  const same = list.find((x) => x.el === c.el && x.from === c.from && x.to === c.to);
  if (!same) {
    list.push({ ...c });
    return;
  }
  same.atoms += c.atoms;
  same.fromSpecies = union(same.fromSpecies, c.fromSpecies);
  same.toSpecies = union(same.toSpecies, c.toSpecies);
}

/** Atoms in one molecule of a free element (O₂ → 2), or 1 for anything else. */
export function moleculeAtoms(species: string[]): number {
  const [only] = species;
  if (species.length !== 1 || only === undefined) return 1;
  const { counts, charge } = parseFormula(only);
  const [n] = [...counts.values()];
  return counts.size === 1 && charge === 0 && n !== undefined ? n : 1;
}

function finish(c: Draft): Change {
  const unit =
    [moleculeAtoms(c.fromSpecies), moleculeAtoms(c.toSpecies), 1].find(
      (u) => u > 1 && c.atoms % u === 0,
    ) ?? 1;
  return {
    ...c,
    electrons: Math.abs(c.to - c.from) * c.atoms,
    unit,
    multiplier: c.atoms / unit,
  };
}

export function analyzeRedox(r: Pick<Reaction, 'reactants' | 'products'>): RedoxAnalysis {
  const { coefficients, by } = balancedCoefficients(r);
  const terms = [
    ...r.reactants.map((t) => ({ formula: t.formula, side: 'reactant' as const })),
    ...r.products.map((t) => ({ formula: t.formula, side: 'product' as const })),
  ];
  const species: SpeciesOx[] = terms.map((t, i) => ({
    ...t,
    coef: coefficients[i] ?? 1,
    ox: oxidationNumbers(t.formula),
  }));
  const base = { species, coefficientsBy: by };
  const refused = species.filter((s) => !s.ox.ok);
  if (refused.length) return { ...base, kind: 'undecided', refused };

  const entries = (side: SpeciesOx['side'], el: string): Entry[] =>
    species.flatMap((s) => {
      const value = s.side === side && s.ox.ok ? s.ox.values.get(el) : undefined;
      const n = parseFormula(s.formula).counts.get(el) ?? 0;
      return value === undefined ? [] : [{ value, atoms: n * s.coef, formula: s.formula }];
    });
  const elements = [...new Set(species.flatMap((s) => [...parseFormula(s.formula).counts.keys()]))];
  const drafts: Draft[] = [];
  const ambiguous: string[] = [];
  for (const el of elements) {
    const before = entries('reactant', el);
    const after = entries('product', el);
    const rv = [...new Set(before.map((e) => e.value))];
    const pv = [...new Set(after.map((e) => e.value))];
    const [r0] = rv;
    const [p0] = pv;
    if (rv.length === 1 && r0 !== undefined) {
      for (const e of after)
        if (e.value !== r0)
          push(drafts, {
            el,
            from: r0,
            to: e.value,
            atoms: e.atoms,
            fromSpecies: before.map((b) => b.formula),
            toSpecies: [e.formula],
          });
    } else if (pv.length === 1 && p0 !== undefined) {
      for (const e of before)
        if (e.value !== p0)
          push(drafts, {
            el,
            from: e.value,
            to: p0,
            atoms: e.atoms,
            fromSpecies: [e.formula],
            toSpecies: after.map((a) => a.formula),
          });
    } else ambiguous.push(el);
  }
  if (ambiguous.length) return { ...base, kind: 'ambiguous', elements: ambiguous };
  const changes = drafts.map(finish);
  if (!changes.length) return { ...base, kind: 'notRedox' };
  const oxidised = changes.filter((c) => c.to > c.from);
  const reduced = changes.filter((c) => c.to < c.from);
  return {
    ...base,
    kind: 'redox',
    oxidised,
    reduced,
    // Equal to the electrons taken: atoms and charge are conserved (tested).
    electrons: oxidised.reduce((s, c) => s + c.electrons, 0),
    reducingAgents: [...new Set(oxidised.flatMap((c) => c.fromSpecies))],
    oxidisingAgents: [...new Set(reduced.flatMap((c) => c.fromSpecies))],
  };
}
