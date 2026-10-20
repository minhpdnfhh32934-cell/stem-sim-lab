import { L } from '@/biology/common';
import { card3d } from '@/biology/division/mitosis3d/components';
import type { CellType } from '@/biology/division/mitosis3d/timeline';
import type { ScienceCardData } from '@/science-card/types';

/** How the lesson reads the model, added to the 3D model's own card. */
export const STUDIO_LIMITS = [
  L(
    'Mỗi kì được đọc tại thời điểm đặc trưng của kì đó trong mô hình 3D; số NST, số NST kép và số tâm động nằm trên mặt phẳng xích đạo (mặt phẳng giữa hai cực thoi phân bào) do mô hình đếm.',
    'Each stage is read at its characteristic moment in the 3D model; the numbers of chromosomes, double chromosomes and centromeres on the equatorial plane (halfway between the spindle poles) are counted by the model.',
  ),
  L(
    'Hoạt động tìm bộ phận chỉ so câu trả lời với tên và chức năng bộ phận có sẵn trong dữ liệu của mô hình; dữ liệu này chưa được kiểm duyệt.',
    'The part-finding activity only compares answers with the part names and functions stored with the model; that data has not been reviewed yet.',
  ),
];

export function studioCard(cellType: CellType): ScienceCardData {
  const base = card3d(cellType);
  return { ...base, assumptions: [...base.assumptions, ...STUDIO_LIMITS] };
}
