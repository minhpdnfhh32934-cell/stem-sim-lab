import { create } from 'zustand';
import { isPhase, type PhaseId } from './phases';

export type GrowthView = 'formula' | 'phases';
export type GrowthScale = 'linear' | 'log2';

/** Slider ranges (minutes; N₀ in cells). g reaches the textbook's 12 h; t one day. */
export const LIMITS = {
  n0: [1, 10_000, 1],
  g: [10, 720, 5],
  t: [0, 1440, 10],
} as const satisfies Record<string, readonly [number, number, number]>;

export interface GrowthState {
  view: GrowthView;
  n0: number;
  g: number;
  t: number;
  scale: GrowthScale;
  phase: PhaseId;
}

export const useGrowth = create<GrowthState>()(() => ({
  view: 'formula',
  n0: 100,
  g: 20,
  t: 180,
  scale: 'linear',
  phase: 'log',
}));

const inRange = (v: unknown, [lo, hi]: readonly [number, number, number]) =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** Restores a file's (untrusted) inputs: values the sliders cannot show are dropped. */
export function restoreGrowth(patch: Partial<Record<keyof GrowthState, unknown>>): void {
  const clean: Partial<GrowthState> = {};
  if (patch.view === 'formula' || patch.view === 'phases') clean.view = patch.view;
  if (patch.scale === 'linear' || patch.scale === 'log2') clean.scale = patch.scale;
  if (isPhase(patch.phase)) clean.phase = patch.phase;
  if (inRange(patch.n0, LIMITS.n0)) clean.n0 = Math.round(patch.n0 as number);
  if (inRange(patch.g, LIMITS.g)) clean.g = patch.g as number;
  if (inRange(patch.t, LIMITS.t)) clean.t = patch.t as number;
  useGrowth.setState(clean);
}
