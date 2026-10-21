/**
 * Science Card of "Định luật Hardy–Weinberg" (2D page and 3D view share it). The 3D view adds what
 * its picture shows and what in it is illustration (DATA_REVIEW HW3D-*). No three.js here.
 */
import type { ScienceCardData } from '@/science-card/types';
import { BSRC, L } from '../common';
import { card3dAssumptions } from '../view3d/texts';

export const HW_CARD: ScienceCardData = {
  title: L('Định luật Hardy–Weinberg', 'Hardy–Weinberg principle'),
  model: L(
    'Quần thể ngẫu phối, kích thước lớn, không đột biến, không chọn lọc, không di nhập gen: tần số kiểu gen đạt p², 2pq, q² sau một thế hệ.',
    'Large random-mating population, no mutation, selection or migration: genotype frequencies reach p², 2pq, q² after one generation.',
  ),
  equations: [
    { tex: 'p = \\dfrac{2N_{AA} + N_{Aa}}{2N},\\quad q = 1 - p' },
    { tex: 'p^2 + 2pq + q^2 = 1' },
    { tex: '\\chi^2 = \\sum \\dfrac{(O-E)^2}{E},\\ df = 1' },
  ],
  assumptions: [
    L('Gen có 2 alen trên NST thường.', 'One autosomal gene with two alleles.'),
    L(
      'Kiểm định χ² có df = 3 − 1 − 1 = 1 vì p được ước lượng từ số liệu.',
      'χ² has df = 3 − 1 − 1 = 1 because p is estimated from the data.',
    ),
  ],
  confidence: 'exact',
  confidenceNote: L(
    'Công thức chính xác; mô phỏng ngẫu phối có sai số thống kê.',
    'Exact formulas; the random-mating run has statistical error.',
  ),
  userIntervened: false,
  sources: [BSRC.sgk12, BSRC.hartl],
};

/** What the 3D habitat adds to the card (DATA_REVIEW HW3D-1, HW3D-2). */
export const HW_CARD_3D: ScienceCardData = card3dAssumptions(HW_CARD, [
  L(
    'Hình 3D: mỗi con vật là một cá thể (hoặc một nhóm cá thể, theo thang ghi trên hình), màu thân theo kiểu gen; hai hạt trên râu là hai bản sao gen của nó (khối vuông = A, hình cầu = a).',
    '3D picture: each animal is one individual (or a group, at the scale shown), its body coloured by genotype; the two beads on its antennae are its two gene copies (cube = A, sphere = a).',
  ),
  L(
    'Thanh “Thế hệ”: thế hệ 0 là số liệu bạn nhập; các thế hệ sau là mô phỏng ngẫu phối liên tiếp với N cá thể nên có sai số ngẫu nhiên. Sau khi bấm “Cho ngẫu phối 1 thế hệ”, thế hệ 1 chính là kết quả của nút đó.',
    'The “Generation” slider: generation 0 is the numbers you entered; later generations are simulated rounds of random mating with N individuals, so they carry sampling error. After “Random mating for one generation”, generation 1 is that button’s result.',
  ),
]);
