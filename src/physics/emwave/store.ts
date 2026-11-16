import { create } from 'zustand';
import { SCALE } from './model';

export type Given = 'lambda' | 'f';

export interface EmState {
  /** Wavelength in vacuum (m): the one quantity everything else follows from. */
  lambda: number;
  /** Which quantity the learner types in. */
  given: Given;
  /** Unit the box shows the wavelength in, and the frequency in. */
  lUnit: string;
  fUnit: string;
}

export const L_UNITS = ['pm', 'nm', 'µm', 'mm', 'cm', 'm', 'km'] as const;
export const F_UNITS = ['Hz', 'kHz', 'MHz', 'GHz', 'THz'] as const;

/** Each unit in metres or hertz. */
export const UNIT_SI: Record<string, number> = {
  pm: 1e-12,
  nm: 1e-9,
  µm: 1e-6,
  mm: 1e-3,
  cm: 1e-2,
  m: 1,
  km: 1e3,
  Hz: 1,
  kHz: 1e3,
  MHz: 1e6,
  GHz: 1e9,
  THz: 1e12,
};

/** Opens on green light, 500 nm (the textbook’s exercise 2d, tr. 47). */
export const useEmStore = create<EmState>()(() => ({
  lambda: 5e-7,
  given: 'lambda',
  lUnit: 'nm',
  fUnit: 'THz',
}));

/** Applies saved or typed values within the scale; anything else is ignored. */
export function setEm(patch: Partial<Record<keyof EmState, unknown>>): void {
  const s = useEmStore.getState();
  const lambda =
    typeof patch.lambda === 'number' && Number.isFinite(patch.lambda) && patch.lambda > 0
      ? Math.min(SCALE.max, Math.max(SCALE.min, patch.lambda))
      : s.lambda;
  const pickUnit = (v: unknown, list: readonly string[], old: string) =>
    typeof v === 'string' && list.includes(v) ? v : old;
  useEmStore.setState({
    lambda,
    given: patch.given === 'lambda' || patch.given === 'f' ? patch.given : s.given,
    lUnit: pickUnit(patch.lUnit, L_UNITS, s.lUnit),
    fUnit: pickUnit(patch.fUnit, F_UNITS, s.fUnit),
  });
}
