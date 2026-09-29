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

export const ILLUSTRATIVE = L(
  'Chuyển tiếp minh họa — không phải quỹ đạo nguyên tử thực',
  'Illustrative transition — not real atomic trajectories',
);
