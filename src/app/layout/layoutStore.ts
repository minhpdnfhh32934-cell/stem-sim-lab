import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { SUBJECTS, type Subject } from '@/app/workspaceStore';

export type LeftTab = 'library' | 'history';
export type BottomTab = 'graphs' | 'solution' | 'challenge' | 'data';

/** Tabs of the bench notebook (0.8.1): the bottom panel's tabs, the Science Card, AI, a module's table. */
export type NotebookTab = BottomTab | 'science' | 'ai' | 'module';

const LEFT_TABS: readonly LeftTab[] = ['library', 'history'];
const BOTTOM_TABS: readonly BottomTab[] = ['graphs', 'solution', 'challenge', 'data'];
const NOTEBOOK_TABS: readonly NotebookTab[] = [...BOTTOM_TABS, 'science', 'ai', 'module'];

/** Size limits in CSS pixels. Keep the defaults usable on a 1366×768 screen. */
export const LAYOUT_LIMITS = {
  left: { min: 200, max: 420, default: 256 },
  right: { min: 240, max: 480, default: 300 },
  // The smallest bottom panel still holds a whole chart: tab bar, graph picker, 120 px plot (UI-24).
  bottom: { min: 210, max: 520, default: 220 },
  // Bench shell (0.8.1, docs/BENCH_DESIGN.md §8): the tray on the right, the notebook drawer on the left.
  tray: { min: 256, max: 420, default: 304 },
  notebook: { min: 320, max: 520, default: 352 },
} as const;

/** Bench notebook rail and folded-tray spine width (docs/BENCH_DESIGN.md §8). */
export const BENCH_RAIL = 64;
/** Narrowest stage a drawer may leave before it overlays the stage instead of pushing it. */
export const MIN_STAGE_WIDTH = 560;

/**
 * Whether the open notebook pushes the stage aside (true) or opens over it (false): it pushes only
 * if the stage keeps at least `minStage` px between the rail, the drawer and the tray or its spine.
 */
export function notebookPushes(
  viewport: number,
  layout: Pick<LayoutState, 'trayFolded' | 'trayWidth' | 'notebookWidth'>,
  minStage: number = MIN_STAGE_WIDTH,
): boolean {
  const tray = layout.trayFolded ? BENCH_RAIL : layout.trayWidth;
  return viewport - BENCH_RAIL - layout.notebookWidth - tray >= minStage;
}

type PanelSizeKey = keyof typeof LAYOUT_LIMITS;

/**
 * The lab panels (library, properties, graphs) are always shown; they can only be resized.
 * Presentation mode, the home page and the AI teacher page hide them (`AppShell`). The bench shell
 * (0.8.1) folds its tray to a 64 px spine instead (user decision 2026-11-02); nothing reaches zero.
 */
export interface LayoutState {
  leftWidth: number;
  rightWidth: number;
  bottomHeight: number;
  leftTab: LeftTab;
  bottomTab: BottomTab;
  /** Bench (v2): the tray folded to its 64 px spine (user decision 2026-11-02), and its width. */
  trayFolded: boolean;
  trayWidth: number;
  notebookWidth: number;
  /** Bench (v2): the notebook tab last chosen in each subject. */
  notebookTabBySubject: Partial<Record<Subject, NotebookTab>>;
  /** Bench: the notebook drawer is open. Never persisted (it opens closed). */
  notebookOpen: boolean;
  /** Presentation mode (for judges): hides side panels and enlarges text. Never persisted. */
  presentation: boolean;

  setSize: (panel: PanelSizeKey, px: number) => void;
  setLeftTab: (tab: LeftTab) => void;
  setBottomTab: (tab: BottomTab) => void;
  setTrayFolded: (folded: boolean) => void;
  setNotebookTab: (subject: Subject, tab: NotebookTab) => void;
  setNotebookOpen: (open: boolean) => void;
  setPresentation: (on: boolean) => void;
  resetLayout: () => void;
}

type PersistedLayout = Pick<
  LayoutState,
  | 'leftWidth'
  | 'rightWidth'
  | 'bottomHeight'
  | 'leftTab'
  | 'bottomTab'
  | 'trayFolded'
  | 'trayWidth'
  | 'notebookWidth'
  | 'notebookTabBySubject'
>;

