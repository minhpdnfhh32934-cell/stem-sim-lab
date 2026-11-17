import { create } from 'zustand';
import type { Generator } from './model';

export const TABS = ['flux', 'generator'] as const;
export type Tab = (typeof TABS)[number];

export interface InductionState {
  tab: Tab;
  /** Flux tab: the field and the angle of n⃗ to B⃗ before and after, one turn's area (m²), turns, Δt (s). */
  B1: number;
  B2: number;
  alpha1: number;
  alpha2: number;
  S: number;
  N: number;
  dt: number;
  /** Generator tab. */
  gN: number;
  gB: number;
  gS: number;
  f: number;
  alpha0: number;
  /** Time cursor (s) and whether the three-phase e.m.f.s are drawn. */
  t: number;
  threePhase: boolean;
}

/**
 * The book gives no numbers for Bài 16–17, so the lesson opens on an illustration: a 200-turn coil
 * of 100 cm² turned by 90° in 0,1 s in 0,1 T, and the same coil turning at 50 Hz.
 */
export const useInductionStore = create<InductionState>()(() => ({
  tab: 'flux',
  B1: 0.1,
  B2: 0.1,
  alpha1: 0,
  alpha2: 90,
  S: 0.01,
  N: 200,
  dt: 0.1,
  gN: 200,
  gB: 0.1,
  gS: 0.01,
  f: 50,
  alpha0: 0,
  t: 0,
  threePhase: false,
}));

const num = (v: unknown, lo: number, hi: number, old: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : old;
const int = (v: unknown, old: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1e6, Math.max(1, Math.round(v))) : old;

export function setInduction(patch: Partial<Record<keyof InductionState, unknown>>): void {
  const s = useInductionStore.getState();
  const f = num(patch.f, 0.01, 1e4, s.f);
  useInductionStore.setState({
    tab: TABS.includes(patch.tab as Tab) ? (patch.tab as Tab) : s.tab,
    B1: num(patch.B1, -100, 100, s.B1),
    B2: num(patch.B2, -100, 100, s.B2),
    alpha1: num(patch.alpha1, 0, 360, s.alpha1),
    alpha2: num(patch.alpha2, 0, 360, s.alpha2),
    S: num(patch.S, 1e-8, 1e4, s.S),
    N: int(patch.N, s.N),
    dt: num(patch.dt, 1e-6, 1e4, s.dt),
    gN: int(patch.gN, s.gN),
    gB: num(patch.gB, 0, 100, s.gB),
    gS: num(patch.gS, 1e-8, 1e4, s.gS),
    f,
    alpha0: num(patch.alpha0, 0, 360, s.alpha0),
    // The cursor stays within two periods of the current frequency.
    t: num(patch.t, 0, 2 / f, Math.min(s.t, 2 / f)),
    threePhase: typeof patch.threePhase === 'boolean' ? patch.threePhase : s.threePhase,
  });
}

export const generatorOf = (s: InductionState): Generator => ({
  N: s.gN,
  B: s.gB,
  S: s.gS,
  f: s.f,
  alpha0: s.alpha0,
});
