/**
 * The 3D view of the "Nhiệt lượng" part of "Nội năng, nhiệt độ, nhiệt lượng" (three.js side,
 * loaded when shown): the sample's particles at the curve's time cursor τ.
 */
import { useMemo, type ReactNode } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { Bio3DView } from '@/biology/view3d/Bio3DView';
import type { SceneKit } from '@/biology/view3d/kit';
import { prefersReducedMotion } from '@/ui/three/availability';
import { L } from './card';
import { heatingPlan, type StageKind } from './model';
import { buildThermalScene } from './scene3d';
import { useThermalStore } from './store';

const STAGE_NAME: Record<StageKind, ReturnType<typeof L>> = {
  heatSolid: L('thể rắn đang nóng lên', 'a solid warming up'),
  melt: L('đang nóng chảy', 'melting'),
  heatLiquid: L('thể lỏng đang nóng lên', 'a liquid warming up'),
  boil: L('đang sôi', 'boiling'),
};

const CAPTION = L(
  'Số hạt ở thể rắn, lỏng, khí theo đúng phần đã nóng chảy hay đã hóa hơi mà app tính tại thời điểm đang chọn trên đường đồ thị. Nhiệt độ càng cao, các hạt dao động càng mạnh; cách xếp và chuyển động của hạt chỉ để minh họa.',
  'How many particles are solid, liquid or gas follows the share melted or boiled that the app computes at the time chosen on the curve. The hotter it is, the harder the particles jiggle; their arrangement and motion are illustrations.',
);

export function Thermal3DView({ top }: { top: ReactNode }) {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { preset, m, t0, P, eff, tau } = useThermalStore();
  const stages = useMemo(() => heatingPlan({ preset, m, t0, P, eff }), [preset, m, t0, P, eff]);
  const n = (v: number, d = 4) => formatNumber(locale, v, { maximumSignificantDigits: d });
  return (
    <Bio3DView
      lesson="heatAndPhase"
      scene={{
        build: (kit: SceneKit) =>
          buildThermalScene(kit, {
            stages,
            texts: { t: (p) => `t = ${n(p.t)} °C · ${Lz(STAGE_NAME[p.kind])}` },
          }),
        buildKey: JSON.stringify([preset, m, t0, P, eff, locale]),
        label: Lz(
          L('Các hạt của mẫu chất khi đun nóng', 'The particles of the sample as it is heated'),
        ),
        time: tau,
        running: !prefersReducedMotion(),
        viewDir: [0.5, 0.45, 1],
      }}
      top={top}
      caption={Lz(CAPTION)}
    />
  );
}
