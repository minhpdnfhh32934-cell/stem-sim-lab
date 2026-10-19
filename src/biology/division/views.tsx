import { Suspense, lazy, useLayoutEffect, useRef } from 'react';
import { useNo3dNotice, useNo3dReason } from '../view3d/support';
import { DivisionBottom, DivisionPanel, DivisionStage } from './DivisionViews';
import { Mitosis3DSwitch } from './mitosis3d/Mitosis3DSwitch';
import { Mitosis3DBottom, Mitosis3DParts } from './mitosis3d/panels';
import { index2dOf, timelineFor, useMitosis3D } from './mitosis3d/store';
import { setDivisionState } from './stageIndex';
import { useDivisionStore } from './state';

// three.js is loaded only when the 3D view is shown.
const Mitosis3DView = lazy(() =>
  import('./mitosis3d/Mitosis3DView').then((m) => ({ default: m.Mitosis3DView })),
);

/** The 2D stage that shows what the 3D view was showing (3D time → 2D stage index). */
function show3dStageIn2d(): void {
  const d = useDivisionStore.getState();
  const stage = timelineFor(d.pairs, d.cellType).stageAt(useMitosis3D.getState().t).stage;
  setDivisionState('mitosis', { index: index2dOf(stage), playing: false });
}

export function MitosisStage() {
  const view3d = useDivisionStore((s) => s.view3d);
  const reason = useNo3dReason(useMitosis3D((s) => s.webglFailed));
  const show3d = view3d && !reason;
  const notice = useNo3dNotice(view3d, reason);
  // When the 2D picture takes over from the 3D view by itself (lost GPU context, overload), it
  // opens at the stage the 3D view was showing — before the first paint.
  const was3d = useRef(show3d);
  useLayoutEffect(() => {
    if (was3d.current && view3d && !show3d) show3dStageIn2d();
    was3d.current = show3d;
  }, [show3d, view3d]);
  if (show3d) {
    return (
      <Suspense fallback={<div className="bio-view" />}>
        <Mitosis3DView />
      </Suspense>
    );
  }
  return <DivisionStage kind="mitosis" toolbar={<Mitosis3DSwitch />} notice={notice} />;
}

/** True while the 3D view is on screen (panels follow it). */
function use3dActive(): boolean {
  return useMitosis3D((s) => s.active);
}

export const MitosisPanel = () => {
  const active = use3dActive();
  return (
    <>
      <DivisionPanel kind="mitosis" />
      {active && <Mitosis3DParts />}
    </>
  );
};
export const MitosisBottom = () =>
  use3dActive() ? <Mitosis3DBottom /> : <DivisionBottom kind="mitosis" />;
export const MeiosisStage = () => <DivisionStage kind="meiosis" />;
export const MeiosisPanel = () => <DivisionPanel kind="meiosis" />;
export const MeiosisBottom = () => <DivisionBottom kind="meiosis" />;
