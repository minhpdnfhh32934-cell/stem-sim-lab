import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * HH11 KNTT Bài 11 "Phương pháp tách biệt và tinh chế hợp chất hữu cơ" (printed pages 63–69), in
 * SimLab's own words. Checked against the pages on 17/11/2026: four methods, each with its principle
 * (chưng cất: nhiệt độ sôi; chiết: hòa tan trong hai môi trường không trộn lẫn; kết tinh: độ tan và
 * sự thay đổi độ tan theo nhiệt độ; sắc kí cột: phân bố giữa pha động và pha tĩnh), the four steps
 * of recrystallisation (Hình 11.7) and the book's own examples (rượu thủ công, β-carotene trong nước
 * cà rốt, đường đỏ thành đường trắng). The prediction is the book's question on tr. 64. HH11-GL-1.
 */
export const hh11b11Separation: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'chemistry',
  id: 'guided.hh11-separation',
  topic: 'organicSeparation',
  title: L(
    'Tách biệt và tinh chế hợp chất hữu cơ: chọn phương pháp nào?',
    'Separating and purifying organic compounds: which method?',
  ),
  objectives: [
    L(
      'Dự đoán độ cồn của rượu thu được khi chưng cất rượu nấu thủ công.',
      'Predict the alcohol content of the liquid collected when home-made rice wine is distilled.',
    ),
    L(
      'Ghép mỗi phương pháp với nguyên tắc của nó và với một ví dụ trong sách.',
      'Match each method with its principle and with an example from the book.',
    ),
    L(
      'Xếp đúng thứ tự các bước của phương pháp kết tinh.',
      'Put the steps of recrystallisation in the right order.',
    ),
  ],
  hints: [
    L(
      'Mỗi phương pháp dựa vào một tính chất khác nhau giữa các chất: nhiệt độ sôi, khả năng hòa tan, độ tan theo nhiệt độ, hay mức bị giữ lại trên chất hấp phụ.',
      'Each method uses a different property of the substances: boiling point, solubility, how solubility changes with temperature, or how strongly an adsorbent holds them.',
    ),
    L(
      'Khi đun hỗn hợp, chất có nhiệt độ sôi thấp hơn bay hơi nhiều hơn.',
      'When a mixture is heated, the substance with the lower boiling point evaporates more.',
    ),
  ],
  questions: [
    L(
      'Vì sao khi chiết β-carotene từ nước ép cà rốt bằng hexane, lớp hexane lại nằm ở trên?',
      'Why does the hexane layer sit on top when β-carotene is extracted from carrot juice with hexane?',
    ),
  ],
  expectedConclusion: L(
    'Chưng cất tách các chất lỏng dựa vào nhiệt độ sôi khác nhau: chất sôi thấp hơn (ethanol) bay hơi trước nên phần thu được giàu ethanol hơn rượu ban đầu. Chiết dựa vào khả năng hòa tan khác nhau trong hai chất lỏng không trộn lẫn; chất lỏng nhẹ hơn nằm ở lớp trên. Kết tinh dựa vào độ tan khác nhau và độ tan thay đổi theo nhiệt độ. Sắc kí cột dựa vào sự phân bố khác nhau giữa pha động và pha tĩnh.',
    'Distillation separates liquids by their different boiling points: the lower-boiling one (ethanol) evaporates first, so the liquid collected is richer in ethanol than the wine. Extraction uses different solubilities in two liquids that do not mix; the lighter liquid forms the top layer. Recrystallisation uses different solubilities and how they change with temperature. Column chromatography uses how substances share themselves between the mobile and the stationary phase.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu nguyên tắc và cách tiến hành như sách giáo khoa; SimLab không tính nhiệt độ sôi hay độ cồn.',
      'The lesson gives only the principles and the steps, as the textbook does; SimLab computes no boiling point or alcohol content.',
    ),
  ],
  limits: [
    L(
      'Chưng cất phân đoạn, chưng cất lôi cuốn hơi nước và ngâm chiết chỉ có trong mục "Em có biết" của sách và không có trong bài học này.',
      'Fractional distillation, steam distillation and maceration appear only in the book’s "Em có biết" boxes and are left out here.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'HH11', lesson: 11 },
    question: L(
      'Rượu nấu thủ công gồm chủ yếu nước và ethanol; ethanol sôi ở nhiệt độ thấp hơn nước. Đem chưng cất rượu này, chất lỏng thu được ở bình hứng sẽ thế nào so với rượu ban đầu?',
      'Home-made rice wine is mostly water and ethanol; ethanol boils at a lower temperature than water. When this wine is distilled, how does the liquid collected compare with the wine?',
    ),
    choices: [
      { id: 'hon', text: L('Có độ cồn cao hơn', 'Higher in alcohol') },
      { id: 'kem', text: L('Có độ cồn thấp hơn', 'Lower in alcohol') },
      { id: 'bang', text: L('Có độ cồn như cũ', 'The same alcohol content') },
      { id: 'nuoc', text: L('Chỉ là nước', 'Only water') },
    ],
    answer: 'hon',
    answerWhy: L(
      'Ethanol có nhiệt độ sôi thấp hơn nước nên bay hơi nhiều hơn; hơi được làm lạnh, ngưng tụ ở bình hứng nên chất lỏng thu được có tỉ lệ ethanol cao hơn rượu ban đầu. Đó là nguyên tắc của chưng cất: tách chất dựa vào nhiệt độ sôi khác nhau.',
      'Ethanol boils at a lower temperature than water, so more of it evaporates; the vapour is cooled and condenses in the receiver, so the liquid collected has a higher share of ethanol than the wine. That is the principle of distillation: separating by different boiling points.',
    ),
    activities: [
      {
        kind: 'match',
        id: 'nguyen-tac',
        prompt: L(
          'Ghép mỗi phương pháp với nguyên tắc của nó.',
          'Match each method with its principle.',
        ),
        pairs: [
          {
            id: 'chung-cat',
            left: L('Chưng cất', 'Distillation'),
            right: L(
              'Các chất có nhiệt độ sôi khác nhau',
              'The substances boil at different temperatures',
            ),
            why: L(
              'Chất lỏng được chuyển thành hơi rồi làm lạnh cho ngưng tụ, thu lấy ở khoảng nhiệt độ thích hợp.',
              'The liquid is turned into vapour, then cooled to condense and collected at the right temperature.',
            ),
          },
          {
            id: 'chiet',
            left: L('Chiết', 'Extraction'),
            right: L(
              'Các chất hòa tan khác nhau trong hai chất lỏng không trộn lẫn',
              'The substances dissolve differently in two liquids that do not mix',
            ),
            why: L(
              'Chất cần tách chuyển phần lớn sang dung môi chiết, rồi dùng phễu chiết tách riêng hai lớp.',
              'The wanted substance moves mostly into the extracting solvent, then a separating funnel splits the two layers.',
            ),
          },
          {
            id: 'ket-tinh',
            left: L('Kết tinh', 'Recrystallisation'),
            right: L(
              'Độ tan khác nhau và thay đổi theo nhiệt độ',
              'Different solubilities that change with temperature',
            ),
            why: L(
              'Chất cần tinh chế tan tốt khi nóng, tan kém khi nguội nên kết tinh lại khi làm lạnh.',
              'The substance dissolves well when hot and poorly when cold, so it crystallises as the solution cools.',
            ),
          },
          {
            id: 'sac-ki',
            left: L('Sắc kí cột', 'Column chromatography'),
            right: L(
              'Phân bố khác nhau giữa pha động và pha tĩnh',
              'Different sharing between the mobile and the stationary phase',
            ),
            why: L(
              'Pha tĩnh (silica gel, aluminium oxide…) giữ các chất mạnh yếu khác nhau, nên chúng ra khỏi cột ở các phân đoạn khác nhau.',
              'The stationary phase (silica gel, aluminium oxide…) holds the substances more or less strongly, so they leave the column in different fractions.',
            ),
          },
        ],
      },
      {
        kind: 'order',
        id: 'ket-tinh-buoc',
        prompt: L(
          'Xếp các bước của phương pháp kết tinh theo đúng thứ tự.',
          'Put the steps of recrystallisation in order.',
        ),
        items: [
          {
            id: 'hoa-tan',
            text: L(
              'Hòa tan chất rắn có lẫn tạp chất vào dung môi nóng, tạo dung dịch bão hòa',
              'Dissolve the impure solid in a hot solvent to make a saturated solution',
            ),
            why: L(
              'Dung môi được chọn sao cho hòa tan tốt chất cần tinh chế khi nóng.',
              'The solvent is chosen to dissolve the wanted substance well when hot.',
            ),
          },
          {
            id: 'loc-nong',
            text: L(
              'Lọc nóng để bỏ chất không tan',
              'Filter while hot to remove what does not dissolve',
            ),
            why: L(
              'Lọc khi còn nóng để chất cần tinh chế vẫn ở trong dung dịch.',
              'Filtering while hot keeps the wanted substance in the solution.',
            ),
          },
          {
            id: 'lam-lanh',
            text: L(
              'Để nguội, làm lạnh cho chất cần tinh chế kết tinh',
              'Let it cool so the wanted substance crystallises',
            ),
            why: L(
              'Khi nguội, độ tan giảm nên chất cần tinh chế tách ra thành tinh thể.',
              'As it cools the solubility falls, so the wanted substance comes out as crystals.',
            ),
          },
          {
            id: 'loc-thu',
            text: L('Lọc để thu chất rắn', 'Filter to collect the solid'),
            why: L(
              'Tinh thể được tách khỏi dung dịch; kết tinh lại nhiều lần cho tinh thể tinh khiết hơn.',
              'The crystals are separated from the solution; repeating the process gives purer crystals.',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'vi-du',
        prompt: L(
          'Ghép mỗi ví dụ trong sách với phương pháp được dùng.',
          'Match each example from the book with the method used.',
        ),
        pairs: [
          {
            id: 'ruou',
            left: L('Nấu rượu từ gạo đã ủ men', 'Making spirit from fermented rice'),
            right: L('Chưng cất', 'Distillation'),
            why: L(
              'Hơi bay lên được làm lạnh trong thùng nước rồi ngưng tụ ở bình hứng.',
              'The rising vapour is cooled in a water tank and condenses in the receiver.',
            ),
          },
          {
            id: 'carotene',
            left: L(
              'Lấy β-carotene từ nước ép cà rốt bằng hexane',
              'Taking β-carotene from carrot juice with hexane',
            ),
            right: L('Chiết lỏng – lỏng', 'Liquid–liquid extraction'),
            why: L(
              'β-carotene tan trong hexane; hexane không trộn lẫn với nước nên tách thành lớp riêng.',
              'β-carotene dissolves in hexane; hexane does not mix with water, so it forms its own layer.',
            ),
          },
          {
            id: 'duong',
            left: L('Tinh chế đường đỏ thành đường trắng', 'Refining brown sugar into white sugar'),
            right: L('Kết tinh', 'Recrystallisation'),
            why: L(
              'Hòa tan đường trong nước nóng, khử màu, lọc, cô bớt nước rồi để nguội cho đường kết tinh.',
              'The sugar is dissolved in hot water, decolourised, filtered, concentrated and cooled to crystallise.',
            ),
          },
        ],
      },
    ],
  },
};
