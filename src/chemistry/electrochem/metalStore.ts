import { create } from 'zustand';
import { REAGENTS, SALT_METALS, TEST_METALS, type Reagent } from './model';

export const METAL_TABS = ['reactions', 'physical'] as const;
export type MetalTab = (typeof METAL_TABS)[number];

export interface MetalState {
  tab: MetalTab;
  metal: string;
  reagent: Reagent;
  /** The metal whose salt solution is used (its Mⁿ⁺ ion). */
  salt: string;
}

/** Opens on the book's example: iron with dilute sulfuric acid (tr. 93). */
export const useMetalStore = create<MetalState>()(() => ({
  tab: 'reactions',
  metal: 'Fe',
  reagent: 'acid',
  salt: 'Cu',
}));

export function setMetal(patch: Partial<Record<keyof MetalState, unknown>>): void {
  const s = useMetalStore.getState();
  const ids = (cs: readonly { id: string }[]) => cs.map((c) => c.id);
  const pick = (list: readonly string[], v: unknown, keep: string) =>
    typeof v === 'string' && list.includes(v) ? v : keep;
  useMetalStore.setState({
    tab: METAL_TABS.includes(patch.tab as MetalTab) ? (patch.tab as MetalTab) : s.tab,
    metal: pick(ids(TEST_METALS), patch.metal, s.metal),
    reagent: REAGENTS.includes(patch.reagent as Reagent) ? (patch.reagent as Reagent) : s.reagent,
    salt: pick(ids(SALT_METALS), patch.salt, s.salt),
  });
}
