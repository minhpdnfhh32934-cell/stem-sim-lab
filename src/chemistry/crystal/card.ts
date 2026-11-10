import type { Source } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { CSRC, L } from '../common';
import { CRYSTAL_NAME } from './names';
import type { CrystalId } from './lattice';

/** Crystallography reference for the counts and packing fractions (DATA_REVIEW CRY-1). */
export const KITTEL: Source = {
  id: 'kittel-sscp',
  citation:
    'C. Kittel — Introduction to Solid State Physics, 8th ed., Wiley 2005, chương 1 (cấu trúc tinh thể)',
};

export function crystalCard(id: CrystalId): ScienceCardData {
  return {
    title: CRYSTAL_NAME[id],
    model: L(
      'Ô mạng cơ sở dựng từ toạ độ hình học (đơn vị: cạnh ô a). Số hạt trong một ô, số phối trí và độ đặc khít do chương trình đếm và tính trên chính các toạ độ đó.',
      'The unit cell is built from geometric coordinates (unit: the cell edge a). The particles per cell, the coordination number and the packing fraction are counted and computed by the program from those coordinates.',
    ),
    equations: [
      { tex: 'N = \\sum_i n_i\\, f_i', label: L('Số hạt trong một ô', 'Particles per cell') },
      {
        tex: '\\eta = \\dfrac{N\\cdot\\frac{4}{3}\\pi r^3}{V},\\quad r = \\dfrac{d_{\\min}}{2}',
        label: L(
          'Độ đặc khít (quả cầu cứng; V: thể tích ô, d_min: khoảng cách gần nhất)',
          'Packing fraction (hard spheres; V: cell volume, d_min: nearest distance)',
        ),
      },
    ],
    assumptions: [
      L(
        'Mỗi hạt góp vào ô phần nằm trong ô: 1/8 ở đỉnh hình lập phương, 1/2 ở mặt, 1/4 ở cạnh, 1/6 ở đỉnh hình lăng trụ lục giác.',
        'Each particle counts for the part inside the cell: 1/8 at a cube corner, 1/2 on a face, 1/4 on an edge, 1/6 at a corner of the hexagonal prism.',
      ),
      L(
        'Độ đặc khít: các nguyên tử là quả cầu cứng bằng nhau, chạm các nguyên tử gần nhất. Lục phương đặc khít lấy tỉ số lí tưởng c/a = √(8/3).',
        'Packing fraction: atoms are equal hard spheres touching their nearest neighbours. Hexagonal close packing takes the ideal ratio c/a = √(8/3).',
      ),
      L(
        'Hình không theo tỉ lệ: chưa có hằng số mạng có nguồn; cỡ quả cầu trên hình chỉ để nhìn rõ (ion Na⁺ và Cl⁻ cũng vậy).',
        'Not to scale: no sourced lattice constant yet; the sphere sizes only make the picture readable (Na⁺ and Cl⁻ too).',
      ),
    ],
    validity: L(
      'Tinh thể lí tưởng, không khuyết tật, một ô mạng.',
      'Ideal crystal, no defects, one unit cell.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Số đếm và độ đặc khít tính đúng từ hình học; hình vẽ không theo tỉ lệ.',
      'Counts and packing fraction are exact geometry; the picture is not to scale.',
    ),
    userIntervened: false,
    sources: [KITTEL, CSRC.sgk12, CSRC.sgk10],
    reviewStatus: 'pending',
  };
}
