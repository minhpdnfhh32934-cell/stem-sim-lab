import { create } from 'zustand';
import { BOOK_CELLS_WITH_CROSSOVER, BOOK_COUNTS } from './model';

export const LINKAGE_TABS = ['testcross', 'counts'] as const;
export type LinkageTab = (typeof LINKAGE_TABS)[number];

export interface LinkageState {
  tab: LinkageTab;
  /** The F1 parent of the testcross: the male (no crossing over) or the female. */
  parent: 'male' | 'female';
  /** Share of the female's meiotic cells with a crossover (0–1). */
  cells: number;
  counts: number[];
}

/** Opens on Hình 11.2: the F1 female, 34 % of cells crossing over. */
export const useLinkage = create<LinkageState>()(() => ({
  tab: 'testcross',
  parent: 'female',
  cells: BOOK_CELLS_WITH_CROSSOVER,
  counts: [...BOOK_COUNTS],
}));

export function restoreLinkage(patch: Partial<Record<keyof LinkageState, unknown>>): void {
  const s = useLinkage.getState();
  const counts =
    Array.isArray(patch.counts) && patch.counts.length === 4
      ? patch.counts.map((c, i) =>
          typeof c === 'number' && Number.isFinite(c)
            ? Math.max(0, Math.round(c))
            : (s.counts[i] ?? 0),
        )
      : s.counts;
  useLinkage.setState({
    tab: LINKAGE_TABS.includes(patch.tab as LinkageTab) ? (patch.tab as LinkageTab) : s.tab,
    parent: patch.parent === 'male' || patch.parent === 'female' ? patch.parent : s.parent,
    cells:
      typeof patch.cells === 'number' && Number.isFinite(patch.cells)
        ? Math.min(1, Math.max(0, patch.cells))
        : s.cells,
    counts,
  });
}
