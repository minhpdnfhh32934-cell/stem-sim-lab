import { Suspense, lazy, useLayoutEffect, useRef } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { hasWebGL2 } from '@/perf/benchmark';
import { chosenTier, effectiveTier, usePerfStore } from '@/perf/perfStore';
import { L } from '../common';
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

let webgl2: boolean | null = null;
/** WebGL 2 support, checked once (three.js needs WebGL 2). */
function webgl2Available(): boolean {
  webgl2 ??= usePerfStore.getState().benchmark?.webgl2 ?? hasWebGL2();
  return webgl2;
}

/**
 * Why the 3D view cannot be shown (null = it can): no WebGL, the Low quality setting (chosen in
 * Settings, or by the benchmark), or the app lowering the quality by itself after sustained
 * overload.
 */
function useNo3dReason(): 'tier' | 'overload' | 'webgl' | null {
  const tier = usePerfStore(effectiveTier);
  const chosen = usePerfStore(chosenTier);
  const failed = useMitosis3D((s) => s.webglFailed);
  if (failed || !webgl2Available()) return 'webgl';
  if (tier !== 'low') return null;
  return chosen === 'low' ? 'tier' : 'overload';
}

/** The 2D stage that shows what the 3D view was showing (3D time → 2D stage index). */
function show3dStageIn2d(): void {
  const d = useDivisionStore.getState();
  const stage = timelineFor(d.pairs, d.cellType).stageAt(useMitosis3D.getState().t).stage;
  setDivisionState('mitosis', { index: index2dOf(stage), playing: false });
}

export function MitosisStage() {
  const Lz = useLocalized();
  const view3d = useDivisionStore((s) => s.view3d);
  const reason = useNo3dReason();
  const show3d = view3d && !reason;
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
  const notice = !view3d
    ? undefined
    : reason === 'tier'
      ? Lz(
          L(
            'Đang ở chất lượng hiển thị Thấp nên dùng hình 2D (đổi trong Cài đặt → Chất lượng hiển thị).',
            'Display quality is Low, so the 2D picture is used (change it in Settings → Display quality).',
          ),
        )
      : reason === 'overload'
        ? Lz(
            L(
              'Máy đang chạy chậm nên app tạm dùng hình 2D (số liệu không đổi). Mở lại chủ đề này để thử lại hình 3D.',
              'This computer is running slowly, so the app is using the 2D picture for now (the numbers are the same). Open this topic again to try 3D again.',
            ),
          )
        : Lz(
            L(
              'Máy này chưa vẽ được 3D (WebGL), nên dùng hình 2D.',
              'This computer cannot draw 3D (WebGL) here, so the 2D picture is used.',
            ),
          );
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
