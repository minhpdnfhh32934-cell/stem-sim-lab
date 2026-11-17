import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH12 KNTT Bài 28 "Hệ sinh thái" (printed pages 152–154), in SimLab's own words. Checked against
 * the pages on 17/11/2026: the ecosystem as community plus habitat (Hình 28.1), natural ecosystems
 * on land and in water (Hình 28.2), artificial ecosystems and their features (Hình 28.3, tr. 154).
 * SH12-GL-9.
 */
export const sh12b28Ecosystem: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'biology',
  id: 'guided.sh12-ecosystem',
  topic: 'ecosystem',
  title: L('Hệ sinh thái', 'Ecosystems'),
  objectives: [
    L(
      'Dự đoán hệ sinh thái nào ổn định hơn: tự nhiên hay nhân tạo.',
      'Predict which is more stable: a natural or an artificial ecosystem.',
    ),
    L(
      'Xếp mỗi thành phần vào quần xã sinh vật hoặc sinh cảnh.',
      'Put each part under the community or the habitat.',
    ),
    L(
      'Phân loại các hệ sinh thái tự nhiên và nhân tạo.',
      'Sort natural and artificial ecosystems.',
    ),
  ],
  hints: [
    L(
      'Hệ sinh thái tự nhiên có nhiều loài, các thành phần tự điều chỉnh theo quy luật tự nhiên.',
      'A natural ecosystem has many species that regulate one another.',
    ),
    L(
      'Hệ sinh thái nhân tạo do con người tạo ra và duy trì.',
      'An artificial ecosystem is made and kept by people.',
    ),
  ],
  questions: [
    L(
      'Con người kiểm soát thành phần loài trong một ruộng lúa như thế nào và để làm gì?',
      'How do people control the species in a rice field, and why?',
    ),
  ],
  expectedConclusion: L(
    'Hệ sinh thái là một cấp độ tổ chức sống gồm quần xã sinh vật và sinh cảnh, trong đó các thành phần tác động qua lại và gắn bó với nhau như một thể thống nhất tương đối ổn định. Quần xã gồm sinh vật sản xuất, sinh vật tiêu thụ và sinh vật phân giải; sinh cảnh gồm khí hậu, các chất vô cơ và chất hữu cơ. Hệ sinh thái tự nhiên (trên cạn, dưới nước) có nhiều loài, tính ổn định cao và tự điều chỉnh; hệ sinh thái nhân tạo ít loài, tính ổn định thấp và được duy trì nhờ tác động của con người.',
    'An ecosystem is a level of life made of a community and its habitat, whose parts act on one another as a fairly stable whole. The community has producers, consumers and decomposers; the habitat has climate, inorganic and organic matter. Natural ecosystems (on land, in water) have many species, are stable and self-regulating; artificial ones have few species, are less stable and are kept up by people.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu khái niệm và ví dụ như sách giáo khoa.',
      'The lesson gives the ideas and examples as the textbook does.',
    ),
  ],
  limits: [
    L(
      'Dòng năng lượng và tháp sinh thái được tính trong chủ đề “Trao đổi vật chất và chuyển hóa năng lượng trong hệ sinh thái”.',
      'Energy flow and pyramids are worked out in the topic on matter and energy in ecosystems.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH12', lesson: 28 },
    question: L(
      'So với một ruộng lúa, một khu rừng mưa nhiệt đới có tính ổn định thế nào?',
      'Compared with a rice field, how stable is a tropical rainforest?',
    ),
    choices: [
      { id: 'cao', text: L('Ổn định cao hơn', 'More stable') },
      { id: 'thap', text: L('Ổn định thấp hơn', 'Less stable') },
      { id: 'bang', text: L('Như nhau', 'Equally stable') },
      { id: 'khong', text: L('Không ổn định chút nào', 'Not stable at all') },
    ],
    answer: 'cao',
    answerWhy: L(
      'Rừng là hệ sinh thái tự nhiên có nhiều loài, các thành phần tương tác chặt chẽ và tự điều chỉnh; ruộng lúa là hệ sinh thái nhân tạo ít loài, phụ thuộc vào tác động của con người.',
      'The forest is a natural ecosystem with many interacting, self-regulating species; the rice field is artificial, with few species, and depends on people.',
    ),
    activities: [
      {
        kind: 'sort',
        id: 'thanh-phan',
        prompt: L(
          'Xếp mỗi thành phần vào quần xã sinh vật hoặc sinh cảnh.',
          'Put each part under the community or the habitat.',
        ),
        groups: [
          { id: 'quan-xa', label: L('Quần xã sinh vật', 'Community') },
          { id: 'sinh-canh', label: L('Sinh cảnh', 'Habitat') },
        ],
        items: [
          {
            id: 'san-xuat',
            text: L('Sinh vật sản xuất', 'Producers'),
            group: 'quan-xa',
            why: L('Cây xanh, tảo.', 'Green plants, algae.'),
          },
          {
            id: 'tieu-thu',
            text: L('Sinh vật tiêu thụ', 'Consumers'),
            group: 'quan-xa',
            why: L('Động vật ăn thực vật, ăn thịt.', 'Herbivores and carnivores.'),
          },
          {
            id: 'phan-giai',
            text: L('Sinh vật phân giải', 'Decomposers'),
            group: 'quan-xa',
            why: L('Vi khuẩn, nấm.', 'Bacteria, fungi.'),
          },
          {
            id: 'khi-hau',
            text: L(
              'Khí hậu: ánh sáng, nhiệt độ, lượng mưa, gió',
              'Climate: light, temperature, rain, wind',
            ),
            group: 'sinh-canh',
            why: L('Nhân tố vô sinh.', 'Non-living factors.'),
          },
          {
            id: 'vo-co',
            text: L('Các chất vô cơ như nước, CO₂', 'Inorganic matter such as water, CO₂'),
            group: 'sinh-canh',
            why: L('Nhân tố vô sinh.', 'Non-living factors.'),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'kieu',
        prompt: L('Xếp mỗi hệ sinh thái vào kiểu của nó.', 'Put each ecosystem under its kind.'),
        groups: [
          { id: 'tu-nhien', label: L('Tự nhiên', 'Natural') },
          { id: 'nhan-tao', label: L('Nhân tạo', 'Artificial') },
        ],
        items: [
          {
            id: 'rung',
            text: L('Rừng nhiệt đới', 'Tropical forest'),
            group: 'tu-nhien',
            why: L('Hệ sinh thái trên cạn.', 'On land.'),
          },
          {
            id: 'san-ho',
            text: L('Rạn san hô ven biển', 'Coastal coral reef'),
            group: 'tu-nhien',
            why: L('Hệ sinh thái dưới nước.', 'In water.'),
          },
          {
            id: 'ruong',
            text: L('Ruộng lúa', 'Rice field'),
            group: 'nhan-tao',
            why: L('Do con người tạo ra.', 'Made by people.'),
          },
          {
            id: 'thanh-pho',
            text: L('Thành phố', 'City'),
            group: 'nhan-tao',
            why: L('Do con người tạo ra.', 'Made by people.'),
          },
          {
            id: 'ao-ca',
            text: L('Ao nuôi cá', 'Fish pond'),
            group: 'nhan-tao',
            why: L('Do con người tạo ra.', 'Made by people.'),
          },
        ],
      },
    ],
  },
};
