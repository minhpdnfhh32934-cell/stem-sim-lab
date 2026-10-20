import type { ScienceCardData } from '@/science-card/types';
import { CSRC, L } from '../common';
import { REACTIONS_SOURCE, type Reaction } from '../data/reactions';
import { ILLUSTRATIVE } from './labels';

/** Science Card of one library reaction (shared by the reaction library and the Studio bench). */
export function reactionCard(r: Reaction): ScienceCardData {
  const mech = r.mechanism;
  return {
    title: r.name,
    model: mech
      ? L(
          `Cơ chế ${mech.type.vi.toLowerCase()} theo tài liệu. Các khung chính (chất đầu, trung gian, sản phẩm) là cấu trúc tối ưu bằng trường lực; trạng thái chuyển tiếp và chuyển động giữa các khung chỉ minh họa.`,
          `${mech.type.en} mechanism from the literature. Key frames (reactants, intermediates, products) are force-field structures; transition states and motion between frames are illustrative.`,
        )
      : L(
          'Phương trình tổng đã cân bằng (kiểm tra bảo toàn nguyên tố và điện tích). Không hiển thị cơ chế.',
          'Balanced overall equation (element and charge conservation checked). No mechanism shown.',
        ),
    equations: [],
    assumptions: [
      ...(mech ? [ILLUSTRATIVE, mech.note] : []),
      L(`Điều kiện: ${r.conditions.vi}`, `Conditions: ${r.conditions.en}`),
    ],
    confidence: 'qualitative',
    confidenceNote: L(
      'Phương trình: đã kiểm tra bảo toàn bằng test tự động. Hình ảnh cơ chế: định tính.',
      'Equation: conservation checked by automated tests. Mechanism pictures: qualitative.',
    ),
    userIntervened: false,
    sources: [...r.sources, REACTIONS_SOURCE, ...(mech ? [CSRC.rdkit] : [])],
    reviewStatus: r.review_status,
  };
}
