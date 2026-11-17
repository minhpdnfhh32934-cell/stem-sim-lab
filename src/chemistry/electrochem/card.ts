import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { ELECTROCHEM_SOURCE } from './model';

export const L = (vi: string, en: string): LocalizedText => ({ vi, en });

export const EC_TITLE = L('Thế điện cực và nguồn điện hóa học', 'Electrode potentials and cells');

export function electrochemCard(): ScienceCardData {
  return {
    title: EC_TITLE,
    model: L(
      'Dạng oxi hóa và dạng khử của cùng một nguyên tố tạo nên cặp oxi hóa – khử. Thế điện cực chuẩn (ở 25 °C, ion 1 M) đo so với điện cực hydrogen chuẩn có thế bằng 0: thế càng nhỏ, dạng khử càng mạnh; thế càng lớn, dạng oxi hóa càng mạnh. Chất khử của cặp có thế nhỏ hơn tác dụng với chất oxi hóa của cặp có thế lớn hơn (quy tắc α). Trong pin Galvani, cặp có thế nhỏ hơn là anode (cực âm, xảy ra sự oxi hóa), cặp kia là cathode (cực dương, xảy ra sự khử); electron chạy qua dây dẫn từ anode sang cathode, cầu muối khép kín mạch.',
      'The oxidised and reduced forms of one element make a redox couple. Standard electrode potentials (25 °C, 1 M ions) are measured against the standard hydrogen electrode, set to 0: the lower the potential, the stronger the reductant; the higher, the stronger the oxidant. The reductant of the couple with the lower potential reacts with the oxidant of the couple with the higher one (the α rule). In a Galvanic cell the couple with the lower potential is the anode (negative, oxidation), the other the cathode (positive, reduction); electrons flow through the wire from anode to cathode and a salt bridge closes the circuit.',
    ),
    equations: [
      {
        tex: '\\mathrm{M^{n+} + ne \\rightleftharpoons M}',
        label: L('Cặp oxi hóa – khử Mⁿ⁺/M (tr. 68)', 'The couple Mⁿ⁺/M (p. 68)'),
      },
      {
        tex: 'E^\\circ_{pin} = E^\\circ_{cathode} - E^\\circ_{anode}',
        label: L('Sức điện động chuẩn của pin (tr. 74)', 'Standard EMF of a cell (p. 74)'),
      },
    ],
    assumptions: [
      L(
        'Mọi giá trị thế điện cực lấy từ Bảng 15.1 của sách (điều kiện chuẩn); giá trị của cặp 2H₂O/H₂ đo ở pH = 7 nên không đem so sánh với các cặp khác.',
        'Every potential comes from the book’s Table 15.1 (standard conditions); the 2H₂O/H₂ value is at pH 7, so it is not compared with the others.',
      ),
      L(
        'Quy tắc α chỉ cho chiều phản ứng ở điều kiện chuẩn; tốc độ phản ứng không được xét.',
        'The α rule gives the direction under standard conditions only; how fast a reaction goes is not considered.',
      ),
      L(
        'Pin chỉ dùng điện cực kim loại không tác dụng với nước: Li, Na, K (Bài 24) và Ca, Ba (Bài 25) không được chọn.',
        'Cells use only metals that do not react with water: Li, Na, K (Lesson 24) and Ca, Ba (Lesson 25) are left out.',
      ),
    ],
    validity: L(
      'Điều kiện chuẩn: 25 °C, nồng độ ion 1 M, khí 1 bar. Ở điều kiện khác, sức điện động đo được khác giá trị chuẩn.',
      'Standard conditions: 25 °C, 1 M ions, 1 bar gases. Under other conditions the measured EMF differs from the standard value.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Chiều phản ứng và sức điện động tính đúng từ Bảng 15.1; số liệu lấy từ sách, chờ giáo viên duyệt.',
      'Directions and EMFs are computed exactly from Table 15.1; the data come from the book, awaiting teacher review.',
    ),
    userIntervened: false,
    sources: [ELECTROCHEM_SOURCE],
    reviewStatus: 'pending',
  };
}
