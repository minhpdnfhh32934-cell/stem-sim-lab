/**
 * The 3D view of "Chuyển động tròn đều" (three.js side, loaded when the learner picks 3D): the
 * lesson's own parameters (`useSimStore`) and the body where the engine is (`sim.renderState`).
 */
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { sim } from '@/app/sim/runtime';
import { useSimStore } from '@/app/sim/simStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { Bio3DView } from '@/biology/view3d/Bio3DView';
import type { SceneKit } from '@/biology/view3d/kit';
import { L } from '../common/scene-helpers';
import { fmtQty } from '../common/tex';
import { circular } from './model';
import { buildCircularScene } from './scene3d';

const CAPTION = L(
  'Vật chuyển động trên đường tròn nằm ngang, ở vị trí do app tính tại thời điểm t; trục thẳng đứng đi qua tâm. Mũi tên xanh: vận tốc v (tiếp tuyến); mũi tên cam: gia tốc hướng tâm aₕₜ, cùng hướng lực hướng tâm Fₕₜ. Như hình 2D, độ dài mũi tên chỉ cho biết hướng; độ lớn xem ở bảng Thuộc tính.',
  'The body moves on a horizontal circle, where the app computes it at time t; the vertical axis passes through the centre. Blue arrow: the velocity v (tangent); orange arrow: the centripetal acceleration a_c, along the centripetal force F_c. As in the 2D picture, the arrow lengths show directions only; the magnitudes are in the Inspector.',
);

export default function Circular3DView() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const params = useSimStore((s) => s.params);
  const scrub = useSimStore((s) => s.scrubTime);
  const simTime = useWorkspaceStore((s) => s.simTime);
  const playing = useWorkspaceStore((s) => s.playing);
  const c = circular(params);
  const header = `r = ${fmtQty(locale, c.r, 'm')}, v = ${fmtQty(locale, c.v, 'm/s')}, T = ${fmtQty(locale, c.T, 's')}`;
  return (
    <Bio3DView
      lesson="uniformCircularMotion"
      className="phys3d"
      scene={{
        build: (kit: SceneKit) =>
          buildCircularScene(kit, {
            c,
            texts: {
              v: 'v',
              a: locale === 'vi' ? 'aₕₜ, Fₕₜ' : 'a_c, F_c',
            },
            read: () => sim.renderState,
          }),
        buildKey: JSON.stringify([c, locale]),
        label: Lz(
          L(`Chuyển động tròn đều trong 3D: ${header}`, `Uniform circular motion in 3D: ${header}`),
        ),
        time: scrub ?? simTime,
        running: playing,
        viewDir: [0.2, 0.9, 1],
      }}
      top={<span className="chem-chip mono">{header}</span>}
      caption={Lz(CAPTION)}
    />
  );
}
