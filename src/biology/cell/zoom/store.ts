import { create } from 'zustand';
import { LEVELS } from './levels';

export interface CellZoomState {
  /** Level shown (0 = cell … 5 = double helix; saved in .stemsim files). */
  level: number;
  /** The camera is gliding into the next level's spot (the "not to scale" moment). */
  moving: boolean;
  /** "Hiện tên": the learner's choice; null = the mode's default (on in Basic). */
  labels: boolean | null;
}

export const useCellZoom = create<CellZoomState>()(() => ({
  level: 0,
  moving: false,
  labels: null,
}));

const isLevel = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < LEVELS.length;

/** Shows a level at once (a jump from the inspector, a file, or the end of a glide). */
export function setZoomLevel(level: number): void {
  if (isLevel(level)) useCellZoom.setState({ level, moving: false });
}

/** Restores a file's (untrusted) `level`: anything but the six levels is ignored. */
export function restoreZoom(patch: { level?: unknown }): void {
  if (isLevel(patch.level)) setZoomLevel(patch.level);
}
