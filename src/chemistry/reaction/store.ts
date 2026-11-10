import { create } from 'zustand';
import type { ReactionCategory } from '../data/reactions';

export interface ReactionState {
  id: string;
  /** Position on the mechanism timeline (frame index, fractional while animating). */
  t: number;
  playing: boolean;
  /** Pause briefly on every key frame while playing. */
  stepPause: boolean;
  /** Playback speed of the mechanism (the bench edge's 0,5× · 1× · 2×). */
  speed: number;
  arrows: boolean;
  labels: boolean;
  query: string;
  category: ReactionCategory | 'all' | 'mechanism';
  /** Equation typed in the balancer. */
  equation: string;
}

export const useReactionStore = create<ReactionState>()(() => ({
  id: 'sn2-ch3br',
  t: 0,
  playing: false,
  stepPause: true,
  speed: 1,
  arrows: true,
  labels: true,
  query: '',
  category: 'all',
  equation: 'Fe + O2 -> Fe2O3',
}));

export function selectReaction(id: string): void {
  useReactionStore.setState({ id, t: 0, playing: false });
}
