import { create } from 'zustand';
import { GROUPS, ISOMERS, PROBLEMS } from './model';

export type Tab = 'groups' | 'formula' | 'isomers';
export const TABS: readonly Tab[] = ['groups', 'formula', 'isomers'];

export interface OrganicState {
  tab: Tab;
  /** Functional group picked (Bảng 10.1). */
  group: string;
  /** Mass percentages typed in; null = "the rest". */
  C: number | null;
  H: number | null;
  O: number | null;
  /** Molar mass from the spectrum's [M⁺] (g/mol). */
  M: number;
  /** Molecular formula whose isomers are shown. */
  isomerSet: string;
}

const first = PROBLEMS[0];

export const useOrganicStore = create<OrganicState>()(() => ({
  tab: 'groups',
  group: GROUPS[1]?.id ?? 'alcohol',
  C: first?.percent.C ?? 78.94,
  H: first?.percent.H ?? 10.53,
  O: first?.percent.O ?? 10.53,
  M: first?.M ?? 152,
  isomerSet: ISOMERS[0]?.formula ?? 'C3H6O',
}));

const pctOf = (v: unknown, old: number | null) =>
  v === null ? null : typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100 ? v : old;

/** Applies saved or typed values; a `problem` id loads that worked example. */
export function setOrganic(
  patch: Partial<Record<keyof OrganicState, unknown>> & { problem?: string },
): void {
  const s = useOrganicStore.getState();
  const p = PROBLEMS.find((x) => x.id === patch.problem);
  const src = p
    ? { ...patch, C: p.percent.C ?? null, H: p.percent.H ?? null, O: p.percent.O ?? null, M: p.M }
    : patch;
  useOrganicStore.setState({
    tab: TABS.includes(src.tab as Tab) ? (src.tab as Tab) : s.tab,
    group: GROUPS.some((g) => g.id === src.group) ? (src.group as string) : s.group,
    C: 'C' in src ? pctOf(src.C, s.C) : s.C,
    H: 'H' in src ? pctOf(src.H, s.H) : s.H,
    O: 'O' in src ? pctOf(src.O, s.O) : s.O,
    M:
      typeof src.M === 'number' && Number.isFinite(src.M) && src.M > 0 && src.M < 2000
        ? src.M
        : s.M,
    isomerSet: ISOMERS.some((i) => i.formula === src.isomerSet)
      ? (src.isomerSet as string)
      : s.isomerSet,
  });
}
