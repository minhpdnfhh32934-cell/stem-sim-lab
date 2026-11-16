import {
  ENTHALPY_REACTIONS,
  formationEnthalpy,
  type FormationEnthalpy,
  type Phase,
} from '../data/enthalpy';
import { balancedCoefficients, reactionById, type Reaction } from '../data/reactions';

/**
 * HH10 Bài 17: ΔrH°298 = Σ ν·ΔfH°298(products) − Σ ν·ΔfH°298(reactants), the coefficients ν from
 * the exact balancer, each ΔfH° from data/formation_enthalpy.json (the book's Bảng 17.1 first).
 */

export interface EnthalpyTerm {
  formula: string;
  phase: Phase;
  coef: number;
  side: 'reactant' | 'product';
  /** The data row, or undefined when no source gives the species. */
  data: FormationEnthalpy | undefined;
}

export type ReactionEnthalpy = {
  reaction: Reaction;
  terms: EnthalpyTerm[];
  coefficientsBy: 'balancer' | 'library';
} & (
  | {
      ok: true;
      /** Exact sums (each shown to the decimals of its own side's values). */
      products: number;
      reactants: number;
      productsDecimals: number;
      reactantsDecimals: number;
      /** Exact ΔrH, and ΔrH rounded to `decimals`. */
      dHExact: number;
      dH: number;
      /** Decimals of the least precise value used (an element's defined 0 does not count). */
      decimals: number;
      kind: 'exothermic' | 'endothermic' | 'none';
    }
  | { ok: false; missing: EnthalpyTerm[] }
);

export function reactionEnthalpy(id: string): ReactionEnthalpy | undefined {
  const reaction = reactionById(id);
  const phases = ENTHALPY_REACTIONS.find((r) => r.id === id)?.phases;
  if (!reaction || !phases) return undefined;
  const { coefficients, by } = balancedCoefficients(reaction);
  const sides = [
    ...reaction.reactants.map((t) => ({ formula: t.formula, side: 'reactant' as const })),
    ...reaction.products.map((t) => ({ formula: t.formula, side: 'product' as const })),
  ];
  const terms: EnthalpyTerm[] = sides.map((t, i) => {
    const phase = phases[t.formula] ?? 'g';
    return { ...t, phase, coef: coefficients[i] ?? 1, data: formationEnthalpy(t.formula, phase) };
  });
  const base = { reaction, terms, coefficientsBy: by };
  const missing = terms.filter((t) => !t.data || phases[t.formula] === undefined);
  if (missing.length) return { ...base, ok: false, missing };
  const dec = (t: EnthalpyTerm) => t.data?.decimals ?? 0;
  // Integer arithmetic in units of the finest printed decimal: no binary rounding error.
  const finest = Math.max(...terms.map(dec));
  const scale = 10 ** finest;
  const sideOf = (side: EnthalpyTerm['side']) => terms.filter((t) => t.side === side);
  const sumInt = (side: EnthalpyTerm['side']) =>
    sideOf(side).reduce((s, t) => s + t.coef * Math.round((t.data?.dfh_kj_mol ?? 0) * scale), 0);
  const productsInt = sumInt('product');
  const reactantsInt = sumInt('reactant');
  const dInt = productsInt - reactantsInt;
  const measured = terms.filter((t) => t.data?.source !== 'definition');
  const decimals = measured.length ? Math.min(...measured.map(dec)) : 0;
  // Half away from zero, on exact integers.
  const step = 10 ** (finest - decimals);
  const dH = (Math.sign(dInt) * Math.round(Math.abs(dInt) / step)) / 10 ** decimals + 0;
  return {
    ...base,
    ok: true,
    products: productsInt / scale + 0,
    reactants: reactantsInt / scale + 0,
    productsDecimals: Math.max(...sideOf('product').map(dec)),
    reactantsDecimals: Math.max(...sideOf('reactant').map(dec)),
    dHExact: dInt / scale + 0,
    dH,
    decimals,
    kind: dH < 0 ? 'exothermic' : dH > 0 ? 'endothermic' : 'none',
  };
}

/** The reactions the topic offers, in the data's order. */
export const ENTHALPY_REACTION_IDS = ENTHALPY_REACTIONS.map((r) => r.id);
