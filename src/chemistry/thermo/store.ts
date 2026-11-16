import { create } from 'zustand';
import { ENTHALPY_REACTION_IDS } from './enthalpy';

/** "Biến thiên enthalpy …": the library reaction shown (the book's methane example by default). */
export const useEnthalpyStore = create<{ id: string }>(() => ({ id: 'ch4-combustion' }));

export function selectEnthalpyReaction(id: unknown): void {
  if (typeof id === 'string' && ENTHALPY_REACTION_IDS.includes(id))
    useEnthalpyStore.setState({ id });
}
