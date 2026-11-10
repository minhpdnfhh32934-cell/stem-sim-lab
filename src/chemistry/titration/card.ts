import { formatNumber } from '@/app/i18n';
import type { ScienceCardData } from '@/science-card/types';
import { CSRC, L } from '../common';
import { PKW, PKW_UNCERTAINTY, TITRATION_SOURCES } from './titration';

export function titrationCard(locale: 'vi' | 'en'): ScienceCardData {
  // Four decimals: rounded to two it would read "14", the textbook value it differs from.
  const pkw = formatNumber(locale, PKW, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const err = formatNumber(locale, PKW_UNCERTAINTY);
  // The textbook writes Kw = 1,0·10⁻¹⁴, i.e. pKw = 14 (DATA_REVIEW TIT-4).
  const gap = formatNumber(locale, Math.abs(14 - PKW), { maximumSignificantDigits: 1 });
  return {
    title: L('Chuẩn độ acid mạnh bằng base mạnh', 'Strong acid – strong base titration'),
    model: L(
      'Dung dịch HCl trong cốc được chuẩn độ bằng dung dịch NaOH từ buret. Acid và base phân li hoàn toàn; [H⁺] là nghiệm dương của phương trình cân bằng điện tích kết hợp với tích số ion của nước Kw.',
      'HCl solution in the beaker is titrated with NaOH solution from the burette. Acid and base dissociate completely; [H⁺] is the positive root of the charge balance combined with the ion product of water Kw.',
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
        `25 °C: pKw = ${pkw} (IAPWS, sai số ±${err}; giá trị IAPWS theo mol/kg được đổi sang mol/L bằng khối lượng riêng của nước). SGK làm tròn Kw = 1,0·10⁻¹⁴, nên pH ở đây có thể lệch SGK khoảng ${gap}.`,
        `25 °C: pKw = ${pkw} (IAPWS, uncertainty ±${err}; the IAPWS value in mol/kg is converted to mol/L with the density of water). Textbooks round Kw to 1.0·10⁻¹⁴, so pH here may differ from the textbook by about ${gap}.`,
      ),
      L(
        'Nhiệt độ giữ ở 25 °C: bỏ qua nhiệt tỏa ra khi trung hòa. Bỏ qua tính acid – base của chính chất chỉ thị.',
        'Temperature held at 25 °C: the heat of neutralisation is ignored. The indicator’s own acid–base effect is ignored.',
      ),
      L(
        'Hoạt độ coi bằng nồng độ (dung dịch lí tưởng): pH là −lg[H⁺] theo nồng độ, như SGK. pH đo bằng máy có thể lệch, càng lệch khi nồng độ càng lớn.',
        'Activity taken equal to concentration (ideal solution): pH is −lg[H⁺] from concentration, as in textbooks. A pH meter can read differently, more so at higher concentrations.',
      ),
      L(
        'Thể tích cộng được (thể tích dung dịch = thể tích HCl + thể tích NaOH); bỏ qua CO₂ của không khí hòa vào dung dịch.',
        'Volumes are additive (solution volume = HCl volume + NaOH volume); CO₂ dissolving from the air is ignored.',
      ),
      L(
        'Màu chất chỉ thị là minh họa: khoảng đổi màu và tên màu theo bảng nguồn; màu trên màn hình là một màu CSS chọn theo tên màu (orchid cho hồng tím, trong suốt cho không màu); trong khoảng đổi màu, hai màu được trộn đều theo pH.',
        'Indicator colours are an illustration: the range and colour names follow the source table; the screen colour is a CSS colour chosen by the colour name (orchid for purple-pink, transparent for colourless); inside the range the two colours are blended evenly with pH.',
      ),
    ],
    validity: L(
      'Acid mạnh một nấc và base mạnh một nấc, nồng độ HCl và NaOH từ 0,001 đến 1 mol/L, 25 °C. pH tính theo nồng độ, không phải pH đo bằng máy. Acid/base yếu và dung dịch đệm chưa có.',
      'Monoprotic strong acid and strong base, HCl and NaOH concentrations from 0.001 to 1 mol/L, 25 °C. pH from concentration, not a pH-meter reading. Weak acids/bases and buffers are not included.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Test tự động: pH khớp lời giải chia đôi khoảng độc lập của phương trình cân bằng điện tích, sai số < 10⁻⁹ đơn vị pH ở mọi điểm thử, kể cả điểm tương đương (pH = pKw/2).',
      'Automated tests: pH matches an independent bisection solution of the charge balance within 10⁻⁹ pH units at every test point, including the equivalence point (pH = pKw/2).',
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
