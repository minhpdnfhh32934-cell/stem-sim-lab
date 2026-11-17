/**
 * The 3D view of "Sóng dừng trên dây" (three.js side, loaded when the learner picks 3D): the
 * string at the engine's instant (`sim.renderState`), the same parameters as the canvas.
 */
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { sim } from '@/app/sim/runtime';
import { useSimStore } from '@/app/sim/simStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { Bio3DView } from '@/biology/view3d/Bio3DView';
import type { SceneKit } from '@/biology/view3d/kit';
import { L } from '../common/scene-helpers';
import { fmtQty } from '../common/tex';
import { fmtRatio, verticalScale } from './draw';
import { standingInput, waveOf } from './engine';
import { harmonicRatio } from './model';
import { buildStandingScene } from './scene3d';

const CAPTION = L(
  'Mỗi hạt là một điểm của dây ở vị trí y = 2A·sin(kx)·sin(ωt) do app tính. Vùng mờ là phần không gian dây quét qua khi dao động (bó sóng); nút N đứng yên, bụng dao động mạnh nhất. Độ cao đã phóng to như hình 2D.',
  'Each bead is a point of the string at y = 2A·sin(kx)·sin(ωt), computed by the app. The faint shape is the space the string sweeps (the loops); the nodes N stay still, the antinodes swing most. The height is enlarged as in the 2D picture.',
);

export default function Standing3DView() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const params = useSimStore((s) => s.params);
  const scrub = useSimStore((s) => s.scrubTime);
  const simTime = useWorkspaceStore((s) => s.simTime);
  const playing = useWorkspaceStore((s) => s.playing);
  const q = standingInput(params);
  const w = waveOf(q);
  const n = q.n ?? 0;
  const m = harmonicRatio(q.L, q.f, q.v);
  const ms = Number.isFinite(m) ? fmtRatio(locale, m) : '—';
  const none = Lz(L(`Không có sóng dừng (2Lf/v = ${ms})`, `No standing wave (2Lf/v = ${ms})`));
  const header = w
    ? `f = ${fmtQty(locale, q.f, 'Hz')}, v = ${fmtQty(locale, q.v, 'm/s')}, λ = ${fmtQty(locale, (2 * q.L) / n, 'm')}, n = ${String(n)}`
    : none;
  const S = verticalScale(q);
  return (
    <Bio3DView
      lesson="standingWave"
      className="phys3d"
      scene={{
        build: (kit: SceneKit) =>
          buildStandingScene(kit, {
            q,
            // English "A" would read as the amplitude A (as in 2D).
            texts: { N: 'N', B: locale === 'vi' ? 'B' : 'AN', P: 'P', none },
            read: () => sim.renderState,
          }),
        buildKey: JSON.stringify([q, locale]),
        label: Lz(L(`Sóng dừng trên dây: ${header}`, `Standing wave on a string: ${header}`)),
        time: scrub ?? simTime,
        running: playing,
        viewDir: [0.3, 0.45, 1],
      }}
      top={
        <>
          <span className="chem-chip mono">{header}</span>
          {S > 1 && (
            <span className="chem-chip chem-chip--approx">
              {Lz(
                L(
                  `Độ cao phóng to ×${formatNumber(locale, S)}`,
                  `Height enlarged ×${formatNumber(locale, S)}`,
                ),
              )}
            </span>
          )}
        </>
      }
      caption={Lz(CAPTION)}
    />
  );
}
