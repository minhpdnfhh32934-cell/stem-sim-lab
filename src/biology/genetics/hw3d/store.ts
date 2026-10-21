/**
 * Transient state of the Hardy–Weinberg 3D view (not saved, not tracked by undo): the picked
 * figure or the gene pool, the framing (whole population / close-up beside the gene pool) and the
 * name callouts. The generation shown is the view's playback; the model's inputs live in the
 * lesson's store (`useHw`).
 */
import { createLesson3DStore } from '../../view3d/lessonStore';
import type { HwSelection } from './binding';

/** "Toàn cảnh" (the whole population) or "Cận cảnh cá thể" (a few figures beside the jar). */
export type HwCameraMode = 'overview' | 'closeup';

export const useHw3D = createLesson3DStore<HwSelection, HwCameraMode, object>('overview', {});
