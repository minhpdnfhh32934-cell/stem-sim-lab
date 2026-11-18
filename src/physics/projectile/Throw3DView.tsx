/**
 * The 3D view of the throw lessons (Rơi tự do, Ném ngang, Ném xiên; three.js side, loaded when the
 * learner picks 3D): the scene's own launch (`engineParams`, as the engine runs it), the
 * predicted path from the closed form, and the ball where the engine is (`sim.renderState`).
 */
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { sim } from '@/app/sim/runtime';
import { useSimStore } from '@/app/sim/simStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { Bio3DView } from '@/biology/view3d/Bio3DView';
import type { SceneKit } from '@/biology/view3d/kit';
import type { Bio3DLesson } from '@/biology/view3d/prefs';
import { L } from '../common/scene-helpers';
import { fmtQty } from '../common/tex';
import { projectile, type ProjectileInput } from './analytic';
import { buildThrowScene } from './scene3d';

const CAPTION = L(
  'Đường chấm chấm là quỹ đạo tính trước bằng công thức; quả bóng ở vị trí do app tính tại thời điểm t, bóng mờ dưới đất giúp nhìn độ cao. Mũi tên xanh: vận tốc v và hai thành phần của nó; mũi tên cam: gia tốc (như hình 2D). Bục ném và mặt đất chỉ để minh họa.',
  'The dotted line is the path computed beforehand from the formulas; the ball is where the app computes it at time t, and its shadow on the ground helps to see the height. Blue arrows: the velocity v and its two components; orange arrow: the acceleration (as in the 2D picture). The platform and the ground are illustrations.',
);

export default function Throw3DView() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const scene = useSimStore((s) => s.scene);
  const params = useSimStore((s) => s.params);
  const intervened = useSimStore((s) => s.intervened);
  const scrub = useSimStore((s) => s.scrubTime);
  const simTime = useWorkspaceStore((s) => s.simTime);
  const playing = useWorkspaceStore((s) => s.playing);
  if (!scene) return null;
  // The launch the engine runs (Ném ngang: α = 0; Rơi tự do: ±90° from the signed v₀).
  const p = scene.engineParams?.(params) ?? params;
  const inp: ProjectileInput = {
    v0: p.v0 ?? 0,
    angle: p.angle ?? 0,
    h0: p.h0 ?? 0,
    g: p.g ?? 9.81,
  };
  const r = projectile(inp);
  const deg = formatNumber(locale, Number(((inp.angle * 180) / Math.PI).toPrecision(4)));
  const header = [
    `v₀ = ${fmtQty(locale, inp.v0, 'm/s', 4)}`,
    ...(scene.id === 'obliqueProjectile' ? [`α = ${deg}°`] : []),
    `h₀ = ${fmtQty(locale, inp.h0, 'm', 4)}`,
    `g = ${fmtQty(locale, inp.g, 'm/s^2', 4)}`,
  ].join(', ');
  const t = scrub ?? simTime;
  return (
    <Bio3DView
      lesson={scene.id as Bio3DLesson}
      className="phys3d"
      scene={{
        build: (kit: SceneKit) =>
          buildThrowScene(kit, {
            inp,
            showPath: !intervened,
            texts: {
              H: r.apexTime > 0 ? `H = ${fmtQty(locale, r.maxHeight, 'm', 4)}` : null,
              L:
                Math.abs(r.vx0) > 1e-9 * Math.max(1, inp.v0)
                  ? `L = ${fmtQty(locale, r.range, 'm', 4)}`
                  : null,
              h0: inp.h0 > 0 ? `h₀ = ${fmtQty(locale, inp.h0, 'm', 3)}` : null,
              v: 'v',
              a: 'a',
            },
            fmtX: (x) => fmtQty(locale, x, 'm', 3),
            read: () => sim.renderState,
          }),
        buildKey: JSON.stringify([scene.id, inp, intervened, locale]),
        label: Lz(
          L(`${Lz(scene.title)} trong 3D: ${header}`, `${Lz(scene.title)} in 3D: ${header}`),
        ),
        time: t,
        running: playing,
        viewDir: [0.25, 0.25, 1],
      }}
      top={
        <>
          <span className="chem-chip mono">{header}</span>
          <span className="chem-chip mono">t = {fmtQty(locale, t, 's', 4)}</span>
        </>
      }
      caption={Lz(CAPTION)}
    />
  );
}
