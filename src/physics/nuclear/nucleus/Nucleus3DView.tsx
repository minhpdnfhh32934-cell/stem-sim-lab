/**
 * The 3D view of the "Cấu trúc" part of "Hạt nhân và năng lượng liên kết" (three.js side, loaded
 * when shown): the chosen nucleus of Bảng 21.1 and, for scale, the largest one.
 */
import type { ReactNode } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { Bio3DView } from '@/biology/view3d/Bio3DView';
import type { SceneKit } from '@/biology/view3d/kit';
import { sci } from '@/ui/sciNumber';
import { TABLE_21_1 } from '../data';
import { nucleus3d } from '../nuclear3d';
import { radius } from '../nucleusModel';
import { buildNucleusScene } from '../scene3d';
import { L } from './card';
import { useNucleusStore } from './store';

const CAPTION = L(
  'Hạt nhân gồm A nucleon, đúng Z proton (đỏ cam) và A − Z neutron (xanh), trong quả cầu bán kính R = 1,2·10⁻¹⁵·A^(1/3) m do app tính. Các nucleon vẽ cùng cỡ nên hạt nhân lớn hơn có cùng mật độ; vị trí từng nucleon chỉ để minh họa. Quả cầu mờ là hạt nhân lớn nhất trong Bảng 21.1.',
  'The nucleus holds A nucleons, exactly Z protons (orange) and A − Z neutrons (blue), in a ball of radius R = 1.2·10⁻¹⁵·A^(1/3) m computed by the app. All nucleons are drawn the same size, so a bigger nucleus has the same density; where each nucleon sits is an illustration. The faint ball is the largest nucleus of Table 21.1.',
);

export function Nucleus3DView({ top }: { top: ReactNode }) {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const symbol = useNucleusStore((s) => s.symbol);
  const row = TABLE_21_1.find((r) => r.symbol === symbol) ?? TABLE_21_1[0];
  // The largest nucleus of the table, drawn faintly for scale.
  const big = TABLE_21_1.reduce<typeof row>((a, r) => (a && a.A >= r.A ? a : r), row);
  if (!row || !big) return null;
  const nucleus = nucleus3d(row.Z, row.A);
  const texts = [
    `${Lz(row.name)} (${row.symbol}): A = ${String(row.A)}`,
    Lz(
      L(
        `${String(row.Z)} proton, ${String(row.A - row.Z)} neutron`,
        `${String(row.Z)} protons, ${String(row.A - row.Z)} neutrons`,
      ),
    ),
    Lz(
      L(
        `R = ${sci(locale, nucleus.R)} m (công thức 21.1)`,
        `R = ${sci(locale, nucleus.R)} m (formula 21.1)`,
      ),
    ),
  ];
  return (
    <Bio3DView
      lesson="nucleus"
      scene={{
        build: (kit: SceneKit) =>
          buildNucleusScene(kit, {
            nucleus,
            reference: { R: radius(big.A), text: `${big.symbol} (A = ${String(big.A)})` },
            texts,
          }),
        buildKey: `${symbol}|${locale}`,
        label: texts.join(', '),
      }}
      top={top}
      caption={Lz(CAPTION)}
    />
  );
}
