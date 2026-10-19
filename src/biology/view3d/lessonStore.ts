/**
 * Transient state of a lesson's 3D view (not saved in files, not tracked by undo): playback time,
 * the picked part, the camera mode and the name labels. Saved inputs (the model's parameters,
 * 3D on/off, speed) live in the lesson's own store. One store per lesson (mitosis: `useMitosis3D`).
 */
import { create } from 'zustand';

export interface Lesson3DUi<Sel, Cam extends string> {
  /** Playback time in seconds (0 … the lesson's total). */
  t: number;
  playing: boolean;
  selected: Sel | null;
  camera: Cam;
  /** Incremented to ask the view to re-frame the camera ("Đặt lại góc nhìn"). */
  viewNonce: number;
  /** WebGL could not start or its context was lost: the 2D view is shown instead. */
  webglFailed: boolean;
  /** The 3D view is on screen (tables and parts lists follow it). */
  active: boolean;
  /** "Hiện tên": name labels on the picture; null = the mode's default (on in Basic). */
  labels: boolean | null;
}

/** A lesson's 3D store, starting with `camera` and the lesson's own `extra` fields. */
export function createLesson3DStore<Sel, Cam extends string, Extra extends object>(
  camera: Cam,
  extra: Extra,
) {
  return create<Lesson3DUi<Sel, Cam> & Extra>()(() => ({
    t: 0,
    playing: false,
    selected: null,
    camera,
    viewNonce: 0,
    webglFailed: false,
    active: false,
    labels: null,
    ...extra,
  }));
}
