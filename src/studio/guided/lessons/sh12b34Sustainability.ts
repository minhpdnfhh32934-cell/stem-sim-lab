import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH12 KNTT Bài 34 "Phát triển bền vững" (printed pages 180–187), in SimLab's own words. Checked
 * against the pages on 17/11/2026: what sustainable development is and its three pillars (Hình
 * 34.1), sustainable agriculture (Bảng 34.1), limiting pollution (tr. 182–183), using natural
 * resources wisely by kind (tr. 183–184, Hình 34.3), population policy (tr. 184–185),
 * environmental education (Hình 34.4) and what students can do (tr. 186). SH12-GL-13.
 */
export const sh12b34Sustainability: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'biology',
  id: 'guided.sh12-sustainability',
  topic: 'sustainability',
  title: L('Phát triển bền vững', 'Sustainable development'),
  objectives: [
    L(
      'Dự đoán điều xảy ra khi chỉ một lĩnh vực phát triển quá nhanh.',
      'Predict what happens when one field grows much faster than the others.',
    ),
    L('Xếp mỗi tài nguyên thiên nhiên vào nhóm của nó.', 'Put each natural resource in its group.'),
    L(
      'Ghép mỗi nhóm biện pháp hạn chế ô nhiễm với ví dụ.',
      'Match each group of anti-pollution measures with an example.',
    ),
  ],
  hints: [
    L(
      'Phát triển bền vững cần hài hòa ba lĩnh vực: kinh tế, xã hội, môi trường.',
      'Sustainable development balances the economy, society and the environment.',
    ),
    L(
      'Tài nguyên tái tạo được có thể phục hồi nếu khai thác hợp lí.',
      'Renewable resources can recover if used wisely.',
    ),
  ],
  questions: [
    L(
      'Em có thể làm gì ở trường, ở nhà để góp phần phát triển bền vững?',
      'What can you do at school or at home for sustainable development?',
    ),
  ],
  expectedConclusion: L(
    'Phát triển bền vững là sự phát triển đáp ứng nhu cầu hiện tại mà không làm tổn hại khả năng đáp ứng nhu cầu của các thế hệ tương lai, hài hòa ba lĩnh vực kinh tế, xã hội và môi trường; nếu một lĩnh vực phát triển quá nhanh, cả hệ thống sẽ mất cân bằng. Phát triển bền vững cần nông nghiệp bền vững, các biện pháp hạn chế ô nhiễm (giáo dục, ngăn ngừa, khắc phục), sử dụng hợp lí tài nguyên theo từng nhóm (tái tạo, không tái tạo, khí hậu), chính sách dân số phù hợp và giáo dục môi trường.',
    'Sustainable development meets today’s needs without harming future generations’ ability to meet theirs, balancing the economy, society and the environment; if one grows too fast the whole system loses balance. It needs sustainable agriculture, measures against pollution (education, prevention, remedy), wise use of each kind of resource (renewable, non-renewable, climatic), a suitable population policy and environmental education.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu khái niệm và ví dụ như sách giáo khoa.',
      'The lesson gives the ideas and examples as the textbook does.',
    ),
  ],
  limits: [
    L('Bài không tính các chỉ số phát triển.', 'The lesson computes no development indicators.'),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH12', lesson: 34 },
    question: L(
      'Nếu kinh tế phát triển rất nhanh nhưng môi trường bị tàn phá, điều gì xảy ra với sự phát triển?',
      'If the economy grows very fast while the environment is destroyed, what happens to development?',
    ),
    choices: [
      {
        id: 'mat-can-bang',
        text: L(
          'Cả hệ thống mất cân bằng, không bền vững',
          'The whole system loses balance; it is not sustainable',
        ),
      },
      { id: 'tot', text: L('Càng phát triển tốt hơn', 'Development only improves') },
      { id: 'khong-anh-huong', text: L('Không ảnh hưởng gì', 'Nothing changes') },
      {
        id: 'tu-phuc-hoi',
        text: L('Môi trường luôn tự phục hồi', 'The environment always recovers by itself'),
      },
    ],
    answer: 'mat-can-bang',
    answerWhy: L(
      'Ba lĩnh vực kinh tế, xã hội, môi trường luôn tương tác và hỗ trợ nhau; nếu một lĩnh vực phát triển quá nhanh, cả hệ thống sẽ mất cân bằng và có thể sụp đổ.',
      'The economy, society and environment always interact; if one grows too fast the whole system loses balance and may collapse.',
    ),
    activities: [
      {
        kind: 'sort',
        id: 'tai-nguyen',
        prompt: L('Xếp mỗi tài nguyên vào nhóm của nó.', 'Put each resource in its group.'),
        groups: [
          { id: 'tai-tao', label: L('Tái tạo được', 'Renewable') },
          { id: 'khong-tai-tao', label: L('Không tái tạo', 'Non-renewable') },
          { id: 'khi-hau', label: L('Khí hậu (năng lượng vĩnh cửu)', 'Climatic (perpetual)') },
        ],
        items: [
          {
            id: 'sinh-vat',
            text: L('Sinh vật', 'Living things'),
            group: 'tai-tao',
            why: L('Có thể phục hồi nếu khai thác hợp lí.', 'They recover if used wisely.'),
          },
          {
            id: 'dat',
            text: L('Đất đai, nguồn nước', 'Land and water'),
            group: 'tai-tao',
            why: L('Có khả năng tái tạo.', 'They can renew.'),
          },
          {
            id: 'khoang-san',
            text: L('Khoáng sản, dầu mỏ', 'Minerals and oil'),
            group: 'khong-tai-tao',
            why: L('Cạn kiệt sau khi khai thác.', 'Used up once mined.'),
          },
          {
            id: 'mat-troi',
            text: L('Năng lượng mặt trời', 'Solar energy'),
            group: 'khi-hau',
            why: L('Gần như vô tận.', 'Almost endless.'),
          },
          {
            id: 'gio',
            text: L('Năng lượng gió', 'Wind energy'),
            group: 'khi-hau',
            why: L('Như các turbine gió ở Lâm Đồng.', 'Like the wind turbines in Lâm Đồng.'),
          },
        ],
      },
      {
        kind: 'match',
        id: 'o-nhiem',
        prompt: L(
          'Ghép mỗi nhóm biện pháp hạn chế ô nhiễm với ví dụ.',
          'Match each group of anti-pollution measures with an example.',
        ),
        pairs: [
          {
            id: 'giao-duc',
            left: L('Giáo dục và khuyến khích', 'Education and encouragement'),
            right: L(
              'Trao nhãn “xanh” cho doanh nghiệp sản xuất sạch',
              'Giving “green” labels to clean producers',
            ),
            why: L('Không bắt buộc, khuyến khích tự nguyện.', 'Voluntary, not compulsory.'),
          },
          {
            id: 'ngan-ngua',
            left: L('Ngăn ngừa', 'Prevention'),
            right: L(
              'Quy chuẩn nước thải, khí thải bắt buộc nhà máy phải đạt',
              'Compulsory standards for factory waste water and fumes',
            ),
            why: L('Dùng luật và quy định.', 'It uses laws and rules.'),
          },
          {
            id: 'khac-phuc',
            left: L('Khắc phục và nâng cao khả năng chịu đựng', 'Remedy and resilience'),
            right: L(
              'Trồng rừng ngập mặn, rừng phòng hộ ven biển',
              'Planting mangroves and coastal protective forests',
            ),
            why: L('Giảm tác hại của thiên tai.', 'It softens natural disasters.'),
          },
        ],
      },
    ],
  },
};
