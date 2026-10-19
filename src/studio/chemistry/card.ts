import { L } from '@/chemistry/common';
import { reactionCard } from '@/chemistry/reaction/card';
import type { Reaction } from '@/chemistry/data/reactions';
import type { ScienceCardData } from '@/science-card/types';

/** Limits of the bench itself, added to the library record's own card. */
export const BENCH_LIMITS = [
  L(
    'Bàn thí nghiệm chỉ tra bản ghi của thư viện phản ứng cho đúng tập chất đầu đã trộn; nó không tự suy ra phản ứng hay hiện tượng.',
    'The bench only looks up the reaction library record for exactly the substances mixed; it does not infer reactions or observations itself.',
  ),
  L(
    'Không tính lượng chất, nồng độ, khối lượng kết tủa, chất dư hay chất hết, pH, nhiệt độ, nhiệt lượng, thể tích khí hay hiệu suất.',
    'No amounts, concentrations, precipitate mass, limiting or excess reagent, pH, temperature, heat, gas volume or yield are computed.',
  ),
  L(
    'Lớp kết tủa trong hình chỉ là kí hiệu: màu và lượng không vẽ theo số liệu.',
    'The precipitate layer in the picture is only a symbol: its colour and amount are not drawn from data.',
  ),
];

export function benchCard(r: Reaction): ScienceCardData {
  const base = reactionCard(r);
  return {
    ...base,
    assumptions: [...base.assumptions, ...BENCH_LIMITS],
    validity: L(
      'Chỉ các cặp dung dịch có bản ghi trong thư viện phản ứng tuyển chọn.',
      'Only pairs of solutions that have a record in the curated reaction library.',
    ),
  };
}
