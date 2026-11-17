import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH12 KNTT Bài 15 "Di truyền gene ngoài nhân" (printed pages 78–82), in SimLab's own words.
 * Checked against the pages on 17/11/2026: Correns' crosses of Mirabilis jalapa (Bảng 15.1), the
 * explanation by chloroplast genes and random sharing of plastids (Hình 15.2), the features of
 * extranuclear inheritance (tr. 80), mitochondrial replacement against Leigh syndrome (Hình 15.3),
 * cytoplasmic male sterility in rice and mitochondrial DNA in evolution and forensics (tr. 81).
 * SH12-GL-4.
 */
export const sh12b15Extranuclear: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'biology',
  id: 'guided.sh12-extranuclear',
  topic: 'extranuclearInheritance',
  title: L('Di truyền gene ngoài nhân', 'Extranuclear inheritance'),
  objectives: [
    L(
      'Dự đoán màu lá đời con khi lấy hạt phấn cây lá xanh thụ phấn cho cây lá trắng.',
      'Predict the leaf colour of the offspring when a green plant’s pollen fertilises a white plant.',
    ),
    L(
      'Ghép mỗi phép lai của Correns với kết quả của nó.',
      'Match each of Correns’ crosses with its result.',
    ),
    L(
      'Phân loại ứng dụng của di truyền gene ngoài nhân.',
      'Sort the uses of extranuclear inheritance.',
    ),
  ],
  hints: [
    L(
      'Hợp tử nhận tế bào chất chủ yếu từ trứng của mẹ, rất ít từ tinh trùng của bố.',
      'The zygote gets its cytoplasm mostly from the mother’s egg, hardly any from the sperm.',
    ),
    L(
      'Gene trong lục lạp, ti thể nằm ở tế bào chất.',
      'Genes in chloroplasts and mitochondria lie in the cytoplasm.',
    ),
  ],
  questions: [
    L(
      'Vì sao DNA ti thể được dùng để xác định danh tính hài cốt bị hủy hoại nghiêm trọng?',
      'Why is mitochondrial DNA used to identify badly damaged remains?',
    ),
  ],
  expectedConclusion: L(
    'Tính trạng không chỉ do gene trong nhân mà còn do gene trong tế bào chất (lục lạp, ti thể) quy định. Gene ngoài nhân được truyền từ mẹ cho con qua tế bào chất của trứng, nên tính trạng di truyền theo dòng mẹ và kết quả phép lai thuận nghịch khác nhau; các con của cùng một mẹ có thể nhận số lượng bào quan mang allele khác nhau nên có kiểu hình khác nhau. Di truyền gene ngoài nhân được ứng dụng trong y học (loại trừ gene bệnh ở ti thể), nông nghiệp (dòng lúa bất dục đực tế bào chất) và nghiên cứu tiến hóa, pháp y.',
    'Traits are set not only by nuclear genes but also by genes in the cytoplasm (chloroplasts, mitochondria). These pass from mother to child in the egg’s cytoplasm, so the trait follows the mother and reciprocal crosses differ; children of one mother can get different numbers of organelles with each allele and so differ. Extranuclear inheritance is used in medicine (removing faulty mitochondrial genes), agriculture (cytoplasmic male-sterile rice) and in evolution research and forensics.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu thí nghiệm và giải thích như sách giáo khoa.',
      'The lesson gives the experiment and its explanation as the textbook does.',
    ),
  ],
  limits: [
    L(
      'Bài không tính tỉ lệ kiểu hình của cây lá khảm vì sự phân chia lục lạp là ngẫu nhiên.',
      'The lesson gives no ratio for variegated plants, since plastids are shared at random.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH12', lesson: 15 },
    question: L(
      'Correns lấy hạt phấn của cây hoa bốn giờ lá xanh thụ phấn cho hoa của cây lá trắng. Đời con có lá màu gì?',
      'Correns put pollen from a green-leaved four-o’clock onto a white-leaved plant. What colour are the offspring’s leaves?',
    ),
    choices: [
      { id: 'trang', text: L('Lá trắng', 'White') },
      { id: 'xanh', text: L('Lá xanh', 'Green') },
      { id: 'kham', text: L('Lá khảm', 'Variegated') },
      { id: 'ca-hai', text: L('Một nửa xanh, một nửa trắng', 'Half green, half white') },
    ],
    answer: 'trang',
    answerWhy: L(
      'Màu lá đời con hoàn toàn phụ thuộc vào màu lá của cây mẹ (cây lá trắng), không chịu ảnh hưởng của cây bố: gene quy định màu lá nằm trong lục lạp, truyền qua tế bào chất của trứng.',
      'The offspring’s leaf colour depends only on the mother (the white plant), not the father: the gene is in the chloroplasts, passed on in the egg’s cytoplasm.',
    ),
    activities: [
      {
        kind: 'match',
        id: 'correns',
        prompt: L(
          'Ghép mỗi phép lai (bố × mẹ) của Correns với màu lá đời con.',
          'Match each of Correns’ crosses (father × mother) with the offspring.',
        ),
        pairs: [
          {
            id: 'trang-xanh',
            left: L('Bố lá trắng × mẹ lá xanh', 'White father × green mother'),
            right: L('Lá xanh', 'Green'),
            why: L('Giống mẹ.', 'Like the mother.'),
          },
          {
            id: 'xanh-trang',
            left: L('Bố lá xanh × mẹ lá trắng', 'Green father × white mother'),
            right: L('Lá trắng', 'White'),
            why: L('Giống mẹ.', 'Like the mother.'),
          },
          {
            id: 'trang-kham',
            left: L('Bố lá trắng × mẹ lá khảm', 'White father × variegated mother'),
            right: L('Lá khảm, lá xanh, lá trắng', 'Variegated, green and white'),
            why: L(
              'Lục lạp của mẹ được chia ngẫu nhiên cho các tế bào con.',
              'The mother’s plastids are shared at random.',
            ),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'ung-dung',
        prompt: L('Xếp mỗi ứng dụng vào lĩnh vực của nó.', 'Put each use under its field.'),
        groups: [
          { id: 'y-hoc', label: L('Y học', 'Medicine') },
          { id: 'nong-nghiep', label: L('Nông nghiệp', 'Agriculture') },
          { id: 'tien-hoa', label: L('Tiến hóa, pháp y', 'Evolution, forensics') },
        ],
        items: [
          {
            id: 'leigh',
            text: L(
              'Loại trừ gene gây bệnh trong ti thể ở đời con',
              'Removing a faulty mitochondrial gene from a child',
            ),
            group: 'y-hoc',
            why: L('Như trường hợp hội chứng Leigh.', 'As with Leigh syndrome.'),
          },
          {
            id: 'bat-duc',
            text: L(
              'Dòng lúa bất dục đực để lai tạo giống',
              'Male-sterile rice lines for breeding',
            ),
            group: 'nong-nghiep',
            why: L('Không phải khử bao phấn bằng tay.', 'No need to remove anthers by hand.'),
          },
          {
            id: 'nguon-goc',
            text: L('Truy tìm nguồn gốc loài người', 'Tracing the origin of humans'),
            group: 'tien-hoa',
            why: L('So sánh DNA ti thể của các chủng tộc.', 'By comparing mitochondrial DNA.'),
          },
          {
            id: 'hai-cot',
            text: L('Xác định danh tính hài cốt', 'Identifying remains'),
            group: 'tien-hoa',
            why: L(
              'Ti thể có nhiều bản sao và di truyền theo dòng mẹ.',
              'Many copies, passed down the mother’s line.',
            ),
          },
        ],
      },
    ],
  },
};
