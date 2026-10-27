import type { LocalizedText } from '@/core/data/dataset';
import { L } from '../common';
import type { MechanismFrame, ReactionCategory } from '../data/reactions';

export const CATEGORY: Record<ReactionCategory, LocalizedText> = {
  synthesis: L('Hóa hợp', 'Synthesis'),
  combustion: L('Đốt cháy', 'Combustion'),
  acidBase: L('Axit – bazơ', 'Acid–base'),
  precipitation: L('Tạo kết tủa', 'Precipitation'),
  redox: L('Oxi hóa – khử', 'Redox'),
  decomposition: L('Phân hủy', 'Decomposition'),
  equilibrium: L('Cân bằng (công nghiệp)', 'Equilibrium (industry)'),
  organic: L('Hữu cơ', 'Organic'),
};

export const FRAME_KIND: Record<MechanismFrame['kind'], LocalizedText> = {
  reactants: L('Chất đầu', 'Reactants'),
  ts: L('Trạng thái chuyển tiếp', 'Transition state'),
  intermediate: L('Trung gian', 'Intermediate'),
  products: L('Sản phẩm', 'Products'),
};

/** The step kind shown after a step's name, or null when the name already says it ("Chất đầu"). */
export function kindNote(label: LocalizedText, kind: MechanismFrame['kind']): LocalizedText | null {
  const k = FRAME_KIND[kind];
  return label.vi === k.vi && label.en === k.en ? null : k;
}

export const ILLUSTRATIVE = L(
  'Chuyển tiếp minh họa — không phải quỹ đạo nguyên tử thực',
  'Illustrative transition — not real atomic trajectories',
);
