/**
 * Transient state of the Hardy–Weinberg 3D view (not saved, not tracked by undo): the picked
 * figure or the gene pool. The generation shown is the view's playback; the model's inputs live
 * in the lesson's store (`useHw`).
 */
import { createLesson3DStore } from '../../view3d/lessonStore';
import type { HwSelection } from './binding';

export const useHw3D = createLesson3DStore<HwSelection, 'overview', object>('overview', {});
