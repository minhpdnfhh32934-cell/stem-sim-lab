import type { ScienceCardData } from '@/science-card/types';
import { L } from '../common';
import { ORGANIC_SOURCE } from './model';

export const TITLE = L('Đại cương về hóa học hữu cơ', 'Basics of organic chemistry');

export function organicCard(): ScienceCardData {
  return {
    title: TITLE,
    model: L(
      'Ba phần của Chương 3: nhóm chức và vùng số sóng hấp thụ đặc trưng trên phổ hồng ngoại; lập công thức phân tử từ phần trăm khối lượng các nguyên tố và phân tử khối đo bằng phổ khối lượng; đồng phân là các chất khác nhau có cùng công thức phân tử.',
      'Three parts of chapter 3: functional groups and their characteristic infrared bands; setting up a molecular formula from the elements’ mass percentages and the molar mass from a mass spectrum; isomers, different compounds with the same molecular formula.',
    ),
    equations: [
      {
        tex: 'x : y : z = \\frac{\\%m_C}{12{,}0} : \\frac{\\%m_H}{1{,}0} : \\frac{\\%m_O}{16{,}0} = p : q : r',
        label: L('Tỉ lệ số nguyên tử (tr. 72)', 'Ratio of atoms (p. 72)'),
      },
      {
        tex: '\\mathrm{C_xH_yO_z} = (\\mathrm{C_pH_qO_r})_n,\\quad n = \\frac{M}{M_{\\mathrm{C_pH_qO_r}}}',
        label: L(
          'Công thức phân tử từ công thức đơn giản nhất',
          'Molecular formula from the simplest formula',
        ),
      },
    ],
    assumptions: [
      L(
        'Nguyên tử khối dùng như sách: C 12,0; H 1,0; O 16,0. Phân tử khối M lấy từ peak ion phân tử [M⁺] có m/z lớn nhất (tr. 71).',
        'Atomic masses as in the book: C 12.0, H 1.0, O 16.0. The molar mass M is the molecular ion [M⁺], the peak of highest m/z (p. 71).',
      ),
      L(
        'Phần trăm khối lượng trong đề đã làm tròn, nên tỉ lệ được coi là nguyên khi lệch số nguyên không quá 0,06; nếu không tìm được, SimLab báo chứ không làm tròn ép.',
        'The percentages are rounded, so a ratio counts as whole within 0.06 of a whole number; when none fits, SimLab says so instead of forcing a rounding.',
      ),
      L(
        'Bảng nhóm chức (Bảng 10.1), vùng số sóng hồng ngoại (Bảng 10.2, sách ghi nguồn orgchemboulder.com), nhiệt độ sôi (tr. 75, sách ghi nguồn PubChem) và các ví dụ đồng phân (tr. 76–77) lấy nguyên từ sách.',
        'The functional-group table (Table 10.1), the IR bands (Table 10.2, the book cites orgchemboulder.com), the boiling points (p. 75, the book cites PubChem) and the isomer examples (pp. 76–77) are taken from the book.',
      ),
    ],
    validity: L(
      'Hợp chất chỉ gồm C, H, O; phần trăm khối lượng làm tròn hai chữ số thập phân.',
      'Compounds of C, H and O only; mass percentages rounded to two decimals.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Phép tính theo đúng các bước của sách; kiểm lại bằng cách tính ngược phần trăm khối lượng từ công thức tìm được.',
      'The calculation follows the book’s steps; checked by computing the mass percentages back from the formula found.',
    ),
    userIntervened: false,
    sources: [ORGANIC_SOURCE],
    reviewStatus: 'pending',
  };
}
