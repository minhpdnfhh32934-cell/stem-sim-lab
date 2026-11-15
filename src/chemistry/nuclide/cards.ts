import { CONSTANTS_DATASET } from '@/core/constants';
import type { ScienceCardData } from '@/science-card/types';
import { CSRC, L } from '../common';
import { ELEMENTS_SOURCE } from '../data/elements';
import { ISOTOPE_REFERENCES, ISOTOPES_SOURCE } from '../data/isotopes';
import { KRANE } from './composition';

/** Science Card of "Thành phần của nguyên tử" (HH10 Bài 1; DATA_REVIEW HH10-ATOM-1, -2, -4). */
export const COMPOSITION_CARD: ScienceCardData = {
  title: L('Thành phần của nguyên tử', 'Composition of the atom'),
  model: L(
    'Nguyên tử gồm hạt nhân (Z proton, N neutron) và các electron. Khối lượng mỗi loại hạt là hằng số CODATA 2022; chương trình cộng khối lượng các hạt. Khối lượng thực của nguyên tử lấy từ bảng đồng vị tự nhiên. Kích thước hạt nhân theo công thức thực nghiệm R = r₀·A^(1/3); kích thước nguyên tử lấy bán kính cộng hóa trị trong bảng nguyên tố.',
    'An atom is a nucleus (Z protons, N neutrons) and its electrons. Each particle’s mass is a CODATA 2022 constant; the program adds the particles’ masses. The atom’s real mass comes from the table of natural isotopes. The nuclear size follows the empirical formula R = r₀·A^(1/3); the atom’s size is the covalent radius from the element table.',
  ),
  equations: [
    { tex: 'A = Z + N', label: L('Số khối', 'Mass number') },
    {
      tex: 'q = (Z - n_e)\\,e',
      label: L('Điện tích (n_e: số electron)', 'Charge (n_e: number of electrons)'),
    },
    {
      tex: 'm = Z\\,m_p + N\\,m_n + n_e\\,m_e,\\qquad 1\\ \\text{u} = m_u',
      label: L('Tổng khối lượng các hạt', 'Sum of the particle masses'),
    },
    {
      tex: '\\Delta m = Z\\,(m_p + m_e) + N\\,m_n - M',
      label: L(
        'Độ hụt khối của nguyên tử trung hòa (M: khối lượng thực)',
        'Mass defect of the neutral atom (M: real mass)',
      ),
    },
    {
      tex: {
        vi: 'R = r_0\\,A^{1/3},\\quad r_0 \\approx 1{,}2\\ \\text{fm}',
        en: 'R = r_0\\,A^{1/3},\\quad r_0 \\approx 1.2\\ \\text{fm}',
      },
      label: L('Bán kính hạt nhân (gần đúng)', 'Nuclear radius (approximate)'),
    },
  ],
  assumptions: [
    L(
      'Khối lượng proton, neutron, electron là khối lượng của hạt tự do. Nguyên tử thật nhẹ hơn tổng đó một chút (độ hụt khối, do năng lượng liên kết); sách giáo khoa bỏ qua phần chênh lệch này.',
      'The proton, neutron and electron masses are those of free particles. A real atom is a little lighter than their sum (the mass defect, from the binding energy); the textbook ignores this difference.',
    ),
    L(
      'r₀ ≈ 1,2 fm là giá trị thực nghiệm thường dùng; công thức chỉ cho cỡ độ lớn và kém chính xác với hạt nhân rất nhẹ.',
      'r₀ ≈ 1.2 fm is the usual measured value; the formula gives only the order of magnitude and is poor for very light nuclei.',
    ),
    L(
      'Nguyên tử không có biên rõ: kích thước lấy bán kính cộng hóa trị của nguyên tử trung hòa (Cordero và cộng sự, 2008), kể cả khi đang xem một ion.',
      'An atom has no sharp edge: its size is the covalent radius of the neutral atom (Cordero et al., 2008), even when an ion is shown.',
    ),
    L(
      'Hình minh họa, không theo tỉ lệ: nếu vẽ đúng tỉ lệ, hạt nhân nhỏ hơn một điểm ảnh. Electron vẽ thành chấm, chưa xếp theo lớp (lớp vỏ electron: Bài 3).',
      'Illustration, not to scale: drawn to scale, the nucleus would be smaller than one pixel. Electrons are dots, not yet arranged in shells (electron shells: Lesson 3).',
    ),
  ],
  validity: L(
    'Z từ 1 đến 36 (H đến Kr). Khối lượng thực và độ hụt khối chỉ có cho đồng vị tự nhiên trong bảng dữ liệu.',
    'Z from 1 to 36 (H to Kr). The real mass and the mass defect exist only for natural isotopes in the data table.',
  ),
  confidence: 'approx',
  confidenceNote: L(
    'Khối lượng: tính đúng từ hằng số CODATA 2022. Kích thước hạt nhân: công thức gần đúng, chỉ đúng cỡ độ lớn. Hình vẽ: minh họa.',
    'Masses: exact from CODATA 2022 constants. Nuclear size: an approximate formula, right in order of magnitude only. Picture: an illustration.',
  ),
  userIntervened: false,
  sources: [
    CONSTANTS_DATASET.source,
    KRANE,
    ELEMENTS_SOURCE,
    ISOTOPES_SOURCE,
    // The real isotope masses (the mass defect); abundances are not used here.
    ...ISOTOPE_REFERENCES.filter((r) => r.id === 'ciaaw-atomic-masses'),
    CSRC.sgk10,
  ],
  reviewStatus: 'pending',
};

