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
      products: number;
      reactants: number;
      dH: number;
      /** Decimals of the least precise value used: the result is shown to that many. */
      decimals: number;
      kind: 'exothermic' | 'endothermic' | 'none';
    }
  | { ok: false; missing: EnthalpyTerm[] }
);

/** Decimals as the value is written in the data ("−285.8" → 1, "−314.55" → 2, "0" → 0). */
export const decimalsOf = (x: number) => (String(x).split('.')[1] ?? '').length;

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
  const sum = (side: EnthalpyTerm['side']) =>
    terms
      .filter((t) => t.side === side)
      .reduce((s, t) => s + t.coef * (t.data?.dfh_kj_mol ?? 0), 0);
  const decimals = Math.max(...terms.map((t) => decimalsOf(t.data?.dfh_kj_mol ?? 0)));
  const round = (x: number) => Number(x.toFixed(decimals)) + 0;
  const products = round(sum('product'));
  const reactants = round(sum('reactant'));
  const dH = round(products - reactants);
  return {
    ...base,
    ok: true,
    products,
    reactants,
    dH,
    decimals,
    kind: dH < 0 ? 'exothermic' : dH > 0 ? 'endothermic' : 'none',
  };
}

/** The reactions the topic offers, in the data's order. */
export const ENTHALPY_REACTION_IDS = ENTHALPY_REACTIONS.map((r) => r.id);
