/**
 * Transient state of the 3D view of "Động học enzyme" (not saved, not tracked by undo): the time
 * of the time course `t` (min), the [S] cursor `s` (mM; null = the apparent Km), playback, the
 * picked enzyme or particle, the camera mode and the name labels. Saved inputs (the model's
 * parameters, the plot shown, 3D on/off) live in the lesson's store (`useEnzyme`).
 */
import { createLesson3DStore } from '../../view3d/lessonStore';
import { enzymeModel3d, type EnzymeInputs, type EnzymeModel3D } from './binding';
import type { EnzymeSelection } from './components';

export type EnzymeCameraMode = 'overview' | 'close';

export const useEnzyme3D = createLesson3DStore<
  EnzymeSelection,
  EnzymeCameraMode,
  { s: number | null }
>('overview', { s: null });

let last: { key: string; model: EnzymeModel3D } | null = null;
/** The 3D model of the lesson's inputs (the last one is kept). */
export function enzyme3dFor(st: EnzymeInputs): EnzymeModel3D {
  const key = JSON.stringify([st.vmax, st.km, st.kind, st.inhibitor, st.ki, st.s0, st.view]);
  if (last?.key !== key) last = { key, model: enzymeModel3d(st) };
  return last.model;
}
