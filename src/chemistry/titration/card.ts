import { formatNumber } from '@/app/i18n';
import type { ScienceCardData } from '@/science-card/types';
import { CSRC, L } from '../common';
import { PKW, PKW_UNCERTAINTY, TITRATION_SOURCES } from './titration';

export function titrationCard(locale: 'vi' | 'en'): ScienceCardData {
  const pkw = formatNumber(locale, PKW, { maximumFractionDigits: 2 });
  const err = formatNumber(locale, PKW_UNCERTAINTY);
  return {
    title: L('Chuẩn độ acid mạnh bằng base mạnh', 'Strong acid – strong base titration'),
    model: L(
      'Dung dịch HCl (Cₐ, Vₐ) trong bình được chuẩn độ bằng dung dịch NaOH (C_b) từ buret. Acid và base phân li hoàn toàn; [H⁺] là nghiệm dương của phương trình cân bằng điện tích kết hợp với tích số ion của nước K_w.',
      'HCl solution (Cₐ, Vₐ) in the flask is titrated with NaOH solution (C_b) from the burette. Acid and base dissociate completely; [H⁺] is the positive root of the charge balance combined with the ion product of water K_w.',
    ),
    equations: [
      {
        tex: '[\\mathrm{H^+}] + [\\mathrm{Na^+}] = [\\mathrm{OH^-}] + [\\mathrm{Cl^-}]',
        label: L('Cân bằng điện tích', 'Charge balance'),
      },
      {
        tex: '[\\mathrm{H^+}][\\mathrm{OH^-}] = K_w',
        label: L('Tích số ion của nước', 'Ion product of water'),
      },
      {
        tex: '[\\mathrm{H^+}] = \\dfrac{D + \\sqrt{D^2 + 4K_w}}{2},\\quad D = \\dfrac{C_a V_a - C_b V_b}{V_a + V_b}',
      },
      { tex: '\\mathrm{pH} = -\\lg [\\mathrm{H^+}]' },
      {
        tex: 'V_{\\text{tđ}} = \\dfrac{C_a V_a}{C_b}',
        label: L('Điểm tương đương', 'Equivalence point'),
      },
    ],
    assumptions: [
      L(
        `25 °C: pK_w = ${pkw} (sai số ±${err}, IAPWS). SGK làm tròn K_w = 1,0·10⁻¹⁴ nên pH có thể khác SGK ở chữ số thứ hai sau dấu phẩy.`,
        `25 °C: pK_w = ${pkw} (uncertainty ±${err}, IAPWS). Textbooks round K_w to 1.0·10⁻¹⁴, so pH may differ from the textbook in the second decimal.`,
      ),
      L(
        'Dung dịch loãng lí tưởng: hoạt độ bằng nồng độ. Ở nồng độ lớn, pH đo bằng máy lệch khỏi giá trị tính.',
        'Ideal dilute solution: activity equals concentration. At higher concentrations a pH meter reads differently from the computed value.',
      ),
      L(
        'Thể tích cộng được (V = Vₐ + V_b); bỏ qua CO₂ của không khí hoà vào dung dịch.',
        'Volumes are additive (V = Vₐ + V_b); CO₂ dissolving from the air is ignored.',
      ),
      L(
        'Màu chất chỉ thị là minh hoạ: khoảng đổi màu và tên màu theo bảng nguồn, màu trên màn hình là màu CSS cùng tên; trong khoảng đổi màu, màu được trộn đều theo pH.',
        'Indicator colours are an illustration: the range and colour names follow the source table, the screen colour is the CSS colour of the same name; inside the range the colours are blended evenly with pH.',
      ),
    ],
    validity: L(
      'Acid mạnh một nấc và base mạnh một nấc, Cₐ, C_b từ 0,001 đến 1 mol/L, 25 °C. Acid/base yếu và dung dịch đệm chưa có.',
      'Monoprotic strong acid and strong base, Cₐ, C_b from 0.001 to 1 mol/L, 25 °C. Weak acids/bases and buffers are not included.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Test tự động: pH khớp lời giải chia đôi khoảng độc lập của phương trình cân bằng điện tích, sai số < 10⁻⁹ đơn vị pH ở mọi điểm thử, kể cả điểm tương đương (pH = pK_w/2).',
      'Automated tests: pH matches an independent bisection solution of the charge balance within 10⁻⁹ pH units at every test point, including the equivalence point (pH = pK_w/2).',
    ),
    method: L(
      'Nghiệm đóng của phương trình bậc hai, viết dạng không bị triệt tiêu số học',
      'Closed-form root of the quadratic, written without numerical cancellation',
    ),
    userIntervened: false,
    sources: [...TITRATION_SOURCES, CSRC.sgk11],
    reviewStatus: 'pending',
  };
}
