import { create } from 'zustand';
import { CLASSES, classOf, type ClassId } from './model';

/** Most carbon atoms the n slider offers (the book's tables reach C10). */
export const N_MAX = 10;

export interface HcState {
  cls: ClassId;
  n: number;
}

export const useHcStore = create<HcState>()(() => ({ cls: 'alkane', n: 3 }));

/** Applies saved or chosen values; n is kept inside the series' range. */
export function setHc(patch: Partial<Record<keyof HcState, unknown>>): void {
  const s = useHcStore.getState();
  const cls = CLASSES.some((c) => c.id === patch.cls) ? (patch.cls as ClassId) : s.cls;
  const raw = typeof patch.n === 'number' && Number.isFinite(patch.n) ? Math.round(patch.n) : s.n;
  const n = Math.min(N_MAX, Math.max(classOf(cls).n_min, raw));
  useHcStore.setState({ cls, n });
}
