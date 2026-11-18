import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * HH12 KNTT Bài 22 "Sự ăn mòn kim loại" (printed pages 102–105), in SimLab's own words. Checked
 * against the pages on 17/11/2026: what corrosion is (tr. 102), chemical corrosion and
 * electrochemical corrosion of cast iron in moist air (Hình 22.3, tr. 103), question 1 (tr. 104),
 * the electrochemical protection of iron with zinc (experiment and Hình 22.4, tr. 104) and coating
 * (tr. 105). HH12-GL-11.
 */
export const hh12b22Corrosion: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'chemistry',
  id: 'guided.hh12-corrosion',
  topic: 'corrosion',
  title: L('Sự ăn mòn kim loại', 'Corrosion of metals'),
  objectives: [
    L(
      'Dự đoán đinh sắt nào bị ăn mòn chậm hơn: đinh có quấn dây kẽm hay đinh không quấn.',
      'Predict which iron nail corrodes more slowly: one wrapped in zinc wire or a bare one.',
    ),
    L(
      'Phân loại các hiện tượng ăn mòn hóa học và ăn mòn điện hóa.',
      'Sort cases of chemical and electrochemical corrosion.',
    ),
    L(
      'Ghép mỗi khái niệm của ăn mòn điện hóa và chống ăn mòn với điều đúng về nó.',
      'Match the ideas of electrochemical corrosion and protection with what is true of them.',
    ),
  ],
  hints: [
    L(
      'Ăn mòn điện hóa xảy ra khi có sự tạo thành pin điện: hai kim loại khác nhau (hoặc kim loại và phi kim) tiếp xúc nhau và cùng tiếp xúc với dung dịch chất điện li.',
      'Electrochemical corrosion needs a cell: two different metals (or a metal and a non-metal) in contact and in the same electrolyte.',
    ),
    L(
      'Trong pin điện, kim loại hoạt động hóa học mạnh hơn là anode và bị oxi hóa.',
      'In a cell the more active metal is the anode and is oxidised.',
    ),
  ],
  questions: [
    L(
      'Ở nhà em, những đồ vật bằng gang, thép được bảo vệ khỏi gỉ bằng cách nào?',
      'How are cast-iron and steel objects at your home protected from rust?',
    ),
  ],
  expectedConclusion: L(
    'Ăn mòn kim loại là sự phá hủy kim loại hoặc hợp kim dưới tác dụng của các chất trong môi trường, trong đó kim loại bị oxi hóa. Ăn mòn hóa học là phản ứng oxi hóa – khử trực tiếp giữa kim loại và chất oxi hóa trong môi trường; ăn mòn điện hóa xảy ra khi có sự tạo thành pin điện. Trong không khí ẩm, gang thép bị ăn mòn điện hóa: sắt là anode bị oxi hóa thành Fe²⁺, carbon là cathode nơi oxygen bị khử, Fe²⁺ tiếp tục bị oxi hóa tạo gỉ sắt. Có hai phương pháp bảo vệ: phương pháp điện hóa (gắn kim loại hoạt động hóa học mạnh hơn, như kẽm, để nó bị ăn mòn thay) và phương pháp phủ bề mặt (mạ kim loại khó bị gỉ, sơn, tra dầu mỡ).',
    'Corrosion is the destruction of a metal or alloy by substances around it, the metal being oxidised. Chemical corrosion is a direct redox reaction between the metal and an oxidant; electrochemical corrosion happens when a cell forms. In moist air cast iron corrodes electrochemically: iron is the anode, oxidised to Fe²⁺, carbon is the cathode where oxygen is reduced, and Fe²⁺ goes on to form rust. Metals are protected electrochemically (a more active metal such as zinc corrodes instead) or by coating (plating with a metal that resists rust, paint, oil or grease).',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu khái niệm, thí nghiệm và cách chống ăn mòn như sách giáo khoa.',
      'The lesson gives only ideas, experiments and protection methods, as the textbook does.',
    ),
  ],
  limits: [
    L(
      'Pin điện và thế điện cực được tính trong chủ đề “Thế điện cực và nguồn điện hóa học”.',
      'Cells and electrode potentials are worked out in “Electrode potentials and cells”.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'HH12', lesson: 22 },
    question: L(
      'Một đinh sắt được quấn dây kẽm, một đinh sắt khác để nguyên; cả hai ngâm trong nước máy vài ngày. Đinh nào bị ăn mòn chậm hơn?',
      'One iron nail is wrapped in zinc wire, another left bare; both stand in tap water for a few days. Which corrodes more slowly?',
    ),
    choices: [
      { id: 'co-kem', text: L('Đinh sắt có quấn kẽm', 'The nail wrapped in zinc') },
      { id: 'khong-kem', text: L('Đinh sắt không quấn kẽm', 'The bare nail') },
      { id: 'nhu-nhau', text: L('Hai đinh như nhau', 'Both the same') },
      { id: 'khong-dinh', text: L('Không đinh nào bị ăn mòn', 'Neither corrodes') },
    ],
    answer: 'co-kem',
    answerWhy: L(
      'Kẽm hoạt động hóa học mạnh hơn sắt nên trong pin điện hóa kẽm là anode và bị ăn mòn, sắt được bảo vệ. Đây là phương pháp điện hóa.',
      'Zinc is more active than iron, so in the cell zinc is the anode and corrodes while iron is protected. This is electrochemical protection.',
    ),
    activities: [
      {
        kind: 'sort',
        id: 'loai',
        prompt: L(
          'Xếp mỗi hiện tượng vào loại ăn mòn của nó.',
          'Put each case under its kind of corrosion.',
        ),
        groups: [
          { id: 'hoa-hoc', label: L('Ăn mòn hóa học', 'Chemical corrosion') },
          { id: 'dien-hoa', label: L('Ăn mòn điện hóa', 'Electrochemical corrosion') },
        ],
        items: [
          {
            id: 'lo-dot',
            text: L(
              'Bộ phận lò đốt bằng sắt bị oxygen ăn mòn ở nhiệt độ cao',
              'Iron furnace parts attacked by oxygen when hot',
            ),
            group: 'hoa-hoc',
            why: L('Phản ứng trực tiếp với chất oxi hóa.', 'A direct reaction with the oxidant.'),
          },
          {
            id: 'kho',
            text: L('Thép bị gỉ trong không khí khô', 'Steel rusting in dry air'),
            group: 'hoa-hoc',
            why: L('Không có dung dịch chất điện li.', 'There is no electrolyte.'),
          },
          {
            id: 'am',
            text: L('Thép bị gỉ trong không khí ẩm', 'Steel rusting in moist air'),
            group: 'dien-hoa',
            why: L(
              'Lớp nước mỏng là dung dịch chất điện li, sắt và carbon tạo pin.',
              'A thin water film is the electrolyte; iron and carbon make a cell.',
            ),
          },
          {
            id: 'bien',
            text: L('Thép bị gỉ khi tiếp xúc nước biển', 'Steel rusting in seawater'),
            group: 'dien-hoa',
            why: L('Nước biển là dung dịch chất điện li.', 'Seawater is an electrolyte.'),
          },
          {
            id: 'dinh',
            text: L('Đinh sắt ngâm trong nước vài ngày', 'An iron nail standing in water for days'),
            group: 'dien-hoa',
            why: L('Đinh là hợp kim của sắt với carbon.', 'The nail is an iron–carbon alloy.'),
          },
        ],
      },
      {
        kind: 'match',
        id: 'pin',
        prompt: L(
          'Ghép mỗi khái niệm với điều đúng về nó.',
          'Match each idea with what is true of it.',
        ),
        pairs: [
          {
            id: 'anode',
            left: L('Anode trong gang thép bị ăn mòn', 'The anode in corroding cast iron'),
            right: L('Sắt bị oxi hóa thành ion Fe²⁺', 'Iron is oxidised to Fe²⁺'),
            why: L('Quá trình oxi hóa xảy ra ở anode.', 'Oxidation happens at the anode.'),
          },
          {
            id: 'cathode',
            left: L('Cathode trong gang thép bị ăn mòn', 'The cathode in corroding cast iron'),
            right: L(
              'Carbon, nơi oxygen hòa tan trong nước bị khử',
              'Carbon, where dissolved oxygen is reduced',
            ),
            why: L('Quá trình khử xảy ra ở cathode.', 'Reduction happens at the cathode.'),
          },
          {
            id: 'tau',
            left: L('Vỏ tàu biển bằng thép', 'A steel ship’s hull'),
            right: L(
              'Gắn các tấm kẽm lên phần chìm dưới nước',
              'Zinc plates are fixed below the waterline',
            ),
            why: L(
              'Phương pháp điện hóa: kẽm bị ăn mòn thay.',
              'Electrochemical: zinc corrodes instead.',
            ),
          },
          {
            id: 'phu',
            left: L('Tôn, sắt tây', 'Galvanised iron, tinplate'),
            right: L('Thép được tráng kẽm hoặc thiếc', 'Steel coated with zinc or tin'),
            why: L('Phương pháp phủ bề mặt.', 'Coating.'),
          },
        ],
      },
    ],
  },
};
