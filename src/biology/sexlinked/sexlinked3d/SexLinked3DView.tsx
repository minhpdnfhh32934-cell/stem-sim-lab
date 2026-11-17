/**
 * The 3D view of "Di truyền giới tính và liên kết với giới tính" (three.js side, loaded when the
 * learner picks 3D): the lesson's own cross (`useSexLinked`), worked out by `cross()`.
 */
import type { ReactNode } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { Bio3DView } from '@/biology/view3d/Bio3DView';
import type { SceneKit } from '@/biology/view3d/kit';
import { L } from '../../common';
import { useSexLinked } from '../store';
import { buildSexLinkedScene } from './scene';

const CAPTION = L(
  'Mỗi ô là một tổ hợp giao tử (1/4). NST màu cam nhận từ mẹ, màu xanh nhận từ bố: con trai luôn nhận X từ mẹ. Dải trên X đánh dấu alen (A đậm, a sáng); Y không mang alen của gene này. Quả cầu nhỏ: màu mắt. Hình dạng, kích thước NST chỉ để minh họa.',
  'Each cell is one pair of gametes (1/4). Orange chromosomes come from the mother, blue ones from the father: a son always gets his X from his mother. The band on X marks the allele (A dark, a light); Y carries no allele of this gene. The small sphere: the eye colour. The chromosomes’ shapes and sizes are illustrations.',
);

export function SexLinked3DView({ top, label }: { top: ReactNode; label: string }) {
  const Lz = useLocalized();
  const { mother, father } = useSexLinked();
  return (
    <Bio3DView
      lesson="sexLinkage"
      scene={{
        build: (kit: SceneKit) =>
          buildSexLinkedScene(kit, {
            mother,
            father,
            texts: {
              red: Lz(L('mắt đỏ', 'red eyes')),
              white: Lz(L('mắt trắng', 'white eyes')),
              mother: '♀',
              father: '♂',
              quarter: '1/4',
            },
          }),
        buildKey: `${mother}|${father}`,
        label,
        viewDir: [0.25, 0.2, 1],
      }}
      top={top}
      caption={Lz(CAPTION)}
    />
  );
}
