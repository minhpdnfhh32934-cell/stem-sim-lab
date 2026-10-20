/**
 * Texts of "Di truyền Mendel" shared by the 2D page and the 3D view: the Science Card, the
 * Monte Carlo button and the χ² verdict, so both views say exactly the same words.
 */
import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { BSRC, L } from '../common';

export const MENDEL_CARD: ScienceCardData = {
  title: L('Di truyền Mendel', 'Mendelian genetics'),
  model: L(
    'Các gen phân li độc lập (không liên kết), giao tử có xác suất bằng nhau; tỉ lệ kiểu gen, kiểu hình tính chính xác bằng phân số. Mô phỏng Monte Carlo tạo ngẫu nhiên con lai và so sánh bằng kiểm định χ².',
    'Independently assorting genes (no linkage) and equally likely gametes; genotype/phenotype ratios are exact fractions. A Monte Carlo run draws random offspring and compares with a χ² test.',
  ),
  equations: [{ tex: '\\chi^2 = \\sum \\dfrac{(O - E)^2}{E},\\quad df = k - 1' }],
  assumptions: [
    L(
      'Trội hoàn toàn hoặc trội không hoàn toàn; không đột biến, không gây chết.',
      'Complete or incomplete dominance; no mutation or lethality.',
    ),
    L('Các cặp gen nằm trên các cặp NST khác nhau.', 'Genes on different chromosome pairs.'),
  ],
  confidence: 'exact',
  confidenceNote: L(
    'Test tự động: 3 : 1, 1 : 1, 9 : 3 : 3 : 1, 1 : 2 : 1; χ² tới hạn 3,841 / 5,991 / 7,815 ở α = 0,05.',
    'Automated tests: 3:1, 1:1, 9:3:3:1, 1:2:1; χ² critical values 3.841 / 5.991 / 7.815 at α = 0.05.',
  ),
  userIntervened: false,
  sources: [BSRC.sgk12, BSRC.campbell],
};

/** "Tạo ngẫu nhiên n con lai" (`n` already formatted). */
export const drawLabel = (n: string): LocalizedText =>
  L(`Tạo ngẫu nhiên ${n} con lai`, `Draw ${n} random offspring`);

/** The χ² verdict at α = 0.05. */
export const CHI_VERDICT = {
  ok: L('phù hợp lí thuyết (α = 0,05)', 'consistent with theory (α = 0.05)'),
  bad: L('khác lí thuyết (α = 0,05)', 'differs from theory (α = 0.05)'),
} as const;

/** The notice of a genotype the model cannot read (`GenotypeError`). */
export const INVALID_GENOTYPE = L('Kiểu gen không hợp lệ: ', 'Invalid genotype: ');
