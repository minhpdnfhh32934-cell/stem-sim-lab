import { create } from 'zustand';

/**
 * "Làm mờ phần còn lại" (docs/BENCH_DESIGN.md §9.6, Advanced, decided 2026-11-02): whether the
 * parts that are not picked are dimmed when a part is picked (the division 3D views). On by
 * default, as before; never saved. Only the look changes, never the model.
 */
export const useDimRest = create<{ on: boolean }>(() => ({ on: true }));
