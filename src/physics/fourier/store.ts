import { create } from 'zustand';
import { WAVES, type Wave } from './model';

export interface FourierState {
  wave: Wave;
  /** Highest harmonic kept, 1…N_MAX. */
  N: number;
  /** Fundamental frequency f₁ (Hz), also the pitch of "Nghe". */
  f1: number;
  /** Draw each harmonic faintly under the sum. */
  showHarmonics: boolean;
}

export const N_MAX = 50;
export const F1_RANGE = { min: 55, max: 880 } as const;

export const useFourierStore = create<FourierState>()(() => ({
  wave: 'square',
  N: 5,
  f1: 220,
  showHarmonics: false,
}));

/** Applies saved or typed values within their ranges; anything else is ignored. */
export function setFourier(patch: Partial<Record<keyof FourierState, unknown>>): void {
  const s = useFourierStore.getState();
  const num = (v: unknown, lo: number, hi: number, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
  useFourierStore.setState({
    wave: WAVES.includes(patch.wave as Wave) ? (patch.wave as Wave) : s.wave,
    N: Math.round(num(patch.N, 1, N_MAX, s.N)),
    f1: num(patch.f1, F1_RANGE.min, F1_RANGE.max, s.f1),
    showHarmonics: typeof patch.showHarmonics === 'boolean' ? patch.showHarmonics : s.showHarmonics,
  });
}
