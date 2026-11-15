import { create } from 'zustand';
import { elementByZ } from '../data/elements';
import { isotopesOf } from '../data/isotopes';
import { electronRange, N_MAX, Z_MAX, Z_MIN } from './composition';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));

/** "Thành phần của nguyên tử": protons Z, neutrons N, electrons. Opens on ¹²C. */
export const useCompositionStore = create<{ z: number; n: number; electrons: number }>(() => ({
  z: 6,
  n: 6,
  electrons: 6,
}));

/** N of the element's most abundant natural isotope (every Z ≤ 36 has one). */
function commonN(z: number): number {
  const top = isotopesOf(z)?.isotopes.reduce((a, b) => (b.abundance_pct > a.abundance_pct ? b : a));
  return top ? top.a - z : 0;
}

/**
 * Sets Z, N and the electrons within the sliders' ranges. A new Z (without its own N) takes the N
 * of its most abundant natural isotope and keeps the charge, so the learner lands on a real atom.
 */
export function setComposition(patch: { z?: unknown; n?: unknown; electrons?: unknown }): void {
  const s = useCompositionStore.getState();
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  const z = clamp(num(patch.z, s.z), Z_MIN, Z_MAX);
  const n = clamp(num(patch.n, z === s.z ? s.n : commonN(z)), 0, N_MAX);
  const [lo, hi] = electronRange(z);
  const electrons = clamp(num(patch.electrons, z - (s.z - s.electrons)), lo, hi);
  useCompositionStore.setState({ z, n, electrons });
}

/** "Nguyên tố hóa học và đồng vị": the element, and the average typed in the reverse problem. */
export const useIsotopeStore = create<{ z: number; average: number }>(() => ({
  z: 17,
  average: elementByZ(17)?.atomic_weight ?? 35.45,
}));

/** Picks an element with natural isotopes; the reverse problem starts from its atomic weight. */
export function selectIsotopeElement(z: unknown): void {
  if (typeof z !== 'number' || !isotopesOf(z)) return;
  useIsotopeStore.setState({ z, average: elementByZ(z)?.atomic_weight ?? 0 });
}
