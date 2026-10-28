/**
 * Science Card of "Con mồi – vật ăn thịt (Lotka–Volterra)" (2D phase plot and 3D habitat share
 * it). The 3D view adds what its picture shows and what in it is illustration (DATA_REVIEW
 * LV3D-*). No three.js here.
 */
import type { ScienceCardData } from '@/science-card/types';
import { BSRC, L } from '../common';
import { card3dAssumptions } from '../view3d/texts';

export const LV_CARD: ScienceCardData = {
  title: L('Con mồi – vật ăn thịt (Lotka–Volterra)', 'Predator–prey (Lotka–Volterra)'),
  model: L(
    'Mô hình Lotka–Volterra: con mồi x sinh sản theo hàm mũ và bị ăn tỉ lệ với số lần gặp xy; vật ăn thịt y tăng nhờ ăn mồi và chết với tốc độ không đổi. Hệ được giải số bằng phương pháp Runge–Kutta tự chỉnh bước (Dormand–Prince, DOPRI5) theo biến ln x, ln y (sai số tương đối 10⁻¹⁰, quần thể luôn dương); đại lượng bảo toàn V được theo dõi để kiểm tra độ chính xác.',
    'Lotka–Volterra model: prey x grows exponentially and is eaten in proportion to encounters xy; predators y grow by eating prey and die at a constant rate. Integrated with an adaptive-step Runge–Kutta method (Dormand–Prince, DOPRI5) in the variables ln x, ln y (relative tolerance 10⁻¹⁰, populations stay positive); the conserved quantity V is monitored to check accuracy.',
  ),
  equations: [
    {
      tex: '\\dfrac{dx}{dt} = \\alpha x - \\beta xy,\\qquad \\dfrac{dy}{dt} = \\delta xy - \\gamma y',
    },
    { tex: 'V = \\delta x - \\gamma\\ln x + \\beta y - \\alpha \\ln y = \\text{const}' },
    {
      tex: '(x^{*}, y^{*}) = \\left(\\dfrac{\\gamma}{\\delta}, \\dfrac{\\alpha}{\\beta}\\right),\\quad T \\approx \\dfrac{2\\pi}{\\sqrt{\\alpha\\gamma}}',
    },
  ],
  assumptions: [
    L(
      'Con mồi có thức ăn không giới hạn; vật ăn thịt chỉ ăn loài mồi này.',
      'Prey have unlimited food; predators eat only this prey.',
    ),
    L(
      'Các hệ số không đổi; không có tuổi, không có độ trễ, không có yếu tố ngẫu nhiên.',
      'Constant coefficients; no age structure, delays or randomness.',
    ),
    L(
      'Chu kì T = 2π/√(αγ) chỉ đúng với dao động nhỏ quanh điểm cân bằng.',
      'The period T = 2π/√(αγ) holds only for small oscillations around the equilibrium.',
    ),
  ],
  validity: L(
    'Mô hình định tính kinh điển; quần thể thật chịu thêm nhiều yếu tố khác.',
    'A classic qualitative model; real populations are affected by many other factors.',
  ),
  confidence: 'approx',
  confidenceNote: L(
    'Nghiệm số (DOPRI5). Test tự động: V bảo toàn tới 10⁻⁷, điểm cân bằng đứng yên, chu kì dao động nhỏ khớp 2π/√(αγ).',
    'Numerical solution (DOPRI5). Automated tests: V conserved to 10⁻⁷, equilibrium stays put, small-oscillation period matches 2π/√(αγ).',
  ),
  userIntervened: false,
  sources: [BSRC.murray, BSRC.sgk12],
};

/** What the 3D habitat adds to the Science Card (DATA_REVIEW LV3D-1 … LV3D-3). */
export const LV_CARD_3D: ScienceCardData = card3dAssumptions(LV_CARD, [
  L(
    'Hình 3D: mỗi con vật là một cá thể (hoặc một nhóm, theo thang ghi trên hình, chung cho hai loài, làm tròn); lúc t, số con mồi là x/thang và số vật ăn thịt là y/thang, đọc ở điểm đã tính gần t nhất (không nội suy).',
    '3D picture: each animal is one individual (or a group, at the scale shown, the same for both species, rounded); at t the prey figures are x/scale and the predator figures y/scale, read at the computed point nearest t (no interpolation).',
  ),
  L(
    'Hai cột cùng một thang cho x(t) và y(t), vòng ở x* = γ/δ và y* = α/β; mũi tên bên ngoài mỗi ống (màu đậm của loài đó) dài theo dx/dt, dy/dt so với tốc độ lớn nhất trên các điểm đã tính, tốc độ rất nhỏ thì không vẽ mũi tên; nhãn dưới mỗi cột ghi x, dx/dt và y, dy/dt lúc đang xem. Bảng mặt phẳng pha vẽ đường (x, y) qua các điểm đã tính, hai đường x = x*, y = y* và điểm cân bằng; hạt sáng là lúc đang xem.',
    'The two columns share one scale for x(t) and y(t), with rings at x* = γ/δ and y* = α/β; the arrow beside each tube (a deeper shade of that species’ colour) follows dx/dt, dy/dt relative to the largest rate among the computed points, and a very small rate draws no arrow; the plaque under each column gives x, dx/dt and y, dy/dt at the moment shown. The phase-plane board draws the (x, y) path through the computed points, the lines x = x*, y = y* and the equilibrium; the bead is the moment shown.',
  ),
  L(
    'Mô hình không có không gian và không theo từng cá thể: chỗ đứng, cử động, việc không có cảnh săn mồi, đồng cỏ luôn xanh (giả thiết con mồi có thức ăn không giới hạn) và cây cối chỉ là minh họa.',
    'The model has no space and no individuals: places, motion, the absence of any hunting scene, the always-green clover (the assumption that prey have unlimited food) and the plants are illustration only.',
  ),
]);
