/**
 * The 3D view of "Cảm ứng điện từ" (three.js side, loaded when shown): the coil in the field of
 * two magnet poles on the biology kit's stage. Fluxes and e.m.f.s come from the model.
 */
import type { ReactNode } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { Bio3DView } from '@/biology/view3d/Bio3DView';
import type { SceneKit } from '@/biology/view3d/kit';
import { sci } from '@/ui/sciNumber';
import { L } from './card';
import { induction3d } from './induction3d';
import { buildInductionScene } from './scene3d';
import { useInductionStore } from './store';

const INDUCTION_3D_CAPTION = L(
  'Nam châm, đường sức và kích thước khung dây chỉ để minh họa. Góc giữa n và B, từ thông Φ = BS cosα và suất điện động do app tính.',
  'The magnets, field lines and coil size are illustrations. The angle between n and B, the flux Φ = BS cosα and the e.m.f. are computed by the app.',
);

export function Induction3DView({ top }: { top: ReactNode }) {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const s = useInductionStore();
  const model = induction3d(s);
  const wb = (v: number) => `${sci(locale, v)} Wb`;
  const flux = s.tab === 'flux';
  const texts = {
    B: 'B',
    north: 'N',
    south: 'S',
    now: { n: flux ? 'n₂' : 'n', phi: `${flux ? 'Φ₂' : 'Φ'} = ${wb(model.now.phi)}` },
    ...(model.before ? { before: { n: 'n₁', phi: `Φ₁ = ${wb(model.before.phi)}` } } : {}),
  };
  const label = Lz(
    flux
      ? L(
          `Khung dây trong từ trường: từ thông qua một vòng dây từ ${wb(model.before?.phi ?? 0)} đến ${wb(model.now.phi)}; suất điện động cảm ứng trung bình ${sci(locale, model.emf)} V`,
          `Coil in a magnetic field: flux through one turn from ${wb(model.before?.phi ?? 0)} to ${wb(model.now.phi)}; mean induced e.m.f. ${sci(locale, model.emf)} V`,
        )
      : L(
          `Khung dây quay trong từ trường: Φ = ${wb(model.now.phi)}, e = ${sci(locale, model.emf)} V`,
          `Coil turning in a magnetic field: Φ = ${wb(model.now.phi)}, e = ${sci(locale, model.emf)} V`,
        ),
  );
  const key = flux
    ? [s.tab, s.B1, s.B2, s.alpha1, s.alpha2, s.S]
    : [s.tab, s.gB, s.gS, s.f, s.alpha0, s.t];
  return (
    <Bio3DView
      lesson="induction"
      scene={{
        build: (kit: SceneKit) => buildInductionScene(kit, { model, texts }),
        buildKey: [...key, locale].join('|'),
        label,
      }}
      top={top}
      caption={Lz(INDUCTION_3D_CAPTION)}
    />
  );
}
