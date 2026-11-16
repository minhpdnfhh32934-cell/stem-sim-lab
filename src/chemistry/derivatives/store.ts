import { create } from 'zustand';
import { ACIDS, C_MAX, C_MIN, ELIMINATIONS } from './model';

const pick = <T extends string>(v: unknown, ok: readonly T[], old: T): T =>
  ok.includes(v as T) ? (v as T) : old;

/** Chương 5 (Bài 19–21): what the stage shows and which elimination is open. */
export type HapTab = 'compare' | 'alcohols' | 'zaitsev';
export const HAP_TABS: readonly HapTab[] = ['compare', 'alcohols', 'zaitsev'];

export interface HapState {
  tab: HapTab;
  elimination: string;
}

export const useHapStore = create<HapState>()(() => ({
  tab: 'compare',
  elimination: '2-bromobutane',
}));

export function setHap(patch: Partial<Record<keyof HapState, unknown>>): void {
  const s = useHapStore.getState();
  useHapStore.setState({
    tab: pick(patch.tab, HAP_TABS, s.tab),
    elimination: pick(
      patch.elimination,
      ELIMINATIONS.map((e) => e.id),
      s.elimination,
    ),
  });
}

/** Chương 6 (Bài 23–24): comparison, one series of the book's tables, or acid strength. */
export type CaTab = 'compare' | 'series' | 'acid';
export const CA_TABS: readonly CaTab[] = ['compare', 'series', 'acid'];
export type CaSeries = 'aldehyde' | 'ketone' | 'acid';
export const CA_SERIES: readonly CaSeries[] = ['aldehyde', 'ketone', 'acid'];

export interface CaState {
  tab: CaTab;
  series: CaSeries;
  /** Acid of Bảng 24.3 (its formula). */
  acid: string;
  /** Analytical concentration (mol/L). */
  C: number;
}

export const useCaStore = create<CaState>()(() => ({
  tab: 'compare',
  series: 'acid',
  acid: 'CH3COOH',
  C: 0.1,
}));

export function setCa(patch: Partial<Record<keyof CaState, unknown>>): void {
  const s = useCaStore.getState();
  const C =
    typeof patch.C === 'number' && Number.isFinite(patch.C)
      ? Math.min(C_MAX, Math.max(C_MIN, patch.C))
      : s.C;
  useCaStore.setState({
    tab: pick(patch.tab, CA_TABS, s.tab),
    series: pick(patch.series, CA_SERIES, s.series),
    acid: pick(
      patch.acid,
      ACIDS.map((a) => a.formula),
      s.acid,
    ),
    C,
  });
}
