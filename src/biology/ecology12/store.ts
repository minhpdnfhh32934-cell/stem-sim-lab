import { create } from 'zustand';
import { PYRAMIDS } from './model';

export interface ToleranceState {
  /** Temperature (°C) on the tolerance curve. */
  t: number;
}

/** Opens at 25 °C, inside the book's best range of 20–30 °C. */
export const useTolerance = create<ToleranceState>()(() => ({ t: 25 }));

export function restoreTolerance(patch: Partial<Record<keyof ToleranceState, unknown>>): void {
  const s = useTolerance.getState();
  useTolerance.setState({
    t:
      typeof patch.t === 'number' && Number.isFinite(patch.t)
        ? Math.min(50, Math.max(-10, patch.t))
        : s.t,
  });
}

export interface PyramidState {
  pyramid: string;
}

/** Opens on the energy pyramid of Silver Springs, the one that gives the efficiencies. */
export const usePyramid = create<PyramidState>()(() => ({ pyramid: 'springs' }));

export function restorePyramid(patch: Partial<Record<keyof PyramidState, unknown>>): void {
  const s = usePyramid.getState();
  usePyramid.setState({
    pyramid: PYRAMIDS.some((p) => p.id === patch.pyramid) ? (patch.pyramid as string) : s.pyramid,
  });
}
