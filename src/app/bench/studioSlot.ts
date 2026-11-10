import { create } from 'zustand';

/**
 * The live stage beside a guided lesson (docs/BENCH_DESIGN.md §9.7): the studio room's right
 * column, where a lesson portals the lab's own stage and bench edge (`PhysicsLive`).
 */
export const useStudioSlot = create<{ el: HTMLElement | null }>(() => ({ el: null }));
