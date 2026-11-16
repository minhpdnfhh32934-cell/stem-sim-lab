/**
 * Science Cards of "Các nguyên tố hóa học và nước": the textbook's shares (approximate, rounded
 * values for a typical body) and water's heat numbers (constants taken at 25 °C).
 */
import type { ScienceCardData } from '@/science-card/types';
import { L } from '../common';
import { CHON, ELEMENTS_SOURCE, WATER, shareOf } from './data';

export const ELEMENTS_CARD: ScienceCardData = {
  title: L('Các nguyên tố hóa học trong cơ thể người', 'Chemical elements of the human body'),
  model: L(
    'Tỉ lệ khối lượng các nguyên tố trong cơ thể người, đúng như Hình 4.1 của sách giáo khoa in. Sách gộp K, S, Na, Mg, Cl làm một phần, và các nguyên tố vi lượng làm một phần, nên app không tách chúng ra.',
    'The share of each element in the mass of the human body, exactly as the textbook’s figure 4.1 prints it. The book gives K, S, Na, Mg, Cl as one slice and the trace elements as another, so the app does not split them.',
  ),
  equations: [
    {
      tex: 'w_X = \\dfrac{m_X}{m} \\times 100\\%',
      label: L(
        'tỉ lệ khối lượng của nguyên tố X trong cơ thể có khối lượng m',
        'mass share of element X in a body of mass m',
      ),
    },
    // The sum comes from the data (figure 4.1), never typed.
    {
      tex: `w_{\\mathrm{C}} + w_{\\mathrm{H}} + w_{\\mathrm{O}} + w_{\\mathrm{N}} = ${String(shareOf(CHON))}\\%`,
    },
  ],
  assumptions: [
    L(
      'Số liệu làm tròn của một cơ thể người điển hình; mỗi người, mỗi lứa tuổi có thể khác. Sách khác có thể ghi số hơi khác.',
      'Rounded values for a typical human body; they differ between people and ages. Other books may print slightly different numbers.',
    ),
  ],
  validity: L(
    'Cơ thể người. Thực vật cần 17 loại nguyên tố thiết yếu, người cần tới 25 loại (SGK tr. 24); tỉ lệ ở loài khác không giống hình này.',
    'The human body. Plants need 17 essential elements, humans up to 25 (textbook p. 24); other species have other shares.',
  ),
  confidence: 'approx',
  confidenceNote: L(
    'Số làm tròn của sách giáo khoa (tổng đúng 100%); không phải số đo của một người cụ thể.',
    'The textbook’s rounded values (they add up to exactly 100 %); not measured on one particular person.',
  ),
  userIntervened: false,
  sources: [ELEMENTS_SOURCE],
  reviewStatus: 'pending',
};

export const WATER_CARD: ScienceCardData = {
  title: L(
    'Nước: nhiệt dung riêng và nhiệt bay hơi',
    'Water: specific heat and heat of vaporization',
  ),
  model: L(
    'Nhiệt cần để làm nóng nước lỏng và để làm bay hơi nước, với hằng số của nước ở 25 °C (NIST). Đây là con số minh chứng cho "nhiệt dung đặc trưng cao" và "nhiệt bay hơi cao" mà sách giáo khoa nói tới.',
    'The heat needed to warm liquid water and to evaporate water, with water’s constants at 25 °C (NIST). These numbers back the textbook’s “high specific heat” and “high heat of vaporization”.',
  ),
  equations: [
    { tex: 'Q_1 = m\\,c\\,\\Delta T' },
    { tex: 'Q_2 = m\\,L' },
    { tex: 'c = \\dfrac{C_p}{M},\\quad L = \\dfrac{\\Delta_{\\mathrm{vap}}H}{M}' },
    {
      tex: '\\Delta_{\\mathrm{vap}}H = \\Delta_f H^\\circ(\\mathrm{H_2O},g) - \\Delta_f H^\\circ(\\mathrm{H_2O},l)',
    },
  ],
  assumptions: [
    L(
      `c và L lấy ở ${String(WATER.t_ref_k)} K (25 °C) và coi như không đổi; thật ra chúng thay đổi chút ít theo nhiệt độ.`,
      `c and L are taken at ${String(WATER.t_ref_k)} K (25 °C) and held constant; in reality they change a little with temperature.`,
    ),
    L('Áp suất 1 bar; nước tinh khiết.', 'Pressure 1 bar; pure water.'),
  ],
  validity: L(
    'Nước lỏng, gần 25 °C (hệ số Shomate của NIST dùng được từ 298 K đến 500 K).',
    'Liquid water near 25 °C (NIST’s Shomate coefficients hold from 298 K to 500 K).',
  ),
  confidence: 'approx',
  confidenceNote: L(
    'Phép tính đúng với hằng số ở 25 °C; ở nhiệt độ khác, c và L thật hơi khác nên kết quả là gần đúng.',
    'The arithmetic is exact with the constants at 25 °C; at other temperatures the real c and L differ a little, so the result is approximate.',
  ),
  userIntervened: false,
  sources: [WATER.source],
  reviewStatus: 'pending',
};
