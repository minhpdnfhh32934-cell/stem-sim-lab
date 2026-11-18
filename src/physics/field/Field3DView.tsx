/**
 * The 3D view of "Điện trường của điện tích điểm" (three.js side, loaded when the learner picks
 * 3D): the same parameters as the canvas (`useSimStore`), drawn by `field3d` + `scene3d` on the
 * biology kit's stage.
 */
import { useMemo } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useSimStore } from '@/app/sim/simStore';
import { Bio3DView } from '@/biology/view3d/Bio3DView';
import type { SceneKit } from '@/biology/view3d/kit';
import { L } from '../common/scene-helpers';
import { fmtQty } from '../common/tex';
import { field3d } from './field3d';
import { PLATES_VIEW, buildFieldScene } from './scene3d';

const CAPTION = {
  points: L(
    'Đường sức do app vạch theo điện trường của các điện tích, giống hình 2D. Với một, hai điện tích hoặc ba điện tích thẳng hàng, điện trường đối xứng quanh đường thẳng nối chúng nên đường sức được vẽ thêm khi quay quanh đường đó. Cỡ quả cầu và độ dài mũi tên E chỉ để minh họa; giá trị E do app tính.',
    'The app traces the field lines from the charges’ field, as in the 2D picture. With one or two charges, or three on one line, the field is symmetric about that line, so the lines are also drawn turned about it. The ball sizes and the length of the E arrow are illustrations; the value of E is computed by the app.',
  ),
  plates: L(
    'Tụ điện phẳng lí tưởng: điện trường đều giữa hai bản, E = U/d, hướng từ bản dương sang bản âm. Độ dài bản và các đường sức chỉ để minh họa.',
    'Ideal parallel-plate capacitor: a uniform field between the plates, E = U/d, from the + plate to the − plate. The plate length and the field lines are illustrations.',
  ),
};

export default function Field3DView() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const params = useSimStore((s) => s.params);
  const model = useMemo(() => field3d(params), [params]);
  const eText = fmtQty(locale, model.e, 'V/m');
  const texts = {
    charges: ['q₁', 'q₂', 'q₃'],
    M: 'M',
    E: 'E',
    nul: 'E = 0',
  };
  const label = Lz(
    model.mode === 'plates'
      ? L(`Tụ điện phẳng: E = ${eText}`, `Parallel-plate capacitor: E = ${eText}`)
      : L(
          `Đường sức điện trong không gian; tại M: E = ${eText}`,
          `Electric field lines in space; at M: E = ${eText}`,
        ),
  );
  const { U, d } = model.plates;
  return (
    <Bio3DView
      // A new model (point charges ↔ capacitor) starts from its own view direction.
      key={model.mode}
      lesson="electricField"
      className="phys3d"
      scene={{
        build: (kit: SceneKit) => buildFieldScene(kit, { model, texts }),
        buildKey: JSON.stringify([params, locale]),
        label,
        ...(model.mode === 'plates' ? { viewDir: PLATES_VIEW } : {}),
      }}
      top={
        <span className="chem-chip mono">
          {model.mode === 'plates'
            ? `U = ${fmtQty(locale, U, 'V')}, d = ${fmtQty(locale, d, 'cm')}, E = ${eText}`
            : `E(M) = ${eText}`}
        </span>
      }
      caption={Lz(CAPTION[model.mode])}
    />
  );
}
