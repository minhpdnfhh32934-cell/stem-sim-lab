/**
 * The 3D view of the "Quá trình" part of "Các định luật của khí lí tưởng" (three.js side, loaded
 * when shown): states 1 and 2 of the lesson's store as two cylinders.
 */
import type { ReactNode } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { Bio3DView } from '@/biology/view3d/Bio3DView';
import type { SceneKit } from '@/biology/view3d/kit';
import { prefersReducedMotion } from '@/ui/three/availability';
import { L } from './card';
import { gas3d } from './gas3d';
import { buildGasScene } from './scene3d';
import { statesOf, useGasStore } from './store';

const CAPTION = L(
  'Cùng một lượng khí ở hai trạng thái: cột khí cao theo V, mũi tên đè lên pít-tông dài theo p, các phân tử chạy nhanh theo √T (tốc độ căn quân phương). Số hạt bằng nhau vì lượng khí không đổi; chuyển động của hạt chỉ để minh họa.',
  'The same amount of gas in two states: the gas column is as tall as V, the arrow on the piston as long as p, the molecules move as fast as √T allows (rms speed). Both hold the same number of particles, as the amount of gas does not change; their motion is an illustration.',
);

export function Gas3DView({ top }: { top: ReactNode }) {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const store = useGasStore();
  const { s1, s2 } = statesOf(store);
  const cylinders = gas3d(s1, s2);
  const n = (v: number, d = 4) => formatNumber(locale, v, { maximumSignificantDigits: d });
  const texts = cylinders.map((c, i) => {
    const k = i === 0 ? '₁' : '₂';
    return [
      Lz(L(`Trạng thái ${String(i + 1)}`, `State ${String(i + 1)}`)),
      `p${k} = ${n(c.state.p / 1e5)}·10⁵ Pa`,
      `V${k} = ${n(c.state.V * 1000)} L`,
      `T${k} = ${n(c.state.T, 5)} K`,
    ];
  });
  const label = Lz(
    L(
      `Hai xi lanh: ${texts.map((t) => t.slice(1).join(', ')).join('; ')}`,
      `Two cylinders: ${texts.map((t) => t.slice(1).join(', ')).join('; ')}`,
    ),
  );
  return (
    <Bio3DView
      lesson="idealGas"
      scene={{
        build: (kit: SceneKit) => buildGasScene(kit, { cylinders, texts }),
        buildKey: JSON.stringify([s1, s2, locale]),
        label,
        running: !prefersReducedMotion(),
        viewDir: [0.25, 0.35, 1],
      }}
      top={top}
      caption={Lz(CAPTION)}
    />
  );
}
