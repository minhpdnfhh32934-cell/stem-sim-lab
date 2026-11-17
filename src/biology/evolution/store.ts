import { create } from 'zustand';
import { GEOLOGIC } from './model';

export const EVOLUTION_TABS = ['molecular', 'timescale'] as const;
export type EvolutionTab = (typeof EVOLUTION_TABS)[number];

export interface EvolutionState {
  tab: EvolutionTab;
  /** The period shown in detail on the timescale. */
  period: string;
}

/** Opens on Bảng 19.1; the timescale on the Cretaceous, the end of the dinosaurs. */
export const useEvolution = create<EvolutionState>()(() => ({
  tab: 'molecular',
  period: 'cretaceous',
}));

export function restoreEvolution(patch: Partial<Record<keyof EvolutionState, unknown>>): void {
  const s = useEvolution.getState();
  useEvolution.setState({
    tab: EVOLUTION_TABS.includes(patch.tab as EvolutionTab) ? (patch.tab as EvolutionTab) : s.tab,
    period: GEOLOGIC.some((p) => p.id === patch.period) ? (patch.period as string) : s.period,
  });
}
