import { create } from 'zustand';

/** The bench edge's slot for a module view's own player (docs/BENCH_DESIGN.md §8, B5). */
export const useEdgeSlot = create<{ el: HTMLElement | null }>(() => ({ el: null }));
