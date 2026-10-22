/**
 * Science Card of "Tăng trưởng logistic" (2D chart and 3D habitat share it). The 3D view adds what
 * its picture shows and what in it is illustration (DATA_REVIEW LOG3D-*). No three.js here.
 */
import type { ScienceCardData } from '@/science-card/types';
import { BSRC, L } from '../common';
import { card3dAssumptions } from '../view3d/texts';

export const LOGISTIC_CARD: ScienceCardData = {
  title: L('Tăng trưởng quần thể (logistic)', 'Population growth (logistic)'),
  model: L(
    'Quần thể tăng theo phương trình logistic: tốc độ tăng giảm dần khi số cá thể tiến tới sức chứa K của môi trường. Nghiệm được tính chính xác bằng công thức; đường hàm mũ (không giới hạn) vẽ để so sánh.',
    'The population follows the logistic equation: growth slows as N approaches the carrying capacity K. The curve uses the exact solution; unlimited exponential growth is drawn for comparison.',
  ),
  equations: [
    { tex: '\\dfrac{dN}{dt} = rN\\left(1 - \\dfrac{N}{K}\\right)' },
    { tex: 'N(t) = \\dfrac{K}{1 + \\left(\\dfrac{K}{N_0} - 1\\right)e^{-rt}}' },
    {
      tex: 't^{*} = \\dfrac{1}{r}\\ln\\!\\left(\\dfrac{K}{N_0} - 1\\right),\\quad \\left(\\dfrac{dN}{dt}\\right)_{\\max} = \\dfrac{rK}{4}',
    },
  ],
  assumptions: [
    L(
      'r và K không đổi theo thời gian; không có di cư, không có độ trễ.',
      'Constant r and K; no migration, no time lag.',
    ),
    L(
      'N là biến liên tục (thích hợp cho quần thể lớn).',
      'N is treated as continuous (suitable for large populations).',
    ),
  ],
  confidence: 'exact',
  confidenceNote: L(
    'Công thức nghiệm chính xác; test tự động so sánh với DOPRI5 và kiểm tra điểm uốn tại N = K/2.',
    'Exact closed form; automated tests compare with DOPRI5 and check the inflection at N = K/2.',
  ),
  userIntervened: false,
  sources: [BSRC.sgk12, BSRC.murray, BSRC.campbell],
};

/** What the 3D habitat adds to the Science Card (DATA_REVIEW LOG3D-1 … LOG3D-3). */
export const LOGISTIC_CARD_3D: ScienceCardData = card3dAssumptions(LOGISTIC_CARD, [
  L(
    'Hình 3D: mỗi con vật là một cá thể (hoặc một nhóm cá thể, theo thang ghi trên hình, làm tròn); số con vật lúc t là N(t) của nghiệm chính xác chia cho thang.',
    '3D picture: each animal is one individual (or a group, at the scale shown, rounded); the number of animals at t is the exact solution N(t) divided by the scale.',
  ),
  L(
    'Hàng rào bao đúng chỗ cho K cá thể ở thang vẽ; khi N₀ > K các con vật thừa đứng ngoài rào. Mô hình logistic không có không gian: rào chỉ minh họa sức chứa K.',
    'The fence holds exactly the room for K individuals at the drawing scale; when N₀ > K the extra animals stand outside it. The logistic model has no space: the fence only illustrates the carrying capacity K.',
  ),
  L(
    'Bãi cỏ bị gặm theo tỉ lệ N/K và cột N(t) có vòng K, K/2; mũi tên dài theo |dN/dt| so với rK/4, tốc độ lớn nhất mô hình cho phép khi N ≤ K (lúc N = K/2), hoặc so với |dN/dt| lúc t = 0 khi N₀ > K và giá trị đó lớn hơn. Thức ăn chỉ là hình minh họa cho hệ số (1 − N/K).',
    'The clover is grazed in proportion N/K and the N(t) column has rings at K and K/2; the arrow’s length follows |dN/dt| relative to rK/4, the largest rate the model allows while N ≤ K (at N = K/2), or relative to |dN/dt| at t = 0 when N₀ > K and that is larger. The food only illustrates the factor (1 − N/K).',
  ),
]);
