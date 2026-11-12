/**
 * Transient state of the 3D view of "Khuếch tán & thẩm thấu" (not saved, not tracked by undo):
 * the time `t` (min for diffusion, s for osmosis), playback, the picked part and the name labels.
 * Saved inputs (the process, the model's parameters, 3D on/off) live in the lesson's store
 * (`useTransport`).
 */
import { createLesson3DStore } from '../../view3d/lessonStore';
import type { TransportSelection } from './components';
import type { OsmosisSpan } from './osmosis';
import { diffusionModel3d, type DiffusionInputs, type DiffusionModel3D } from './diffusion';

/**
 * `page`: the span shown of an endless run (#205 C5; time `t` is the run's own, spans of the
 * process's tEnd one after the other); `osmosis`: the osmosis span's samples, computed from the
 * span before.
 */
export const useTransport3D = createLesson3DStore<
  TransportSelection,
  'overview',
  { page: number; osmosis: OsmosisSpan | null }
>('overview', { page: 0, osmosis: null });

let last: { key: string; model: DiffusionModel3D } | null = null;
/** The diffusion 3D model of the lesson's inputs (the last one is kept). */
export function diffusion3dFor(st: DiffusionInputs): DiffusionModel3D {
  const key = JSON.stringify([st.particles, st.pores, st.c1, st.c2, st.v1, st.v2, st.pa, st.run]);
  if (last?.key !== key) last = { key, model: diffusionModel3d(st) };
  return last.model;
}
