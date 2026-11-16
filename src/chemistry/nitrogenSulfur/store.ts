import { create } from 'zustand';
import { SUBSTANCES, type Element } from './model';

export interface NsState {
  element: Element;
  /** The substance whose card is open. */
  selected: string;
  /** Formulas the learner placed on the axes themselves (at most 8 each). */
  extraN: string[];
  extraS: string[];
}

export const EXTRA_MAX = 8;

export const useNsStore = create<NsState>()(() => ({
  element: 'N',
  selected: 'n2',
  extraN: [],
  extraS: [],
}));

const formulas = (v: unknown, old: string[]) =>
  Array.isArray(v) && v.every((x) => typeof x === 'string' && x.length > 0 && x.length < 40)
    ? (v as string[]).slice(-EXTRA_MAX)
    : old;

/** Applies saved or chosen values; anything else is ignored. */
export function setNs(patch: Partial<Record<keyof NsState, unknown>>): void {
  const s = useNsStore.getState();
  const element: Element =
    patch.element === 'N' || patch.element === 'S' ? patch.element : s.element;
  const selected =
    typeof patch.selected === 'string' && SUBSTANCES.some((x) => x.id === patch.selected)
      ? patch.selected
      : s.selected;
  useNsStore.setState({
    element,
    selected,
    extraN: formulas(patch.extraN, s.extraN),
    extraS: formulas(patch.extraS, s.extraS),
  });
}

/** Adds a formula the learner typed to the current element's axis (no duplicates). */
export function addFormula(formula: string): void {
  const s = useNsStore.getState();
  const f = formula.trim();
  if (!f) return;
  const key = s.element === 'N' ? 'extraN' : 'extraS';
  const list = s[key].filter((x) => x !== f);
  setNs({ [key]: [...list, f] });
}

export function removeFormula(formula: string): void {
  const s = useNsStore.getState();
  const key = s.element === 'N' ? 'extraN' : 'extraS';
  setNs({ [key]: s[key].filter((x) => x !== formula) });
}
