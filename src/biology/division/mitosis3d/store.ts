import { create } from 'zustand';
import type { CameraMode, Selection } from './components';
import { STAGES } from '../division';
import {
  MODEL_STAGE,
  STAGES_3D,
  buildTimeline,
  type CellType,
  type Mitosis3DState,
  type Stage3D,
  type Timeline,
} from './timeline';

/**
 * Transient state of the 3D mitosis view (not saved in files, not tracked by undo): the
 * playback time, the picked part and the camera mode. Saved inputs (2n, cell type, 3D on/off,
 * speed) live in the division store.
 */
export interface Mitosis3DUi {
  /** Playback time in seconds (0 … timeline total). */
  t: number;
  playing: boolean;
  selected: Selection | null;
  camera: CameraMode;
  /** Incremented to ask the view to re-frame the camera ("Đặt lại góc nhìn"). */
  viewNonce: number;
  /** WebGL could not start or its context was lost: the 2D view is shown instead. */
  webglFailed: boolean;
  /** The 3D view is on screen (the bottom table and the parts list follow it). */
  active: boolean;
}

export const useMitosis3D = create<Mitosis3DUi>()(() => ({
  t: 0,
  playing: false,
  selected: null,
  camera: 'overview',
  viewNonce: 0,
  webglFailed: false,
  active: false,
}));

const cache = new Map<string, Timeline>();
/** Timelines are pure and deterministic: share one per (2n, cell type). */
export function timelineFor(pairs: number, cellType: CellType): Timeline {
  const key = `${pairs}|${cellType}`;
  let tl = cache.get(key);
  if (!tl) {
    if (cache.size > 8) cache.clear();
    tl = buildTimeline(pairs, cellType);
    cache.set(key, tl);
  }
  return tl;
}

let lastState: { tl: Timeline; t: number; state: Mitosis3DState } | null = null;
/**
 * `tl.stateAt(t)`, computed once per (timeline, t): the scene, the counts chip and the part
 * info all read the same moment on every playback frame. The result is shared — read only.
 */
export function stateFor(tl: Timeline, t: number): Mitosis3DState {
  if (lastState?.tl === tl && lastState.t === t) return lastState.state;
  const state = tl.stateAt(t);
  lastState = { tl, t, state };
  return state;
}

/** Index in the 2D mitosis view of a 3D stage (3D telophase and cytokinesis → 2D telophase). */
export function index2dOf(stage: Stage3D): number {
  return Math.max(0, STAGES.mitosis.indexOf(MODEL_STAGE[stage]));
}

/**
 * 3D stage of a 2D mitosis index. The 2D telophase picture shows two daughter cells counted
 * 2n each: that is the end of 3D cytokinesis, not 3D telophase (one cell, two nuclei, 4n).
 */
export function stage3dOf(index2d: number): Stage3D {
  const stage2d = STAGES.mitosis[index2d] ?? 'g1';
  if (stage2d === 'telophase') return 'cytokinesis';
  return STAGES_3D.find((s) => MODEL_STAGE[s] === stage2d) ?? 'g1';
}
