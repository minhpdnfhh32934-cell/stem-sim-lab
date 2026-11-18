import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * HH12 KNTT Bài 10 "Protein và enzyme" (printed pages 46–48), in SimLab's own words. Checked
 * against the pages on 17/11/2026: proteins as one or more polypeptide chains (insulin, Hình 10.1),
 * simple and complex proteins, fibrous and globular proteins (tr. 47), hydrolysis, the biuret and
 * nitric acid colours, coagulation by heat, acid, base or heavy-metal ions (experiment, tr. 47),
 * the roles of proteins, enzymes as selective catalysts and their uses (tr. 48). HH12-GL-5.
 */
export const hh12b10Protein: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'chemistry',
  id: 'guided.hh12-protein',
  topic: 'proteinEnzyme',
  title: L('Protein và enzyme', 'Proteins and enzymes'),
  objectives: [
    L(
      'Dự đoán điều xảy ra khi đun nóng lòng trắng trứng.',
      'Predict what happens when egg white is heated.',
    ),
    L(
      'Ghép mỗi thí nghiệm với protein với hiện tượng của nó; phân biệt protein dạng sợi và dạng cầu.',
      'Match each protein experiment with what is seen; tell fibrous from globular proteins.',
    ),
    L('Nêu vai trò của protein và enzyme.', 'State the roles of proteins and enzymes.'),
  ],
  hints: [
    L(
      'Nhiệt, acid, base hay ion kim loại nặng làm cấu tạo ban đầu của protein bị biến đổi.',
      'Heat, acid, base or heavy-metal ions change a protein’s original structure.',
    ),
    L(
      'Protein có nhiều liên kết peptide nên cho phản ứng màu biuret như peptide.',
      'Proteins have many peptide bonds, so they give the biuret colour like peptides.',
    ),
  ],
  questions: [
    L(
      'Vì sao khi nấu canh cua, phần protein trong nước cua lại đóng thành mảng nổi lên?',
      'Why does the protein in crab soup set into floating curds while it cooks?',
    ),
  ],
  expectedConclusion: L(
    'Protein là hợp chất cao phân tử tạo từ một hay nhiều chuỗi polypeptide. Protein dạng sợi như keratin, collagen, myosin không tan trong nước; protein dạng cầu như hemoglobin, albumin tan trong nước tạo dung dịch keo. Protein bị thủy phân bởi acid, base hoặc enzyme, thủy phân hoàn toàn tạo các α-amino acid; tạo màu tím với thuốc thử biuret và chất rắn màu vàng với nitric acid đặc; bị đông tụ dưới tác dụng của nhiệt, acid, base hoặc ion kim loại nặng. Phần lớn enzyme là protein xúc tác cho các phản ứng hóa học và sinh hóa với tính chọn lọc cao, được ứng dụng rộng rãi trong công nghệ sinh học.',
    'Proteins are macromolecules of one or more polypeptide chains. Fibrous proteins such as keratin, collagen and myosin do not dissolve in water; globular ones such as haemoglobin and albumin dissolve to colloidal solutions. Proteins are hydrolysed by acid, base or enzymes, fully to α-amino acids; they turn violet with biuret reagent and give a yellow solid with concentrated nitric acid; heat, acid, base or heavy-metal ions coagulate them. Most enzymes are proteins that catalyse chemical and biochemical reactions very selectively and are widely used in biotechnology.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu cấu tạo, thí nghiệm và vai trò như sách giáo khoa; SimLab không tính lượng chất ở đây.',
      'The lesson gives only structure, experiments and roles, as the textbook does; SimLab computes no amounts here.',
    ),
  ],
  limits: [
    L(
      'Peptide, liên kết peptide và phản ứng màu biuret được tính trong bài “Amino acid và peptide”.',
      'Peptides, peptide bonds and the biuret test are worked out in “Amino acids and peptides”.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'HH12', lesson: 10 },
    question: L(
      'Đun nóng một ống nghiệm chứa dung dịch lòng trắng trứng trên ngọn lửa đèn cồn trong vài phút. Hiện tượng nào xảy ra?',
      'A tube of egg-white solution is heated over a spirit lamp for a few minutes. What happens?',
    ),
    choices: [
      { id: 'dong-tu', text: L('Lòng trắng trứng đông tụ lại', 'The egg white coagulates') },
      {
        id: 'tan',
        text: L(
          'Lòng trắng trứng tan hết, dung dịch trong suốt',
          'It all dissolves to a clear solution',
        ),
      },
      { id: 'tim', text: L('Dung dịch chuyển màu tím', 'The solution turns violet') },
      { id: 'khong', text: L('Không có hiện tượng gì', 'Nothing happens') },
    ],
    answer: 'dong-tu',
    answerWhy: L(
      'Nhiệt làm cấu tạo ban đầu của protein bị biến đổi nên protein bị đông tụ. Màu tím chỉ xuất hiện khi dùng thuốc thử biuret.',
      'Heat changes the protein’s original structure, so it coagulates. The violet colour only appears with biuret reagent.',
    ),
    activities: [
      {
        kind: 'match',
        id: 'thi-nghiem',
        prompt: L(
          'Ghép mỗi thí nghiệm với protein với hiện tượng quan sát được.',
          'Match each protein experiment with what is seen.',
        ),
        pairs: [
          {
            id: 'nhiet',
            left: L('Đun nóng lòng trắng trứng', 'Heating egg white'),
            right: L('Protein bị đông tụ', 'The protein coagulates'),
            why: L('Cấu tạo ban đầu bị biến đổi.', 'Its original structure changes.'),
          },
          {
            id: 'nitric',
            left: L(
              'Nhỏ nitric acid đặc vào lòng trắng trứng',
              'Concentrated nitric acid on egg white',
            ),
            right: L('Có chất rắn màu vàng', 'A yellow solid forms'),
            why: L(
              'Phản ứng nitro hóa các vòng benzene và sự đông tụ trong môi trường acid.',
              'Nitration of benzene rings and coagulation in acid.',
            ),
          },
          {
            id: 'biuret',
            left: L('Thuốc thử biuret (Cu(OH)₂ trong kiềm)', 'Biuret reagent (Cu(OH)₂ in base)'),
            right: L('Màu tím đặc trưng', 'A violet colour'),
            why: L('Protein có nhiều liên kết peptide.', 'Proteins have many peptide bonds.'),
          },
          {
            id: 'thuy-phan',
            left: L(
              'Thủy phân hoàn toàn bằng enzyme hoặc acid',
              'Full hydrolysis by enzymes or acid',
            ),
            right: L('Hỗn hợp các α-amino acid', 'A mixture of α-amino acids'),
            why: L('Với protein đơn giản.', 'For a simple protein.'),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'dang',
        prompt: L(
          'Xếp mỗi protein hay đặc điểm vào protein dạng sợi hoặc dạng cầu.',
          'Put each protein or feature under fibrous or globular.',
        ),
        groups: [
          { id: 'soi', label: L('Protein dạng sợi', 'Fibrous protein') },
          { id: 'cau', label: L('Protein dạng cầu', 'Globular protein') },
        ],
        items: [
          {
            id: 'keratin',
            text: L('Keratin trong tóc, móng', 'Keratin in hair and nails'),
            group: 'soi',
            why: L('Ví dụ sách nêu.', 'An example the book gives.'),
          },
          {
            id: 'collagen',
            text: L('Collagen trong da, sụn', 'Collagen in skin and cartilage'),
            group: 'soi',
            why: L('Ví dụ sách nêu.', 'An example the book gives.'),
          },
          {
            id: 'khong-tan',
            text: L('Không tan trong nước', 'Does not dissolve in water'),
            group: 'soi',
            why: L('Đặc điểm của protein dạng sợi.', 'A feature of fibrous proteins.'),
          },
          {
            id: 'hemoglobin',
            text: L('Hemoglobin trong máu', 'Haemoglobin in blood'),
            group: 'cau',
            why: L('Ví dụ sách nêu.', 'An example the book gives.'),
          },
          {
            id: 'albumin',
            text: L('Albumin trong lòng trắng trứng', 'Albumin in egg white'),
            group: 'cau',
            why: L('Ví dụ sách nêu.', 'An example the book gives.'),
          },
          {
            id: 'keo',
            text: L('Tan trong nước tạo dung dịch keo', 'Dissolves to a colloidal solution'),
            group: 'cau',
            why: L('Đặc điểm của protein dạng cầu.', 'A feature of globular proteins.'),
          },
        ],
      },
      {
        kind: 'match',
        id: 'vai-tro',
        prompt: L(
          'Ghép mỗi khái niệm với điều đúng về nó.',
          'Match each idea with what is true of it.',
        ),
        pairs: [
          {
            id: 'enzyme',
            left: L('Enzyme', 'Enzyme'),
            right: L(
              'Xúc tác cho một hoặc một số phản ứng nhất định, nhanh hơn nhiều so với xúc tác hóa học',
              'Catalyses one or a few reactions, much faster than chemical catalysts',
            ),
            why: L('Tính chọn lọc cao.', 'High selectivity.'),
          },
          {
            id: 'insulin',
            left: L('Insulin', 'Insulin'),
            right: L(
              'Hormone điều hòa quá trình chuyển hóa glucose',
              'A hormone controlling glucose metabolism',
            ),
            why: L('Do tuyến tụy sinh ra.', 'Made by the pancreas.'),
          },
          {
            id: 'don-gian',
            left: L('Protein đơn giản', 'Simple protein'),
            right: L(
              'Thủy phân chỉ cho hỗn hợp các α-amino acid',
              'Hydrolyses only to α-amino acids',
            ),
            why: L('Định nghĩa trong sách.', 'The book’s definition.'),
          },
          {
            id: 'phuc-tap',
            left: L('Protein phức tạp', 'Complex protein'),
            right: L(
              'Protein đơn giản kết hợp với thành phần phi protein như nucleic acid, lipid',
              'A simple protein joined with non-protein parts such as nucleic acids or lipids',
            ),
            why: L('Định nghĩa trong sách.', 'The book’s definition.'),
          },
        ],
      },
    ],
  },
};
