import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH11 KNTT Bài 24 "Khái quát về sinh sản ở sinh vật" (printed pages 156–158), in SimLab's own
 * words. Checked against the pages on 17/11/2026: asexual reproduction (the book's cây thuốc bỏng
 * leaf, which is the prediction) and sexual reproduction (Hình 24.1), the signs of Bảng 24.1, the
 * role of each, and the forms of reproduction in plants and animals (the diagram on tr. 157).
 * SH11-GL-17.
 */
export const sh11b24Reproduction: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh11-reproduction',
  topic: 'reproductionOverview',
  title: L('Khái quát về sinh sản ở sinh vật', 'Reproduction: an overview'),
  objectives: [
    L(
      'Dự đoán cây mọc từ một lá cây thuốc bỏng giống cây mẹ đến mức nào.',
      'Predict how closely a plant grown from a kalanchoe leaf resembles its parent.',
    ),
    L(
      'Phân loại các đặc điểm vào sinh sản vô tính hoặc hữu tính; xếp các hình thức sinh sản ở động vật.',
      'Sort features into asexual or sexual reproduction; sort the forms of reproduction in animals.',
    ),
    L(
      'Xếp đúng thứ tự quá trình sinh sản hữu tính ở người.',
      'Put the steps of sexual reproduction in humans in order.',
    ),
  ],
  hints: [
    L(
      'Sinh sản vô tính không có sự kết hợp giao tử; sinh sản hữu tính có giao tử đực và cái kết hợp tạo hợp tử.',
      'Asexual reproduction has no fusion of gametes; sexual reproduction joins a male and a female gamete into a zygote.',
    ),
    L(
      'Nguyên phân sao chép nguyên vẹn vật chất di truyền; giảm phân và thụ tinh tạo tổ hợp mới.',
      'Mitosis copies the genetic material unchanged; meiosis and fertilisation make new combinations.',
    ),
  ],
  questions: [
    L(
      'Vì sao những giống cây thụ phấn chéo như lúa, ngô thường bị phân hóa thành nhiều dòng qua một số thế hệ?',
      'Why do cross-pollinated crops such as rice and maize split into many lines over a few generations?',
    ),
  ],
  expectedConclusion: L(
    'Sinh sản là quá trình tạo ra cơ thể mới, bảo đảm sự phát triển liên tục của loài. Sinh sản vô tính tạo cơ thể mới giống cơ thể ban đầu, không có sự đóng góp vật chất di truyền của cá thể khác, qua nguyên phân; nó nhanh chóng tạo nhiều cá thể khi môi trường ổn định. Sinh sản hữu tính kết hợp giao tử đực và cái thành hợp tử, qua giảm phân, thụ tinh và nguyên phân, tạo tổ hợp gene đa dạng giúp loài thích nghi với môi trường thay đổi.',
    'Reproduction makes new organisms and keeps a species going. Asexual reproduction makes offspring like the parent, with no genetic material from another individual, through mitosis; it quickly makes many individuals when conditions are steady. Sexual reproduction joins a male and a female gamete into a zygote through meiosis, fertilisation and mitosis, giving varied gene combinations that help the species adapt to change.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu khái niệm và đặc điểm như sách giáo khoa.',
      'The lesson gives only the ideas and features, as the textbook does.',
    ),
  ],
  limits: [
    L(
      'Chi tiết sinh sản ở thực vật và động vật ở các bài sau của chương.',
      'Details of reproduction in plants and animals are in the chapter’s later lessons.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH11', lesson: 24 },
    question: L(
      'Từ một lá của cây thuốc bỏng có thể mọc thành cây mới. Cây mới này có đặc điểm thế nào so với cây đã cho lá?',
      'A new plant can grow from one kalanchoe leaf. How does it compare with the plant that gave the leaf?',
    ),
    choices: [
      {
        id: 'giong-het',
        text: L('Giống hệt cây cung cấp lá', 'Exactly like the plant that gave the leaf'),
      },
      {
        id: 'khac-han',
        text: L('Khác hẳn cây cung cấp lá', 'Quite unlike the plant that gave the leaf'),
      },
      { id: 'nua', text: L('Mang một nửa đặc điểm của cây mẹ', 'Half like the parent') },
      {
        id: 'ngau-nhien',
        text: L(
          'Mỗi cây mới một khác, không đoán được',
          'Each new plant differs, impossible to say',
        ),
      },
    ],
    answer: 'giong-het',
    answerWhy: L(
      'Đây là sinh sản vô tính: cây mới hình thành từ tế bào của lá qua nguyên phân, không có sự kết hợp giao tử, nên vật chất di truyền được truyền đạt nguyên vẹn và cây con có đặc điểm giống hệt cây mẹ.',
      'This is asexual reproduction: the new plant forms from leaf cells by mitosis, with no fusion of gametes, so the genetic material passes on unchanged and the new plant is just like its parent.',
    ),
    activities: [
      {
        kind: 'sort',
        id: 'dau-hieu',
        prompt: L(
          'Xếp mỗi đặc điểm vào sinh sản vô tính hoặc hữu tính.',
          'Put each feature under asexual or sexual reproduction.',
        ),
        groups: [
          { id: 'vo-tinh', label: L('Sinh sản vô tính', 'Asexual reproduction') },
          { id: 'huu-tinh', label: L('Sinh sản hữu tính', 'Sexual reproduction') },
        ],
        items: [
          {
            id: 'giong-me',
            text: L(
              'Các cơ thể con giống nhau và giống cơ thể mẹ',
              'The offspring are alike and like the parent',
            ),
            group: 'vo-tinh',
            why: L(
              'Vật chất di truyền được truyền nguyên vẹn.',
              'The genetic material passes on unchanged.',
            ),
          },
          {
            id: 'nguyen-phan',
            text: L(
              'Vật chất di truyền truyền cho con qua nguyên phân',
              'Genetic material passes to the offspring by mitosis',
            ),
            group: 'vo-tinh',
            why: L('Không có giảm phân và thụ tinh.', 'There is no meiosis or fertilisation.'),
          },
          {
            id: 'chu-ki',
            text: L(
              'Điều hòa chủ yếu bởi hệ thống kiểm soát chu kì tế bào',
              'Regulated mainly by the cell-cycle control system',
            ),
            group: 'vo-tinh',
            why: L('Theo Bảng của sách.', 'From the book’s table.'),
          },
          {
            id: 'tai-to-hop',
            text: L(
              'Vật chất di truyền tái tổ hợp từ hai nguồn nên có sai khác',
              'Genetic material recombined from two sources, so offspring differ',
            ),
            group: 'huu-tinh',
            why: L('Tạo các tổ hợp gene đa dạng.', 'It gives varied gene combinations.'),
          },
          {
            id: 'giam-phan',
            text: L(
              'Truyền đạt qua giảm phân, thụ tinh và nguyên phân',
              'Passed on through meiosis, fertilisation and mitosis',
            ),
            group: 'huu-tinh',
            why: L('Có sự kết hợp giao tử đực và giao tử cái.', 'A male and a female gamete fuse.'),
          },
          {
            id: 'hormone',
            text: L('Điều hòa bởi các hormone', 'Regulated by hormones'),
            group: 'huu-tinh',
            why: L('Theo Bảng của sách.', 'From the book’s table.'),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'hinh-thuc',
        prompt: L(
          'Xếp mỗi hình thức sinh sản ở động vật vào vô tính hoặc hữu tính.',
          'Put each form of animal reproduction under asexual or sexual.',
        ),
        groups: [
          { id: 'vo-tinh', label: L('Vô tính', 'Asexual') },
          { id: 'huu-tinh', label: L('Hữu tính', 'Sexual') },
        ],
        items: [
          {
            id: 'phan-doi',
            text: L('Phân đôi', 'Fission'),
            group: 'vo-tinh',
            why: L('Một cơ thể tách thành hai.', 'One body splits into two.'),
          },
          {
            id: 'nay-choi',
            text: L('Nảy chồi', 'Budding'),
            group: 'vo-tinh',
            why: L('Cơ thể mới mọc ra từ cơ thể mẹ.', 'A new body grows out of the parent.'),
          },
          {
            id: 'phan-manh',
            text: L('Phân mảnh', 'Fragmentation'),
            group: 'vo-tinh',
            why: L('Mỗi mảnh phát triển thành cơ thể mới.', 'Each piece grows into a new body.'),
          },
          {
            id: 'trinh-sinh',
            text: L('Trinh sinh', 'Parthenogenesis'),
            group: 'vo-tinh',
            why: L(
              'Sơ đồ của sách xếp vào sinh sản vô tính.',
              'The book’s diagram places it under asexual reproduction.',
            ),
          },
          {
            id: 'de-trung',
            text: L('Đẻ trứng', 'Laying eggs'),
            group: 'huu-tinh',
            why: L(
              'Có thụ tinh, hợp tử phát triển trong trứng.',
              'There is fertilisation; the zygote develops inside the egg.',
            ),
          },
          {
            id: 'de-con',
            text: L('Đẻ con', 'Live birth'),
            group: 'huu-tinh',
            why: L(
              'Có thụ tinh, phôi phát triển trong cơ thể mẹ.',
              'There is fertilisation; the embryo develops inside the mother.',
            ),
          },
        ],
      },
      {
        kind: 'order',
        id: 'nguoi',
        prompt: L(
          'Xếp quá trình sinh sản hữu tính ở người theo đúng thứ tự.',
          'Put the steps of sexual reproduction in humans in order.',
        ),
        items: [
          {
            id: 'giao-tu',
            text: L('Hình thành trứng và tinh trùng', 'Eggs and sperm form'),
            why: L('Giao tử hình thành qua giảm phân.', 'Gametes form by meiosis.'),
          },
          {
            id: 'thu-tinh',
            text: L('Thụ tinh', 'Fertilisation'),
            why: L('Tinh trùng kết hợp với trứng.', 'A sperm joins an egg.'),
          },
          {
            id: 'hop-tu',
            text: L('Hợp tử', 'Zygote'),
            why: L('Hợp tử phân chia tạo phôi.', 'The zygote divides into an embryo.'),
          },
          {
            id: 'phoi',
            text: L('Phôi', 'Embryo'),
            why: L('Phôi phát triển thành thai nhi.', 'The embryo develops into a fetus.'),
          },
          {
            id: 'thai',
            text: L('Thai nhi', 'Fetus'),
            why: L('Thai nhi phát triển đến khi được sinh ra.', 'The fetus develops until birth.'),
          },
        ],
      },
    ],
  },
};
