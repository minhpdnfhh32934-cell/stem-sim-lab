/**
 * The 3D view of "Sóng cơ: sóng ngang, sóng dọc" (three.js side, loaded when the learner picks
 * 3D): the medium at the engine's instant (`sim.renderState`), the same parameters as the canvas.
 */
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { sim } from '@/app/sim/runtime';
import { useSimStore } from '@/app/sim/simStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { Bio3DView } from '@/biology/view3d/Bio3DView';
import type { SceneKit } from '@/biology/view3d/kit';
import { Bio3DSwitch } from '@/biology/view3d/switch';
import { formatNumber } from '@/app/i18n';
import { L } from '../common/scene-helpers';
import { fmtQty } from '../common/tex';
import { shiftScale, verticalScale } from './draw';
import { KIND, isValid, period, travelInput, wavelength } from './model';
import { buildTravelScene } from './scene3d';

const CAPTION = {
  [KIND.transverse]: L(
    'Sóng ngang: các phần tử dao động lên xuống, vuông góc với phương truyền sóng, quanh vị trí của mình; sóng truyền đi, các phần tử không đi theo. Độ cao dao động đã phóng to như hình 2D.',
    'Transverse wave: the parts move up and down, across the direction of travel, about their places; the wave travels on, the parts do not. The displacement is enlarged as in the 2D picture.',
  ),
  [KIND.longitudinal]: L(
    'Sóng dọc: các phần tử dao động dọc theo phương truyền sóng, tạo nên chỗ nén và chỗ dãn; mỗi phần tử chỉ dao động quanh vị trí của mình. Độ dời đã phóng to như hình 2D.',
    'Longitudinal wave: the parts move along the direction of travel, making compressions and rarefactions; each part only oscillates about its place. The shifts are enlarged as in the 2D picture.',
  ),
} as const;

export default function Travel3DView() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const params = useSimStore((s) => s.params);
  const scrub = useSimStore((s) => s.scrubTime);
  const simTime = useWorkspaceStore((s) => s.simTime);
  const playing = useWorkspaceStore((s) => s.playing);
  const q = travelInput(params);
  // Values the model cannot draw: the stage shows the scene's own message; keep the way back to 2D.
  if (!isValid(q))
    return (
      <div className="stage__view-switch">
        <Bio3DSwitch lesson="travellingWave" />
      </div>
    );
  const transverse = q.kind === KIND.transverse;
  const stretch = transverse ? verticalScale(q) : shiftScale(q);
  const header = `λ = ${fmtQty(locale, wavelength(q), 'm')}, T = ${fmtQty(locale, period(q), 's')}, v = ${fmtQty(locale, q.v, 'm/s')}`;
  return (
    <Bio3DView
      // Transverse ↔ longitudinal: a new block, framed again from its own direction.
      key={q.kind}
      lesson="travellingWave"
      className="phys3d"
      scene={{
        build: (kit: SceneKit) =>
          buildTravelScene(kit, {
            q,
            texts: { O: 'O', M: 'M', v: 'v' },
            read: () => sim.renderState,
          }),
        buildKey: JSON.stringify([q, locale]),
        label: Lz(
          transverse
            ? L(
                `Sóng ngang trong môi trường: ${header}`,
                `A transverse wave in a medium: ${header}`,
              )
            : L(
                `Sóng dọc trong môi trường: ${header}`,
                `A longitudinal wave in a medium: ${header}`,
              ),
        ),
        time: scrub ?? simTime,
        running: playing,
        viewDir: [0.35, 0.55, 1],
      }}
      top={
        <>
          <span className="chem-chip mono">{header}</span>
          {stretch > 1 && (
            <span className="chem-chip chem-chip--approx">
              {Lz(
                L(
                  `Độ dời phóng to ×${formatNumber(locale, stretch)}`,
                  `Displacement enlarged ×${formatNumber(locale, stretch)}`,
                ),
              )}
            </span>
          )}
        </>
      }
      caption={Lz(CAPTION[q.kind as keyof typeof CAPTION])}
    />
  );
}
