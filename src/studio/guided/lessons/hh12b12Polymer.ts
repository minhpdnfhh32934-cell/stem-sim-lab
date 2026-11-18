import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * HH12 KNTT Bài 12 "Đại cương về polymer" (printed pages 51–55), in SimLab's own words. Checked
 * against the pages on 17/11/2026: polymer, monomer and repeat unit (tr. 51), naming "poly + tên
 * monomer" and the common polymers (tr. 52), physical properties and recycling codes (Hình 12.1),
 * chain-breaking, chain-growing (vulcanisation) and chain-keeping reactions (tr. 53), addition and
 * condensation polymerisation (tr. 54). HH12-GL-6.
 */
export const hh12b12Polymer: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'chemistry',
  id: 'guided.hh12-polymer',
  topic: 'polymerBasics',
  title: L('Đại cương về polymer', 'Polymers'),
  objectives: [
    L(
      'So sánh thành phần nguyên tố và phân tử khối của polyethylene với ethylene.',
      'Compare the elements and molar mass of polyethylene with those of ethylene.',
    ),
    L(
      'Ghép mỗi polymer với monomer tạo nên nó; phân loại phản ứng trùng hợp và trùng ngưng.',
      'Match each polymer with its monomer; sort addition and condensation polymerisation.',
    ),
    L(
      'Phân loại các phản ứng cắt mạch, tăng mạch và giữ nguyên mạch polymer.',
      'Sort reactions that break, grow or keep the polymer chain.',
    ),
  ],
  hints: [
    L(
      'Trong phản ứng trùng hợp, các phân tử monomer nối với nhau mà không tách ra phân tử nào khác.',
      'In addition polymerisation the monomers join without giving off any other molecule.',
    ),
    L(
      'Trùng ngưng giải phóng những phân tử nhỏ khác, thường là nước.',
      'Condensation releases other small molecules, usually water.',
    ),
  ],
  questions: [
    L(
      'Có nên dùng hộp xốp polystyrene để đựng thức ăn nóng hay hâm nóng trong lò vi sóng không? Vì sao?',
      'Should polystyrene foam boxes hold hot food or go in a microwave? Why?',
    ),
  ],
  expectedConclusion: L(
    'Polymer là hợp chất có phân tử khối rất lớn do nhiều đơn vị nhỏ (mắt xích) liên kết với nhau; monomer là những phân tử nhỏ phản ứng với nhau tạo nên polymer. Tên polymer đơn giản là "poly" ghép với tên monomer. Hầu hết polymer là chất rắn, không bay hơi, nhiều polymer có tính dẻo, đàn hồi hoặc dai, bền. Polymer có thể bị cắt mạch (nhiệt phân, thủy phân), tăng mạch (lưu hóa cao su) hoặc phản ứng giữ nguyên mạch. Polymer được tổng hợp bằng phản ứng trùng hợp (monomer có liên kết đôi hoặc vòng) hoặc trùng ngưng (monomer có ít nhất hai nhóm chức, giải phóng phân tử nhỏ như nước).',
    'A polymer is a compound of very large molar mass made of many small units (repeat units) joined together; monomers are the small molecules that react to make it. Simple polymers are named "poly" plus the monomer’s name. Most polymers are non-volatile solids; many are plastic, elastic or tough. A polymer chain can be broken (pyrolysis, hydrolysis), grown (vulcanising rubber) or kept while groups react. Polymers are made by addition polymerisation (monomers with a double bond or a ring) or condensation (monomers with at least two reactive groups, releasing a small molecule such as water).',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu khái niệm, tên gọi và phản ứng như sách giáo khoa; SimLab không tính lượng chất ở đây.',
      'The lesson gives only ideas, names and reactions, as the textbook does; SimLab computes no amounts here.',
    ),
  ],
  limits: [
    L(
      'Công thức cấu tạo đầy đủ của từng polymer có trong sách; bài này chỉ dùng tên.',
      'The book gives each polymer’s full structure; this lesson uses the names only.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'HH12', lesson: 12 },
    question: L(
      'Trùng hợp ethylene tạo thành polyethylene. So với ethylene, polyethylene có thành phần nguyên tố và phân tử khối thế nào?',
      'Ethylene polymerises to polyethylene. Compared with ethylene, how do its elements and molar mass compare?',
    ),
    choices: [
      {
        id: 'cung-lon',
        text: L(
          'Cùng thành phần nguyên tố, phân tử khối lớn hơn rất nhiều',
          'The same elements, a far larger molar mass',
        ),
      },
      {
        id: 'khac-lon',
        text: L(
          'Khác thành phần nguyên tố, phân tử khối lớn hơn',
          'Different elements, a larger molar mass',
        ),
      },
      {
        id: 'cung-bang',
        text: L(
          'Cùng thành phần nguyên tố và cùng phân tử khối',
          'The same elements and the same molar mass',
        ),
      },
      {
        id: 'nho-hon',
        text: L(
          'Cùng thành phần nguyên tố, phân tử khối nhỏ hơn',
          'The same elements, a smaller molar mass',
        ),
      },
    ],
    answer: 'cung-lon',
    answerWhy: L(
      'Mỗi mắt xích của polyethylene có cùng thành phần với một phân tử ethylene; rất nhiều mắt xích nối lại nên phân tử khối lớn hơn rất nhiều.',
      'Each repeat unit has ethylene’s composition; very many of them joined together give a far larger molar mass.',
    ),
    activities: [
      {
        kind: 'match',
        id: 'monomer',
        prompt: L(
          'Ghép mỗi polymer với monomer tạo nên nó.',
          'Match each polymer with its monomer.',
        ),
        pairs: [
          {
            id: 'pe',
            left: L('Polyethylene (PE)', 'Polyethylene (PE)'),
            right: L('Ethylene', 'Ethylene'),
            why: L('Poly + tên monomer.', 'Poly + the monomer’s name.'),
          },
          {
            id: 'pvc',
            left: L('Poly(vinyl chloride) (PVC)', 'Poly(vinyl chloride) (PVC)'),
            right: L('Vinyl chloride', 'Vinyl chloride'),
            why: L(
              'Tên monomer có hai cụm từ nên đặt trong ngoặc đơn.',
              'A two-word monomer name goes in brackets.',
            ),
          },
          {
            id: 'ps',
            left: L('Polystyrene (PS)', 'Polystyrene (PS)'),
            right: L('Styrene', 'Styrene'),
            why: L(
              'Nhiệt phân polystyrene lại thu được styrene.',
              'Heating polystyrene gives styrene back.',
            ),
          },
          {
            id: 'pp',
            left: L('Polypropylene (PP)', 'Polypropylene (PP)'),
            right: L('Propylene', 'Propylene'),
            why: L('Câu hỏi trong sách.', 'A question in the book.'),
          },
          {
            id: 'pmma',
            left: L('Poly(methyl methacrylate)', 'Poly(methyl methacrylate)'),
            right: L('Methyl methacrylate', 'Methyl methacrylate'),
            why: L('Câu hỏi trong sách.', 'A question in the book.'),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'tong-hop',
        prompt: L(
          'Xếp mỗi polymer theo phương pháp tổng hợp nó.',
          'Put each polymer under the way it is made.',
        ),
        groups: [
          { id: 'trung-hop', label: L('Trùng hợp', 'Addition polymerisation') },
          { id: 'trung-ngung', label: L('Trùng ngưng', 'Condensation polymerisation') },
        ],
        items: [
          {
            id: 'pe',
            text: L('Polyethylene từ ethylene', 'Polyethylene from ethylene'),
            group: 'trung-hop',
            why: L('Monomer có liên kết đôi.', 'The monomer has a double bond.'),
          },
          {
            id: 'pvc',
            text: L('Poly(vinyl chloride) từ vinyl chloride', 'PVC from vinyl chloride'),
            group: 'trung-hop',
            why: L('Monomer có liên kết đôi.', 'The monomer has a double bond.'),
          },
          {
            id: 'ps',
            text: L('Polystyrene từ styrene', 'Polystyrene from styrene'),
            group: 'trung-hop',
            why: L('Monomer có liên kết đôi.', 'The monomer has a double bond.'),
          },
          {
            id: 'ppf',
            text: L(
              'Poly(phenol formaldehyde) từ phenol và formaldehyde',
              'Phenol-formaldehyde resin from phenol and formaldehyde',
            ),
            group: 'trung-ngung',
            why: L('Có tách ra nước.', 'Water is released.'),
          },
          {
            id: 'polyamide',
            text: L('Polyamide từ ε-aminocaproic acid', 'A polyamide from ε-aminocaproic acid'),
            group: 'trung-ngung',
            why: L(
              'Nhóm –COOH phân tử này phản ứng với nhóm –NH₂ phân tử khác, tách ra nước.',
              'One molecule’s –COOH reacts with another’s –NH₂, releasing water.',
            ),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'phan-ung',
        prompt: L(
          'Xếp mỗi phản ứng vào loại phản ứng của polymer.',
          'Put each reaction under its kind of polymer reaction.',
        ),
        groups: [
          { id: 'cat', label: L('Cắt mạch', 'Chain breaking') },
          { id: 'tang', label: L('Tăng mạch', 'Chain growing') },
          { id: 'giu', label: L('Giữ nguyên mạch', 'Chain keeping') },
        ],
        items: [
          {
            id: 'nhiet-phan',
            text: L(
              'Nhiệt phân polystyrene thu được styrene',
              'Heating polystyrene to get styrene',
            ),
            group: 'cat',
            why: L('Polymer bị phân cắt thành monomer.', 'The polymer breaks into its monomer.'),
          },
          {
            id: 'thuy-phan',
            text: L('Thủy phân tinh bột thu được glucose', 'Hydrolysing starch to get glucose'),
            group: 'cat',
            why: L('Mạch polymer bị cắt.', 'The chain is broken.'),
          },
          {
            id: 'luu-hoa',
            text: L(
              'Đun cao su với lưu huỳnh (lưu hóa)',
              'Heating rubber with sulfur (vulcanisation)',
            ),
            group: 'tang',
            why: L(
              'Các mạch nối với nhau bằng cầu nối disulfide.',
              'Chains link through disulfide bridges.',
            ),
          },
          {
            id: 'vinyl-acetate',
            text: L(
              'Poly(vinyl acetate) tác dụng với dung dịch NaOH',
              'Poly(vinyl acetate) with NaOH solution',
            ),
            group: 'giu',
            why: L('Chỉ nhóm thế trên mạch thay đổi.', 'Only the side groups change.'),
          },
        ],
      },
    ],
  },
};
