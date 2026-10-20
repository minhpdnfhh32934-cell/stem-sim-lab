/** The Science Card of "Động học enzyme" (2D page; the 3D view adds its notes: enzyme3d/components.ts). */
import type { ScienceCardData } from '@/science-card/types';
import { BSRC, L } from '../common';

export const ENZYME_CARD: ScienceCardData = {
  title: L('Động học enzyme Michaelis–Menten', 'Michaelis–Menten enzyme kinetics'),
  model: L(
    'Tốc độ phản ứng ban đầu theo phương trình Michaelis–Menten, ảnh hưởng của chất ức chế theo các dạng chuẩn. Tiến trình [S](t) dùng nghiệm chính xác qua hàm Lambert W và được đối chiếu với tích phân số DOPRI5.',
    'Initial rate from the Michaelis–Menten equation, with the standard inhibition forms. The time course [S](t) uses the exact Lambert W solution, cross-checked with DOPRI5.',
  ),
  equations: [
    { tex: 'v = \\dfrac{V_{\\max}[S]}{K_m + [S]}' },
    { tex: '\\dfrac{1}{v} = \\dfrac{K_m}{V_{\\max}}\\cdot\\dfrac{1}{[S]} + \\dfrac{1}{V_{\\max}}' },
    {
      tex: '\\alpha = 1 + \\dfrac{[I]}{K_i}',
      label: L('Hệ số ức chế', 'Inhibition factor'),
    },
    {
      tex: 'K_m^{app} = \\alpha K_m,\\quad V_{\\max}^{app} = V_{\\max}',
      label: L('Ức chế cạnh tranh', 'Competitive inhibition'),
    },
    {
      tex: 'K_m^{app} = K_m,\\quad V_{\\max}^{app} = V_{\\max}/\\alpha',
      label: L('Ức chế không cạnh tranh', 'Non-competitive inhibition'),
    },
    {
      tex: 'K_m^{app} = K_m/\\alpha,\\quad V_{\\max}^{app} = V_{\\max}/\\alpha',
      label: L('Ức chế phi cạnh tranh', 'Uncompetitive inhibition'),
    },
    { tex: '[S](t) = K_m\\,W\\!\\left(\\dfrac{[S]_0}{K_m}\\,e^{([S]_0 - V_{\\max}t)/K_m}\\right)' },
  ],
  assumptions: [
    L(
      'Trạng thái giả dừng: [E] ≪ [S]; phản ứng một chiều S → P; nhiệt độ và pH không đổi.',
      'Quasi-steady state: [E] ≪ [S]; irreversible S → P; constant temperature and pH.',
    ),
    L(
      'Chất ức chế thuận nghịch, dạng tuyến tính đơn giản (một hằng số Kᵢ).',
      'Reversible inhibitor, simple linear forms (one constant Kᵢ).',
    ),
  ],
  confidence: 'exact',
  confidenceNote: L(
    'Công thức chính xác. Test tự động: v = Vmax/2 tại [S] = Km; Km, Vmax biểu kiến; Lambert W khớp DOPRI5.',
    'Exact formulas. Automated tests: v = Vmax/2 at [S] = Km; apparent Km, Vmax; Lambert W matches DOPRI5.',
  ),
  userIntervened: false,
  sources: [BSRC.cornish, BSRC.schnell, BSRC.sgk10],
};
