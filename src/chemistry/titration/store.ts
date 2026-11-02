import { create } from 'zustand';
import { INDICATORS, equivalenceVolume, type Titration } from './titration';

export interface TitrationState extends Titration {
  /** NaOH added from the burette (mL). */
  vb: number;
  indicator: string;
}

/** Input limits: dilute solutions (the model ignores activity), a flask and burette scale. */
export const LIMITS = {
  c: { min: 0.001, max: 1 },
  va: { min: 1, max: 100 },
} as const;

const DEFAULTS: TitrationState = { ca: 0.1, va: 10, cb: 0.1, vb: 0, indicator: 'phenolphthalein' };

export const useTitrationStore = create<TitrationState>()(() => ({ ...DEFAULTS }));

/** The burette runs to twice the equivalence volume, so both sides of the jump are visible. */
export function maxVolume(t: Titration): number {
  return 2 * equivalenceVolume(t);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Applies (and validates) an input change; the added volume stays inside the new burette range. */
export function setTitration(patch: Partial<TitrationState>): void {
  const next = { ...useTitrationStore.getState(), ...patch };
  const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const ca = ok(next.ca) ? clamp(next.ca, LIMITS.c.min, LIMITS.c.max) : DEFAULTS.ca;
  const cb = ok(next.cb) ? clamp(next.cb, LIMITS.c.min, LIMITS.c.max) : DEFAULTS.cb;
  const va = ok(next.va) ? clamp(next.va, LIMITS.va.min, LIMITS.va.max) : DEFAULTS.va;
  const vb = ok(next.vb) ? clamp(next.vb, 0, maxVolume({ ca, va, cb })) : 0;
  const indicator = INDICATORS.some((i) => i.id === next.indicator)
    ? next.indicator
    : DEFAULTS.indicator;
  useTitrationStore.setState({ ca, cb, va, vb, indicator });
}
