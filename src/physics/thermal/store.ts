import { create } from 'zustand';
import { PRESETS, physical, presetDef, type Preset, type TempUnit } from './model';

export const TABS = ['heat', 'scale', 'firstLaw'] as const;
export type Tab = (typeof TABS)[number];
export const TARGETS = ['temp', 'melted', 'boiled'] as const;
export type TargetKind = (typeof TARGETS)[number];
export const UNITS: readonly TempUnit[] = ['C', 'K', 'F'];

export interface ThermalState {
  tab: Tab;
  preset: Preset;
  /** kg */
  m: number;
  /** °C */
  t0: number;
  /** W */
  P: number;
  /** 0–1 */
  eff: number;
  target: TargetKind;
  /** °C, used when target is 'temp'. */
  t1: number;
  /** Time cursor along the curve (s). */
  tau: number;
  /** Temperature scales tab. */
  value: number;
  unit: TempUnit;
  /** First-law tab (J). */
  A: number;
  Q: number;
}

/** Opens on the book's question 2 (tr. 24): 2 kg of copper from 30 °C, 20 000 W, 50 %. */
export const useThermalStore = create<ThermalState>()(() => ({
  tab: 'heat',
  preset: 'copper',
  m: 2,
  t0: 30,
  P: 20000,
  eff: 0.5,
  target: 'melted',
  t1: 500,
  tau: 0,
  value: 270,
  unit: 'C',
  A: 300,
  Q: -100,
}));

const num = (v: unknown, lo: number, hi: number, old: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : old;

/** Applies saved or chosen values; each stays inside the range its preset allows. */
export function setThermal(patch: Partial<Record<keyof ThermalState, unknown>>): void {
  const s = useThermalStore.getState();
  const preset = PRESETS.includes(patch.preset as Preset) ? (patch.preset as Preset) : s.preset;
  const [lo, hi] = presetDef(preset).t0;
  const unit = UNITS.includes(patch.unit as TempUnit) ? (patch.unit as TempUnit) : s.unit;
  const rawValue = num(patch.value, -1e6, 1e6, s.value);
  useThermalStore.setState({
    tab: TABS.includes(patch.tab as Tab) ? (patch.tab as Tab) : s.tab,
    preset,
    m: num(patch.m, 0.001, 100, s.m),
    t0: num(patch.t0, lo, hi, Math.min(hi, Math.max(lo, s.t0))),
    P: num(patch.P, 1, 1e6, s.P),
    eff: num(patch.eff, 0.01, 1, s.eff),
    target: TARGETS.includes(patch.target as TargetKind) ? (patch.target as TargetKind) : s.target,
    t1: num(patch.t1, -273, 5000, s.t1),
    tau: num(patch.tau, 0, 1e9, s.tau),
    // A temperature below absolute zero is refused, not clipped silently into another value.
    value: physical(rawValue, unit) ? rawValue : s.value,
    unit,
    A: num(patch.A, -1e6, 1e6, s.A),
    Q: num(patch.Q, -1e6, 1e6, s.Q),
  });
}
