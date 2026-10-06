import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type LeftTab = 'library' | 'history';
export type BottomTab = 'graphs' | 'solution' | 'challenge' | 'data';

/** Size limits in CSS pixels. Keep the defaults usable on a 1366×768 screen. */
export const LAYOUT_LIMITS = {
  left: { min: 200, max: 420, default: 256 },
  right: { min: 240, max: 480, default: 300 },
  bottom: { min: 120, max: 520, default: 220 },
} as const;

type PanelSizeKey = keyof typeof LAYOUT_LIMITS;

export interface LayoutState {
  leftWidth: number;
  rightWidth: number;
  bottomHeight: number;
  leftOpen: boolean;
  rightOpen: boolean;
  bottomOpen: boolean;
  leftTab: LeftTab;
  bottomTab: BottomTab;
  /** Presentation mode (for judges): hides side panels and enlarges text. Never persisted. */
  presentation: boolean;

  setSize: (panel: PanelSizeKey, px: number) => void;
  toggle: (panel: 'left' | 'right' | 'bottom') => void;
  setLeftTab: (tab: LeftTab) => void;
  setBottomTab: (tab: BottomTab) => void;
  setPresentation: (on: boolean) => void;
  resetLayout: () => void;
}

export function clampSize(panel: PanelSizeKey, px: number): number {
  const { min, max, default: fallback } = LAYOUT_LIMITS[panel];
  if (!Number.isFinite(px)) return fallback;
  return Math.round(Math.min(max, Math.max(min, px)));
}

const DEFAULT_LAYOUT = {
  leftWidth: LAYOUT_LIMITS.left.default,
  rightWidth: LAYOUT_LIMITS.right.default,
  bottomHeight: LAYOUT_LIMITS.bottom.default,
  leftOpen: true,
  rightOpen: true,
  bottomOpen: true,
  leftTab: 'library',
  bottomTab: 'graphs',
} as const satisfies Partial<LayoutState>;

const SIZE_FIELD = { left: 'leftWidth', right: 'rightWidth', bottom: 'bottomHeight' } as const;
const OPEN_FIELD = { left: 'leftOpen', right: 'rightOpen', bottom: 'bottomOpen' } as const;

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      ...DEFAULT_LAYOUT,
      presentation: false,
      setSize: (panel, px) => {
        set({ [SIZE_FIELD[panel]]: clampSize(panel, px) });
      },
      toggle: (panel) => {
        set((s) => ({ [OPEN_FIELD[panel]]: !s[OPEN_FIELD[panel]] }));
      },
      setLeftTab: (leftTab) => {
        set({ leftTab, leftOpen: true });
      },
      setBottomTab: (bottomTab) => {
        set({ bottomTab, bottomOpen: true });
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
      partialize: (s) => ({
        leftWidth: s.leftWidth,
        rightWidth: s.rightWidth,
        bottomHeight: s.bottomHeight,
        leftOpen: s.leftOpen,
        rightOpen: s.rightOpen,
        bottomOpen: s.bottomOpen,
        leftTab: s.leftTab,
        bottomTab: s.bottomTab,
      }),
      // Re-clamp persisted sizes: limits may change between versions.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<LayoutState>;
        return {
          ...current,
          ...p,
          leftWidth: clampSize('left', p.leftWidth ?? current.leftWidth),
          rightWidth: clampSize('right', p.rightWidth ?? current.rightWidth),
          bottomHeight: clampSize('bottom', p.bottomHeight ?? current.bottomHeight),
        };
      },
    },
  ),
);
