import type { ScienceCardData } from '@/science-card/types';
import { L } from '../common';
import { AQUEOUS_SOURCE } from './model';

export const TITLE = L('Cân bằng trong dung dịch nước', 'Equilibria in aqueous solution');

export function aqueousCard(): ScienceCardData {
  return {
    title: TITLE,
    model: L(
      'Dung dịch nước ở 25 °C. Chất điện li mạnh (acid mạnh, base mạnh, muối tan) phân li hoàn toàn thành ion; nước phân li rất ít, với tích số ion Kw = [H⁺]·[OH⁻] không đổi. pH cho biết dung dịch có môi trường acid, trung tính hay base; chất chỉ thị đổi màu theo pH.',
      'Aqueous solution at 25 °C. Strong electrolytes (strong acids, strong bases, soluble salts) dissociate completely into ions; water dissociates very little, with a constant ion product Kw = [H⁺]·[OH⁻]. The pH tells whether the solution is acidic, neutral or basic; indicators change colour with pH.',
    ),
    equations: [
      {
        tex: 'K_w = [\\mathrm{H^+}]\\cdot[\\mathrm{OH^-}] = 10^{-14}',
        label: L('Tích số ion của nước (25 °C)', 'Ion product of water (25 °C)'),
      },
      {
        tex: '\\mathrm{pH} = -\\lg[\\mathrm{H^+}],\\quad [\\mathrm{H^+}] = 10^{-\\mathrm{pH}}',
        label: L('Khái niệm pH', 'Definition of pH'),
      },
      {
        tex: '[\\mathrm{H^+}] = \\frac{C + \\sqrt{C^2 + 4K_w}}{2}',
        label: L(
          'Acid mạnh nồng độ C (tính cả H⁺ của nước)',
          'Strong acid of concentration C (water’s H⁺ included)',
        ),
      },
    ],
    assumptions: [
      L(
        'Kw = 10⁻¹⁴ ở 25 °C theo SGK (tr. 20); sách nói có thể dùng giá trị này khi nhiệt độ không khác nhiều 25 °C.',
        'Kw = 10⁻¹⁴ at 25 °C as the textbook gives it (p. 20); the book says it may be used when the temperature is not far from 25 °C.',
      ),
      L(
        'Màu giấy quỳ và phenolphthalein theo Bảng 2.1 (tr. 23): quỳ đỏ khi pH ≤ 6, tím khi pH = 7, xanh khi pH ≥ 8; phenolphthalein không màu khi pH < 8, hồng khi pH > 8. Giữa các ngưỡng sách không ghi màu, SimLab cũng không ghi. Màu trên màn hình là màu minh họa.',
        'Litmus and phenolphthalein colours follow Table 2.1 (p. 23): litmus red at pH ≤ 6, violet at pH = 7, blue at pH ≥ 8; phenolphthalein colourless at pH < 8, pink at pH > 8. Between the thresholds the book names no colour, and neither does SimLab. Screen colours are an illustration.',
      ),
      L(
        'pH của các dung dịch quen thuộc (Hình 2.1, tr. 16) và khoảng pH của dịch cơ thể, nước nuôi tôm cá, đất trồng (Hình 2.4 và tr. 22) lấy nguyên từ sách.',
        'The pH of everyday solutions (Figure 2.1, p. 16) and the pH ranges of body fluids, fish ponds and soils (Figure 2.4 and p. 22) are taken from the book as printed.',
      ),
      L(
        'Dung dịch lí tưởng: pH tính theo nồng độ, như SGK. Acid, base yếu cần hằng số phân li mà Bài 2 không cho, nên SimLab không tính pH của chúng.',
        'Ideal solution: pH from concentration, as in the textbook. Weak acids and bases need a dissociation constant that lesson 2 does not give, so SimLab does not compute their pH.',
      ),
    ],
    validity: L(
      'Dung dịch loãng ở khoảng 25 °C, thang pH 0–14.',
      'Dilute solutions near 25 °C, pH scale 0–14.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Các hệ thức là định nghĩa. Kiểm chứng độc lập: pH của acid, base mạnh khớp với lời giải chia đôi của phương trình cân bằng điện tích.',
      'The relations are definitions. Independent check: the pH of a strong acid or base matches a bisection solution of the charge balance.',
    ),
    userIntervened: false,
    sources: [AQUEOUS_SOURCE],
    reviewStatus: 'pending',
  };
}
