/**
 * Transient state of the predator–prey 3D view (not saved, not tracked by undo): the picked
 * animal, columns or board, the framing (the whole habitat or "Cận cảnh đàn"), the name callouts,
 * and `t` = the moment shown while the view is `active` (the x(t), y(t) chart under the picture
 * marks it). The model's inputs live in `useLv`.
 */
import { createLesson3DStore } from '../../view3d/lessonStore';
import type { LvSelection } from './binding';

/** "Toàn cảnh" (meadow, columns and board) or "Cận cảnh đàn" (the scene's 'closeup' frame). */
export type LvCameraMode = 'overview' | 'closeup';

export const useLv3D = createLesson3DStore<LvSelection, LvCameraMode, object>('overview', {});