/** Science Card of "Nguyên tố hóa học và đồng vị" (HH10 Bài 2; DATA_REVIEW HH10-ATOM-3, -5). */
export const ISOTOPE_CARD: ScienceCardData = {
  title: L('Nguyên tố hóa học và đồng vị', 'Chemical elements and isotopes'),
  model: L(
    'Một nguyên tố gồm các nguyên tử cùng số proton Z; các đồng vị khác nhau ở số neutron. Nguyên tử khối trung bình là trung bình của các đồng vị tự nhiên, có trọng số là phần trăm số nguyên tử. Phần trăm và khối lượng đồng vị lấy từ bảng dữ liệu; chương trình chỉ làm phép tính.',
    'An element is all atoms with the same proton number Z; its isotopes differ in neutron number. The average atomic mass is the mean of the natural isotopes weighted by their atom percentages. Percentages and isotope masses come from the data table; the program only does the arithmetic.',
  ),
  equations: [
    {
      tex: '\\bar{A} = \\dfrac{\\sum_i x_i A_i}{\\sum_i x_i} = \\dfrac{x_1 A_1 + x_2 A_2 + \\dots}{100}',
      label: L(
        'Nguyên tử khối trung bình (xᵢ: phần trăm số nguyên tử)',
        'Average atomic mass (xᵢ: atom percentage)',
      ),
    },
    {
      tex: 'x_1 = 100\\cdot\\dfrac{A_2 - \\bar{A}}{A_2 - A_1},\\qquad x_2 = 100 - x_1',
      label: L('Bài toán ngược, hai đồng vị', 'Reverse problem, two isotopes'),
    },
  ],
  assumptions: [
    L(
      'Như sách giáo khoa, Aᵢ là số khối của đồng vị; app cũng tính lại với khối lượng thực của từng đồng vị (IUPAC-CIAAW).',
      'As in the textbook, Aᵢ is each isotope’s mass number; the app also redoes it with each isotope’s real mass (IUPAC-CIAAW).',
    ),
    L(
      'Phần trăm đồng vị là giá trị của NUBASE2020; với nguyên tố có thành phần thay đổi theo nguồn mẫu (H, Li, B, C, N, O, Mg, S, Cl, Br, Tl), đó là điểm giữa khoảng biến thiên. Vì vậy giá trị tính được có thể lệch nguyên tử khối chuẩn IUPAC (ví dụ Li, Pb).',
      'Isotope percentages are NUBASE2020 values; for elements whose composition varies with the sample (H, Li, B, C, N, O, Mg, S, Cl, Br, Tl), that is the middle of the range. So the computed value can differ from the IUPAC standard atomic weight (e.g. Li, Pb).',
    ),
    L(
      'Khi các phần trăm trong bảng không cộng lại đúng 100 % (số đã làm tròn, hoặc thiếu đồng vị không có trong bảng), Ā chia cho tổng của chúng và màn hình ghi tổng đó.',
      'When the table’s percentages do not add up to exactly 100 % (rounded values, or an isotope missing from the table), Ā is divided by their sum and the screen shows that sum.',
    ),
    L(
      'Bài toán ngược được giải hai cách: với số khối, như sách giáo khoa (gần đúng; với La, V, In lệch xa bảng), và với khối lượng thực của đồng vị (khớp bảng). Ā phải nằm giữa hai số khối, hoặc giữa hai khối lượng.',
      'The reverse problem is solved two ways: with mass numbers, as the textbook does (an approximation; far from the table for La, V, In), and with the isotopes’ real masses (matches the table). Ā must lie between the two mass numbers, or the two masses.',
    ),
  ],
  validity: L(
    'Các nguyên tố có đồng vị tự nhiên trong bảng dữ liệu (84 nguyên tố); bài toán ngược cho nguyên tố có đúng hai đồng vị tự nhiên.',
    'Elements with natural isotopes in the data table (84 elements); the reverse problem for elements with exactly two natural isotopes.',
  ),
  confidence: 'exact',
  confidenceNote: L(
    'Phép tính đúng trên số liệu của bảng (cột "theo số khối" của bài toán ngược là phép gần đúng của sách giáo khoa); số liệu đang chờ giáo viên duyệt.',
    'Exact arithmetic on the table’s values (the reverse problem’s "mass numbers" column is the textbook’s approximation); the values await a teacher’s review.',
  ),
  userIntervened: false,
  sources: [ISOTOPES_SOURCE, ...ISOTOPE_REFERENCES, ELEMENTS_SOURCE, CSRC.sgk10],
  reviewStatus: 'pending',
};
