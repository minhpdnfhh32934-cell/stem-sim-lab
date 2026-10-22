/**
 * Texts of the 3D view of "Di truyền Mendel": names of the parts on the picture, the four steps,
 * what is illustration, the 3D Science Card and the selection type. Vietnamese is the source of
 * truth; every new text is listed in docs/DATA_REVIEW.md (MEN3D-*, review_status: pending) —
 * sources: SGK Sinh học 12, Campbell Biology.
 */
import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { L } from '../../common';
import { ILLUSTRATION, MOTION } from '../../view3d/texts';
import { MENDEL_CARD } from '../mendelCard';
import type { MendelStep, ParentId } from './binding';

export type MendelPart =
  'mother' | 'father' | 'femaleGametes' | 'maleGametes' | 'board' | 'pedestals' | 'field';

/** What the learner picked (indices are the model's, 0-based). */
export type MendelSelection =
  | { kind: 'parent'; parent: ParentId }
  | { kind: 'gamete'; parent: ParentId; index: number }
  | { kind: 'cell'; row: number; col: number }
  | { kind: 'class'; index: number };

/** "Minh họa — không phải tỉ lệ/hình dạng thật" (the same words as the DNA 3D views). */
export const MENDEL_ILLUSTRATION = L(
  'Minh họa — không phải tỉ lệ/hình dạng thật.',
  'Illustration — not to scale or true shape.',
);

/** The required colour note: colours tell the phenotype classes apart, nothing more. */
export const COLOUR_NOTE = L(
  'Màu chỉ phân biệt nhóm kiểu hình, không phải màu thật của tính trạng.',
  'Colours only tell the phenotype classes apart; they are not the real colour of a trait.',
);

/** Individuals are symbols: no species, no real trait. */
export const ABSTRACT_NOTE = L(
  'Bố mẹ, giao tử và con lai là kí hiệu trừu tượng: không thuộc loài nào, không mang tính trạng cụ thể nào.',
  'Parents, gametes and offspring are abstract symbols: no species and no particular trait.',
);

/** Names on the picture ("Hiện tên"). */
export const MENDEL_PARTS: Record<MendelPart, LocalizedText> = {
  mother: L('Mẹ ♀ (P)', 'Mother ♀ (P)'),
  father: L('Bố ♂ (P)', 'Father ♂ (P)'),
  femaleGametes: L('Giao tử ♀', 'Gametes ♀'),
  maleGametes: L('Giao tử ♂', 'Gametes ♂'),
  board: L('Bảng Punnett', 'Punnett square'),
  pedestals: L('Tỉ lệ kiểu hình', 'Phenotype ratio'),
  field: L('Con lai ngẫu nhiên', 'Random offspring'),
};

export const PARENT_NAME: Record<ParentId, LocalizedText> = {
  0: L('Mẹ ♀', 'Mother ♀'),
  1: L('Bố ♂', 'Father ♂'),
};

export const STEP_NAME: Record<MendelStep, LocalizedText> = {
  meiosis: L('Giảm phân', 'Meiosis'),
  gametes: L('Giao tử', 'Gametes'),
  fertilisation: L('Thụ tinh', 'Fertilisation'),
  offspring: L('Con lai', 'Offspring'),
};

/** What each step shows (the caption). */
export const STEP_NOTE: Record<MendelStep, LocalizedText> = {
  meiosis: L(
    'Mỗi gen nằm trên một cặp NST tương đồng; khi giảm phân, hai NST của mỗi cặp phân li về hai giao tử khác nhau, các cặp phân li độc lập.',
    'Each gene sits on its own pair of homologous chromosomes; in meiosis the two chromosomes of a pair separate into different gametes, and the pairs assort independently.',
  ),
  gametes: L(
    'Mỗi giao tử mang một alen của mỗi gen. Số bên cạnh là xác suất chính xác của loại giao tử đó.',
    'Each gamete carries one allele of each gene. The number beside it is the exact probability of that kind of gamete.',
  ),
  fertilisation: L(
    'Mỗi ô của bảng Punnett là một tổ hợp giao tử ♀ × giao tử ♂ khi thụ tinh; xác suất của ô bằng tích hai xác suất.',
    'Each cell of the Punnett square is one ♀ gamete × ♂ gamete pair at fertilisation; its probability is the product of the two.',
  ),
  offspring: L(
    'Con lai tô màu theo nhóm kiểu hình; mức chất lỏng trong mỗi ống bằng xác suất chính xác của kiểu hình đó (vạch khắc ở 1/4, 1/2, 3/4 và 1).',
    'Offspring are coloured by phenotype class; the liquid in each cylinder stands as high as the exact probability of its phenotype (marks at 1/4, 1/2, 3/4 and 1).',
  ),
};

