import type { ScienceCardData } from '@/science-card/types';
import { L } from '../common';
import { ELEMENTS_SOURCE } from '../data/elements';
import { PERIOD3_CROSS_CHECK, PERIOD3_SOURCE } from '../data/period3';
import { OPENSTAX_OX, SGK_B15 } from '../redox/card';

/** Science Card of HH10 Bài 7 (DATA_REVIEW HH10-RX-1). */
export const PERIOD_TRENDS_CARD: ScienceCardData = {
  title: L(
    'Xu hướng biến đổi thành phần và tính chất của hợp chất trong chu kì 3',
    'Trends in the composition and properties of period 3 compounds',
  ),
  model: L(
    'Hoá trị cao nhất của các nguyên tố nhóm A trong hợp chất với oxygen tăng từ I đến VII khi đi từ trái qua phải trong một chu kì, nên thành phần các oxide và hydroxide lặp lại theo chu kì (SGK Bài 7, tr. 40). Chương trình lấy số nhóm A từ bảng nguyên tố, suy ra công thức oxide cao nhất và hydroxide của kim loại; công thức acid lấy theo Bảng 7.1 và được kiểm tra bằng quy tắc số oxi hoá. Tính acid – base theo Bảng 7.2: theo chiều tăng điện tích hạt nhân, tính base giảm và tính acid tăng.',
    'The highest valence of group A elements towards oxygen rises from I to VII across a period, so the oxides and hydroxides repeat period after period (SGK Lesson 7, p. 40). The program reads the A-group number from the element table and derives the highest oxide and a metal’s hydroxide; an acid’s formula is the book’s (Bảng 7.1), checked with the oxidation-number rules. The acid–base character is the book’s Bảng 7.2: with rising nuclear charge, basic character falls and acidic character rises.',
  ),
  equations: [
    {
      tex: '\\mathrm{E_2O_n}\\ (n = 1, 3, 5, 7),\\qquad \\mathrm{EO_{n/2}}\\ (n = 2, 4, 6)',
      label: L(
        'Oxide ứng với số oxi hoá cao nhất +n, n là số thứ tự nhóm A',
        'Oxide for the highest oxidation number +n, n being the A-group number',
      ),
    },
    {
      tex: '\\mathrm{E(OH)_n}',
      label: L('Hydroxide của kim loại (Na, Mg, Al)', 'Hydroxide of a metal (Na, Mg, Al)'),
    },
  ],
  assumptions: [
    L(
      'Số oxi hoá cao nhất bằng số thứ tự nhóm A, đúng với Na…Cl (không áp dụng cho fluorine, oxygen và khí hiếm).',
      'The highest oxidation number equals the A-group number, true for Na…Cl (not for fluorine, oxygen and the noble gases).',
    ),
    L(
      'Số nguyên tử H và O trong acid (H₂SiO₃, H₃PO₄, H₂SO₄, HClO₄) không suy ra được từ số nhóm: lấy theo SGK Bảng 7.1, chương trình chỉ kiểm tra số oxi hoá.',
      'How many H and O an acid has (H₂SiO₃, H₃PO₄, H₂SO₄, HClO₄) does not follow from the group number: it is the book’s Bảng 7.1, the program only checks the oxidation number.',
    ),
    L(
      'Tính acid – base là nhận xét định tính của sách (Bảng 7.2), đối chiếu với LibreTexts (J. Clark) cho các oxide; không có số đo trong bài này.',
      'The acid–base character is the book’s qualitative statement (Bảng 7.2), cross-checked with LibreTexts (J. Clark) for the oxides; this lesson has no measured numbers.',
    ),
  ],
  validity: L(
    'Oxide và hydroxide ứng với hoá trị cao nhất của Na, Mg, Al, Si, P, S, Cl.',
    'Oxides and hydroxides for the highest valence of Na, Mg, Al, Si, P, S, Cl.',
  ),
  confidence: 'qualitative',
  confidenceNote: L(
    'Công thức: suy ra chính xác hoặc lấy theo sách và kiểm tra. Tính acid – base: định tính, theo sách; đang chờ giáo viên duyệt.',
    'Formulas: derived exactly, or the book’s and checked. Acid–base character: qualitative, as the book gives it; awaiting a teacher’s review.',
  ),
  userIntervened: false,
  sources: [PERIOD3_SOURCE, PERIOD3_CROSS_CHECK, ELEMENTS_SOURCE, SGK_B15, OPENSTAX_OX],
  reviewStatus: 'pending',
};
