import { useContext } from 'react';
import { create } from 'zustand';
import { BenchContext } from './shellMode';

/** The bench edge's slot for a module view's own player (docs/BENCH_DESIGN.md §8, B5). */
export const useEdgeSlot = create<{ el: HTMLElement | null }>(() => ({ el: null }));

/**
 * True when a module view's player goes to the bench edge: the bench shell with its edge on
 * screen. A guided lesson's room (§9.7) has no edge, so a lesson keeps its own player there.
 */
export function useOnEdge(): boolean {
  const bench = useContext(BenchContext);
  const el = useEdgeSlot((s) => s.el);
  return bench && el !== null;
}
