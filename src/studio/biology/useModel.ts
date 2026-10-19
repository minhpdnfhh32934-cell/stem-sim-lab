import { useLayoutEffect } from 'react';
import { stage3dOf, useMitosis3D } from '@/biology/division/mitosis3d/store';
import type { Stage3D, Timeline } from '@/biology/division/mitosis3d/timeline';
import { setDivisionState, stageIndexKind } from '@/biology/division/stageIndex';
import { useDivisionStore } from '@/biology/division/state';
import type { BiologyBinding } from '../scenario';

/** True while the model view shows the lesson's cell (its 2n and cell type). */
export function useShowsLessonCell(b: BiologyBinding): boolean {
  const pairs = useDivisionStore((s) => s.pairs);
  const cellType = useDivisionStore((s) => s.cellType);
  return pairs === b.pairs && cellType === b.cellType;
}

/**
 * The stage on screen: the 3D view's playback time while it is shown, otherwise the stage of
 * the 2D picture that replaces it (no WebGL, Low quality).
 */
export function useShownStage(tl: Timeline): Stage3D {
  const active = useMitosis3D((s) => s.active);
  const stage3d = useMitosis3D((s) => tl.stageAt(s.t).stage);
  const index = useDivisionStore((s) => s.index);
  return active ? stage3d : stage3dOf(index);
}

/**
 * Holds the shared mitosis model on the lesson's cell (2n and cell type) in the 3D view while
 * the lesson shows it, with the view's cell type control locked. When the lesson stops showing
 * the model (next step, lesson closed), the learner's own settings and view come back, so the
 * regular Mitosis topic opens as the learner left it.
 */
export function useLessonModel(b: BiologyBinding | null): void {
  // Before paint: the first frame already shows the lesson's cell.
  useLayoutEffect(() => {
    if (!b) return;
    const d = useDivisionStore.getState();
    const m = useMitosis3D.getState();
    const kind = stageIndexKind();
    const saved = {
      pairs: d.pairs,
      cellType: d.cellType,
      view3d: d.view3d,
      index: d.index,
      speed: d.speed,
    };
    const view = { t: m.t, selected: m.selected, camera: m.camera };
    useDivisionStore.setState({
      pairs: b.pairs,
      cellType: b.cellType,
      view3d: true,
      playing: false,
    });
    useMitosis3D.setState({ cellLocked: true });
    return () => {
      useMitosis3D.setState({ ...view, playing: false, cellLocked: false });
      useDivisionStore.setState({ ...saved, playing: false });
      // The 2D picture may have written the stage index during the lesson: give it back to
      // the division it belonged to.
      if (kind) setDivisionState(kind, { index: saved.index });
    };
  }, [b]);
}
