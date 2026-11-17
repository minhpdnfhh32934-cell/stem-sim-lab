import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * HH12 KNTT Bài 21 "Hợp kim" (printed pages 99–101), in SimLab's own words. Checked against the
 * pages on 17/11/2026: what an alloy is and how it is made (tr. 99), its properties compared with
 * its metals (tr. 99–100: harder, less malleable, conducts less, a different melting point), cast
 * iron and steel (tr. 100), stainless steel (Hình 21.1) and duralumin (tr. 101). HH12-GL-10.
 */
export const hh12b21Alloys: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'chemistry',
  id: 'guided.hh12-alloys',
  topic: 'alloys',
  title: L('Hợp kim', 'Alloys'),
  objectives: [
    L(
      'Dự đoán độ cứng của hợp kim so với kim loại thành phần.',
      'Predict how hard an alloy is compared with its metals.',
    ),
    L(
      'Ghép mỗi hợp kim quan trọng của sắt và nhôm với thành phần, ứng dụng của nó.',
      'Match the main iron and aluminium alloys with what they are and their uses.',
    ),
    L(
      'Phân biệt tính chất của hợp kim giống và khác kim loại thành phần.',
      'Tell which properties of an alloy are like its metals and which differ.',
    ),
  ],
  hints: [
    L(
      'Tính chất hóa học của hợp kim tương tự kim loại thành phần, còn tính chất vật lí thường khác nhiều.',
      'An alloy’s chemistry is like its metals’, its physical properties often differ a lot.',
    ),
    L(
      'Hợp kim vàng – đồng cứng hơn vàng nên được dùng đúc tiền, làm đồ trang sức.',
      'Gold–copper alloy is harder than gold, so it is used for coins and jewellery.',
    ),
  ],
  questions: [
    L(
      'Vì sao khung xe đạp, thân máy bay thường được làm bằng hợp kim thay vì kim loại nguyên chất?',
      'Why are bicycle frames and aircraft bodies made of alloys rather than pure metals?',
    ),
  ],
  expectedConclusion: L(
    'Hợp kim là vật liệu kim loại chứa một kim loại cơ bản và một số kim loại khác hoặc phi kim, thường được điều chế bằng cách nung chảy các thành phần rồi để nguội. Tính chất hóa học của hợp kim tương tự kim loại thành phần, nhưng tính chất vật lí thường khác nhiều: hợp kim thường cứng hơn, kém dẻo hơn, dẫn điện kém hơn và có nhiệt độ nóng chảy khác kim loại thành phần. Gang dùng làm nguyên liệu sản xuất thép, chế tạo dụng cụ đun nấu, chi tiết máy; thép là vật liệu chủ yếu trong chế tạo máy, xây dựng; thép không gỉ chống ăn mòn tốt; duralumin nhẹ, cứng, bền, dùng trong công nghiệp chế tạo máy bay.',
    'An alloy is a metal material of one base metal with other metals or non-metals, usually made by melting the parts together and letting them cool. Its chemistry is like its metals’, but its physical properties often differ a lot: alloys are usually harder, less malleable, conduct less and melt at a different temperature. Cast iron is the raw material for steel and is used for cookware and machine parts; steel is the main material of machines and buildings; stainless steel resists corrosion; duralumin is light, hard and strong and is used to build aircraft.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu khái niệm, tính chất và ứng dụng như sách giáo khoa.',
      'The lesson gives only ideas, properties and uses, as the textbook does.',
    ),
  ],
  limits: [
    L(
      'Thành phần phần trăm của từng hợp kim được nêu trong sách; bài này chỉ so sánh.',
      'The book gives each alloy’s percentages; this lesson only compares them.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'HH12', lesson: 21 },
    question: L(
      'So với các kim loại thành phần, độ cứng của hợp kim thường thế nào?',
      'Compared with its metals, how hard is an alloy usually?',
    ),
    choices: [
      { id: 'cung-hon', text: L('Cứng hơn', 'Harder') },
      { id: 'mem-hon', text: L('Mềm hơn', 'Softer') },
      { id: 'nhu-nhau', text: L('Như nhau', 'The same') },
      { id: 'khong-cung', text: L('Không có độ cứng', 'Has no hardness') },
    ],
    answer: 'cung-hon',
    answerWhy: L(
      'Độ cứng của hợp kim thường lớn hơn độ cứng của kim loại thành phần, còn độ dẻo thường kém hơn; ví dụ hợp kim vàng – đồng cứng hơn vàng.',
      'An alloy is usually harder and less malleable than its metals; gold–copper alloy, for example, is harder than gold.',
    ),
    activities: [
      {
        kind: 'match',
        id: 'hop-kim',
        prompt: L(
          'Ghép mỗi hợp kim với điều đúng về nó.',
          'Match each alloy with what is true of it.',
        ),
        pairs: [
          {
            id: 'gang',
            left: L('Gang', 'Cast iron'),
            right: L(
              'Hợp kim của sắt chứa nhiều carbon hơn thép, cứng nhưng giòn',
              'An iron alloy with more carbon than steel, hard but brittle',
            ),
            why: L('Dùng làm nguyên liệu sản xuất thép.', 'Used to make steel.'),
          },
          {
            id: 'thep',
            left: L('Thép', 'Steel'),
            right: L(
              'Hợp kim của sắt chứa ít carbon hơn gang, vật liệu chủ yếu của ngành chế tạo máy, xây dựng',
              'An iron alloy with less carbon than cast iron, the main material of machines and buildings',
            ),
            why: L(
              'Thêm các nguyên tố khác để điều chỉnh tính chất.',
              'Other elements tune its properties.',
            ),
          },
          {
            id: 'khong-gi',
            left: L('Thép không gỉ', 'Stainless steel'),
            right: L(
              'Hợp kim của sắt có chromium, chống ăn mòn tốt hơn sắt nguyên chất',
              'An iron alloy with chromium, more corrosion resistant than pure iron',
            ),
            why: L('Thường dùng làm dụng cụ y tế.', 'Often used for medical tools.'),
          },
          {
            id: 'duralumin',
            left: L('Duralumin', 'Duralumin'),
            right: L(
              'Hợp kim của nhôm với đồng và một số nguyên tố khác, nhẹ, cứng, bền',
              'An aluminium alloy with copper and other elements, light, hard and strong',
            ),
            why: L('Dùng trong công nghiệp chế tạo máy bay.', 'Used to build aircraft.'),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'tinh-chat',
        prompt: L(
          'Xếp mỗi tính chất của hợp kim vào nhóm của nó.',
          'Put each property of an alloy in its group.',
        ),
        groups: [
          { id: 'giong', label: L('Tương tự kim loại thành phần', 'Like its metals') },
          { id: 'khac', label: L('Khác kim loại thành phần', 'Unlike its metals') },
        ],
        items: [
          {
            id: 'hoa-hoc',
            text: L('Tính chất hóa học', 'Chemical properties'),
            group: 'giong',
            why: L('Sách nêu tương tự kim loại thành phần.', 'The book says they are alike.'),
          },
          {
            id: 'anh-kim',
            text: L('Có ánh kim, dẫn điện, dẫn nhiệt', 'Shine, conduct electricity and heat'),
            group: 'giong',
            why: L(
              'Tính chất vật lí chung của kim loại.',
              'The common physical properties of metals.',
            ),
          },
          {
            id: 'cung',
            text: L('Thường cứng hơn', 'Usually harder'),
            group: 'khac',
            why: L('Ví dụ hợp kim vàng – đồng.', 'Gold–copper alloy, for example.'),
          },
          {
            id: 'dan-dien',
            text: L('Dẫn điện kém hơn kim loại cơ bản', 'Conducts less than its base metal'),
            group: 'khac',
            why: L(
              'Đồng dẫn điện tốt hơn hợp kim đồng.',
              'Copper conducts better than its alloys.',
            ),
          },
          {
            id: 'nong-chay',
            text: L('Nhiệt độ nóng chảy khác', 'A different melting point'),
            group: 'khac',
            why: L('Gang nóng chảy ở nhiệt độ thấp hơn sắt.', 'Cast iron melts lower than iron.'),
          },
        ],
      },
    ],
  },
};
