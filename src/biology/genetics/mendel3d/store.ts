/**
 * Transient state of the 3D view of "Di truyền Mendel" (not saved, not tracked by undo): the
 * moment of the four illustrative steps, the picked part, the camera mode and the name labels.
 * Saved inputs (the cross, n, 3D on/off) live in the lesson's store (`useMendel`). The view
 * opens on the outcome (the last step complete), like the 2D page.
 */
import { createLesson3DStore } from '../../view3d/lessonStore';
import { GenotypeError } from '../mendel';
import { lociOf, type MendelState } from '../store';
import { MENDEL_TOTAL, mendelModel3d, type MendelModel3D } from './binding';
import type { MendelSelection } from './components';

export type MendelCameraMode = 'overview' | 'board';

export const useMendel3D = createLesson3DStore<MendelSelection, MendelCameraMode, { t: number }>(
  'overview',
  { t: MENDEL_TOTAL },
);

let last: { key: string; model: MendelModel3D } | null = null;

/** The lesson's cross now, or the model's `GenotypeError` message (the last model is kept). */
export function currentMendel(
  st: Pick<MendelState, 'p1' | 'p2' | 'loci' | 'dominance'>,
): { ok: true; model: MendelModel3D } | { ok: false; error: string } {
  const key = JSON.stringify([st.p1, st.p2, st.loci, st.dominance]);
  if (last?.key === key) return { ok: true, model: last.model };
  try {
    const model = mendelModel3d(st.p1, st.p2, lociOf(st));
    last = { key, model };
    return { ok: true, model };
  } catch (e) {
    if (e instanceof GenotypeError) return { ok: false, error: e.message };
    throw e;
  }
}
