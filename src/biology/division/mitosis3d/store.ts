import { create } from 'zustand';
import type { CameraMode, Selection } from './components';
import { buildTimeline, type CellType, type Timeline } from './timeline';

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
