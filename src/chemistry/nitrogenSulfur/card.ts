import type { ScienceCardData } from '@/science-card/types';
import { CSRC, L } from '../common';
import { NS_SOURCE } from './model';

export const TITLE = L('Nitrogen và sulfur', 'Nitrogen and sulfur');

export function nsCard(): ScienceCardData {
  return {
    title: TITLE,
    model: L(
      'Các chất của nitrogen và sulfur trong Chương 2 được đặt lên trục số oxi hóa của nguyên tố. Số oxi hóa tính từ công thức bằng các quy tắc của SGK Hóa học 10 (Bài 15). Ở số oxi hóa thấp nhất nguyên tố chỉ có thể nhường electron (tính khử), ở số oxi hóa cao nhất chỉ có thể nhận electron (tính oxi hóa), ở mức trung gian thì có cả hai.',
      'The nitrogen and sulfur compounds of chapter 2 are placed on the element’s oxidation-number axis. Oxidation numbers come from the formula by the rules of the grade-10 textbook (lesson 15). At its lowest number an element can only give electrons (reducing), at its highest only take them (oxidising), in between both.',
    ),
    equations: [
      {
        tex: '\\overset{-3}{\\mathrm{N}}\\mathrm{H_3} \\;\\cdots\\; \\overset{0}{\\mathrm{N_2}} \\;\\cdots\\; \\mathrm{H}\\overset{+5}{\\mathrm{N}}\\mathrm{O_3}',
        label: L(
          'Trục số oxi hóa của nitrogen: −3 đến +5 (tr. 30)',
          'Nitrogen’s axis: −3 to +5 (p. 30)',
        ),
      },
      {
        tex: '\\mathrm{H_2}\\overset{-2}{\\mathrm{S}} \\;\\cdots\\; \\overset{0}{\\mathrm{S}} \\;\\cdots\\; \\mathrm{H_2}\\overset{+6}{\\mathrm{S}}\\mathrm{O_4}',
        label: L(
          'Trục số oxi hóa của sulfur: −2 đến +6 (tr. 43)',
          'Sulfur’s axis: −2 to +6 (p. 43)',
        ),
      },
    ],
    assumptions: [
      L(
        'Mọi số liệu của các chất (nhiệt độ sôi, nóng chảy, độ tan, năng lượng liên kết, đồng vị, điều kiện phản ứng, biến thiên enthalpy) lấy nguyên từ SGK Hóa học 11, Bài 4–8, có ghi trang.',
        'Every property (boiling and melting points, solubility, bond energies, isotopes, reaction conditions, enthalpy changes) is taken from the grade-11 textbook, lessons 4–8, with its page.',
      ),
      L(
        'Số oxi hóa không lưu sẵn: SimLab tính từ công thức. Khi quy tắc không đủ (ví dụ NH₄NO₃ có N ở hai mức), SimLab nói rõ là chưa xác định, không đoán.',
        'Oxidation numbers are not stored: SimLab computes them from the formula. When the rules are not enough (NH₄NO₃ has N at two levels), SimLab says it cannot decide instead of guessing.',
      ),
      L(
        'Vai trò khử, oxi hóa của chất được suy từ vị trí trên trục (cách lập luận của sách); phản ứng thật còn phụ thuộc chất phản ứng cùng và điều kiện.',
        'The reducing or oxidising role is read from the place on the axis (the book’s reasoning); a real reaction also depends on the partner and the conditions.',
      ),
    ],
    validity: L(
      'Chất vô cơ đơn giản của nitrogen và sulfur trong chương trình lớp 11.',
      'Simple inorganic compounds of nitrogen and sulfur in the grade-11 course.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Số oxi hóa theo quy tắc của sách và có test; số liệu chất đọc từ sách, chờ giáo viên duyệt.',
      'Oxidation numbers by the book’s rules, tested; the properties are read from the book, awaiting teacher review.',
    ),
    userIntervened: false,
    sources: [NS_SOURCE, CSRC.sgk10],
    reviewStatus: 'pending',
  };
}