/** The camera choices: everything, or the Punnett square with the gametes. */
export const CAMERA_NAME = {
  overview: L('Toàn cảnh', 'Whole picture'),
  board: L('Bảng Punnett', 'Punnett square'),
} as const;

/**
 * The 3D Science Card: the lesson's card (same model, equation, confidence and sources) with
 * what the 3D picture adds.
 */
export function mendelCard3d(): ScienceCardData {
  const base = MENDEL_CARD;
  return {
    ...base,
    title: L('Di truyền Mendel 3D', 'Mendelian genetics in 3D'),
    assumptions: [
      ...base.assumptions,
      ILLUSTRATION,
      MOTION,
      COLOUR_NOTE,
      ABSTRACT_NOTE,
      L(
        'Bàn thí nghiệm, khay có ô lõm, bệ đỡ, ống đong và cách con lai rơi vào ô chỉ là hình minh họa để sắp xếp; trong các ống chỉ mức chất lỏng mang số liệu. Kiểu gen trong ô hiện khi phóng to hoặc khi bấm vào ô.',
        'The bench, the tray with its slots, the pedestals, the cylinders and the way the offspring drop into the cells are only an illustrative arrangement; in the cylinders only the liquid level carries a number. The genotypes in the cells show when you zoom in or click a cell.',
      ),
      L(
        'Mỗi gen được vẽ trên một cặp NST tương đồng riêng, đúng giả thiết phân li độc lập (không liên kết) của bài. Giảm phân vẽ giản lược: chỉ các cặp NST mang gen; không vẽ sự nhân đôi NST, trao đổi chéo hay thoi phân bào.',
        'Each gene is drawn on its own pair of homologous chromosomes, matching the lesson’s independent assortment (no linkage). Meiosis is simplified: only the chromosome pairs carrying the genes; chromosome replication, crossing over and the spindle are not drawn.',
      ),
      L(
        'Trội không hoàn toàn: thể dị hợp là một nhóm kiểu hình riêng, có màu riêng — không phải màu pha giữa hai thể đồng hợp.',
        'Incomplete dominance: the heterozygote is its own phenotype class with its own colour — not a blend of the two homozygotes.',
      ),
      L(
        'Chính xác (lấy từ mô hình): giao tử và xác suất của chúng, các ô của bảng Punnett, kiểu gen, kiểu hình, mức chất lỏng trong ống = xác suất, tỉ lệ rút gọn, và số con lai ngẫu nhiên (cùng lần tạo như trang 2D).',
        'Exact (from the model): the gametes and their probabilities, the cells of the Punnett square, genotypes, phenotypes, liquid level in each cylinder = probability, the reduced ratio, and the random offspring counts (the same draw as the 2D page).',
      ),
      L(
        'Khi số con lai lớn, mỗi hình đại diện cho k con lai (k = 1, 2 hoặc 5 × 10ⁿ); số hình của các nhóm được làm tròn theo phần dư lớn nhất nên cộng lại đúng tổng. Số chính xác ở chip và thẻ chi tiết.',
        'With many offspring, each figure stands for k offspring (k = 1, 2 or 5 × 10ⁿ); the figures of the classes are rounded by largest remainders so they add up to the total. The exact numbers are on the chips and in the detail card.',
      ),
    ],
    reviewStatus: 'pending',
  };
}
