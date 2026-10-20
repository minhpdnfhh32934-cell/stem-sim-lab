import { createLesson3DStore, type Lesson3DUi } from '../../view3d/lessonStore';
import { STAGES } from '../division';
import { meiosisOptions } from '../meiosisOptions';
import type { MeiosisCameraMode, MeiosisSelection } from './components';
import {
  MEIOSIS_STAGES_3D,
  MODEL_STAGE,
  buildMeiosisTimeline,
  type Meiosis3DState,
  type MeiosisStage3D,
  type MeiosisTimeline,
} from './timeline';

/**
 * Transient state of the 3D meiosis view (not saved in files, not tracked by undo): playback
 * time, the picked part, the camera mode and the name labels. Saved inputs (2n, crossing over,
 * seed, 3D on/off, speed) live in the division store.
 */
export type Meiosis3DUi = Lesson3DUi<MeiosisSelection, MeiosisCameraMode>;

export const useMeiosis3D = createLesson3DStore<MeiosisSelection, MeiosisCameraMode, object>(
  'overview',
  {},
);

const cache = new Map<string, MeiosisTimeline>();
/**
 * Timelines are pure and deterministic: one per (2n, crossing over, seed). The options are the
 * lesson's (`meiosisOptions`), so the 3D view shows the same run as the 2D picture.
 */
export function meiosisTimelineFor(
  pairs: number,
  crossover: boolean,
  seed: number,
): MeiosisTimeline {
  const key = `${pairs}|${crossover ? 1 : 0}|${seed}`;
  let tl = cache.get(key);
  if (!tl) {
    if (cache.size > 8) cache.clear();
    tl = buildMeiosisTimeline(pairs, meiosisOptions(pairs, crossover, seed));
    cache.set(key, tl);
  }
  return tl;
}

let lastState: { tl: MeiosisTimeline; t: number; state: Meiosis3DState } | null = null;
/**
 * `tl.stateAt(t)`, computed once per (timeline, t): the scene, the chips and the part card read
 * the same moment on every playback frame. The result is shared — read only.
 */
export function meiosisStateFor(tl: MeiosisTimeline, t: number): Meiosis3DState {
  if (lastState?.tl === tl && lastState.t === t) return lastState.state;
  const state = tl.stateAt(t);
  lastState = { tl, t, state };
  return state;
}

/** Index in the 2D meiosis view of a 3D stage (telophase and cytokinesis → 2D telophase). */
export function meiosisIndex2dOf(stage: MeiosisStage3D): number {
  return Math.max(0, STAGES.meiosis.indexOf(MODEL_STAGE[stage]));
}

/**
 * 3D stage of a 2D meiosis index. The 2D telophase I / II pictures show the daughter cells
 * counted per cell: that is the end of 3D cytokinesis I / II (3D telophase is one cell with two
 * nuclei).
 */
export function meiosisStage3dOf(index2d: number): MeiosisStage3D {
  const stage2d = STAGES.meiosis[index2d] ?? 'g1';
  if (stage2d === 'telophase1') return 'cytokinesis1';
  if (stage2d === 'telophase2') return 'cytokinesis2';
  return MEIOSIS_STAGES_3D.find((s) => MODEL_STAGE[s] === stage2d) ?? 'g1';
}
