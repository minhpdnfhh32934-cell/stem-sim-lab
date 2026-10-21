/**
 * Transient state of the logistic-growth 3D view (not saved, not tracked by undo): the picked
 * figure, column or clover, the framing (the whole habitat or "Cận cảnh đàn"), the name callouts,
 * and `t` = the moment shown while the view is `active` (the dN/dt chart under the picture marks
 * N(t) of that moment). The model's inputs live in `useLogistic`.
 */
import { createLesson3DStore } from '../../view3d/lessonStore';
import type { LogiSelection } from './binding';

/** "Toàn cảnh" (meadow and column) or "Cận cảnh đàn" (the scene's 'closeup' frame). */
export type LogiCameraMode = 'overview' | 'closeup';

export const useLogistic3D = createLesson3DStore<LogiSelection, LogiCameraMode, object>(
  'overview',
  {},
);
