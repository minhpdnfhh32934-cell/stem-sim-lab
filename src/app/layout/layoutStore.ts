import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type LeftTab = 'library' | 'history';
export type BottomTab = 'graphs' | 'solution' | 'challenge' | 'data';

const LEFT_TABS: readonly LeftTab[] = ['library', 'history'];
const BOTTOM_TABS: readonly BottomTab[] = ['graphs', 'solution', 'challenge', 'data'];

/** Size limits in CSS pixels. Keep the defaults usable on a 1366×768 screen. */
export const LAYOUT_LIMITS = {
  left: { min: 200, max: 420, default: 256 },
  right: { min: 240, max: 480, default: 300 },
  // The smallest bottom panel still holds a whole chart: tab bar, graph picker, 120 px plot (UI-24).
  bottom: { min: 210, max: 520, default: 220 },
} as const;

type PanelSizeKey = keyof typeof LAYOUT_LIMITS;

/**
 * The lab panels (library, properties, graphs) are always shown; they can only be resized.
 * Presentation mode, the home page and the AI teacher page hide them (`AppShell`).
 */
export interface LayoutState {
  leftWidth: number;
  rightWidth: number;
  bottomHeight: number;
  leftTab: LeftTab;
  bottomTab: BottomTab;
  /** Presentation mode (for judges): hides side panels and enlarges text. Never persisted. */
  presentation: boolean;

  setSize: (panel: PanelSizeKey, px: number) => void;
  setLeftTab: (tab: LeftTab) => void;
  setBottomTab: (tab: BottomTab) => void;
  setPresentation: (on: boolean) => void;
  resetLayout: () => void;
}

type PersistedLayout = Pick<
  LayoutState,
  'leftWidth' | 'rightWidth' | 'bottomHeight' | 'leftTab' | 'bottomTab'
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
} as const satisfies PersistedLayout;

const SIZE_FIELD = { left: 'leftWidth', right: 'rightWidth', bottom: 'bottomHeight' } as const;

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      ...DEFAULT_LAYOUT,
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
      setPresentation: (presentation) => {
        set({ presentation });
      },
      resetLayout: () => {
        set({ ...DEFAULT_LAYOUT });
      },
    }),
    {
      name: 'stemsim.layout',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s): PersistedLayout => ({
        leftWidth: s.leftWidth,
        rightWidth: s.rightWidth,
        bottomHeight: s.bottomHeight,
        leftTab: s.leftTab,
        bottomTab: s.bottomTab,
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
        };
      },
    },
  ),
);
