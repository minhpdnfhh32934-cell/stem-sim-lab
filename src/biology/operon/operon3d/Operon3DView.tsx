/**
 * The 3D view of "Điều hòa biểu hiện gene: operon lac" (three.js side, loaded when the learner
 * picks 3D): the lesson's own store and `operon()` result, drawn by `layout` + `scene`.
 */
import type { ReactNode } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { Bio3DView } from '@/biology/view3d/Bio3DView';
import type { SceneKit } from '@/biology/view3d/kit';
import { L } from '../../common';
import { operon } from '../model';
import { useOperon } from '../store';
import { buildOperonScene } from './scene';

const CAPTION = L(
  'Hình minh họa, không theo tỉ lệ: đoạn DNA có gene điều hòa lacI và operon lac (P, O, lacZ, lacY, lacA) như Hình 3.1. Protein ức chế, allolactose và RNA polymerase được đặt theo kết quả của mô hình trong bài: protein ức chế có bám vào O không, các gene cấu trúc có được phiên mã không. Kéo để xoay, cuộn để phóng to.',
  'An illustration, not to scale: a stretch of DNA with the regulator gene lacI and the lac operon (P, O, lacZ, lacY, lacA) as in Figure 3.1. The repressor, allolactose and RNA polymerase are placed by the lesson’s model: whether the repressor holds O, whether the structural genes are transcribed. Drag to turn, scroll to zoom.',
);

export function Operon3DView({ top, label }: { top: ReactNode; label: string }) {
  const Lz = useLocalized();
  const input = useOperon();
  const result = operon(input);
  return (
    <Bio3DView
      lesson="lacOperon"
      scene={{
        build: (kit: SceneKit) =>
          buildOperonScene(kit, {
            input,
            result,
            texts: {
              repressor: Lz(L('Protein ức chế', 'Repressor')),
              polymerase: 'RNA polymerase',
              allolactose: 'allolactose',
              lactose: 'lactose',
              mrna: 'mRNA',
              broken: Lz(L('bị hỏng', 'damaged')),
            },
          }),
        buildKey: JSON.stringify(input),
        label,
        viewDir: [0.15, 0.35, 1],
      }}
      top={top}
      caption={Lz(CAPTION)}
    />
  );
}
