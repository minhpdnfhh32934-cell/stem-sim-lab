import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * HH12 KNTT Bài 2 "Xà phòng và chất giặt rửa" (printed pages 14–17), in SimLab's own words.
 * Checked against the pages on 17/11/2026: soap and synthetic detergents, their hydrophilic head
 * and hydrophobic tail (Hình 2.1, 2.2), how they wash (Hình 2.3), making soap by saponification
 * and the experiment with saturated NaCl (tr. 16), detergents from petroleum, and why detergents
 * work in hard water while soap does not (tr. 17). HH12-GL-1.
 */
export const hh12b02Soap: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'chemistry',
  id: 'guided.hh12-soap',
  topic: 'soapDetergent',
  title: L('Xà phòng và chất giặt rửa', 'Soap and detergents'),
  objectives: [
    L(
      'Dự đoán vì sao chất giặt rửa tổng hợp được dùng phổ biến khi giặt bằng nước cứng.',
      'Predict why synthetic detergents are widely used with hard water.',
    ),
    L(
      'Phân loại đặc điểm của xà phòng và chất giặt rửa tổng hợp; ghép mỗi phần cấu tạo với vai trò của nó.',
      'Sort the features of soap and of synthetic detergents; match each part of their structure with its role.',
    ),
    L(
      'Sắp xếp các bước làm sạch vết bẩn dầu mỡ.',
      'Order the steps of cleaning off a greasy stain.',
    ),
  ],
  hints: [
    L(
      'Phần ưa nước tan trong nước, phần kị nước tan trong dầu mỡ.',
      'The water-loving part dissolves in water, the water-fearing part in grease.',
    ),
    L(
      'Nước cứng chứa nhiều ion calcium và magnesium.',
      'Hard water holds many calcium and magnesium ions.',
    ),
  ],
  questions: [
    L(
      'Trong thí nghiệm xà phòng hóa chất béo, vì sao phải khuấy liên tục hỗn hợp phản ứng?',
      'In the saponification experiment, why must the mixture be stirred all the time?',
    ),
  ],
  expectedConclusion: L(
    'Xà phòng là hỗn hợp muối sodium hoặc potassium của các acid béo, được sản xuất bằng cách đun chất béo với dung dịch kiềm đặc (phản ứng xà phòng hóa) hoặc từ dầu mỏ. Chất giặt rửa tổng hợp không phải muối của acid béo, thường là muối sodium alkylsulfate hoặc alkylbenzene sulfonate làm từ dầu mỏ. Cả hai đều có đầu ưa nước và đuôi kị nước: đuôi kị nước thâm nhập vào vết bẩn, chia nó thành hạt nhỏ có đầu ưa nước quay ra ngoài, các hạt này phân tán vào nước và bị rửa trôi. Chất giặt rửa tổng hợp dùng được với nước cứng và trong môi trường acid, còn xà phòng thì kém tác dụng; nhưng chất giặt rửa tổng hợp khó bị phân hủy sinh học hơn.',
    'Soap is a mixture of the sodium or potassium salts of fatty acids, made by heating fat with concentrated alkali (saponification) or from petroleum. Synthetic detergents are not fatty acid salts; they are usually sodium alkyl sulfates or alkylbenzene sulfonates made from petroleum. Both have a water-loving head and a water-fearing tail: the tail works into the grease and breaks it into tiny droplets with the heads facing out, which spread through the water and are rinsed away. Detergents work in hard water and in acid, where soap does poorly, but they are harder to break down biologically.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu các khái niệm và thí nghiệm như sách giáo khoa; khối lượng xà phòng thu được từ chất béo được tính trong bài “Ester và chất béo”.',
      'The lesson gives only the ideas and the experiment, as the textbook does; the mass of soap from a fat is computed in “Esters and fats”.',
    ),
  ],
  limits: [
    L(
      'Bài không tính độ cứng của nước hay lượng chất giặt rửa cần dùng.',
      'The lesson does not compute water hardness or how much detergent to use.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'HH12', lesson: 2 },
    question: L(
      'Khi giặt quần áo bằng nước cứng, người ta thường dùng chất giặt rửa tổng hợp thay cho xà phòng. Lí do chính là gì?',
      'When washing in hard water, people usually use a synthetic detergent instead of soap. What is the main reason?',
    ),
    choices: [
      {
        id: 'nuoc-cung',
        text: L('Xà phòng kém tác dụng trong nước cứng', 'Soap works poorly in hard water'),
      },
      {
        id: 'khong-duoi',
        text: L(
          'Chất giặt rửa tổng hợp không có đuôi kị nước',
          'Detergents have no water-fearing tail',
        ),
      },
      {
        id: 'khong-tan',
        text: L('Xà phòng không tan trong nước', 'Soap does not dissolve in water'),
      },
      {
        id: 'acid-beo',
        text: L('Chất giặt rửa tổng hợp là muối của acid béo', 'Detergents are fatty acid salts'),
      },
    ],
    answer: 'nuoc-cung',
    answerWhy: L(
      'Sách nêu chất giặt rửa tổng hợp dễ hòa tan trong nước hơn xà phòng và có thể dùng với nước cứng, môi trường acid, ngược lại xà phòng kém tác dụng trong các môi trường này.',
      'The book says detergents dissolve more easily than soap and work with hard water and in acid, where soap works poorly.',
    ),
    activities: [
      {
        kind: 'sort',
        id: 'loai',
        prompt: L(
          'Xếp mỗi đặc điểm vào xà phòng hoặc chất giặt rửa tổng hợp.',
          'Put each feature under soap or synthetic detergent.',
        ),
        groups: [
          { id: 'xa-phong', label: L('Xà phòng', 'Soap') },
          { id: 'tong-hop', label: L('Chất giặt rửa tổng hợp', 'Synthetic detergent') },
        ],
        items: [
          {
            id: 'muoi-acid-beo',
            text: L(
              'Muối sodium hoặc potassium của acid béo',
              'Sodium or potassium salts of fatty acids',
            ),
            group: 'xa-phong',
            why: L('Đây là định nghĩa xà phòng.', 'That is what soap is.'),
          },
          {
            id: 'xa-phong-hoa',
            text: L(
              'Sản xuất bằng cách đun chất béo với dung dịch kiềm đặc',
              'Made by heating fat with concentrated alkali',
            ),
            group: 'xa-phong',
            why: L('Phản ứng xà phòng hóa.', 'Saponification.'),
          },
          {
            id: 'sulfate',
            text: L(
              'Thường là muối sodium alkylsulfate hoặc alkylbenzene sulfonate',
              'Usually sodium alkyl sulfates or alkylbenzene sulfonates',
            ),
            group: 'tong-hop',
            why: L('Không phải muối của acid béo.', 'Not fatty acid salts.'),
          },
          {
            id: 'dau-mo',
            text: L(
              'Sản xuất từ dầu mỏ qua sulfonic acid hoặc hydrogen sulfate',
              'Made from petroleum via sulfonic acids or hydrogen sulfates',
            ),
            group: 'tong-hop',
            why: L('Sơ đồ sản xuất ở cuối trang sách.', 'The production scheme in the book.'),
          },
          {
            id: 'nuoc-cung',
            text: L('Dùng tốt với nước cứng', 'Works well in hard water'),
            group: 'tong-hop',
            why: L(
              'Xà phòng thì kém tác dụng trong nước cứng.',
              'Soap works poorly in hard water.',
            ),
          },
          {
            id: 'phan-huy',
            text: L('Khó bị phân hủy sinh học', 'Hard to break down biologically'),
            group: 'tong-hop',
            why: L(
              'Nhược điểm sách nêu: kém thân thiện với môi trường.',
              'A drawback the book names: less friendly to the environment.',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'cau-tao',
        prompt: L(
          'Ghép mỗi phần hay chất với vai trò của nó.',
          'Match each part or substance with its role.',
        ),
        pairs: [
          {
            id: 'dau',
            left: L('Đầu ưa nước', 'Water-loving head'),
            right: L(
              'Nhóm carboxylate, sulfate hoặc sulfonate, tan được trong nước',
              'A carboxylate, sulfate or sulfonate group that dissolves in water',
            ),
            why: L('Phần phân cực.', 'The polar part.'),
          },
          {
            id: 'duoi',
            left: L('Đuôi kị nước', 'Water-fearing tail'),
            right: L(
              'Gốc hydrocarbon mạch dài, không tan trong nước',
              'A long hydrocarbon chain that does not dissolve in water',
            ),
            why: L(
              'Phần không phân cực, thâm nhập vào dầu mỡ.',
              'The non-polar part that enters grease.',
            ),
          },
          {
            id: 'nacl',
            left: L('Dung dịch NaCl bão hòa', 'Saturated NaCl solution'),
            right: L(
              'Làm xà phòng tách ra và nổi lên trên khi để nguội',
              'Makes the soap separate and float as it cools',
            ),
            why: L(
              'Bước cuối của thí nghiệm xà phòng hóa.',
              'The last step of the saponification experiment.',
            ),
          },
        ],
      },
      {
        kind: 'order',
        id: 'tay-ban',
        prompt: L(
          'Sắp xếp các bước làm sạch vết bẩn dầu mỡ theo đúng thứ tự.',
          'Put the steps of cleaning a greasy stain in order.',
        ),
        items: [
          {
            id: 'bam',
            text: L('Vết bẩn dầu mỡ bám trên vật liệu', 'A greasy stain sticks to the fabric'),
            why: L('Dầu mỡ không tan trong nước.', 'Grease does not dissolve in water.'),
          },
          {
            id: 'tham-nhap',
            text: L('Đuôi kị nước thâm nhập vào vết bẩn', 'The tails work into the grease'),
            why: L('Đuôi kị nước tan trong dầu mỡ.', 'The tails dissolve in grease.'),
          },
          {
            id: 'chia-nho',
            text: L(
              'Vết bẩn bị chia thành hạt nhỏ, đầu ưa nước quay ra ngoài',
              'The grease breaks into droplets with the heads facing out',
            ),
            why: L('Các đầu ưa nước hướng vào nước.', 'The heads turn towards the water.'),
          },
          {
            id: 'rua-troi',
            text: L(
              'Các hạt nhỏ phân tán vào nước và bị rửa trôi',
              'The droplets spread through the water and are rinsed off',
            ),
            why: L('Vật liệu sạch vết bẩn.', 'The fabric is clean.'),
          },
        ],
      },
    ],
  },
};
