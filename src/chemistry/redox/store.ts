import { create } from 'zustand';
import { reactionById } from '../data/reactions';

/** "Phản ứng oxi hóa – khử": the library reaction shown, and an equation typed to look it up. */
export const useRedoxStore = create<{ id: string; equation: string }>(() => ({
  // The book opens Bài 15 with the blast furnace reaction (SGK tr. 71).
  id: 'fe2o3-co',
  equation: '',
}));

export function selectRedoxReaction(id: unknown): void {
  if (typeof id === 'string' && reactionById(id)) useRedoxStore.setState({ id });
}
