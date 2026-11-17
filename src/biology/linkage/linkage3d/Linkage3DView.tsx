/**
 * The 3D view of "Liên kết gene và hoán vị gene", testcross tab (three.js side, loaded when the
 * learner picks 3D): the lesson's own F1 parent and crossover share (`useLinkage`).
 */
import type { ReactNode } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { Bio3DView } from '@/biology/view3d/Bio3DView';
import type { SceneKit } from '@/biology/view3d/kit';
import { L } from '../../common';
import { frequencyFromCells } from '../model';
import { useLinkage } from '../store';
import { buildLinkageScene } from './scene';

const CAPTION = L(
  'Bên trái: một tế bào giảm phân của cá thể BV/bv — bốn chromatid, phần mang B, V màu cam, phần mang b, v màu xanh; khi có hoán vị, hai chromatid không chị em trao đổi đoạn giữa hai locus (minh họa Hình 11.3). Bên phải: tỉ lệ bốn loại giao tử do app tính, cũng là tỉ lệ kiểu hình ở Fa của phép lai phân tích.',
  'Left: one meiotic cell of the BV/bv parent — four chromatids, the parts carrying B, V orange and those carrying b, v blue; with crossing over, two non-sister chromatids exchange the part between the two loci (an illustration of Figure 11.3). Right: the shares of the four gametes computed by the app, which are also the Fa shares of the testcross.',
);

export function Linkage3DView({ top, label }: { top: ReactNode; label: string }) {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { parent, cells } = useLinkage();
  const f = parent === 'male' ? 0 : frequencyFromCells(cells);
  return (
    <Bio3DView
      lesson="geneLinkage"
      scene={{
        build: (kit: SceneKit) =>
          buildLinkageScene(kit, {
            f,
            texts: {
              percent: (x) => `${formatNumber(locale, 100 * x, { maximumFractionDigits: 1 })} %`,
              crossover: Lz(L('trao đổi chéo', 'crossing over')),
            },
          }),
        buildKey: `${String(f)}|${locale}`,
        label,
        viewDir: [0.2, 0.25, 1],
      }}
      top={top}
      caption={Lz(CAPTION)}
    />
  );
}
