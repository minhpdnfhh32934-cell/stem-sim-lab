import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { sgkVl12 } from '../../common/sources';
import { NUCLEAR_SOURCE } from '../data';

export const L = (vi: string, en: string): LocalizedText => ({ vi, en });

export const TITLE = L('Hạt nhân và năng lượng liên kết', 'The nucleus and binding energy');

export function nucleusCard(): ScienceCardData {
  return {
    title: TITLE,
    model: L(
      'Hạt nhân ᴬ_ZX gồm Z proton và A − Z neutron (gọi chung là nucleon), có kích thước cỡ 10⁻¹⁵ m. Trong phản ứng hạt nhân, tổng số nucleon và tổng điện tích được bảo toàn. Khối lượng hạt nhân nhỏ hơn tổng khối lượng các nucleon tạo thành nó một lượng Δm (độ hụt khối); năng lượng liên kết E_lk = Δm·c² là năng lượng tối thiểu để tách hạt nhân thành các nucleon, năng lượng liên kết riêng E_lk/A càng lớn thì hạt nhân càng bền.',
      'A nucleus ᴬ_ZX has Z protons and A − Z neutrons (together, nucleons) and a size of about 10⁻¹⁵ m. In a nuclear reaction the number of nucleons and the charge are conserved. A nucleus is lighter than its separate nucleons by Δm (the mass defect); the binding energy E_b = Δm·c² is the least energy needed to pull it apart, and the larger E_b/A, the more stable the nucleus.',
    ),
    equations: [
      {
        tex: 'R = 1{,}2\\cdot 10^{-15}\\,A^{1/3}\\ \\mathrm{m}',
        label: L('Bán kính hạt nhân (21.1)', 'Nuclear radius (21.1)'),
      },
      {
        tex: '\\Delta m = Zm_p + (A - Z)m_n - m_X',
        label: L('Độ hụt khối (22.2)', 'Mass defect (22.2)'),
      },
      {
        tex: 'E_{lk} = \\Delta m\\, c^2,\\quad E_{lkr} = \\dfrac{E_{lk}}{A}',
        label: L('Năng lượng liên kết (22.4), (22.1)', 'Binding energy (22.4), (22.1)'),
      },
      {
        tex: 'A_1 + A_2 = A_3 + A_4,\\quad Z_1 + Z_2 = Z_3 + Z_4',
        label: L('Bảo toàn số khối và điện tích', 'Conservation of A and Z'),
      },
    ],
    assumptions: [
      L(
        'Khối lượng m_p = 1,00728 amu, m_n = 1,00866 amu, 1 amu = 1,66054·10⁻²⁷ kg như sách; c và e (để đổi J sang MeV) lấy theo CODATA vì chương này không in.',
        'Masses m_p = 1.00728 amu, m_n = 1.00866 amu and 1 amu = 1.66054·10⁻²⁷ kg as in the book; c and e (for J ↔ MeV) are CODATA values since this chapter prints neither.',
      ),
      L(
        'Khối lượng hạt nhân ⁴He và ¹⁶O là số sách cho (4,00260 và 15,99492 amu).',
        'The masses of the ⁴He and ¹⁶O nuclei are the book’s (4.00260 and 15.99492 amu).',
      ),
      L(
        'Năng lượng phân hạch: mỗi phân hạch ²³⁵U tỏa khoảng 200 MeV, N_A = 6,02·10²³ mol⁻¹ như sách.',
        'Fission energy: about 200 MeV for each ²³⁵U fission, N_A = 6.02·10²³ mol⁻¹ as in the book.',
      ),
    ],
    validity: L(
      'Công thức (21.1) là gần đúng, sách nói nó tốt hơn với A > 12; bán kính trong Bảng 21.1 nhỏ hơn giá trị của công thức khoảng 10–30 %, đang chờ giáo viên xem.',
      'Formula (21.1) is approximate and the book says it works better for A > 12; the radii of Table 21.1 are about 10–30 % below it, awaiting teacher review.',
    ),
    confidence: 'approx',
    confidenceNote: L(
      'Bảo toàn A, Z là chính xác; bán kính theo công thức là gần đúng; số liệu lấy từ sách, chờ giáo viên duyệt.',
      'Conservation of A and Z is exact; the radius formula is approximate; the data come from the book, awaiting teacher review.',
    ),
    userIntervened: false,
    sources: [sgkVl12(21), sgkVl12(22), NUCLEAR_SOURCE],
    reviewStatus: 'pending',
  };
}
