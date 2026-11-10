import { create } from 'zustand';
import { CRYSTALS, type CrystalId } from './lattice';

export const useCrystalStore = create<{ id: CrystalId }>(() => ({ id: 'bcc' }));

/** Shows one structure; anything else (an old or broken file) is ignored. */
export function selectCrystal(id: unknown): void {
  if (CRYSTALS.includes(id as CrystalId)) useCrystalStore.setState({ id: id as CrystalId });
}
