/**
 * The 3D view of "Thế năng điện. Điện thế" (three.js side, loaded when the learner picks 3D): the
 * same parameters as the canvas, the charge where the engine has it (`sim.renderState`).
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
import { potential3d } from './potential3d';
import { POTENTIAL_VIEW, buildPotentialScene } from './scene3d';

const CAPTION = L(
  'Mặt phẳng mờ qua M và qua N là mặt đẳng thế: mọi điểm trên đó có cùng điện thế V = E·y. Điện tích đi từ M đến N theo đường đã chọn; công của lực điện chỉ phụ thuộc điện thế hai đầu, không phụ thuộc đường đi. Độ rộng bản, độ dài mũi tên chỉ để minh họa.',
  'The see-through planes through M and through N are equipotentials: every point on one has the same potential V = E·y. The charge goes from M to N along the chosen path; the work of the electric force depends only on the potentials at the ends, not on the path. The plate width and arrow lengths are illustrations.',
);

export default function Potential3DView() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const params = useSimStore((s) => s.params);
  const scrub = useSimStore((s) => s.scrubTime);
  const simTime = useWorkspaceStore((s) => s.simTime);
  const playing = useWorkspaceStore((s) => s.playing);
  const model = useMemo(() => potential3d(params), [params]);
  const V = (v: number) => fmtQty(locale, v, 'V', 4);
  const texts = {
    plus: `+  V = ${V(model.q.U)}`,
    minus: '−  V = 0',
    E: `E = ${fmtQty(locale, model.E, 'V/m', 4)}`,
    planes: {
      M: `Vₘ = ${V(model.planes[0]?.V ?? 0)}`,
      N: `Vₙ = ${V(model.planes[1]?.V ?? 0)}`,
    },
    F: 'F',
  };
  const label = Lz(
    L(
      `Hai bản phẳng, mặt đẳng thế qua M (${texts.planes.M}) và qua N (${texts.planes.N})`,
      `Two plates, the equipotentials through M (${texts.planes.M}) and N (${texts.planes.N})`,
    ),
  );
  // Points outside the plates: the stage shows the scene's own message; the picture stays.
  return (
    <Bio3DView
      lesson="electricPotential"
      className="phys3d"
      scene={{
        build: (kit: SceneKit) =>
          buildPotentialScene(kit, { model, texts, read: () => sim.renderState }),
        buildKey: JSON.stringify([params, locale]),
        label,
        time: scrub ?? simTime,
        running: playing,
        viewDir: POTENTIAL_VIEW,
      }}
      caption={Lz(CAPTION)}
    />
  );
}
