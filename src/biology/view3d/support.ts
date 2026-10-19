/**
 * Whether a biology lesson shows its 3D view. The generic rules (WebGL 2, quality tier, overload,
 * reduced motion) live in the 3D kit (`@/ui/three/availability`) and are re-exported here for
 * existing imports; this file adds the learner's per-lesson 3D/2D choice.
 */
import { useNo3dNotice, useNo3dReason } from '@/ui/three/availability';
import { use3dWanted, useBio3DHealth, type Bio3DLesson } from './prefs';

export {
  NO3D_NOTICE,
  prefersReducedMotion,
  resetWebgl2Cache,
  useNo3dNotice,
  useNo3dReason,
  webgl2Available,
  type No3dReason,
} from '@/ui/three/availability';

/** Whether the lesson shows its 3D view now, and why not when the learner wanted it. */
export function useShow3d(lesson: Bio3DLesson): { show3d: boolean; notice: string | undefined } {
  const wanted = use3dWanted(lesson);
  const reason = useNo3dReason(useBio3DHealth((s) => s.failed));
  const notice = useNo3dNotice(wanted, reason);
  return { show3d: wanted && !reason, notice };
}
