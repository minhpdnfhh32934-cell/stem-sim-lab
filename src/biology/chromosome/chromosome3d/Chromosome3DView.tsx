/**
 * The 3D view of "Đột biến nhiễm sắc thể", structure tab (three.js side, loaded when the learner
 * picks 3D): the lesson's own mutation (`useChromosome`), the gene orders of Hình 12.1.
 */
import type { ReactNode } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { Bio3DView } from '@/biology/view3d/Bio3DView';
import type { SceneKit } from '@/biology/view3d/kit';
import { L } from '../../common';
import { useChromosome } from '../store';
import { buildChromosomeScene } from './scene';

const CAPTION = L(
  'Mỗi hạt là một gene (chữ cái như Hình 12.1): hàng trên là NST trước đột biến, hàng dưới là NST sau. Đường mảnh nối mỗi gene với vị trí của nó sau đột biến: không có đường là gene bị mất, hai đường là gene được lặp, đường bắt chéo là đoạn bị đảo, đường sang NST khác là chuyển đoạn. Vòng cam: gene mới trên NST đó. Hình dạng NST chỉ để minh họa.',
  'Each bead is a gene (the letters of Figure 12.1): the top row is the chromosome before the mutation, the bottom row after. A thin line joins each gene to where it is afterwards: no line means a lost gene, two lines a repeated one, crossing lines an inverted piece, a line to the other chromosome a translocation. Orange ring: a gene new to that chromosome. The chromosomes’ shapes are illustrations.',
);

export function Chromosome3DView({ top, label }: { top: ReactNode; label: string }) {
  const Lz = useLocalized();
  const structure = useChromosome((s) => s.structure);
  return (
    <Bio3DView
      lesson="chromosomeMutation"
      scene={{
        build: (kit: SceneKit) =>
          buildChromosomeScene(kit, {
            structure,
            texts: { before: Lz(L('Trước', 'Before')), after: Lz(L('Sau', 'After')) },
          }),
        buildKey: structure,
        label,
        viewDir: [0.15, 0.2, 1],
      }}
      top={top}
      caption={Lz(CAPTION)}
    />
  );
}
