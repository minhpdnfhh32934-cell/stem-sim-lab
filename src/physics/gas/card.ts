import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { sgkVl12 } from '../common/sources';
import { GAS_SOURCE } from './model';

export const L = (vi: string, en: string): LocalizedText => ({ vi, en });

export const TITLE = L('Các định luật của khí lí tưởng', 'Ideal gas laws');

export function gasCard(): ScienceCardData {
  return {
    title: TITLE,
    model: L(
      'Một lượng khí xác định có ba thông số trạng thái p, V, T. Khi giữ nhiệt độ không đổi, pV không đổi (định luật Boyle); khi giữ áp suất không đổi, V/T không đổi (định luật Charles); khi cả ba thay đổi, pV/T không đổi, và với n mol khí thì pV = nRT. Theo mô hình động học phân tử, áp suất do các phân tử va chạm với thành bình: p = ⅓μm·v̄² = ⅔μĒđ, với động năng trung bình Ēđ = 3/2 kT.',
      'A fixed amount of gas has three state variables p, V, T. At constant temperature pV is constant (Boyle’s law); at constant pressure V/T is constant (Charles’s law); when all three change pV/T is constant, and for n moles pV = nRT. In the kinetic model the pressure comes from the molecules hitting the walls: p = ⅓μm·v̄² = ⅔μĒk, with mean kinetic energy Ēk = 3/2 kT.',
    ),
    equations: [
      { tex: 'pV = \\text{const}', label: L('Định luật Boyle (9.1)', 'Boyle’s law (9.1)') },
      {
        tex: '\\dfrac{V}{T} = \\text{const}',
        label: L('Định luật Charles (10.3)', 'Charles’s law (10.3)'),
      },
      {
        tex: '\\dfrac{p_1V_1}{T_1} = \\dfrac{p_2V_2}{T_2}',
        label: L('Phương trình trạng thái (11.1)', 'Equation of state (11.1)'),
      },
      { tex: 'pV = nRT', label: L('Phương trình Clapeyron (11.2)', 'Clapeyron equation (11.2)') },
      {
        tex: 'p = \\tfrac{1}{3}\\mu m\\overline{v^2} = \\tfrac{2}{3}\\mu\\overline{E}_{\\mathrm{d}}',
        label: L('Áp suất theo mô hình phân tử (12.1), (12.2)', 'Kinetic pressure (12.1), (12.2)'),
      },
      {
        tex: '\\overline{E}_{\\mathrm{d}} = \\tfrac{3}{2}kT,\\quad k = \\dfrac{R}{N_A}',
        label: L('Động năng và nhiệt độ (12.3)', 'Kinetic energy and temperature (12.3)'),
      },
    ],
    assumptions: [
      L(
        'Khí lí tưởng: phân tử là chất điểm, không tương tác khi chưa va chạm, va chạm hoàn toàn đàn hồi (Bài 8). Lượng khí không đổi trong mỗi quá trình.',
        'Ideal gas: the molecules are point particles that do not interact until they collide, and collisions are perfectly elastic (lesson 8). The amount of gas stays the same in each process.',
      ),
      L(
        'Đổi nhiệt độ như sách trong Chương II: T = t + 273 (có thể chọn + 273,15). Hằng số làm tròn như sách: R = 8,31 J/(mol·K), N_A = 6,02·10²³ mol⁻¹, k = R/N_A ≈ 1,38·10⁻²³ J/K.',
        'Temperatures are converted as the book does in chapter II: T = t + 273 (+ 273.15 can be chosen). Constants rounded as in the book: R = 8.31 J/(mol·K), N_A = 6.02·10²³ mol⁻¹, k = R/N_A ≈ 1.38·10⁻²³ J/K.',
      ),
      L(
        'Khối lượng mol tính từ nguyên tử khối chuẩn (sách Vật lí 12 không ghi). Tốc độ hiện ra là tốc độ căn quân phương √(v̄²), không phải tốc độ trung bình.',
        'Molar masses come from standard atomic weights (the physics book prints none). The speed shown is the root-mean-square speed √(v̄²), not the mean speed.',
      ),
      L(
        'Ở thẻ "Thí nghiệm SGK", các điểm là số đo in trong Bảng 9.1 và 10.1; app chỉ tính pV, V/T và đường theo giá trị trung bình.',
        'In the “Textbook experiments” part the points are the measurements printed in Tables 9.1 and 10.1; the app only computes pV, V/T and the line through their mean.',
      ),
    ],
    validity: L(
      'Sách nêu các định luật Boyle và Charles được rút ra từ thí nghiệm với áp suất không quá 10⁵ Pa, nhiệt độ không dưới 200 K (tr. 44); ở áp suất rất cao hoặc nhiệt độ rất thấp, khí thực lệch khỏi khí lí tưởng.',
      'The book says Boyle’s and Charles’s laws were found from experiments at pressures up to 10⁵ Pa and temperatures from 200 K (p. 44); at very high pressure or very low temperature a real gas departs from the ideal gas.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Các hệ thức là chính xác với khí lí tưởng; hằng số làm tròn như sách, chờ giáo viên duyệt.',
      'The relations are exact for an ideal gas; constants are rounded as in the book, awaiting teacher review.',
    ),
    userIntervened: false,
    sources: [sgkVl12(8), sgkVl12(9), sgkVl12(10), sgkVl12(11), sgkVl12(12), GAS_SOURCE],
    reviewStatus: 'pending',
  };
}
