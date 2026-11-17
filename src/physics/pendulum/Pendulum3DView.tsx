/**
 * The 3D view of "Con lắc đơn" (three.js side, loaded when the learner picks 3D): the lesson's
 * own parameters (`useSimStore`) and the bob where the engine is (`sim.renderState`).
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
import { PE, pendulumInput } from './engine';
import { buildPendulumScene } from './scene3d';

const CAPTION = L(
  'Quả nặng ở góc lệch α do app tính (mô hình chính xác, không dùng gần đúng góc nhỏ); quả cầu mờ là lời giải gần đúng góc nhỏ để so sánh, như hình 2D. Mũi tên xanh dương: vận tốc v; xanh lục: trọng lực P; cam: lực căng dây T. Đường chấm là cung dao động giữa hai biên.',
  'The bob is at the angle α the app computes (the exact model, no small-angle approximation); the see-through ball is the small-angle solution for comparison, as in the 2D picture. Blue arrow: the velocity v; green: the weight; orange: the tension T. The dotted line is the swing between the turning points.',
);

export default function Pendulum3DView() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const params = useSimStore((s) => s.params);
  const scrub = useSimStore((s) => s.scrubTime);
  const simTime = useWorkspaceStore((s) => s.simTime);
  const playing = useWorkspaceStore((s) => s.playing);
  const q = pendulumInput(params);
  const showSmall = (params.showSmall ?? 1) > 0.5;
  const header = `ℓ = ${fmtQty(locale, q.L, 'm')}, α₀ = ${fmtQty(locale, q.theta0, 'deg', 3)}, g = ${fmtQty(locale, q.g, 'm/s^2')}`;
  const th = sim.renderState?.[PE.th] ?? q.theta0;
  return (
    <Bio3DView
      lesson="simplePendulum"
      className="phys3d"
      scene={{
        build: (kit: SceneKit) =>
          buildPendulumScene(kit, {
            q,
            showSmall,
            texts: {
              v: 'v',
              P: plain(sym(locale).weight).replace('_', ''),
              T: 'T',
              small: Lz(L('góc nhỏ', 'small-angle')),
            },
            read: () => sim.renderState,
          }),
        buildKey: JSON.stringify([q, showSmall, locale]),
        label: Lz(L(`Con lắc đơn trong 3D: ${header}`, `Simple pendulum in 3D: ${header}`)),
        time: scrub ?? simTime,
        running: playing,
        viewDir: [0.35, 0.15, 1],
      }}
      top={
        <>
          <span className="chem-chip mono">{header}</span>
          <span className="chem-chip mono">α = {fmtQty(locale, th, 'deg', 3)}</span>
        </>
      }
      caption={Lz(CAPTION)}
    />
  );
}
