/**
 * The 3D view of "Con lắc lò xo" (three.js side, loaded when the learner picks 3D): the lesson's
 * own parameters and orientation (`useSimStore`), the block where the engine is.
 */
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { sim } from '@/app/sim/runtime';
import { useSimStore } from '@/app/sim/simStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { Bio3DView } from '@/biology/view3d/Bio3DView';
import type { SceneKit } from '@/biology/view3d/kit';
import { L } from '../common/scene-helpers';
import { plain, sym } from '../common/symbols';
import { fmtQty } from '../common/tex';
import { SP, springInput } from './engine';
import { buildSpringScene } from './scene3d';

const CAPTION = {
  horizontal: L(
    'Vật nặng trượt không ma sát quanh vị trí cân bằng O, ở li độ x do app tính tại thời điểm t; lò xo co giãn theo vật. Mũi tên xanh dương: vận tốc v; xanh lục: lực đàn hồi của lò xo (luôn hướng về O). Như hình 2D, độ dài mũi tên so với giá trị lớn nhất của nó.',
    'The block slides without friction about the equilibrium O, at the displacement x the app computes at time t; the spring stretches with it. Blue arrow: the velocity v; green: the spring force (always towards O). As in the 2D picture, each arrow is scaled to its largest value.',
  ),
  vertical: L(
    'Vật treo dao động quanh vị trí cân bằng (VTCB), ở li độ x do app tính tại thời điểm t; l₀ là chiều dài tự nhiên của lò xo. Mũi tên cam: trọng lực P; xanh lục: lực đàn hồi của lò xo. Như hình 2D, hai lực vẽ cùng tỉ lệ.',
    'The hanging block oscillates about the equilibrium, at the displacement x the app computes at time t; l₀ is the spring’s natural length. Orange arrow: the weight; green: the spring force. As in the 2D picture, both forces share one scale.',
  ),
};

export default function Spring3DView() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const params = useSimStore((s) => s.params);
  const scrub = useSimStore((s) => s.scrubTime);
  const simTime = useWorkspaceStore((s) => s.simTime);
  const playing = useWorkspaceStore((s) => s.playing);
  const q = springInput(params);
  const S = sym(locale);
  const header = `k = ${fmtQty(locale, q.k, 'N/m')}, m = ${fmtQty(locale, q.m, 'kg')}`;
  const x = sim.renderState?.[SP.x] ?? q.x0;
  return (
    <Bio3DView
      lesson="springPendulum"
      className="phys3d"
      scene={{
        build: (kit: SceneKit) =>
          buildSpringScene(kit, {
            q,
            texts: {
              v: 'v',
              // 3D labels are plain text: F_đh reads Fđh (no subscript).
              F: plain(S.springForce).replace('_', ''),
              P: plain(S.weight).replace('_', ''),
              O: 'O',
              eq: Lz(L('VTCB', 'equilibrium')),
              l0: 'l₀',
            },
            read: () => sim.renderState,
          }),
        buildKey: JSON.stringify([q, locale]),
        label: Lz(
          L(`Con lắc lò xo trong 3D: ${header}`, `Spring–mass oscillator in 3D: ${header}`),
        ),
        time: scrub ?? simTime,
        running: playing,
        viewDir: q.vertical ? [0.45, 0.15, 1] : [0.3, 0.35, 1],
      }}
      top={
        <>
          <span className="chem-chip mono">{header}</span>
          <span className="chem-chip mono">x = {fmtQty(locale, x, 'cm', 3)}</span>
        </>
      }
      caption={Lz(q.vertical ? CAPTION.vertical : CAPTION.horizontal)}
    />
  );
}
