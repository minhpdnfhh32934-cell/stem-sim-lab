import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * HH12 KNTT Bài 6 "Tinh bột và cellulose" (printed pages 28–32), in SimLab's own words. Checked
 * against the pages on 17/11/2026: starch as amylose and amylopectin, cellulose as unbranched
 * chains of β-glucose (tr. 28–29), hydrolysis of both to glucose, starch's colour with iodine
 * (Hình 6.1), cellulose with nitric acid and in Schweizer's reagent (tr. 29–31), starch in green
 * plants and in the body, uses of both (tr. 31–32). HH12-GL-4.
 */
export const hh12b06Polysaccharides: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'chemistry',
  id: 'guided.hh12-polysaccharides',
  topic: 'polysaccharides',
  title: L('Tinh bột và cellulose', 'Starch and cellulose'),
  objectives: [
    L(
      'Dự đoán hiện tượng khi nhỏ dung dịch iodine vào hồ tinh bột.',
      'Predict what happens when iodine solution is dropped into starch paste.',
    ),
    L(
      'Phân biệt cấu tạo, tính chất và ứng dụng của tinh bột và cellulose.',
      'Tell the structure, properties and uses of starch and cellulose apart.',
    ),
    L(
      'Sắp xếp các bước chuyển hóa tinh bột trong cơ thể.',
      'Order the steps by which the body uses starch.',
    ),
  ],
  hints: [
    L('Phân tử amylose có dạng xoắn.', 'Amylose molecules are coiled.'),
    L(
      'Cả tinh bột và cellulose đều là polymer của glucose.',
      'Starch and cellulose are both polymers of glucose.',
    ),
  ],
  questions: [
    L(
      'Vì sao tinh bột và cellulose đều có thể dùng để sản xuất ethanol?',
      'Why can both starch and cellulose be used to make ethanol?',
    ),
  ],
  expectedConclusion: L(
    'Tinh bột và cellulose đều là polysaccharide có công thức (C₆H₁₀O₅)n. Tinh bột gồm amylose (chuỗi xoắn không nhánh các đơn vị α-glucose) và amylopectin (có nhánh); cellulose gồm các chuỗi không nhánh các đơn vị β-glucose. Cả hai bị thủy phân hoàn toàn tạo glucose. Tinh bột tạo màu xanh tím với iodine; cellulose phản ứng với nitric acid tạo cellulose nitrate và tan trong nước Schweizer. Tinh bột hình thành trong cây xanh qua quang hợp, là nguồn lương thực chính; cellulose dùng làm vật liệu xây dựng, sản xuất giấy, tơ và ethanol.',
    'Starch and cellulose are polysaccharides of formula (C₆H₁₀O₅)n. Starch is amylose (coiled unbranched chains of α-glucose) and amylopectin (branched); cellulose is unbranched chains of β-glucose. Both are fully hydrolysed to glucose. Starch turns iodine blue-violet; cellulose reacts with nitric acid to give cellulose nitrate and dissolves in Schweizer’s reagent. Starch forms in green plants by photosynthesis and is a staple food; cellulose is used for building materials, paper, fibres and ethanol.',
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
      'Các thí nghiệm với acid đặc trong sách cần làm cẩn thận và có giáo viên hướng dẫn.',
      'The book’s experiments with concentrated acids need care and a teacher’s guidance.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'HH12', lesson: 6 },
    question: L(
      'Nhỏ vài giọt dung dịch iodine vào ống nghiệm chứa hồ tinh bột rồi lắc đều. Hiện tượng nào xảy ra?',
      'A few drops of iodine solution go into a tube of starch paste, shaken. What happens?',
    ),
    choices: [
      { id: 'xanh-tim', text: L('Dung dịch có màu xanh tím', 'The mixture turns blue-violet') },
      { id: 'do-gach', text: L('Xuất hiện kết tủa đỏ gạch', 'A brick-red precipitate forms') },
      { id: 'mat-mau', text: L('Dung dịch iodine mất màu', 'The iodine loses its colour') },
      { id: 'khong', text: L('Không có hiện tượng gì', 'Nothing happens') },
    ],
    answer: 'xanh-tim',
    answerWhy: L(
      'Các phân tử amylose có dạng xoắn, khi tương tác với iodine tạo ra màu xanh tím. Phản ứng này dùng để nhận biết tinh bột.',
      'The coiled amylose molecules hold iodine and give a blue-violet colour. This reaction is used to detect starch.',
    ),
    activities: [
      {
        kind: 'sort',
        id: 'so-sanh',
        prompt: L(
          'Xếp mỗi đặc điểm vào tinh bột, cellulose hoặc cả hai.',
          'Put each feature under starch, cellulose or both.',
        ),
        groups: [
          { id: 'tinh-bot', label: L('Tinh bột', 'Starch') },
          { id: 'cellulose', label: L('Cellulose', 'Cellulose') },
          { id: 'ca-hai', label: L('Cả hai', 'Both') },
        ],
        items: [
          {
            id: 'amylose',
            text: L('Gồm amylose và amylopectin', 'Made of amylose and amylopectin'),
            group: 'tinh-bot',
            why: L('Amylopectin có cấu tạo phân nhánh.', 'Amylopectin is branched.'),
          },
          {
            id: 'beta',
            text: L(
              'Chuỗi không nhánh các đơn vị β-glucose',
              'Unbranched chains of β-glucose units',
            ),
            group: 'cellulose',
            why: L('Tinh bột gồm các đơn vị α-glucose.', 'Starch is made of α-glucose units.'),
          },
          {
            id: 'iodine',
            text: L('Tạo màu xanh tím với iodine', 'Turns iodine blue-violet'),
            group: 'tinh-bot',
            why: L('Nhờ dạng xoắn của amylose.', 'Thanks to the coiled amylose.'),
          },
          {
            id: 'schweizer',
            text: L('Tan trong nước Schweizer', 'Dissolves in Schweizer’s reagent'),
            group: 'cellulose',
            why: L('Thí nghiệm trong sách.', 'An experiment in the book.'),
          },
          {
            id: 'nitric',
            text: L(
              'Phản ứng với nitric acid tạo chất làm thuốc súng không khói',
              'Reacts with nitric acid to give smokeless powder',
            ),
            group: 'cellulose',
            why: L('Sản phẩm là cellulose trinitrate.', 'The product is cellulose trinitrate.'),
          },
          {
            id: 'glucose',
            text: L('Thủy phân hoàn toàn tạo glucose', 'Fully hydrolysed to glucose'),
            group: 'ca-hai',
            why: L('Đều là polymer của glucose.', 'Both are glucose polymers.'),
          },
        ],
      },
      {
        kind: 'order',
        id: 'co-the',
        prompt: L(
          'Sắp xếp các bước chuyển hóa tinh bột trong cơ thể người.',
          'Put the steps by which the human body uses starch in order.',
        ),
        items: [
          {
            id: 'nuoc-bot',
            text: L(
              'Enzyme α-amylase trong nước bọt thủy phân một phần tinh bột thành dextrin và maltose',
              'α-amylase in saliva breaks part of the starch into dextrin and maltose',
            ),
            why: L('Quá trình bắt đầu từ miệng.', 'It starts in the mouth.'),
          },
          {
            id: 'ruot',
            text: L(
              'Ở ruột non, phần lớn tinh bột bị thủy phân thành glucose',
              'In the small intestine most of the starch becomes glucose',
            ),
            why: L('Tiếp tục thủy phân.', 'Hydrolysis goes on.'),
          },
          {
            id: 'mau',
            text: L(
              'Glucose được hấp thụ vào máu và đến các tế bào',
              'Glucose passes into the blood and reaches the cells',
            ),
            why: L('Máu chuyển glucose đi khắp cơ thể.', 'The blood carries glucose everywhere.'),
          },
          {
            id: 'glycogen',
            text: L(
              'Glucose được dùng cho năng lượng hoặc chuyển thành glycogen dự trữ ở gan và cơ',
              'Glucose is used for energy or stored as glycogen in the liver and muscles',
            ),
            why: L('Phần dư được dự trữ.', 'The rest is stored.'),
          },
        ],
      },
      {
        kind: 'match',
        id: 'ung-dung',
        prompt: L('Ghép mỗi chất với ứng dụng của nó.', 'Match each substance with its use.'),
        pairs: [
          {
            id: 'tinh-bot',
            left: L('Tinh bột', 'Starch'),
            right: L(
              'Nguồn lương thực, chất làm đặc, chất kết dính',
              'Staple food, thickener, binder',
            ),
            why: L('Ứng dụng sách nêu.', 'Uses the book names.'),
          },
          {
            id: 'cellulose',
            left: L('Cellulose', 'Cellulose'),
            right: L('Vật liệu xây dựng, sản xuất giấy, tơ', 'Building material, paper, fibres'),
            why: L('Ứng dụng sách nêu.', 'Uses the book names.'),
          },
          {
            id: 'trinitrate',
            left: L('Cellulose trinitrate', 'Cellulose trinitrate'),
            right: L('Chế tạo thuốc súng không khói', 'Smokeless powder'),
            why: L(
              'Sản phẩm của cellulose với nitric acid.',
              'Made from cellulose and nitric acid.',
            ),
          },
        ],
      },
    ],
  },
};
