import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH10 KNTT Bài 13 "Khái quát về chuyển hóa vật chất và năng lượng" (printed pages 78–84), in
 * SimLab's own words. Checked on 16/11/2026: đồng hóa = tổng hợp (uses energy), dị hóa = phân
 * giải (releases energy); the enzyme acts in three stages (binds the substrate at the active site,
 * catalyses, the product leaves). The sorted examples follow Bài 13–14. SH10-GL-3.
 */
export const sh10b13Metabolism: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh10-metabolism',
  topic: 'metabolismEnergy',
  title: L(
    'Chuyển hóa vật chất và năng lượng: đồng hóa, dị hóa và enzyme',
    'Matter and energy in the cell: anabolism, catabolism and enzymes',
  ),
  objectives: [
    L(
      'Dự đoán năng lượng đi đâu khi tế bào phân giải glucose.',
      'Predict where the energy goes when a cell breaks down glucose.',
    ),
    L(
      'Phân loại các quá trình thành đồng hóa hoặc dị hóa.',
      'Sort processes into anabolism or catabolism.',
    ),
    L(
      'Xếp đúng thứ tự các bước enzyme xúc tác một phản ứng.',
      'Put the steps of an enzyme catalysing a reaction in order.',
    ),
  ],
  hints: [
    L(
      'Tự hỏi: quá trình này tạo ra phân tử lớn hơn hay nhỏ hơn?',
      'Ask yourself: does this process make bigger molecules or smaller ones?',
    ),
    L(
      'ATP giống như một viên pin sạc: năng lượng được nạp vào khi tạo ATP và được lấy ra khi ATP bị phân giải.',
      'ATP is like a rechargeable battery: energy goes in when ATP is made and comes out when ATP is broken down.',
    ),
  ],
  questions: [
    L(
      'Vì sao nói chuyển hóa vật chất luôn đi kèm với chuyển hóa năng lượng?',
      'Why do we say that changing matter always goes with changing energy?',
    ),
  ],
  expectedConclusion: L(
    'Đồng hóa là tổng hợp chất phức tạp từ chất đơn giản và cần năng lượng; dị hóa là phân giải chất và giải phóng năng lượng. Khi phân giải glucose, năng lượng được giải phóng: một phần được giữ trong ATP, phần còn lại tỏa ra dạng nhiệt. Enzyme gắn cơ chất ở trung tâm hoạt động, xúc tác phản ứng rồi trở lại như cũ để dùng tiếp.',
    'Anabolism builds complex substances from simple ones and needs energy; catabolism breaks substances down and releases energy. When glucose is broken down its energy is released: part is kept in ATP and the rest is given off as heat. An enzyme binds its substrate at the active site, catalyses the reaction and comes back unchanged to be used again.',
  ),
  sources: [],
  assumptions: [
    L(
      'Mỗi quá trình được xếp theo kết quả chung của nó; bài không đi vào từng phản ứng nhỏ bên trong.',
      'Each process is sorted by its overall result; the lesson does not go into the small reactions inside it.',
    ),
  ],
  limits: [
    L(
      'Bài không tính lượng năng lượng hay số phân tử ATP.',
      'The lesson does not compute amounts of energy or numbers of ATP molecules.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH10', lesson: 13 },
    question: L(
      'Khi tế bào phân giải glucose trong hô hấp, theo em năng lượng chứa trong glucose sẽ thế nào?',
      'When a cell breaks down glucose in respiration, what do you think happens to the energy in the glucose?',
    ),
    choices: [
      {
        id: 'tich-them',
        text: L('Được tích thêm vào glucose', 'More of it is stored in the glucose'),
      },
      {
        id: 'giai-phong',
        text: L(
          'Được giải phóng, một phần được giữ lại trong ATP',
          'It is released, and part of it is kept in ATP',
        ),
      },
      {
        id: 'mat-di',
        text: L('Biến mất hoàn toàn, không còn ở đâu cả', 'It vanishes completely'),
      },
    ],
    answer: 'giai-phong',
    answerWhy: L(
      'Phân giải glucose là dị hóa: liên kết hóa học bị phá vỡ và năng lượng được giải phóng. Một phần năng lượng ấy được giữ trong ATP để tế bào dùng, phần còn lại tỏa ra dưới dạng nhiệt. Năng lượng không tự mất đi, chỉ chuyển từ dạng này sang dạng khác.',
      'Breaking down glucose is catabolism: chemical bonds break and energy is released. Part of it is kept in ATP for the cell to use and the rest is given off as heat. Energy does not vanish; it only changes from one form to another.',
    ),
    activities: [
      {
        kind: 'sort',
        id: 'dong-di',
        prompt: L(
          'Đồng hóa là tổng hợp chất, dị hóa là phân giải chất. Xếp mỗi quá trình vào đúng nhóm.',
          'Anabolism builds substances up, catabolism breaks them down. Put each process in the right group.',
        ),
        groups: [
          { id: 'dong-hoa', label: L('Đồng hóa', 'Anabolism') },
          { id: 'di-hoa', label: L('Dị hóa', 'Catabolism') },
        ],
        items: [
          {
            id: 'protein',
            text: L('Tổng hợp protein từ các amino acid', 'Making a protein from amino acids'),
            group: 'dong-hoa',
            why: L(
              'Nhiều phân tử nhỏ nối lại thành phân tử lớn: đó là tổng hợp, cần tiêu tốn năng lượng.',
              'Many small molecules join into a big one: that is building up, and it uses energy.',
            ),
          },
          {
            id: 'quang-hop',
            text: L(
              'Quang hợp tạo glucose từ CO₂ và nước',
              'Photosynthesis making glucose from CO₂ and water',
            ),
            group: 'dong-hoa',
            why: L(
              'Từ chất vô cơ đơn giản tạo ra chất hữu cơ; năng lượng ánh sáng được tích vào liên kết hóa học.',
              'Organic matter is made from simple inorganic substances; light energy is stored in chemical bonds.',
            ),
          },
          {
            id: 'tinh-bot',
            text: L('Tổng hợp tinh bột từ glucose', 'Making starch from glucose'),
            group: 'dong-hoa',
            why: L(
              'Các đường đơn nối lại thành đường đa: đây là phản ứng tổng hợp.',
              'Simple sugars join into a polysaccharide: this is a building-up reaction.',
            ),
          },
          {
            id: 'ho-hap',
            text: L(
              'Hô hấp tế bào phân giải glucose thành CO₂ và nước',
              'Cellular respiration breaking glucose down to CO₂ and water',
            ),
            group: 'di-hoa',
            why: L(
              'Phân tử lớn bị phá vỡ thành phân tử nhỏ và năng lượng được giải phóng.',
              'A big molecule is broken into small ones and energy is released.',
            ),
          },
          {
            id: 'len-men',
            text: L('Lên men glucose tạo lactate', 'Fermenting glucose into lactate'),
            group: 'di-hoa',
            why: L(
              'Glucose bị phân giải không hoàn toàn nhưng vẫn giải phóng một ít năng lượng.',
              'Glucose is only partly broken down, but some energy is still released.',
            ),
          },
          {
            id: 'amylase',
            text: L('Enzyme amylase phân giải tinh bột', 'The enzyme amylase breaking down starch'),
            group: 'di-hoa',
            why: L(
              'Đường đa bị cắt thành những phân tử nhỏ hơn: đó là phân giải.',
              'A polysaccharide is cut into smaller molecules: that is breaking down.',
            ),
          },
        ],
      },
      {
        kind: 'order',
        id: 'enzyme',
        prompt: L(
          'Xếp các bước enzyme xúc tác một phản ứng theo đúng thứ tự.',
          'Put the steps of an enzyme catalysing a reaction in the right order.',
        ),
        // The three stages of H 13.2 (p. 81), nothing added.
        items: [
          {
            id: 'ket-hop',
            text: L(
              'Cơ chất liên kết vào trung tâm hoạt động của enzyme',
              'The substrate binds the active site of the enzyme',
            ),
            why: L(
              'Trung tâm hoạt động có hình dạng khớp với cơ chất; khi gắn vào, cả hai đổi hình dạng một chút để khớp chặt hơn.',
              'The active site has a shape that fits the substrate; when it binds, both change shape a little to fit more tightly.',
            ),
          },
          {
            id: 'xuc-tac',
            text: L(
              'Enzyme xúc tác, cơ chất biến đổi thành sản phẩm',
              'The enzyme catalyses and the substrate turns into product',
            ),
            why: L(
              'Nhờ enzyme, phản ứng cần ít năng lượng hoạt hóa hơn nên xảy ra nhanh hơn rất nhiều.',
              'The enzyme lowers the activation energy, so the reaction runs much faster.',
            ),
          },
          {
            id: 'tach',
            text: L(
              'Sản phẩm rời khỏi enzyme, enzyme trở lại như cũ',
              'The product leaves and the enzyme is as it was before',
            ),
            why: L(
              'Enzyme không bị biến đổi sau phản ứng nên được dùng lại nhiều lần.',
              'The enzyme is not changed by the reaction, so it is used again and again.',
            ),
          },
        ],
      },
    ],
  },
};
