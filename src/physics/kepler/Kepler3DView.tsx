/**
 * The 3D view of "Định luật II Kepler" (three.js side, loaded when the learner picks 3D): the
 * lesson's own orbit (`useSimStore`), the planet where the engine is (`sim.renderState`).
 */
import { useMemo } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { sim } from '@/app/sim/runtime';
import { useSimStore } from '@/app/sim/simStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { Bio3DView } from '@/biology/view3d/Bio3DView';
import type { SceneKit } from '@/biology/view3d/kit';
import { L } from '../common/scene-helpers';
import { fmtQty } from '../common/tex';
import { orbit, sectorArea } from './model';
import { buildKeplerScene } from './scene3d';

const CAPTION = L(
  'Quỹ đạo elip của hành tinh, Mặt Trời ở một tiêu điểm. Mỗi phần tô màu là diện tích mà đoạn thẳng nối Mặt Trời với hành tinh quét được trong cùng một khoảng thời gian: các phần này bằng nhau (định luật II Kepler); phần đang quét tô đậm. Vị trí hành tinh do app tính; cỡ Mặt Trời và hành tinh chỉ để minh họa.',
  'The planet’s elliptical orbit, with the Sun at one focus. Each coloured slice is the area the line from the Sun to the planet sweeps in the same time: the slices are equal (Kepler’s second law); the one being swept is darker. The planet’s position is computed by the app; the sizes of the Sun and the planet are illustrations.',
);

export default function Kepler3DView() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const params = useSimStore((s) => s.params);
  const scrub = useSimStore((s) => s.scrubTime);
  const simTime = useWorkspaceStore((s) => s.simTime);
  const playing = useWorkspaceStore((s) => s.playing);
  // The view re-renders every frame while the orbit runs: the slice area only when it changes.
  const o = useMemo(() => orbit(params), [params]);
  const dA = useMemo(() => sectorArea(o, 0, o.T / o.N, 400), [o]);
  const header = `e = ${fmtQty(locale, o.e, '1')}, T = ${fmtQty(locale, o.T, 's')}, ${Lz(L('mỗi phần quét', 'each slice sweeps'))} ${fmtQty(locale, dA, '1')} a²`;
  return (
    <Bio3DView
      lesson="keplerOrbit"
      className="phys3d"
      scene={{
        build: (kit: SceneKit) =>
          buildKeplerScene(kit, {
            o,
            texts: { sun: Lz(L('Mặt Trời', 'Sun')) },
            read: () => sim.renderState,
          }),
        buildKey: JSON.stringify([o, locale]),
        label: Lz(
          L(`Định luật II Kepler trong 3D: ${header}`, `Kepler’s second law in 3D: ${header}`),
        ),
        time: scrub ?? simTime,
        running: playing,
        viewDir: [0.15, 0.85, 1],
      }}
      top={<span className="chem-chip mono">{header}</span>}
      caption={Lz(CAPTION)}
    />
  );
}