export function clampSize(panel: PanelSizeKey, px: number): number {
  const { min, max, default: fallback } = LAYOUT_LIMITS[panel];
  if (!Number.isFinite(px)) return fallback;
  return Math.round(Math.min(max, Math.max(min, px)));
}

const DEFAULT_LAYOUT = {
  leftWidth: LAYOUT_LIMITS.left.default,
  rightWidth: LAYOUT_LIMITS.right.default,
  bottomHeight: LAYOUT_LIMITS.bottom.default,
  leftTab: 'library',
  bottomTab: 'graphs',
  trayFolded: false,
  trayWidth: LAYOUT_LIMITS.tray.default,
  notebookWidth: LAYOUT_LIMITS.notebook.default,
  notebookTabBySubject: {},
} as const satisfies PersistedLayout;

const SIZE_FIELD = {
  left: 'leftWidth',
  right: 'rightWidth',
  bottom: 'bottomHeight',
  tray: 'trayWidth',
  notebook: 'notebookWidth',
} as const;

/** Only known subjects and tabs survive a load. */
function notebookTabs(v: unknown): Partial<Record<Subject, NotebookTab>> {
  if (typeof v !== 'object' || v === null) return {};
  const out: Partial<Record<Subject, NotebookTab>> = {};
  for (const subject of SUBJECTS) {
    const tab = NOTEBOOK_TABS.find((t) => t === (v as Record<string, unknown>)[subject]);
    if (tab) out[subject] = tab;
  }
  return out;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      ...DEFAULT_LAYOUT,
      notebookOpen: false,
      presentation: false,
      setSize: (panel, px) => {
        set({ [SIZE_FIELD[panel]]: clampSize(panel, px) });
      },
      setLeftTab: (leftTab) => {
        set({ leftTab });
      },
      setBottomTab: (bottomTab) => {
        set({ bottomTab });
      },
      setTrayFolded: (trayFolded) => {
        set({ trayFolded });
      },
      setNotebookTab: (subject, tab) => {
        set((s) => ({ notebookTabBySubject: { ...s.notebookTabBySubject, [subject]: tab } }));
      },
      setNotebookOpen: (notebookOpen) => {
        set({ notebookOpen });
      },
      setPresentation: (presentation) => {
        set({ presentation });
      },
      resetLayout: () => {
        set({ ...DEFAULT_LAYOUT });
      },
    }),
    {
      name: 'stemsim.layout',
      // v2 (0.8.1): the bench fields. A v1 state needs no change: `merge` fills in what is missing.
      version: 2,
      migrate: (persisted) => persisted as PersistedLayout,
      storage: createJSONStorage(() => localStorage),
      partialize: (s): PersistedLayout => ({
        leftWidth: s.leftWidth,
        rightWidth: s.rightWidth,
        bottomHeight: s.bottomHeight,
        leftTab: s.leftTab,
        bottomTab: s.bottomTab,
        trayFolded: s.trayFolded,
        trayWidth: s.trayWidth,
        notebookWidth: s.notebookWidth,
        notebookTabBySubject: s.notebookTabBySubject,
      }),
      // Only known fields are restored, sizes re-clamped (limits may change). Until 0.4.3 the
      // panels could be hidden (`leftOpen`/`rightOpen`/`bottomOpen` were saved): those flags are
      // ignored, so a panel hidden back then is shown again.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Record<keyof PersistedLayout, unknown>>;
        const num = (v: unknown, fallback: number) => (typeof v === 'number' ? v : fallback);
        return {
          ...current,
          leftWidth: clampSize('left', num(p.leftWidth, current.leftWidth)),
          rightWidth: clampSize('right', num(p.rightWidth, current.rightWidth)),
          bottomHeight: clampSize('bottom', num(p.bottomHeight, current.bottomHeight)),
          leftTab: LEFT_TABS.find((t) => t === p.leftTab) ?? current.leftTab,
          bottomTab: BOTTOM_TABS.find((t) => t === p.bottomTab) ?? current.bottomTab,
          trayFolded: typeof p.trayFolded === 'boolean' ? p.trayFolded : current.trayFolded,
          trayWidth: clampSize('tray', num(p.trayWidth, current.trayWidth)),
          notebookWidth: clampSize('notebook', num(p.notebookWidth, current.notebookWidth)),
          notebookTabBySubject: notebookTabs(p.notebookTabBySubject),
        };
      },
    },
  ),
);
