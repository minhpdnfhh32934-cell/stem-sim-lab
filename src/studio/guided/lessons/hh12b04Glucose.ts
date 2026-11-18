import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * HH12 KNTT Bài 4 "Giới thiệu về carbohydrate. Glucose và fructose" (printed pages 20–24), in
 * SimLab's own words. Checked against the pages on 17/11/2026: carbohydrates and their three
 * classes, the open-chain and ring forms of glucose and fructose (tr. 21), glucose's reactions with
 * Cu(OH)₂ at room temperature and on heating, with Tollens' reagent and bromine water, fructose
 * reacting with Tollens' reagent and Cu(OH)₂ in base (tr. 22–23), fermentation, occurrence and uses
 * (tr. 24). HH12-GL-2.
 */
export const hh12b04Glucose: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'chemistry',
  id: 'guided.hh12-glucose',
  topic: 'monosaccharides',
  title: L('Carbohydrate. Glucose và fructose', 'Carbohydrates. Glucose and fructose'),
  objectives: [
    L(
      'Dự đoán hiện tượng khi cho dung dịch glucose vào Cu(OH)₂ trong môi trường kiềm.',
      'Predict what happens when glucose solution is added to Cu(OH)₂ in base.',
    ),
    L(
      'Ghép mỗi thí nghiệm với glucose với hiện tượng quan sát được.',
      'Match each experiment with glucose to what is seen.',
    ),
    L(
      'Phân biệt tính chất của glucose và fructose; phân loại các carbohydrate.',
      'Tell glucose from fructose; sort the carbohydrates into classes.',
    ),
  ],
  hints: [
    L(
      'Glucose vừa có nhiều nhóm hydroxy liền kề, vừa có nhóm aldehyde ở dạng mạch hở.',
      'Glucose has several neighbouring hydroxy groups and, open-chained, an aldehyde group.',
    ),
    L(
      'Trong môi trường kiềm, fructose chuyển hóa được thành glucose.',
      'In base, fructose can turn into glucose.',
    ),
  ],
  questions: [
    L(
      'Ứng dụng tráng gương, tráng ruột phích của glucose dựa trên tính chất nào của nó?',
      'Which property of glucose lets it silver mirrors and vacuum flasks?',
    ),
  ],
  expectedConclusion: L(
    'Carbohydrate là hợp chất hữu cơ tạp chức, thường có công thức chung Cn(H₂O)m, gồm monosaccharide (không bị thủy phân), disaccharide và polysaccharide. Glucose và fructose có cùng công thức phân tử, tồn tại ở dạng mạch hở và mạch vòng. Glucose có tính chất của polyalcohol (hòa tan Cu(OH)₂ tạo dung dịch xanh lam) và của aldehyde (bị oxi hóa bởi Cu(OH)₂ khi đun nóng, thuốc thử Tollens và nước bromine), nhóm –OH hemiacetal tác dụng với methanol, và lên men tạo ethanol hoặc lactic acid. Fructose cũng hòa tan Cu(OH)₂ và bị oxi hóa bởi thuốc thử Tollens, Cu(OH)₂ trong môi trường kiềm vì chuyển hóa được thành glucose.',
    'Carbohydrates are organic compounds with several functional groups, usually of formula Cn(H₂O)m: monosaccharides (not hydrolysed), disaccharides and polysaccharides. Glucose and fructose share a molecular formula and exist as open chains and rings. Glucose behaves as a polyalcohol (dissolving Cu(OH)₂ to a blue solution) and as an aldehyde (oxidised by hot Cu(OH)₂, Tollens’ reagent and bromine water); its hemiacetal –OH reacts with methanol, and it ferments to ethanol or lactic acid. Fructose also dissolves Cu(OH)₂ and is oxidised by Tollens’ reagent and Cu(OH)₂ in base, because in base it turns into glucose.',
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
      'Bài không vẽ cơ chế phản ứng; các phương trình viết như trong sách.',
      'The lesson draws no reaction mechanisms; the equations are as the book writes them.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'HH12', lesson: 4 },
    question: L(
      'Cho vài mililít dung dịch glucose vào ống nghiệm chứa Cu(OH)₂ trong môi trường kiềm, lắc đều ở nhiệt độ thường. Hiện tượng nào xảy ra?',
      'A few millilitres of glucose solution go into a tube of Cu(OH)₂ in base, shaken at room temperature. What happens?',
    ),
    choices: [
      {
        id: 'xanh-lam',
        text: L(
          'Kết tủa tan, dung dịch có màu xanh lam',
          'The precipitate dissolves to a blue solution',
        ),
      },
      {
        id: 'do-gach',
        text: L('Xuất hiện ngay kết tủa đỏ gạch', 'A brick-red precipitate forms at once'),
      },
      {
        id: 'bac',
        text: L('Có lớp bạc sáng bám thành ống', 'A shiny silver layer coats the tube'),
      },
      { id: 'khong', text: L('Không có hiện tượng gì', 'Nothing happens') },
    ],
    answer: 'xanh-lam',
    answerWhy: L(
      'Phân tử glucose có nhiều nhóm hydroxy liền kề nên hòa tan Cu(OH)₂ trong môi trường kiềm, tạo dung dịch màu xanh lam (tính chất polyalcohol). Kết tủa đỏ gạch chỉ xuất hiện khi đun nóng.',
      'Glucose has several neighbouring hydroxy groups, so it dissolves Cu(OH)₂ in base to a blue solution (a polyalcohol property). The brick-red precipitate only appears on heating.',
    ),
    activities: [
      {
        kind: 'match',
        id: 'thuoc-thu',
        prompt: L(
          'Ghép mỗi thí nghiệm với glucose với hiện tượng quan sát được.',
          'Match each experiment with glucose to what is seen.',
        ),
        pairs: [
          {
            id: 'cu-thuong',
            left: L('Cu(OH)₂ trong kiềm, nhiệt độ thường', 'Cu(OH)₂ in base, room temperature'),
            right: L('Dung dịch màu xanh lam', 'A blue solution'),
            why: L('Tính chất polyalcohol.', 'A polyalcohol property.'),
          },
          {
            id: 'cu-nong',
            left: L('Cu(OH)₂ trong kiềm, đun nóng', 'Cu(OH)₂ in base, heated'),
            right: L('Kết tủa đỏ gạch Cu₂O', 'A brick-red precipitate of Cu₂O'),
            why: L('Nhóm aldehyde bị oxi hóa.', 'The aldehyde group is oxidised.'),
          },
          {
            id: 'tollens',
            left: L('Thuốc thử Tollens, ngâm nước nóng', 'Tollens’ reagent, in hot water'),
            right: L(
              'Lớp bạc sáng bám trên thành ống nghiệm',
              'A shiny silver layer on the tube wall',
            ),
            why: L(
              'Ion bạc bị khử thành bạc kim loại.',
              'Silver ions are reduced to silver metal.',
            ),
          },
          {
            id: 'bromine',
            left: L('Nước bromine loãng', 'Dilute bromine water'),
            right: L('Nước bromine mất màu', 'The bromine water loses its colour'),
            why: L(
              'Glucose bị oxi hóa thành gluconic acid.',
              'Glucose is oxidised to gluconic acid.',
            ),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'glucose-fructose',
        prompt: L(
          'Xếp mỗi đặc điểm vào glucose, fructose hoặc cả hai.',
          'Put each feature under glucose, fructose or both.',
        ),
        groups: [
          { id: 'glucose', label: L('Glucose', 'Glucose') },
          { id: 'fructose', label: L('Fructose', 'Fructose') },
          { id: 'ca-hai', label: L('Cả hai', 'Both') },
        ],
        items: [
          {
            id: 'aldehyde',
            text: L('Có nhóm aldehyde ở dạng mạch hở', 'An aldehyde group in the open chain'),
            group: 'glucose',
            why: L('Fructose có nhóm ketone.', 'Fructose has a ketone group.'),
          },
          {
            id: 'ketone',
            text: L('Có nhóm ketone ở dạng mạch hở', 'A ketone group in the open chain'),
            group: 'fructose',
            why: L('Glucose có nhóm aldehyde.', 'Glucose has an aldehyde group.'),
          },
          {
            id: 'hydroxy',
            text: L('Có năm nhóm hydroxy ở dạng mạch hở', 'Five hydroxy groups in the open chain'),
            group: 'ca-hai',
            why: L('Cả hai đều là polyalcohol.', 'Both are polyalcohols.'),
          },
          {
            id: 'cu-xanh',
            text: L(
              'Hòa tan Cu(OH)₂ tạo dung dịch xanh lam',
              'Dissolve Cu(OH)₂ to a blue solution',
            ),
            group: 'ca-hai',
            why: L('Nhờ các nhóm hydroxy liền kề.', 'Thanks to the neighbouring hydroxy groups.'),
          },
          {
            id: 'bromine',
            text: L('Làm mất màu nước bromine', 'Decolourise bromine water'),
            group: 'glucose',
            why: L(
              'Nước bromine oxi hóa nhóm aldehyde của glucose.',
              'Bromine water oxidises glucose’s aldehyde group.',
            ),
          },
          {
            id: 'mat-ong',
            text: L(
              'Có nhiều trong mật ong và nhiều loại trái cây',
              'Plentiful in honey and many fruits',
            ),
            group: 'fructose',
            why: L(
              'Sách nêu fructose có nhiều trong mật ong.',
              'The book says honey is rich in fructose.',
            ),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'phan-loai',
        prompt: L(
          'Xếp mỗi chất vào loại carbohydrate của nó.',
          'Put each compound in its class of carbohydrate.',
        ),
        groups: [
          { id: 'mono', label: L('Monosaccharide', 'Monosaccharide') },
          { id: 'di', label: L('Disaccharide', 'Disaccharide') },
          { id: 'poly', label: L('Polysaccharide', 'Polysaccharide') },
        ],
        items: [
          {
            id: 'glucose',
            text: L('Glucose', 'Glucose'),
            group: 'mono',
            why: L('Không bị thủy phân.', 'Not hydrolysed.'),
          },
          {
            id: 'fructose',
            text: L('Fructose', 'Fructose'),
            group: 'mono',
            why: L('Không bị thủy phân.', 'Not hydrolysed.'),
          },
          {
            id: 'saccharose',
            text: L('Saccharose', 'Saccharose'),
            group: 'di',
            why: L(
              'Thủy phân tạo hai phân tử monosaccharide.',
              'Hydrolyses to two monosaccharides.',
            ),
          },
          {
            id: 'maltose',
            text: L('Maltose', 'Maltose'),
            group: 'di',
            why: L(
              'Thủy phân tạo hai phân tử monosaccharide.',
              'Hydrolyses to two monosaccharides.',
            ),
          },
          {
            id: 'tinh-bot',
            text: L('Tinh bột', 'Starch'),
            group: 'poly',
            why: L(
              'Thủy phân tạo nhiều phân tử monosaccharide.',
              'Hydrolyses to many monosaccharides.',
            ),
          },
          {
            id: 'cellulose',
            text: L('Cellulose', 'Cellulose'),
            group: 'poly',
            why: L(
              'Thủy phân tạo nhiều phân tử monosaccharide.',
              'Hydrolyses to many monosaccharides.',
            ),
          },
        ],
      },
    ],
  },
};
