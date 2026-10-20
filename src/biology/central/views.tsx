import { Suspense, lazy } from 'react';
import { useNo3dNotice, useNo3dReason } from '../view3d/support';
import { DogmaPanel, DogmaStage } from './DogmaViews';
import { Dogma3DSwitch } from './dogma3d/Dogma3DSwitch';
import { Dogma3DParts } from './dogma3d/panels';
import { useDogma3D } from './dogma3d/store';
import { Mutation3DSwitch } from './mutation3d/Mutation3DSwitch';
import { useMutation3D } from './mutation3d/store';
import { useDogmaStore } from './state';

// three.js is loaded only when the 3D view is shown.
const Dogma3DView = lazy(() =>
  import('./dogma3d/Dogma3DView').then((m) => ({ default: m.Dogma3DView })),
);
const Mutation3DView = lazy(() =>
  import('./mutation3d/Mutation3DView').then((m) => ({ default: m.Mutation3DView })),
);

/**
 * "ADN → mARN → Protein": the 3D view (default) or the 2D page. The 2D page takes over when WebGL
 * is missing or lost, or on the Low quality tier, at the codon the 3D clock was on (the clock
 * writes the dogma store's `step` while it plays).
 */
export function CentralDogmaStage() {
  const view3d = useDogmaStore((s) => s.view3d);
  const reason = useNo3dReason(useDogma3D((s) => s.webglFailed));
  const notice = useNo3dNotice(view3d, reason);
  if (view3d && !reason) {
    return (
      <Suspense fallback={<div className="bio-view" />}>
        <Dogma3DView />
      </Suspense>
    );
  }
  return <DogmaStage mode="dogma" toolbar={<Dogma3DSwitch />} notice={notice} />;
}

export const CentralDogmaPanel = () => {
  const active = useDogma3D((s) => s.active);
  return (
    <>
      <DogmaPanel mode="dogma" />
      {active && <Dogma3DParts />}
    </>
  );
};

/**
 * "Đột biến điểm": the 3D view (default) or the 2D page, by the dogma store's `view3d` (shared
 * with "ADN → mARN → Protein"). The 2D page takes over when WebGL is missing or lost, or on the
 * Low quality tier.
 */
export function MutationStage() {
  const view3d = useDogmaStore((s) => s.view3d);
  const reason = useNo3dReason(useMutation3D((s) => s.webglFailed));
  const notice = useNo3dNotice(view3d, reason);
  if (view3d && !reason) {
    return (
      <Suspense fallback={<div className="bio-view" />}>
        <Mutation3DView />
      </Suspense>
    );
  }
  return <DogmaStage mode="mutation" toolbar={<Mutation3DSwitch />} notice={notice} />;
}
export const MutationPanel = () => <DogmaPanel mode="mutation" />;
