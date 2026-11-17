import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * HH12 KNTT Bài 16 "Điện phân" (printed pages 78–84), in SimLab's own words. Checked against the
 * pages on 17/11/2026: electrolysis of molten NaCl (Hình 16.1), the cathode as the negative and the
 * anode as the positive electrode (tr. 79), CuSO₄ solution with inert electrodes (tr. 79–80), the
 * order of discharge at each electrode and the anions not discharged (tr. 81), aluminium from
 * molten Al₂O₃ with cryolite (tr. 82), refining copper and electroplating (tr. 83). HH12-GL-8.
 */
export const hh12b16Electrolysis: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'chemistry',
  id: 'guided.hh12-electrolysis',
  topic: 'electrolysis',
  title: L('Điện phân', 'Electrolysis'),
  objectives: [
    L(
      'Dự đoán chất tạo thành ở cathode khi điện phân dung dịch CuSO₄ với điện cực trơ.',
      'Predict what forms at the cathode when CuSO₄ solution is electrolysed with inert electrodes.',
    ),
    L(
      'Sắp xếp thứ tự các chất bị khử ở cathode; phân biệt anion bị và không bị điện phân trong dung dịch.',
      'Order what is reduced at the cathode; tell which anions are and are not discharged from a solution.',
    ),
    L(
      'Ghép mỗi quá trình điện phân trong thực tiễn với điều xảy ra ở điện cực.',
      'Match each practical electrolysis with what happens at the electrode.',
    ),
  ],
  hints: [
    L(
      'Tại cathode, chất oxi hóa mạnh hơn bị khử trước; tại anode, chất khử mạnh hơn bị oxi hóa trước.',
      'At the cathode the stronger oxidant is reduced first; at the anode the stronger reductant is oxidised first.',
    ),
    L(
      'Ion Cu²⁺ có thế điện cực chuẩn lớn hơn H⁺ nên dễ bị khử hơn nước.',
      'Cu²⁺ has a higher standard potential than H⁺, so it is reduced more easily than water.',
    ),
  ],
  questions: [
    L(
      'Khi điện phân dung dịch NaCl để tự làm nước tẩy rửa, vì sao nên đậy nắp cốc?',
      'When electrolysing NaCl solution to make bleach at home, why cover the beaker?',
    ),
  ],
  expectedConclusion: L(
    'Điện phân là quá trình oxi hóa – khử xảy ra trên bề mặt các điện cực khi cho dòng điện một chiều đi qua chất điện li nóng chảy hoặc dung dịch chất điện li; phản ứng này không tự xảy ra mà cần điện năng. Trong bình điện phân, cathode là cực âm, xảy ra sự khử; anode là cực dương, xảy ra sự oxi hóa. Tại cathode, chất oxi hóa mạnh hơn bị khử trước; tại anode, chất khử mạnh hơn bị oxi hóa trước. Điện phân được dùng để sản xuất kim loại (nhôm từ aluminium oxide nóng chảy, kẽm từ dung dịch muối), tinh chế kim loại (anode bằng đồng thô) và mạ điện.',
    'Electrolysis is a redox process on the surfaces of the electrodes when direct current passes through a molten electrolyte or a solution; the reaction is not spontaneous and needs electrical energy. In the cell the cathode is negative, where reduction happens, and the anode is positive, where oxidation happens. At the cathode the stronger oxidant is reduced first; at the anode the stronger reductant is oxidised first. Electrolysis produces metals (aluminium from molten aluminium oxide, zinc from salt solutions), refines metals (an anode of crude copper) and electroplates.',
  ),
  sources: [],
  assumptions: [
    L(
      'Thứ tự điện phân theo thế điện cực chuẩn như sách nêu; sách cũng lưu ý thứ tự này còn phụ thuộc vật liệu và bề mặt điện cực.',
      'The order of discharge follows the standard potentials as the book says; the book also notes it depends on the electrode material and surface.',
    ),
  ],
  limits: [
    L(
      'Bài không tính lượng chất thu được khi điện phân vì sách không nêu công thức tính.',
      'The lesson does not compute amounts produced, since the book gives no formula for it.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'HH12', lesson: 16 },
    question: L(
      'Điện phân dung dịch CuSO₄ với hai điện cực than chì. Chất nào tạo thành ở cathode?',
      'CuSO₄ solution is electrolysed between two graphite electrodes. What forms at the cathode?',
    ),
    choices: [
      { id: 'cu', text: L('Kim loại Cu bám trên cathode', 'Copper metal on the cathode') },
      { id: 'h2', text: L('Khí H₂ thoát ra', 'Hydrogen gas') },
      { id: 'o2', text: L('Khí O₂ thoát ra', 'Oxygen gas') },
      { id: 'khong', text: L('Không có chất nào', 'Nothing') },
    ],
    answer: 'cu',
    answerWhy: L(
      'Ion Cu²⁺ dễ bị khử hơn H₂O nên bị khử trước, tạo Cu bám trên cathode; khí O₂ thoát ra ở anode do H₂O bị oxi hóa.',
      'Cu²⁺ is reduced more easily than H₂O, so copper coats the cathode; oxygen forms at the anode, where water is oxidised.',
    ),
    activities: [
      {
        kind: 'order',
        id: 'cathode',
        prompt: L(
          'Sắp xếp các chất theo thứ tự bị khử tại cathode, chất bị khử trước đứng đầu.',
          'Order what is reduced at the cathode, the first one at the top.',
        ),
        items: [
          {
            id: 'au',
            text: L('Au³⁺', 'Au³⁺'),
            why: L('Thế điện cực chuẩn lớn nhất.', 'The highest standard potential.'),
          },
          {
            id: 'ag',
            text: L('Ag⁺', 'Ag⁺'),
            why: L('Đứng sau Au³⁺ trong dãy điện hóa.', 'Next after Au³⁺ in the series.'),
          },
          {
            id: 'hg',
            text: L('Hg²⁺', 'Hg²⁺'),
            why: L('Đứng sau Ag⁺.', 'Next after Ag⁺.'),
          },
          {
            id: 'cu',
            text: L('Cu²⁺', 'Cu²⁺'),
            why: L('Đứng sau Hg²⁺.', 'Next after Hg²⁺.'),
          },
          {
            id: 'h',
            text: L('H⁺', 'H⁺'),
            why: L('Thế điện cực chuẩn bằng không.', 'A standard potential of zero.'),
          },
          {
            id: 'h2o',
            text: L('H₂O', 'H₂O'),
            why: L('Bị khử sau cùng trong dãy sách nêu.', 'Reduced last in the book’s list.'),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'anion',
        prompt: L(
          'Khi điện phân dung dịch với điện cực trơ, xếp mỗi anion vào nhóm của nó.',
          'In a solution with inert electrodes, put each anion in its group.',
        ),
        groups: [
          { id: 'co', label: L('Bị oxi hóa ở anode', 'Oxidised at the anode') },
          { id: 'khong', label: L('Coi như không bị điện phân', 'Treated as not discharged') },
        ],
        items: [
          {
            id: 'i',
            text: L('I⁻', 'I⁻'),
            group: 'co',
            why: L('Bị oxi hóa trước Br⁻ và Cl⁻.', 'Oxidised before Br⁻ and Cl⁻.'),
          },
          {
            id: 'br',
            text: L('Br⁻', 'Br⁻'),
            group: 'co',
            why: L('Bị oxi hóa trước Cl⁻.', 'Oxidised before Cl⁻.'),
          },
          {
            id: 'cl',
            text: L('Cl⁻', 'Cl⁻'),
            group: 'co',
            why: L(
              'Tạo khí Cl₂ khi điện phân dung dịch NaCl.',
              'Gives chlorine in NaCl electrolysis.',
            ),
          },
          {
            id: 'so4',
            text: L('SO₄²⁻', 'SO₄²⁻'),
            group: 'khong',
            why: L(
              'Khi điện phân dung dịch CuSO₄, nước bị oxi hóa thay cho ion này.',
              'In CuSO₄ electrolysis, water is oxidised instead.',
            ),
          },
          {
            id: 'no3',
            text: L('NO₃⁻', 'NO₃⁻'),
            group: 'khong',
            why: L('Sách xếp vào nhóm này.', 'The book puts it in this group.'),
          },
          {
            id: 'f',
            text: L('F⁻', 'F⁻'),
            group: 'khong',
            why: L('Sách xếp vào nhóm này.', 'The book puts it in this group.'),
          },
          {
            id: 'co3',
            text: L('CO₃²⁻', 'CO₃²⁻'),
            group: 'khong',
            why: L('Sách xếp vào nhóm này.', 'The book puts it in this group.'),
          },
        ],
      },
      {
        kind: 'match',
        id: 'ung-dung',
        prompt: L(
          'Ghép mỗi quá trình điện phân với điều xảy ra ở điện cực được nêu.',
          'Match each electrolysis with what happens at the electrode named.',
        ),
        pairs: [
          {
            id: 'nacl',
            left: L('Anode khi điện phân NaCl nóng chảy', 'Anode, molten NaCl'),
            right: L(
              'Ion Cl⁻ bị oxi hóa, khí Cl₂ thoát ra',
              'Cl⁻ is oxidised, chlorine is given off',
            ),
            why: L('Na tạo thành ở cathode.', 'Sodium forms at the cathode.'),
          },
          {
            id: 'nhom',
            left: L('Cathode khi điện phân Al₂O₃ nóng chảy', 'Cathode, molten Al₂O₃'),
            right: L('Ion Al³⁺ bị khử thành nhôm', 'Al³⁺ is reduced to aluminium'),
            why: L(
              'Al₂O₃ được trộn với cryolite để hạ nhiệt độ nóng chảy.',
              'Al₂O₃ is mixed with cryolite to lower its melting point.',
            ),
          },
          {
            id: 'tinh-che',
            left: L('Anode bằng đồng thô khi tinh chế đồng', 'Crude copper anode in refining'),
            right: L(
              'Cu bị oxi hóa thành ion Cu²⁺, anode tan dần',
              'Cu is oxidised to Cu²⁺ and the anode dissolves',
            ),
            why: L('Đồng tinh khiết bám ở cathode.', 'Pure copper deposits on the cathode.'),
          },
          {
            id: 'ma',
            left: L('Vật cần mạ khi mạ điện', 'The object being plated'),
            right: L(
              'Đóng vai trò cathode, ion kim loại mạ bị khử bám lên bề mặt',
              'It is the cathode, where the plating metal’s ions are reduced onto it',
            ),
            why: L(
              'Dung dịch chứa muối của kim loại mạ.',
              'The solution holds a salt of the plating metal.',
            ),
          },
        ],
      },
    ],
  },
};
