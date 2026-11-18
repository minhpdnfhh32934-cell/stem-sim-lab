/**
 * The 3D view of "Cường độ dòng điện" (three.js side, loaded when the learner picks 3D): the
 * same parameters as the canvas; the electrons drift by the engine's distance (`sim.renderState`).
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
import { driftSpeed, wireInput } from './model';
import { buildCurrentScene } from './scene3d';

const CAPTION = L(
  'Ion dương (xanh lá) đứng yên; electron tự do (xanh dương) trôi ngược chiều dòng điện với tốc độ thật do app tính theo I = Snve, nên trông gần như đứng yên. Mỗi chấm đại diện cho rất nhiều electron; vị trí của chúng trong tiết diện chỉ để minh họa.',
  'The positive ions (green) stay in place; the free electrons (blue) drift against the current at the real speed the app computes from I = Snve, so they look almost still. Each dot stands for very many electrons; where they sit across the section is an illustration.',
);

export default function Current3DView() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const params = useSimStore((s) => s.params);
  const scrub = useSimStore((s) => s.scrubTime);
  const simTime = useWorkspaceStore((s) => s.simTime);
  const playing = useWorkspaceStore((s) => s.playing);
  const w = wireInput(params);
  const v = fmtQty(locale, driftSpeed(w), 'mm/s', 3);
  return (
    <Bio3DView
      lesson="electricCurrent"
      className="phys3d"
      scene={{
        build: (kit: SceneKit) =>
          buildCurrentScene(kit, {
            d: w.d,
            texts: { I: 'I', v: 'v', S: 'S' },
            read: () => sim.renderState,
          }),
        buildKey: JSON.stringify([w.d, locale]),
        label: Lz(
          L(
            `Đoạn dây dẫn: electron tự do trôi với tốc độ v = ${v}`,
            `A piece of wire: the free electrons drift at v = ${v}`,
          ),
        ),
        time: scrub ?? simTime,
        running: playing,
      }}
      top={<span className="chem-chip mono">{`v = ${v}`}</span>}
      caption={Lz(CAPTION)}
    />
  );
}
