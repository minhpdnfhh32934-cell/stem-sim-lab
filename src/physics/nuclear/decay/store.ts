import { create } from 'zustand';
import { ISOTOPES, isotope } from '../data';
import { fromSeconds, halfLifeSeconds, type TimeUnit } from '../decayModel';

export const TABS = ['law', 'random', 'safety'] as const;
export type Tab = (typeof TABS)[number];
export const UNITS: readonly TimeUnit[] = ['second', 'day', 'year'];
/** A Bảng 23.2 isotope, or a half-life the learner types (Rn-220, F-18 …). */
export const SOURCES = [...ISOTOPES.map((i) => i.id), 'custom'] as const;

export interface DecayState {
  tab: Tab;
  source: string;
  /** Half-life and the time shown, both in `unit` (the custom half-life is typed in it). */
  T: number;
  unit: TimeUnit;
  t: number;
  /** Nuclei at t = 0. */
  N0: number;
  /** "Find T" tool: share left (%) after a time (in `unit`). */
  leftPct: number;
  after: number;
  /** Random picture's seed; safety tab: dose at d₁, and the distances (m). */
  seed: number;
  dose1: number;
  d1: number;
  d2: number;
}

/** Opens on Rn-220: half of it left every 55 s (tr. 107). */
export const useDecayStore = create<DecayState>()(() => ({
  tab: 'law',
  source: 'custom',
  T: 55,
  unit: 'second',
  t: 110,
  N0: 1e6,
  leftPct: 25,
  after: 244,
  seed: 23,
  dose1: 1,
  d1: 1,
  d2: 2,
}));

const num = (v: unknown, lo: number, hi: number, old: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : old;

export function setDecay(patch: Partial<Record<keyof DecayState, unknown>>): void {
  const s = useDecayStore.getState();
  const source = (SOURCES as readonly string[]).includes(patch.source as string)
    ? (patch.source as string)
    : s.source;
  let unit = UNITS.includes(patch.unit as TimeUnit) ? (patch.unit as TimeUnit) : s.unit;
  let T = num(patch.T, 1e-9, 1e15, s.T);
  if (source !== 'custom') {
    // A Bảng 23.2 isotope brings its own half-life and unit.
    const iso = isotope(source);
    unit = iso.unit;
    T = fromSeconds(halfLifeSeconds(iso), unit);
  }
  useDecayStore.setState({
    tab: TABS.includes(patch.tab as Tab) ? (patch.tab as Tab) : s.tab,
    source,
    T,
    unit,
    t: num(patch.t, 0, 1000 * T, source !== s.source ? T : Math.min(s.t, 1000 * T)),
    N0: num(patch.N0, 1, 1e30, s.N0),
    leftPct: num(patch.leftPct, 1e-6, 99.999, s.leftPct),
    after: num(patch.after, 1e-9, 1e15, s.after),
    seed: typeof patch.seed === 'number' && Number.isInteger(patch.seed) ? patch.seed : s.seed,
    dose1: num(patch.dose1, 0, 1e9, s.dose1),
    d1: num(patch.d1, 1e-3, 1e6, s.d1),
    d2: num(patch.d2, 1e-3, 1e6, s.d2),
  });
}
