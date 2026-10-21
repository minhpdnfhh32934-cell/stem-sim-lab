/**
 * Science Card of "Phiêu bạt di truyền" (2D chart and 3D archipelago share it). The 3D view adds
 * what its picture shows and what in it is illustration (DATA_REVIEW DRF3D-*). No three.js here.
 */
import type { ScienceCardData } from '@/science-card/types';
import { BSRC, L } from '../common';
import { card3dAssumptions } from '../view3d/texts';

export const DRIFT_CARD: ScienceCardData = {
  title: L('Phiêu bạt di truyền (Wright–Fisher)', 'Genetic drift (Wright–Fisher)'),
  model: L(
    'Mỗi thế hệ, 2N bản sao gen được lấy ngẫu nhiên (phân phối nhị thức) từ thế hệ trước; không chọn lọc, không đột biến.',
    'Each generation, 2N gene copies are drawn binomially from the previous one; no selection or mutation.',
  ),
  equations: [
    {
      tex: 'P_{\\text{fix}}(A) = p_0',
      label: L('Xác suất alen A được cố định', 'Fixation probability of allele A'),
    },
    { tex: 'H_t = H_0\\left(1 - \\tfrac{1}{2N}\\right)^t' },
  ],
  assumptions: [
    L(
      'Quần thể lưỡng bội kích thước N không đổi, thế hệ không gối nhau.',
      'Diploid population of constant size N, non-overlapping generations.',
    ),
  ],
  confidence: 'approx',
  confidenceNote: L(
    'Test tự động (3000 lần chạy): tỉ lệ cố định ≈ p₀ trong ±0,03; dị hợp trung bình khớp (1 − 1/2N)ᵗ.',
    'Automated test (3000 runs): fixation fraction ≈ p₀ within ±0.03; mean heterozygosity follows (1 − 1/2N)ᵗ.',
  ),
  userIntervened: false,
  sources: [BSRC.hartl, BSRC.sgk12],
};

/** What the 3D archipelago adds to the card (DATA_REVIEW DRF3D-1 … DRF3D-7). */
export const DRIFT_CARD_3D: ScienceCardData = card3dAssumptions(DRIFT_CARD, [
  L(
    'Hình 3D: mỗi đảo là một quần thể (một lần chạy của bài, cùng hạt giống với biểu đồ 2D), các đảo độc lập, không di nhập gen; dải quanh bờ chia đúng p : q; khi A cố định (p = 1) hay mất (p = 0), một lá cờ màu của alen còn lại (đỉnh cột ■ = A, ● = a) cắm trên đảo — chỉ là dấu hiệu: cỏ của mọi đảo như nhau, môi trường không đổi.',
    '3D picture: each island is one population (one run of the lesson, the same seed as the 2D chart); the islands are independent, with no migration; the band round its coast is split exactly p : q; when A is fixed (p = 1) or lost (p = 0), a flag in the colour of the allele left (■ = A, ● = a on its pole) stands on the island — only a marker: every island has the same grass, the environment does not change.',
  ),
  L(
    'Mỗi con vật là một cá thể, hai hạt trên râu là hai bản sao gen của nó (khối vuông = A, hình cầu = a); khi số lớn, mỗi con vật là một nhóm k cá thể và mỗi hạt là k bản sao gen (thang ghi trên hình). Mô hình chỉ đếm bản sao gen của cả quần thể: con vật nào mang hai bản sao nào là minh họa.',
    'Each animal is one individual and the two beads on its antennae are its two gene copies (cube = A, sphere = a); with large numbers each animal is a group of k individuals and each bead k gene copies (the scale shown on the picture). The model only counts the gene copies of the whole population: which animal carries which two copies is illustration.',
  ),
]);
