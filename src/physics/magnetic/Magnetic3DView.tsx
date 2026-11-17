/**
 * The 3D view of "Lực từ" (three.js side, loaded when shown): the wire, B⃗ and F⃗ in space on the
 * biology kit's stage. Numbers come from the model (`force`, `forceDirection`, `cross`).
 */
import type { ReactNode } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { Bio3DView } from '@/biology/view3d/Bio3DView';
import type { SceneKit } from '@/biology/view3d/kit';
import { sci } from '@/ui/sciNumber';
import { L } from './card';
import { magnetic3d } from './magnetic3d';
import { MAGNETIC_VIEW, buildMagneticScene } from './scene3d';
import { useMagneticStore } from './store';

const MAGNETIC_3D_CAPTION = L(
  'Đường sức từ và độ dài mũi tên chỉ để minh họa: mũi tên F dài theo F/(BIL) = sinα; giá trị F do app tính theo F = BIL sinα. Lực từ vuông góc với cả dây dẫn và B.',
  'The field lines and arrow lengths are illustrations: the F arrow grows with F/(BIL) = sinα; the value of F is computed by the app from F = BIL sinα. The force is perpendicular to both the wire and B.',
);

export function Magnetic3DView({ top, label }: { top: ReactNode; label: string }) {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { B, I, L: len, alpha, reversed } = useMagneticStore();
  const model = magnetic3d({ B, I, L: len, alpha, reversed });
  const texts = {
    B: 'B',
    I: 'I',
    F: `F = ${sci(locale, model.F)} N`,
    alpha: `α = ${formatNumber(locale, alpha, { maximumFractionDigits: 1 })}°`,
  };
  return (
    <Bio3DView
      lesson="magneticForce"
      scene={{
        build: (kit: SceneKit) => buildMagneticScene(kit, { model, alpha, texts }),
        buildKey: [B, I, len, alpha, reversed, locale].join('|'),
        label,
        viewDir: MAGNETIC_VIEW,
      }}
      top={top}
      caption={Lz(MAGNETIC_3D_CAPTION)}
    />
  );
}
