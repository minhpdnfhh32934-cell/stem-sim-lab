import { create } from 'zustand';
import { EXAMPLES, currentFromElectrons } from './model';

export const TABS = ['force', 'measure'] as const;
export type Tab = (typeof TABS)[number];
export const LOADABLE = ['wire-60', 'electrons'] as const;
export type Loadable = (typeof LOADABLE)[number];

export interface MagneticState {
  tab: Tab;
  /** T, A, m, degrees between the wire and B⃗ (0–180). */
  B: number;
  I: number;
  L: number;
  alpha: number;
  /** The current runs the other way along the wire. */
  reversed: boolean;
}

/** Opens on question 1, tr. 63: 1 m, 3 A, 5·10⁻² T, 60°. */
export const useMagneticStore = create<MagneticState>()(() => ({
  tab: 'force',
  B: 5e-2,
  I: 3,
  L: 1,
  alpha: 60,
  reversed: false,
}));

const num = (v: unknown, lo: number, hi: number, old: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : old;

export function setMagnetic(patch: Partial<Record<keyof MagneticState, unknown>>): void {
  const s = useMagneticStore.getState();
  useMagneticStore.setState({
    tab: TABS.includes(patch.tab as Tab) ? (patch.tab as Tab) : s.tab,
    B: num(patch.B, 0, 100, s.B),
    I: num(patch.I, 0, 1e5, s.I),
    L: num(patch.L, 0, 1e4, s.L),
    alpha: num(patch.alpha, 0, 180, s.alpha),
    reversed: typeof patch.reversed === 'boolean' ? patch.reversed : s.reversed,
  });
}

/** Loads one of the questions of tr. 63 (inputs only; the app computes the force). */
export function loadExample(id: Loadable): void {
  const ex = EXAMPLES.find((e) => e.id === id);
  if (!ex) return;
  const n = (k: string) => (typeof ex[k] === 'number' ? ex[k] : undefined);
  const perSecond = n('electrons_per_second');
  setMagnetic({
    tab: 'force',
    B: n('B'),
    L: n('L'),
    alpha: n('angle_deg'),
    I: perSecond === undefined ? n('I') : currentFromElectrons(perSecond),
    reversed: false,
  });
}
