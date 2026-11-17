/**
 * The picture of a physics scene: the 2D canvas, or — for a scene with a 3D view (#302) that the
 * learner switched to 3D — that view, loaded on demand. The 3D view reads the same parameters and
 * engine state as the canvas; while it is shown this keeps the engine running (the canvas, which
 * normally drives it, is not mounted).
 */
import { Suspense, useEffect } from 'react';
import type { Bio3DLesson } from '@/biology/view3d/prefs';
import { useShow3d } from '@/biology/view3d/support';
import { Bio3DToolbar } from '@/biology/view3d/switch';
import type { PhysicsScene } from '@/physics/types';
import { sim } from './runtime';
import { StageCanvas } from './StageCanvas';

/** Advances the engine every animation frame (what `StageCanvas`'s loop does, minus drawing). */
function useEngineClock(on: boolean): void {
  useEffect(() => {
    if (!on) return;
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      sim.tick((now - last) / 1000);
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [on]);
}

export function SceneStage({ scene }: { scene: PhysicsScene }) {
  // Only scenes with a 3D view are listed in the kit's lessons; for the others this is unused.
  const lesson = scene.id as Bio3DLesson;
  const { show3d } = useShow3d(lesson);
  const View3D = scene.view3d;
  const on = View3D !== undefined && show3d;
  useEngineClock(on);
  if (!View3D) return <StageCanvas scene={scene} />;
  return on ? (
    <Suspense fallback={null}>
      <View3D />
    </Suspense>
  ) : (
    <>
      <StageCanvas scene={scene} />
      <div className="stage__view-switch">
        <Bio3DToolbar lesson={lesson} />
      </div>
    </>
  );
}
