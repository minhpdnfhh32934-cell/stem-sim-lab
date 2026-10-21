/**
 * Transient state of the genetic drift 3D view (not saved, not tracked by undo): the picked
 * island or figure, the framing (the whole archipelago or one island close up), the island the
 * close-up frames, the name callouts, and `t` = the generation shown while the view is `active`
 * (the heterozygosity chart under the picture marks it). The model's inputs live in `useDrift`.
 */
import { createLesson3DStore } from '../../view3d/lessonStore';
import type { DriftSelection } from './binding';

/** "Toàn cảnh" (every island) or "Cận cảnh một đảo" (the picked island, or the front one). */
export type DriftCameraMode = 'overview' | 'closeup';

export const useDrift3D = createLesson3DStore<
  DriftSelection,
  DriftCameraMode,
  { focus: number | null }
>('overview', { focus: null });
