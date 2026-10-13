import { Suspense, lazy } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { hasWebGL2 } from '@/perf/benchmark';
import { effectiveTier, usePerfStore } from '@/perf/perfStore';
import { L } from '../common';
import { DivisionBottom, DivisionPanel, DivisionStage } from './DivisionViews';
import { Mitosis3DSwitch } from './mitosis3d/Mitosis3DSwitch';
import { Mitosis3DBottom, Mitosis3DParts } from './mitosis3d/panels';
import { useMitosis3D } from './mitosis3d/store';
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

/** Why the 3D view cannot be shown (null = it can). */
function useNo3dReason(): 'tier' | 'webgl' | null {
  const tier = usePerfStore(effectiveTier);
  const failed = useMitosis3D((s) => s.webglFailed);
  if (failed || !webgl2Available()) return 'webgl';
  return tier === 'low' ? 'tier' : null;
}

export function MitosisStage() {
  const Lz = useLocalized();
  const view3d = useDivisionStore((s) => s.view3d);
  const reason = useNo3dReason();
  if (view3d && !reason) {
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
