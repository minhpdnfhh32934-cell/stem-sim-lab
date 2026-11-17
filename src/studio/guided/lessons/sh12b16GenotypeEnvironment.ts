import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH12 KNTT Bài 16 "Tương tác giữa kiểu gene với môi trường và thành tựu chọn giống" (printed
 * pages 83–87), in SimLab's own words. Checked against the pages on 17/11/2026: genotype and
 * environment together make the phenotype, Hibiscus mutabilis (Hình 16.1), the reaction norm and
 * phenylketonuria (tr. 84), breeding steps and achievements — Đông Tảo chicken, Landrace pig,
 * Blanc-Bleu-Belge cattle, ST25 rice (tr. 85–86), the Himalayan rabbit question (tr. 87).
 * SH12-GL-5.
 */
export const sh12b16GenotypeEnvironment: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'biology',
  id: 'guided.sh12-genotype-environment',
  topic: 'genotypeEnvironment',
  title: L(
    'Tương tác giữa kiểu gene với môi trường và thành tựu chọn giống',
    'Genotype, environment and breeding',
  ),
  objectives: [
    L(
      'Dự đoán kiểu hình của các cây cùng kiểu gene trồng trong các điều kiện khác nhau.',
      'Predict the phenotypes of plants with one genotype grown in different conditions.',
    ),
    L(
      'Ghép mỗi khái niệm với ví dụ của nó; sắp xếp các bước tạo giống.',
      'Match each idea with its example; put the breeding steps in order.',
    ),
    L(
      'Phân loại các thành tựu chọn giống vật nuôi và cây trồng.',
      'Sort the achievements of animal and plant breeding.',
    ),
  ],
  hints: [
    L(
      'Kiểu gene chỉ cung cấp thông tin; sản phẩm nhiều hay ít còn phụ thuộc điều kiện môi trường.',
      'The genotype only gives instructions; how much is made also depends on the environment.',
    ),
    L(
      'Tập hợp các kiểu hình của cùng một kiểu gene là mức phản ứng của kiểu gene đó.',
      'The set of phenotypes of one genotype is its reaction norm.',
    ),
  ],
  questions: [
    L(
      'Năng lực học tập của mỗi người là do gene hay do môi trường quyết định?',
      'Is a person’s ability to learn set by genes or by the environment?',
    ),
  ],
  expectedConclusion: L(
    'Kiểu gene tương tác với môi trường tạo ra kiểu hình. Cùng một kiểu gene, ở môi trường khác nhau có thể cho ra các kiểu hình khác nhau; tập hợp các kiểu hình đó là mức phản ứng của kiểu gene. Sự di truyền của tính trạng là di truyền mức phản ứng, không phải di truyền trực tiếp tính trạng. Hiểu mức phản ứng giúp chọn, tạo giống thích nghi với từng môi trường và xác định điều kiện canh tác phù hợp; nhiều giống vật nuôi, cây trồng năng suất cao đã được tạo ra bằng lai tạo kết hợp chọn lọc.',
    'Genotype and environment together make the phenotype. One genotype can give different phenotypes in different environments; that set is the genotype’s reaction norm. What is inherited is the reaction norm, not the trait itself. Knowing reaction norms helps breed varieties for each environment and choose the right growing conditions; many high-yield breeds and crops have come from crossing combined with selection.',
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
      'Bài không mô tả số liệu năng suất cụ thể của các giống.',
      'The lesson gives no yield figures for the varieties.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH12', lesson: 16 },
    question: L(
      'Các cành cắt từ một cây được đem trồng trong những điều kiện khác nhau. Chiều cao các cây con sẽ thế nào?',
      'Cuttings from one plant are grown in different conditions. How tall will the new plants be?',
    ),
    choices: [
      { id: 'khac', text: L('Khác nhau', 'Different heights') },
      {
        id: 'giong',
        text: L('Giống hệt nhau vì cùng kiểu gene', 'The same, since the genotype is the same'),
      },
      { id: 'khong-lon', text: L('Không cây nào lớn lên được', 'None of them grow') },
      {
        id: 'ngau-nhien',
        text: L(
          'Hoàn toàn ngẫu nhiên, không liên quan đến môi trường',
          'Random, unrelated to conditions',
        ),
      },
    ],
    answer: 'khac',
    answerWhy: L(
      'Các cây có cùng kiểu gene nhưng điều kiện môi trường khác nhau nên phát triển thành các cây có chiều cao khác nhau: đó là mức phản ứng của kiểu gene.',
      'The plants share a genotype but grow in different conditions, so they reach different heights: the genotype’s reaction norm.',
    ),
    activities: [
      {
        kind: 'match',
        id: 'khai-niem',
        prompt: L(
          'Ghép mỗi khái niệm với ví dụ sách nêu.',
          'Match each idea with the book’s example.',
        ),
        pairs: [
          {
            id: 'thuong-bien',
            left: L('Môi trường làm đổi kiểu hình', 'Environment changes the phenotype'),
            right: L(
              'Hoa phù dung trắng buổi sáng, chuyển hồng buổi chiều',
              'Hibiscus flowers white in the morning, pink by afternoon',
            ),
            why: L('Cùng một cây, cùng kiểu gene.', 'One plant, one genotype.'),
          },
          {
            id: 'muc-phan-ung',
            left: L('Mức phản ứng', 'Reaction norm'),
            right: L(
              'Trẻ đồng sinh cùng trứng nuôi ở điều kiện khác nhau có chiều cao, cân nặng khác nhau',
              'Identical twins raised apart differ in height and weight',
            ),
            why: L('Cùng kiểu gene, môi trường khác.', 'Same genotype, different environment.'),
          },
          {
            id: 'y-hoc',
            left: L('Vận dụng trong y học', 'Use in medicine'),
            right: L(
              'Trẻ mắc phenylketonuria ăn kiêng phenylalanine để giảm triệu chứng',
              'A child with phenylketonuria eats little phenylalanine to ease symptoms',
            ),
            why: L(
              'Điều chỉnh môi trường để giảm biểu hiện bệnh.',
              'Changing the environment eases the disease.',
            ),
          },
        ],
      },
      {
        kind: 'order',
        id: 'tao-giong',
        prompt: L('Sắp xếp các bước tạo giống.', 'Put the breeding steps in order.'),
        items: [
          {
            id: 'dong-thuan',
            text: L('Tạo các dòng thuần chủng khác nhau', 'Make different pure lines'),
            why: L('Bước đầu tiên.', 'The first step.'),
          },
          {
            id: 'lai',
            text: L(
              'Lai các dòng với nhau để tìm tổ hợp có đặc tính mong muốn',
              'Cross the lines to find a combination with the wanted traits',
            ),
            why: L('Tạo tổ hợp gene mới.', 'New gene combinations appear.'),
          },
          {
            id: 'nhan-giong',
            text: L(
              'Nhân giống và chọn lọc ra giống thuần chủng',
              'Multiply and select a true-breeding variety',
            ),
            why: L('Ổn định đặc điểm mong muốn.', 'The wanted traits are fixed.'),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'thanh-tuu',
        prompt: L('Xếp mỗi thành tựu vào nhóm của nó.', 'Put each achievement in its group.'),
        groups: [
          { id: 'vat-nuoi', label: L('Vật nuôi', 'Livestock') },
          { id: 'cay-trong', label: L('Cây trồng', 'Crops') },
        ],
        items: [
          {
            id: 'dong-tao',
            text: L('Gà Đông Tảo', 'Đông Tảo chicken'),
            group: 'vat-nuoi',
            why: L('Giống quốc gia của Hưng Yên.', 'A national breed from Hưng Yên.'),
          },
          {
            id: 'landrace',
            text: L('Lợn siêu nạc Landrace', 'Landrace lean pig'),
            group: 'vat-nuoi',
            why: L('Lai tạo ở Đan Mạch.', 'Bred in Denmark.'),
          },
          {
            id: 'bbb',
            text: L('Bò cao sản Blanc-Bleu-Belge', 'Blanc-Bleu-Belge beef cattle'),
            group: 'vat-nuoi',
            why: L('Tăng trưởng cơ bắp cao.', 'Fast muscle growth.'),
          },
          {
            id: 'lua-st',
            text: L('Các giống lúa ST', 'The ST rice varieties'),
            group: 'cay-trong',
            why: L(
              'Có giống được công nhận là gạo ngon nhất thế giới.',
              'One was named the world’s best rice.',
            ),
          },
          {
            id: 'nhan',
            text: L('Nhãn lồng Hưng Yên', 'Hưng Yên longan'),
            group: 'cay-trong',
            why: L('Cây ăn quả nổi tiếng.', 'A well-known fruit tree.'),
          },
        ],
      },
    ],
  },
};
