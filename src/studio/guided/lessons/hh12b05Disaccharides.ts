import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * HH12 KNTT Bài 5 "Saccharose và maltose" (printed pages 25–27), in SimLab's own words. Checked
 * against the pages on 17/11/2026: saccharose is one α-glucose and one β-fructose unit and exists
 * only as a ring, maltose is two glucose units with an open-chain form too (tr. 25), saccharose
 * dissolves Cu(OH)₂ and is hydrolysed to glucose and fructose, it does not react with Tollens'
 * reagent until heated with dilute acid (question 2, tr. 26), occurrence and uses (tr. 26–27).
 * HH12-GL-3.
 */
export const hh12b05Disaccharides: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'chemistry',
  id: 'guided.hh12-disaccharides',
  topic: 'disaccharides',
  title: L('Saccharose và maltose', 'Saccharose and maltose'),
  objectives: [
    L(
      'Dự đoán dung dịch saccharose có phản ứng với thuốc thử Tollens không, trước và sau khi đun với acid loãng.',
      'Predict whether saccharose reacts with Tollens’ reagent, before and after heating with dilute acid.',
    ),
    L(
      'Ghép mỗi disaccharide với cấu tạo và nguồn gốc của nó.',
      'Match each disaccharide with its structure and where it comes from.',
    ),
    L(
      'Phân biệt tính chất và ứng dụng của saccharose và maltose.',
      'Tell the properties and uses of saccharose and maltose apart.',
    ),
  ],
  hints: [
    L(
      'Phản ứng với thuốc thử Tollens cần nhóm có thể mở vòng thành nhóm aldehyde.',
      'Tollens’ reagent needs a group that can open into an aldehyde.',
    ),
    L(
      'Thủy phân saccharose tạo glucose và fructose.',
      'Hydrolysing saccharose gives glucose and fructose.',
    ),
  ],
  questions: [
    L(
      'Vì sao saccharose chỉ tồn tại ở dạng mạch vòng, còn maltose tồn tại cả dạng mạch hở và mạch vòng?',
      'Why does saccharose exist only as a ring while maltose exists both open-chained and as a ring?',
    ),
  ],
  expectedConclusion: L(
    'Saccharose cấu tạo từ một đơn vị α-glucose và một đơn vị β-fructose, chỉ tồn tại ở dạng mạch vòng; maltose cấu tạo từ hai đơn vị glucose, tồn tại cả dạng mạch hở và mạch vòng. Saccharose có tính chất của polyalcohol (hòa tan Cu(OH)₂ trong môi trường kiềm tạo dung dịch xanh lam) và bị thủy phân dưới tác dụng của acid hoặc enzyme tạo glucose và fructose; dung dịch sau thủy phân mới phản ứng với thuốc thử Tollens. Saccharose có nhiều trong mía, củ cải đường, hoa thốt nốt và được dùng làm chất tạo ngọt; maltose có trong hạt nảy mầm, mạch nha và dùng sản xuất bia.',
    'Saccharose is one α-glucose unit and one β-fructose unit and exists only as a ring; maltose is two glucose units and exists both open-chained and as a ring. Saccharose behaves as a polyalcohol (dissolving Cu(OH)₂ in base to a blue solution) and is hydrolysed by acid or enzymes to glucose and fructose; only after hydrolysis does the solution react with Tollens’ reagent. Saccharose is plentiful in sugar cane, sugar beet and palmyra palm flowers and is used to sweeten food; maltose is found in sprouting grain and malt syrup and is used to brew beer.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu cấu tạo, thí nghiệm và tính chất như sách giáo khoa; SimLab không tính lượng chất ở đây.',
      'The lesson gives only structures, experiments and properties, as the textbook does; SimLab computes no amounts here.',
    ),
  ],
  limits: [
    L(
      'Tên các liên kết glycoside được viết đầy đủ trong sách; bài này chỉ nêu đơn vị cấu tạo.',
      'The book names the glycosidic links in full; this lesson gives only the building units.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'HH12', lesson: 5 },
    question: L(
      'Dung dịch saccharose có phản ứng với thuốc thử Tollens không? Còn sau khi đun nóng với dung dịch acid loãng thì sao?',
      'Does saccharose solution react with Tollens’ reagent? And after heating it with dilute acid?',
    ),
    choices: [
      {
        id: 'sau-acid',
        text: L(
          'Lúc đầu không; sau khi đun với acid thì có',
          'Not at first; it does after heating with acid',
        ),
      },
      {
        id: 'luc-dau',
        text: L(
          'Lúc đầu có; sau khi đun với acid thì không',
          'It does at first; not after heating with acid',
        ),
      },
      { id: 'ca-hai', text: L('Có trong cả hai trường hợp', 'It does both times') },
      { id: 'khong', text: L('Không trong cả hai trường hợp', 'It does neither time') },
    ],
    answer: 'sau-acid',
    answerWhy: L(
      'Phân tử saccharose chỉ ở dạng mạch vòng, không mở vòng tạo nhóm aldehyde nên không phản ứng với thuốc thử Tollens. Khi đun với acid loãng, saccharose bị thủy phân thành glucose và fructose; hai chất này phản ứng được với thuốc thử Tollens.',
      'Saccharose exists only as a ring and cannot open into an aldehyde, so it does not react with Tollens’ reagent. Heated with dilute acid it is hydrolysed to glucose and fructose, and these do react.',
    ),
    activities: [
      {
        kind: 'match',
        id: 'cau-tao',
        prompt: L(
          'Ghép mỗi chất hay nguồn với điều đúng về nó.',
          'Match each sugar or source with what is true of it.',
        ),
        pairs: [
          {
            id: 'saccharose',
            left: L('Saccharose', 'Saccharose'),
            right: L(
              'Một đơn vị α-glucose nối với một đơn vị β-fructose',
              'One α-glucose unit joined to one β-fructose unit',
            ),
            why: L('Chỉ tồn tại ở dạng mạch vòng.', 'It exists only as a ring.'),
          },
          {
            id: 'maltose',
            left: L('Maltose', 'Maltose'),
            right: L('Hai đơn vị glucose nối với nhau', 'Two glucose units joined together'),
            why: L(
              'Còn một nhóm –OH hemiacetal nên có dạng mạch hở.',
              'It keeps a hemiacetal –OH, so it has an open-chain form.',
            ),
          },
          {
            id: 'mia',
            left: L('Mía, củ cải đường, hoa thốt nốt', 'Sugar cane, sugar beet, palmyra flowers'),
            right: L('Chứa nhiều saccharose', 'Rich in saccharose'),
            why: L('Nguồn sản xuất đường ăn.', 'Where table sugar is made from.'),
          },
          {
            id: 'mach-nha',
            left: L('Hạt nảy mầm, mạch nha', 'Sprouting grain, malt syrup'),
            right: L('Chứa nhiều maltose', 'Rich in maltose'),
            why: L(
              'Maltose tạo ra khi thủy phân tinh bột.',
              'Maltose forms when starch is hydrolysed.',
            ),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'tinh-chat',
        prompt: L(
          'Xếp mỗi đặc điểm vào saccharose, maltose hoặc cả hai.',
          'Put each feature under saccharose, maltose or both.',
        ),
        groups: [
          { id: 'saccharose', label: L('Saccharose', 'Saccharose') },
          { id: 'maltose', label: L('Maltose', 'Maltose') },
          { id: 'ca-hai', label: L('Cả hai', 'Both') },
        ],
        items: [
          {
            id: 'cu',
            text: L(
              'Hòa tan Cu(OH)₂ tạo dung dịch xanh lam',
              'Dissolve Cu(OH)₂ to a blue solution',
            ),
            group: 'ca-hai',
            why: L(
              'Có nhiều nhóm hydroxy liền kề.',
              'They have several neighbouring hydroxy groups.',
            ),
          },
          {
            id: 'vong',
            text: L('Chỉ tồn tại ở dạng mạch vòng', 'Exists only as a ring'),
            group: 'saccharose',
            why: L('Không còn nhóm –OH hemiacetal.', 'No hemiacetal –OH is left.'),
          },
          {
            id: 'mo-vong',
            text: L(
              'Tồn tại cả dạng mạch hở và mạch vòng',
              'Exists both open-chained and as a ring',
            ),
            group: 'maltose',
            why: L('Còn một nhóm –OH hemiacetal.', 'One hemiacetal –OH is left.'),
          },
          {
            id: 'thuy-phan',
            text: L('Thủy phân tạo glucose và fructose', 'Hydrolyses to glucose and fructose'),
            group: 'saccharose',
            why: L('Phương trình thủy phân trong sách.', 'The hydrolysis equation in the book.'),
          },
          {
            id: 'ngot',
            text: L(
              'Chất tạo ngọt phổ biến trong bánh, kẹo, nước giải khát',
              'The usual sweetener in cakes, sweets and drinks',
            ),
            group: 'saccharose',
            why: L('Đường ăn.', 'Table sugar.'),
          },
          {
            id: 'bia',
            text: L('Nguyên liệu sản xuất bia', 'A raw material for beer'),
            group: 'maltose',
            why: L('Ứng dụng sách nêu.', 'A use the book names.'),
          },
        ],
      },
    ],
  },
};
