/**
 * The 3D view of "Giao thoa sóng hai nguồn" (three.js side, loaded when the learner picks 3D): the
 * water surface at the engine's time (`sim.renderState`), the same parameters as the canvas.
 */
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { sim } from '@/app/sim/runtime';
import { useSimStore } from '@/app/sim/simStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { Bio3DView } from '@/biology/view3d/Bio3DView';
import type { SceneKit } from '@/biology/view3d/kit';
import { effectiveTier, usePerfStore } from '@/perf/perfStore';
import { L } from '../common/scene-helpers';
import { fmtQty } from '../common/tex';
import { interferenceView } from './draw';
import { MODE, interferenceInput, sourcesOf } from './engine';
import { beatFrequency } from './model';
import { surfaceGrid } from './interference3d';
import { MAX_CELLS, buildInterferenceScene } from './scene3d';

const CAPTION = L(
  'Độ cao mặt nước là li độ u do app tính tại từng điểm (xanh: nhô lên, cam: lõm xuống), đã phóng đại rất nhiều để nhìn thấy. Vân cực đại là nơi mặt nước dao động mạnh nhất, vân cực tiểu là nơi gần như đứng yên.',
  'The height of the water is the displacement u the app computes at each point (blue: raised, orange: lowered), greatly exaggerated so it can be seen. Maxima are where the water moves most, minima where it is almost still.',
);

const TOO_FINE = L(
  'Bước sóng quá nhỏ so với khung nhìn: mặt nước 3D cần ít nhất 4 điểm trên mỗi bước sóng. Các số không đổi; hãy xem hình 2D.',
  'The wavelength is too small for the view: the 3D water needs at least 4 points per wavelength. The numbers do not change; see the 2D picture.',
);

export default function Interference3DView() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const params = useSimStore((s) => s.params);
  const scrub = useSimStore((s) => s.scrubTime);
  const simTime = useWorkspaceStore((s) => s.simTime);
  const playing = useWorkspaceStore((s) => s.playing);
  const q = interferenceInput(params);
  const Q = (v: number, u: string) => fmtQty(locale, v, u);
  const header =
    q.mode === MODE.beats
      ? `f₁ = ${Q(q.f1, 'Hz')}, f₂ = ${Q(q.f2, 'Hz')}, f_b = ${Q(beatFrequency(q.f1, q.f2), 'Hz')}`
      : `f = ${Q(q.f1, 'Hz')}, v = ${Q(q.v, 'cm/s')}, λ = ${Q(q.lambda1, 'cm')}`;
  return (
    <Bio3DView
      lesson="interference"
      className="phys3d"
      scene={{
        build: (kit: SceneKit) =>
          buildInterferenceScene(kit, {
            sources: sourcesOf(q),
            view: interferenceView(params),
            lambdaMin: Math.min(q.lambda1, q.lambda2),
            m: q.m,
            texts: { S1: 'S₁', S2: 'S₂', M: 'M' },
            read: () => sim.renderState,
          }),
        buildKey: JSON.stringify([q, locale]),
        label: Lz(L(`Mặt nước giao thoa: ${header}`, `Interfering water surface: ${header}`)),
        time: scrub ?? simTime,
        running: playing,
        viewDir: [0.3, 0.75, 1],
      }}
      top={
        <>
          <span className="chem-chip mono">{`${header}, S₁S₂ = ${Q(q.d, 'cm')}`}</span>
          <span className="chem-chip chem-chip--approx">
            {Lz(L('Độ cao phóng đại', 'Height exaggerated'))}
          </span>
        </>
      }
      caption={Lz(CAPTION)}
      bottom={<Notice q={q} params={params} />}
    />
  );
}

/** Shown when the grid would need under 4 points per wavelength (no surface is drawn). */
function Notice({
  q,
  params,
}: {
  q: ReturnType<typeof interferenceInput>;
  params: Record<string, number>;
}) {
  const Lz = useLocalized();
  const tier = usePerfStore(effectiveTier);
  // The scene's own rule (`surfaceGrid`), for the tier the 3D view draws with.
  const lambda = Math.min(q.lambda1, q.lambda2);
  const tooFine = surfaceGrid(interferenceView(params), lambda, MAX_CELLS[tier]) === null;
  return tooFine ? (
    <p className="chem-note" role="status">
      {Lz(TOO_FINE)}
    </p>
  ) : null;
}
