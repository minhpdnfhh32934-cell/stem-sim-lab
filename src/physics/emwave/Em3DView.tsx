/**
 * The 3D view of "Sóng điện từ" (three.js side, loaded when shown): E⃗ ⊥ B⃗ ⊥ the direction of
 * travel on the biology kit's stage; λ is the lesson's, the motion an illustration (still when
 * the learner asks for reduced motion).
 */
import type { ReactNode } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { Bio3DView } from '@/biology/view3d/Bio3DView';
import type { SceneKit } from '@/biology/view3d/kit';
import { prefersReducedMotion } from '@/ui/three/availability';
import { L } from './card';
import { lengthText } from './model';
import { buildEmScene } from './scene3d';
import { useEmStore } from './store';

const EM_3D_CAPTION = L(
  'Biên độ và chuyển động (đã làm chậm) chỉ để minh họa. E và B dao động cùng pha, vuông góc với nhau và với phương truyền sóng.',
  'The amplitude and the (slowed-down) motion are illustrations. E and B oscillate in phase, perpendicular to each other and to the direction of travel.',
);

export function Em3DView({ top, label }: { top: ReactNode; label: string }) {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const lambda = useEmStore((s) => s.lambda);
  const texts = { E: 'E', B: 'B', c: 'c', lambda: `λ = ${lengthText(locale, lambda)}` };
  return (
    <Bio3DView
      lesson="emWave"
      scene={{
        build: (kit: SceneKit) => buildEmScene(kit, { texts }),
        buildKey: `${String(lambda)}|${locale}`,
        label,
        running: !prefersReducedMotion(),
      }}
      top={top}
      caption={Lz(EM_3D_CAPTION)}
    />
  );
}
