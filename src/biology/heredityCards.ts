/**
 * Science Cards and titles of the SH12 heredity modules of #255 round 5b: X-linked inheritance
 * (Bài 10), linkage and crossing over (Bài 11), chromosome mutations (Bài 12).
 */
import type { ScienceCardData } from '@/science-card/types';
import { L } from './common';
import { HEREDITY_SOURCE } from './heredityData';
import { sgkSh12 } from './sh12Sources';

export const SEXLINKED_TITLE = L(
  'Di truyền giới tính và liên kết với giới tính',
  'Sex determination and sex linkage',
);
export const LINKAGE_TITLE = L('Liên kết gene và hoán vị gene', 'Linkage and crossing over');
export const CHROMOSOME_TITLE = L('Đột biến nhiễm sắc thể', 'Chromosome mutations');

const pending = L(
  'Kết quả tính đúng theo cách sách lập sơ đồ lai; chờ giáo viên duyệt.',
  'Results follow exactly from the book’s way of setting out a cross; awaiting teacher review.',
);

export const SEXLINKED_CARD: ScienceCardData = {
  title: SEXLINKED_TITLE,
  model: L(
    'Ở kiểu XX – XY, con cái cho một loại giao tử mang X, con đực cho hai loại X và Y với tỉ lệ ngang nhau, nên tỉ lệ con đực : con cái là 1 : 1. Gene quy định màu mắt ở ruồi giấm nằm trên NST X, không có allele tương ứng trên Y (A mắt đỏ trội hoàn toàn so với a mắt trắng). Con đực chỉ có một X nên allele lặn biểu hiện ngay; kết quả phép lai thuận và lai nghịch khác nhau, tính trạng di truyền chéo.',
    'With XX – XY, females make one kind of gamete (X), males two (X and Y) in equal shares, so males : females is 1 : 1. The eye-colour gene of Drosophila is on X with no allele on Y (A red, completely dominant over a white). Males have one X, so a recessive allele shows at once; forward and reciprocal crosses differ, and the trait passes criss-cross.',
  ),
  equations: [],
  assumptions: [
    L(
      'Mỗi bên bố mẹ cho các loại giao tử với tỉ lệ ngang nhau; các hợp tử sống như nhau.',
      'Each parent makes its kinds of gametes in equal shares; every zygote survives alike.',
    ),
  ],
  validity: L(
    'Một gene trên vùng không tương đồng của NST X, hai allele, trội hoàn toàn.',
    'One gene on the non-homologous part of X, two alleles, complete dominance.',
  ),
  confidence: 'exact',
  confidenceNote: pending,
  userIntervened: false,
  sources: [sgkSh12(10, 'Di truyền giới tính và di truyền liên kết với giới tính', '50–53')],
  reviewStatus: 'pending',
};

export const LINKAGE_CARD: ScienceCardData = {
  title: LINKAGE_TITLE,
  model: L(
    'Hai gene nằm trên cùng một NST thường di truyền cùng nhau (liên kết gene). Ở ruồi giấm đực F1 không xảy ra hoán vị nên phép lai phân tích cho hai kiểu hình, mỗi loại 50 %. Ở con cái, trong giảm phân I một số tế bào có trao đổi chéo giữa các chromatid không chị em của cặp NST tương đồng, tạo giao tử tái tổ hợp. Tần số hoán vị gene bằng tỉ lệ phần trăm giao tử tái tổ hợp, bằng một nửa tỉ lệ tế bào có trao đổi chéo, và không vượt quá 50 %.',
    'Genes on one chromosome usually pass on together (linkage). The F1 male Drosophila shows no crossing over, so its testcross gives two classes of 50 % each. In females some cells cross over between non-sister chromatids in meiosis I, making recombinant gametes. The recombination frequency is the percentage of recombinant gametes, half the share of cells with a crossover, and never above 50 %.',
  ),
  equations: [
    { tex: 'f = \\dfrac{\\text{recombinant}}{\\text{total}}' },
    { tex: 'f = \\tfrac{1}{2}\\,p_{\\text{cells}},\\quad f \\le 50\\,\\%' },
  ],
  assumptions: [
    L(
      'Phép lai phân tích với cá thể đồng hợp lặn: mỗi kiểu hình ở đời con ứng với một loại giao tử của bố hoặc mẹ dị hợp.',
      'A testcross with a double recessive: each offspring class shows one gamete of the heterozygous parent.',
    ),
  ],
  validity: L(
    'Hai gene trên cùng một NST, mỗi tế bào có trao đổi chéo xảy ra một lần giữa hai gene.',
    'Two genes on one chromosome, at most one crossover between them in a cell.',
  ),
  confidence: 'exact',
  confidenceNote: pending,
  userIntervened: false,
  sources: [sgkSh12(11, 'Liên kết gene và hoán vị gene', '54–59'), HEREDITY_SOURCE],
  reviewStatus: 'pending',
};

export const CHROMOSOME_CARD: ScienceCardData = {
  title: CHROMOSOME_TITLE,
  model: L(
    'Đột biến NST là những biến đổi về cấu trúc hoặc số lượng NST. Đột biến cấu trúc (mất đoạn, lặp đoạn, đảo đoạn, chuyển đoạn) do tác nhân đột biến làm đứt gãy NST rồi các đoạn được nối lại bất thường. Đột biến lệch bội thay đổi số lượng ở một hoặc một vài cặp NST (thể ba 2n + 1, thể một 2n − 1, thể không 2n − 2), do sự rối loạn phân li trong giảm phân. Đột biến đa bội làm số bộ NST đơn bội tăng lên nhiều lần (3n, 4n); lai xa kèm đa bội hóa tạo thể song lưỡng bội 2nA + 2nB.',
    'Chromosome mutations change the structure or number of chromosomes. Structural ones (deletion, duplication, inversion, translocation) come from breaks rejoined wrongly. Aneuploidy changes one or a few pairs (trisomy 2n + 1, monosomy 2n − 1, nullisomy 2n − 2), from non-disjunction in meiosis. Polyploidy multiplies the haploid set (3n, 4n); a wide cross with doubling gives the allopolyploid 2nA + 2nB.',
  ),
  equations: [],
  assumptions: [
    L(
      'Các chữ cái là các gene trên NST như Hình 12.1; số lượng NST tính từ 2n của loài.',
      'Letters are genes on a chromosome as in Figure 12.1; counts follow from the species’ 2n.',
    ),
    L(
      'Biểu đồ hội chứng Down là số liệu sách dẫn (mục Em có biết), mỗi khoảng tuổi một điểm.',
      'The Down syndrome chart is the data the book quotes (“Em có biết”), one point per age band.',
    ),
  ],
  validity: L(
    'Các dạng đột biến và ví dụ sách nêu ở Bài 12.',
    'The kinds of mutation and examples given in Lesson 12.',
  ),
  confidence: 'exact',
  confidenceNote: pending,
  userIntervened: false,
  sources: [sgkSh12(12, 'Đột biến nhiễm sắc thể', '60–67'), HEREDITY_SOURCE],
  reviewStatus: 'pending',
};
