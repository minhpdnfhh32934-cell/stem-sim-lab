/**
 * The 3D view of "Thành phần của nguyên tử" (three.js side, loaded when the learner picks 3D):
 * the same illustration as the 2D picture, not to scale.
 */
import type { ReactNode } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { Bio3DView } from '@/biology/view3d/Bio3DView';
import type { SceneKit } from '@/biology/view3d/kit';
import { L } from '../common';
import { atom3d } from './atom3d';
import { buildAtomScene } from './scene3d';
import { useCompositionStore } from './store';

const CAPTION = L(
  'Hình minh họa, không theo tỉ lệ: chỉ số hạt là đúng (Z proton, N neutron trong hạt nhân, các electron ở vỏ). Nếu vẽ đúng tỉ lệ, hạt nhân nhỏ hơn một điểm ảnh; vị trí các hạt chỉ để minh họa, electron chưa xếp theo lớp (Bài 3).',
  'An illustration, not to scale: only the counts are right (Z protons and N neutrons in the nucleus, the electrons around it). Drawn to scale, the nucleus would be smaller than one pixel; where the particles sit is an illustration, and the electrons are not yet in shells (Lesson 3).',
);

export function Composition3DView({ top, label }: { top: ReactNode; label: string }) {
  const Lz = useLocalized();
  const { z, n, electrons } = useCompositionStore();
  const atom = atom3d(z, n, electrons);
  return (
    <Bio3DView
      lesson="atomComposition"
      scene={{
        build: (kit: SceneKit) => buildAtomScene(kit, { atom }),
        buildKey: `${String(z)}|${String(n)}|${String(electrons)}`,
        label,
      }}
      top={top}
      caption={Lz(CAPTION)}
    />
  );
}
