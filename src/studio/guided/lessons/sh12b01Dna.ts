import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH12 KNTT Bài 1 "DNA và cơ chế tái bản DNA" (printed pages 5–8), in SimLab's own words. Checked
 * against the pages on 17/11/2026: the functions of DNA and the Watson–Crick model (Hình 1.1), the
 * start of replication at Ori with a Y-shaped fork (Hình 1.2), primers, DNA polymerase, Okazaki
 * fragments and ligase (Hình 1.3), the semi-conservative principle, one origin in prokaryotes and
 * many in eukaryotes (tr. 7). SH12-GL-1.
 */
export const sh12b01Dna: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'biology',
  id: 'guided.sh12-dna-replication',
  topic: 'dnaReplication',
  title: L('DNA và cơ chế tái bản DNA', 'DNA and its replication'),
  objectives: [
    L(
      'Dự đoán mỗi phân tử DNA con sau tái bản gồm những mạch nào.',
      'Predict which strands each daughter DNA molecule has after replication.',
    ),
    L(
      'Sắp xếp các bước tái bản DNA; ghép mỗi enzyme với vai trò của nó.',
      'Put the steps of replication in order; match each enzyme with its job.',
    ),
    L(
      'Phân biệt tái bản DNA ở sinh vật nhân sơ và nhân thực.',
      'Tell replication in prokaryotes from that in eukaryotes.',
    ),
  ],
  hints: [
    L(
      'Mỗi mạch của DNA mẹ được dùng làm khuôn để tổng hợp một mạch mới theo nguyên tắc bổ sung.',
      'Each parent strand is a template for one new strand, by complementary base pairing.',
    ),
    L(
      'Enzyme DNA polymerase cần đoạn mồi do RNA polymerase tổng hợp để bắt đầu.',
      'DNA polymerase needs a primer made by RNA polymerase to start.',
    ),
  ],
  questions: [
    L(
      'Vì sao tỉ lệ cặp G – C trong phân tử DNA có ảnh hưởng đến độ bền của phân tử?',
      'Why does the share of G–C pairs affect how stable a DNA molecule is?',
    ),
  ],
  expectedConclusion: L(
    'DNA được cấu tạo theo nguyên tắc đa phân và nguyên tắc bổ sung (A – T, G – C) nên mang, bảo quản và truyền đạt được thông tin di truyền. Tái bản DNA bắt đầu ở điểm khởi đầu sao chép, nơi hai mạch tách nhau tạo chạc sao chép hình chữ Y. RNA polymerase tổng hợp đoạn mồi, DNA polymerase kéo dài mạch mới theo nguyên tắc bổ sung; một mạch mới được tổng hợp liên tục, mạch kia thành từng đoạn Okazaki rồi được enzyme ligase nối lại. Mỗi phân tử DNA con có một mạch cũ và một mạch mới (nguyên tắc bán bảo toàn). Sinh vật nhân sơ có một điểm khởi đầu sao chép, sinh vật nhân thực có nhiều điểm.',
    'DNA is built as a polymer with complementary pairing (A–T, G–C), so it carries, keeps and passes on genetic information. Replication starts at the origin, where the strands part into a Y-shaped fork. RNA polymerase makes a primer and DNA polymerase extends the new strand by complementary pairing; one new strand grows continuously, the other in Okazaki fragments that ligase joins. Each daughter molecule has one old and one new strand (semi-conservative). Prokaryotes have one origin, eukaryotes many.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu cơ chế như sách giáo khoa; SimLab không đo hay tính ở đây.',
      'The lesson gives the mechanism as the textbook does; SimLab measures or computes nothing here.',
    ),
  ],
  limits: [
    L(
      'Chuỗi xoắn DNA có thể xem trong chủ đề “ADN → mARN → Protein”.',
      'The DNA helix can be seen in the topic “DNA → mRNA → protein”.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH12', lesson: 1 },
    question: L(
      'Sau một lần tái bản không có sai sót, mỗi phân tử DNA con gồm những mạch nào?',
      'After one error-free replication, which strands does each daughter DNA have?',
    ),
    choices: [
      {
        id: 'ban-bao-toan',
        text: L('Một mạch cũ và một mạch mới', 'One old strand and one new strand'),
      },
      { id: 'hai-moi', text: L('Hai mạch đều mới', 'Two new strands') },
      { id: 'hai-cu', text: L('Hai mạch đều cũ', 'Two old strands') },
      {
        id: 'xen-ke',
        text: L(
          'Các đoạn mạch cũ xen kẽ các đoạn mạch mới',
          'Old and new pieces mixed along each strand',
        ),
      },
    ],
    answer: 'ban-bao-toan',
    answerWhy: L(
      'Mỗi mạch của DNA mẹ được dùng làm khuôn tổng hợp một mạch mới, nên mỗi DNA con có một mạch cũ và một mạch mới: đó là nguyên tắc bán bảo toàn.',
      'Each parent strand templates one new strand, so each daughter has one old and one new strand: the semi-conservative principle.',
    ),
    activities: [
      {
        kind: 'order',
        id: 'cac-buoc',
        prompt: L('Sắp xếp các bước tái bản DNA.', 'Put the steps of DNA replication in order.'),
        items: [
          {
            id: 'tach',
            text: L(
              'Protein và enzyme tách hai mạch tại điểm khởi đầu sao chép, tạo chạc hình chữ Y',
              'Proteins and enzymes part the strands at the origin, making a Y-shaped fork',
            ),
            why: L('Khởi đầu sao chép.', 'Replication starts.'),
          },
          {
            id: 'moi',
            text: L('RNA polymerase tổng hợp đoạn mồi', 'RNA polymerase makes a primer'),
            why: L('DNA polymerase cần đoạn mồi để bắt đầu.', 'DNA polymerase needs a primer.'),
          },
          {
            id: 'keo-dai',
            text: L(
              'DNA polymerase gắn nucleotide theo nguyên tắc bổ sung, kéo dài mạch mới',
              'DNA polymerase adds nucleotides by pairing, extending the new strand',
            ),
            why: L('Tổng hợp mạch mới.', 'The new strand is made.'),
          },
          {
            id: 'thay-moi',
            text: L(
              'DNA polymerase loại bỏ đoạn mồi và tổng hợp đoạn DNA thay thế',
              'DNA polymerase removes the primers and fills the gaps with DNA',
            ),
            why: L(
              'Sau khi các đoạn Okazaki được tổng hợp.',
              'After the Okazaki fragments are made.',
            ),
          },
          {
            id: 'noi',
            text: L(
              'Enzyme ligase nối các đoạn Okazaki lại với nhau',
              'Ligase joins the Okazaki fragments',
            ),
            why: L('Bước cuối cùng.', 'The last step.'),
          },
        ],
      },
      {
        kind: 'match',
        id: 'enzyme',
        prompt: L('Ghép mỗi enzyme với vai trò của nó.', 'Match each enzyme with its job.'),
        pairs: [
          {
            id: 'tach-mach',
            left: L('Enzyme tách mạch', 'Unwinding enzyme'),
            right: L('Tách hai mạch đơn của DNA', 'Separates the two strands'),
            why: L('Tạo chạc sao chép.', 'It opens the fork.'),
          },
          {
            id: 'rna-pol',
            left: L('RNA polymerase', 'RNA polymerase'),
            right: L('Tổng hợp đoạn mồi', 'Makes the primer'),
            why: L('Đoạn mồi là RNA.', 'The primer is RNA.'),
          },
          {
            id: 'dna-pol',
            left: L('DNA polymerase', 'DNA polymerase'),
            right: L(
              'Kéo dài mạch mới theo nguyên tắc bổ sung',
              'Extends the new strand by pairing',
            ),
            why: L('Gắn A với T, G với C.', 'A pairs with T, G with C.'),
          },
          {
            id: 'ligase',
            left: L('Ligase', 'Ligase'),
            right: L('Nối các đoạn Okazaki', 'Joins Okazaki fragments'),
            why: L('Hoàn chỉnh mạch gián đoạn.', 'It completes the lagging strand.'),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'nhan-so-thuc',
        prompt: L(
          'Xếp mỗi đặc điểm vào tái bản DNA ở sinh vật nhân sơ hoặc nhân thực.',
          'Put each feature under prokaryotic or eukaryotic replication.',
        ),
        groups: [
          { id: 'so', label: L('Nhân sơ', 'Prokaryotes') },
          { id: 'thuc', label: L('Nhân thực', 'Eukaryotes') },
        ],
        items: [
          {
            id: 'mot-ori',
            text: L(
              'Mỗi phân tử DNA chỉ có một điểm khởi đầu sao chép',
              'Each DNA has a single origin',
            ),
            group: 'so',
            why: L('Như sách nêu.', 'As the book says.'),
          },
          {
            id: 'nhieu-ori',
            text: L('Mỗi phân tử DNA có nhiều điểm khởi đầu sao chép', 'Each DNA has many origins'),
            group: 'thuc',
            why: L('Như sách nêu.', 'As the book says.'),
          },
          {
            id: 'dong-thoi',
            text: L(
              'Tái bản xảy ra đồng thời ở nhiều vùng trên một phân tử DNA',
              'Replication runs at many places on one DNA at once',
            ),
            group: 'thuc',
            why: L('Vì có nhiều điểm khởi đầu.', 'Because there are many origins.'),
          },
          {
            id: 'nhieu-pol',
            text: L('Có nhiều loại DNA polymerase hơn', 'More kinds of DNA polymerase'),
            group: 'thuc',
            why: L('So với sinh vật nhân sơ.', 'Compared with prokaryotes.'),
          },
        ],
      },
    ],
  },
};
