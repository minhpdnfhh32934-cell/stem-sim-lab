/**
 * The 3D view of "Orbital nguyên tử hydro" (three.js side, loaded when the learner picks 3D): a
 * cloud of points sampled from |ψ|² of the lesson's orbital.
 */
import { useMemo, type ReactNode } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { Bio3DView } from '@/biology/view3d/Bio3DView';
import type { SceneKit } from '@/biology/view3d/kit';
import { effectiveTier, usePerfStore } from '@/perf/perfStore';
import { L } from '../common';
import { orbitalById } from './hydrogen';
import { CLOUD_POINTS, sampleCloud } from './orbital3d';
import { buildOrbitalScene } from './orbitalScene3d';
import { useOrbitalStore } from './orbitalStore';

const CAPTION = L(
  'Mỗi chấm là một vị trí có thể tìm thấy electron, lấy mẫu theo mật độ xác suất |ψ|² của nghiệm chính xác cho nguyên tử hydro: chấm càng dày, xác suất càng lớn. Đây không phải quỹ đạo chuyển động của electron. Màu là dấu (pha) của ψ, không phải điện tích. Khung chứa 99 % xác suất.',
  'Each dot is a place where the electron may be found, sampled from the probability density |ψ|² of the exact hydrogen solution: the denser the dots, the likelier. This is not a path of the electron. The colour is the sign (phase) of ψ, not charge. The box holds 99 % of the probability.',
);

export function Orbital3DView({ top }: { top: ReactNode }) {
  const Lz = useLocalized();
  const tier = usePerfStore(effectiveTier);
  const { n, orbital: id, mode } = useOrbitalStore();
  const orbital = orbitalById(id);
  const cloud = useMemo(() => sampleCloud(n, orbital, CLOUD_POINTS[tier]), [n, orbital, tier]);
  return (
    <Bio3DView
      lesson="orbitals"
      scene={{
        build: (kit: SceneKit) => buildOrbitalScene(kit, { cloud, mode }),
        buildKey: `${String(n)}|${id}|${mode}|${tier}`,
        label: Lz(
          L(
            `Đám mây xác suất của orbital ${String(n)}${orbital.label.replace(/[_{}]/g, '')}`,
            `Probability cloud of the ${String(n)}${orbital.label.replace(/[_{}]/g, '')} orbital`,
          ),
        ),
        viewDir: [0.8, 0.45, 1],
      }}
      top={top}
      caption={Lz(CAPTION)}
    />
  );
}
