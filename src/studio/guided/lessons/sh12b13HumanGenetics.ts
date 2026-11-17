import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH12 KNTT Bài 13 "Di truyền học người và di truyền y học" (printed pages 68–74), in SimLab's
 * own words. Checked against the pages on 17/11/2026: human genetics and its role (tr. 68), the
 * pedigree method and its symbols (Hình 13.1), the karyotype method (Hình 13.2), genetic
 * counselling and amniocentesis (Hình 13.3), gene therapy (tr. 73). SH12-GL-3.
 */
export const sh12b13HumanGenetics: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'biology',
  id: 'guided.sh12-human-genetics',
  topic: 'humanGenetics',
  title: L('Di truyền học người và di truyền y học', 'Human and medical genetics'),
  objectives: [
    L(
      'Dự đoán kiểu di truyền của một bệnh khi bố mẹ bình thường sinh con bị bệnh.',
      'Predict how a disease is inherited when unaffected parents have an affected child.',
    ),
    L(
      'Ghép mỗi phương pháp nghiên cứu di truyền người với điều nó cho biết.',
      'Match each method of studying human heredity with what it shows.',
    ),
    L(
      'Sắp xếp các bước của kĩ thuật chọc lấy dịch ối.',
      'Put the steps of amniocentesis in order.',
    ),
  ],
  hints: [
    L(
      'Nếu bố mẹ đều bình thường mà sinh con bị bệnh thì cả hai mang allele gây bệnh nhưng không biểu hiện.',
      'If both parents are unaffected but a child is affected, both carry the allele without showing it.',
    ),
    L(
      'Phả hệ là sơ đồ ghi lại sự di truyền của một tính trạng qua nhiều thế hệ trong một dòng họ.',
      'A pedigree records how a trait passes through generations of a family.',
    ),
  ],
  questions: [
    L(
      'Vì sao những người có quan hệ họ hàng gần không nên kết hôn với nhau?',
      'Why should close relatives not marry each other?',
    ),
  ],
  expectedConclusion: L(
    'Di truyền học người nghiên cứu sự di truyền và biến dị ở người; di truyền y học tìm hiểu cơ chế gây bệnh di truyền để phòng tránh và chữa trị. Phương pháp phả hệ cho biết một tính trạng di truyền trội hay lặn, do gene trên NST thường hay NST giới tính; phương pháp nghiên cứu NST phát hiện các đột biến NST. Y học tư vấn dựa trên các quy luật di truyền và các xét nghiệm (như chọc lấy dịch ối) để giúp các cặp vợ chồng quyết định phù hợp. Liệu pháp gene chữa bệnh di truyền bằng cách thay thế hoặc chỉnh sửa gene bệnh.',
    'Human genetics studies heredity and variation in humans; medical genetics studies how inherited diseases arise so they can be prevented and treated. The pedigree method shows whether a trait is dominant or recessive, on an autosome or a sex chromosome; the karyotype method finds chromosome mutations. Genetic counselling uses the laws of heredity and tests (such as amniocentesis) to help couples decide. Gene therapy treats inherited diseases by replacing or editing the faulty gene.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu các phương pháp và ví dụ như sách giáo khoa.',
      'The lesson gives the methods and examples as the textbook does.',
    ),
  ],
  limits: [
    L(
      'Xác suất sinh con mắc bệnh được tính trong các chủ đề về quy luật di truyền.',
      'Chances of an affected child are worked out in the topics on the laws of heredity.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH12', lesson: 13 },
    question: L(
      'Trong một phả hệ, bố mẹ đều bình thường sinh ra một con gái bị bệnh. Bệnh này do gene nào quy định?',
      'In a pedigree, two unaffected parents have an affected daughter. What kind of gene causes the disease?',
    ),
    choices: [
      {
        id: 'lan-nst-thuong',
        text: L('Gene lặn trên NST thường', 'A recessive gene on an autosome'),
      },
      { id: 'troi', text: L('Gene trội', 'A dominant gene') },
      { id: 'y', text: L('Gene trên NST Y', 'A gene on the Y chromosome') },
      { id: 'moi-truong', text: L('Không do gene', 'Not genetic at all') },
    ],
    answer: 'lan-nst-thuong',
    answerWhy: L(
      'Bố mẹ bình thường mà con bị bệnh nên bệnh do gene lặn. Con gái bị bệnh nhận allele lặn từ cả bố; nếu gene nằm trên X thì bố đã bị bệnh, nên gene nằm trên NST thường.',
      'Unaffected parents with an affected child means a recessive gene. The daughter got the allele from her father too; on X, he would have been affected, so the gene is on an autosome.',
    ),
    activities: [
      {
        kind: 'match',
        id: 'phuong-phap',
        prompt: L(
          'Ghép mỗi phương pháp với điều nó giúp phát hiện.',
          'Match each method with what it helps find.',
        ),
        pairs: [
          {
            id: 'pha-he',
            left: L('Nghiên cứu phả hệ', 'Pedigree study'),
            right: L(
              'Tính trạng trội hay lặn, gene trên NST thường hay NST giới tính',
              'Dominant or recessive, on an autosome or a sex chromosome',
            ),
            why: L('Theo dõi tính trạng qua nhiều thế hệ.', 'It follows a trait over generations.'),
          },
          {
            id: 'nst',
            left: L('Nghiên cứu NST người', 'Karyotype study'),
            right: L(
              'Đột biến số lượng, cấu trúc NST',
              'Changes in chromosome number or structure',
            ),
            why: L('So sánh với bộ NST đồ bình thường.', 'It compares with a normal karyotype.'),
          },
          {
            id: 'dich-oi',
            left: L('Chọc lấy dịch ối', 'Amniocentesis'),
            right: L(
              'Đột biến NST, bệnh rối loạn chuyển hóa ở thai nhi',
              'Chromosome and metabolic disorders of the fetus',
            ),
            why: L(
              'Phân tích tế bào thai nhi trong dịch ối.',
              'It analyses fetal cells in the fluid.',
            ),
          },
          {
            id: 'lieu-phap',
            left: L('Liệu pháp gene', 'Gene therapy'),
            right: L(
              'Thay thế hoặc chỉnh sửa gene bệnh trong tế bào người bệnh',
              'Replaces or edits the faulty gene in the patient’s cells',
            ),
            why: L('Là biện pháp chữa trị, không phải chẩn đoán.', 'A treatment, not a test.'),
          },
        ],
      },
      {
        kind: 'order',
        id: 'choc-oi',
        prompt: L('Sắp xếp các bước chọc lấy dịch ối.', 'Put the steps of amniocentesis in order.'),
        items: [
          {
            id: 'lay',
            text: L(
              'Lấy dịch ối dưới hướng dẫn của máy siêu âm',
              'Take amniotic fluid guided by ultrasound',
            ),
            why: L('Bước đầu tiên.', 'The first step.'),
          },
          {
            id: 'quay',
            text: L('Quay li tâm dịch ối', 'Spin the fluid in a centrifuge'),
            why: L('Tách tế bào khỏi dịch.', 'It separates the cells.'),
          },
          {
            id: 'nuoi',
            text: L('Nuôi cấy tế bào thai nhi', 'Culture the fetal cells'),
            why: L('Để có đủ tế bào phân tích.', 'To get enough cells.'),
          },
          {
            id: 'phan-tich',
            text: L('Phân tích NST, DNA và sinh hóa', 'Analyse chromosomes, DNA and biochemistry'),
            why: L('Phát hiện bệnh di truyền.', 'It finds inherited disorders.'),
          },
        ],
      },
    ],
  },
};
