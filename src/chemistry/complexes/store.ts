import { create } from 'zustand';
import { COMPLEXES, SUBSTITUTIONS } from './model';

/* ───────── Bài 28: structure ───────── */

export interface ComplexState {
  id: string;
  labels: boolean;
}

/** Opens on [Cu(H₂O)₆]²⁺, the aqua complex of question 2 (tr. 135) and of tr. 136. */
export const useComplexStore = create<ComplexState>()(() => ({ id: 'cu_h2o_6', labels: true }));

export function setComplex(patch: Partial<Record<keyof ComplexState, unknown>>): void {
  const s = useComplexStore.getState();
  useComplexStore.setState({
    id: COMPLEXES.some((c) => c.id === patch.id) ? (patch.id as string) : s.id,
    labels: typeof patch.labels === 'boolean' ? patch.labels : s.labels,
  });
}

/* ───────── Bài 29: reactions ───────── */

export const REACTION_TABS = ['signs', 'substitution'] as const;
export type ReactionTab = (typeof REACTION_TABS)[number];

export interface ComplexReactionState {
  tab: ReactionTab;
  substitution: string;
}

/** Opens on the signs of complex formation with Cu²⁺ (tr. 138–139). */
export const useComplexReactionStore = create<ComplexReactionState>()(() => ({
  tab: 'signs',
  substitution: 'cu',
}));

export function setComplexReaction(
  patch: Partial<Record<keyof ComplexReactionState, unknown>>,
): void {
  const s = useComplexReactionStore.getState();
  useComplexReactionStore.setState({
    tab: REACTION_TABS.includes(patch.tab as ReactionTab) ? (patch.tab as ReactionTab) : s.tab,
    substitution: SUBSTITUTIONS.some((x) => x.id === patch.substitution)
      ? (patch.substitution as string)
      : s.substitution,
  });
}
