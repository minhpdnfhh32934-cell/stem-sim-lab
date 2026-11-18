import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH11 KNTT Bài 22 "Sinh trưởng và phát triển ở động vật" (printed pages 145–152), in SimLab's own
 * words. Checked against the pages on 17/11/2026: the embryonic and post-embryonic stages,
 * development without metamorphosis (người) and with complete (bướm, lưỡng cư, nhiều côn trùng) or
 * incomplete metamorphosis (châu chấu, cào cào, gián, ve sầu, tôm, cua) (Hình 22.2–22.3), the four
 * main hormones of Hình 22.4, ecdysone and juvenile hormone in butterflies, and puberty. SH11-GL-16.
 */
export const sh11b22AnimalGrowth: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh11-animalgrowth',
  topic: 'animalGrowth',
  title: L('Sinh trưởng và phát triển ở động vật', 'Growth and development in animals'),
  objectives: [
    L(
      'Dự đoán kiểu phát triển của bướm, từ sâu qua nhộng thành bướm.',
      'Predict the kind of development of a butterfly, from caterpillar through pupa to butterfly.',
    ),
    L(
      'Phân loại động vật theo kiểu phát triển; xếp đúng các giai đoạn phát triển của bướm.',
      'Sort animals by their kind of development; put a butterfly’s stages in order.',
    ),
    L(
      'Ghép mỗi hormone với tác dụng của nó lên sinh trưởng, phát triển.',
      'Match each hormone with its effect on growth and development.',
    ),
  ],
  hints: [
    L(
      'Biến thái là sự thay đổi hình thái, cấu tạo của động vật sau khi sinh ra hoặc nở từ trứng.',
      'Metamorphosis is the change in shape and structure of an animal after birth or hatching.',
    ),
    L(
      'Ở biến thái hoàn toàn, ấu trùng rất khác con trưởng thành; ở biến thái không hoàn toàn, ấu trùng lột xác nhiều lần và giống dần con trưởng thành.',
      'In complete metamorphosis the larva is very unlike the adult; in incomplete metamorphosis the young moult many times and become more like the adult.',
    ),
  ],
  questions: [
    L(
      'Vì sao cần có chế độ ăn uống phù hợp cho trẻ em và phụ nữ khi mang thai?',
      'Why do children and pregnant women need a suitable diet?',
    ),
  ],
  expectedConclusion: L(
    'Sinh trưởng và phát triển ở động vật gồm giai đoạn phôi (phân cắt, phôi nang, phôi vị, tạo cơ quan) và giai đoạn hậu phôi. Có ba kiểu phát triển: không qua biến thái (con non giống con trưởng thành, như ở người), biến thái hoàn toàn (ấu trùng rất khác con trưởng thành, như bướm, lưỡng cư) và biến thái không hoàn toàn (ấu trùng lột xác nhiều lần, như châu chấu, tôm, cua). Di truyền, hormone (hormone sinh trưởng, thyroxine, estrogen, testosterone; ecdysone, juvenile ở côn trùng) và các yếu tố bên ngoài như thức ăn, nhiệt độ, ánh sáng ảnh hưởng đến sinh trưởng và phát triển.',
    'Animal growth and development has an embryonic stage (cleavage, blastula, gastrula, organ formation) and a post-embryonic stage. There are three kinds of development: without metamorphosis (the young resemble the adult, as in people), complete metamorphosis (the larva is very unlike the adult, as in butterflies and amphibians) and incomplete metamorphosis (the young moult many times, as in grasshoppers, shrimps and crabs). Heredity, hormones (growth hormone, thyroxine, oestrogen, testosterone; ecdysone and juvenile hormone in insects) and outside factors such as food, temperature and light affect growth and development.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu các giai đoạn, kiểu phát triển và vai trò hormone như sách giáo khoa.',
      'The lesson gives only the stages, kinds of development and hormone roles, as the textbook does.',
    ),
  ],
  limits: [
    L(
      'Số liệu về tuổi dậy thì, thời gian phát triển của phôi thai và nhiệt độ thích hợp cho cá trong sách không có trong bài học này.',
      'The book’s figures on puberty, the timing of the embryo and the best temperature for fish are not part of this lesson.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH11', lesson: 22 },
    question: L(
      'Từ trứng bướm nở ra sâu; sâu lột xác nhiều lần, hóa nhộng rồi thành bướm có hình dạng hoàn toàn khác sâu. Đây là kiểu phát triển nào?',
      'A butterfly egg hatches into a caterpillar, which moults several times, becomes a pupa and then a butterfly that looks nothing like the caterpillar. Which kind of development is this?',
    ),
    choices: [
      { id: 'hoan-toan', text: L('Phát triển qua biến thái hoàn toàn', 'Complete metamorphosis') },
      {
        id: 'khong-hoan-toan',
        text: L('Phát triển qua biến thái không hoàn toàn', 'Incomplete metamorphosis'),
      },
      {
        id: 'khong-bien-thai',
        text: L('Phát triển không qua biến thái', 'Development without metamorphosis'),
      },
      {
        id: 'khong-phat-trien',
        text: L('Chỉ sinh trưởng, không phát triển', 'Only growth, no development'),
      },
    ],
    answer: 'hoan-toan',
    answerWhy: L(
      'Sâu bướm có hình thái và cấu tạo rất khác bướm. Ở giai đoạn nhộng, các mô, cơ quan cũ của sâu tiêu biến và các mô, cơ quan mới hình thành, nên bướm chui ra khỏi kén có hình dạng khác hẳn sâu. Đó là biến thái hoàn toàn.',
      'A caterpillar is very different from a butterfly in shape and structure. In the pupa, the caterpillar’s old tissues and organs break down and new ones form, so the butterfly that comes out is quite unlike the caterpillar. That is complete metamorphosis.',
    ),
    activities: [
      {
        kind: 'sort',
        id: 'kieu',
        prompt: L(
          'Xếp mỗi động vật vào kiểu phát triển của nó.',
          'Put each animal under its kind of development.',
        ),
        groups: [
          { id: 'khong', label: L('Không qua biến thái', 'Without metamorphosis') },
          { id: 'hoan-toan', label: L('Biến thái hoàn toàn', 'Complete metamorphosis') },
          { id: 'khong-ht', label: L('Biến thái không hoàn toàn', 'Incomplete metamorphosis') },
        ],
        items: [
          {
            id: 'nguoi',
            text: L('Người', 'Human'),
            group: 'khong',
            why: L(
              'Trẻ mới sinh đã có cấu tạo giống người trưởng thành.',
              'A newborn already has the adult body plan.',
            ),
          },
          {
            id: 'buom',
            text: L('Bướm', 'Butterfly'),
            group: 'hoan-toan',
            why: L('Trứng, sâu, nhộng, bướm.', 'Egg, caterpillar, pupa, butterfly.'),
          },
          {
            id: 'ech',
            text: L('Ếch', 'Frog'),
            group: 'hoan-toan',
            why: L(
              'Lưỡng cư phát triển qua biến thái hoàn toàn.',
              'Amphibians develop by complete metamorphosis.',
            ),
          },
          {
            id: 'chau-chau',
            text: L('Châu chấu', 'Grasshopper'),
            group: 'khong-ht',
            why: L(
              'Ấu trùng chưa có cánh, lột xác nhiều lần thành con trưởng thành.',
              'The wingless young moult several times into the adult.',
            ),
          },
          {
            id: 'gian',
            text: L('Gián', 'Cockroach'),
            group: 'khong-ht',
            why: L(
              'Một ví dụ biến thái không hoàn toàn của sách.',
              'One of the book’s examples of incomplete metamorphosis.',
            ),
          },
          {
            id: 'tom',
            text: L('Tôm', 'Shrimp'),
            group: 'khong-ht',
            why: L('Động vật chân khớp lột xác nhiều lần.', 'An arthropod that moults many times.'),
          },
        ],
      },
      {
        kind: 'order',
        id: 'buom-giai-doan',
        prompt: L(
          'Xếp các giai đoạn phát triển của bướm theo đúng thứ tự.',
          'Put the stages of a butterfly in order.',
        ),
        items: [
          {
            id: 'trung',
            text: L('Trứng', 'Egg'),
            why: L(
              'Hợp tử phát triển thành phôi trong trứng.',
              'The zygote develops into an embryo inside the egg.',
            ),
          },
          {
            id: 'sau',
            text: L(
              'Sâu (ấu trùng) ăn lá, lột xác nhiều lần',
              'Caterpillar (larva) eats leaves and moults several times',
            ),
            why: L(
              'Sâu ăn lá cây, ống tiêu hóa có nhiều loại enzyme.',
              'The caterpillar eats leaves; its gut has many enzymes.',
            ),
          },
          {
            id: 'nhong',
            text: L(
              'Nhộng: mô, cơ quan cũ tiêu biến, mô, cơ quan mới hình thành',
              'Pupa: old tissues and organs break down, new ones form',
            ),
            why: L(
              'Giai đoạn nhộng giúp vượt qua điều kiện bất lợi như lạnh giá, thiếu thức ăn.',
              'The pupa helps it survive hard times such as cold or lack of food.',
            ),
          },
          {
            id: 'buom-tt',
            text: L('Bướm trưởng thành', 'Adult butterfly'),
            why: L('Hầu hết bướm sống bằng mật hoa.', 'Most butterflies feed on nectar.'),
          },
        ],
      },
      {
        kind: 'match',
        id: 'hormone',
        prompt: L('Ghép mỗi hormone với tác dụng của nó.', 'Match each hormone with its effect.'),
        pairs: [
          {
            id: 'gh',
            left: L('Hormone sinh trưởng', 'Growth hormone'),
            right: L(
              'Kích thích phân chia, tăng kích thước tế bào; xương dài và to ra',
              'Promotes cell division and growth; bones grow longer and thicker',
            ),
            why: L('Tăng tổng hợp protein.', 'It raises protein synthesis.'),
          },
          {
            id: 'thyroxine',
            left: L('Thyroxine', 'Thyroxine'),
            right: L(
              'Duy trì chuyển hóa ở tế bào; phát triển hệ thần kinh',
              'Keeps up cell metabolism; develops the nervous system',
            ),
            why: L(
              'Tác động lên quá trình sinh trưởng và phát triển bình thường.',
              'Needed for normal growth and development.',
            ),
          },
          {
            id: 'estrogen',
            left: L('Estrogen', 'Oestrogen'),
            right: L(
              'Kích thích sinh trưởng, phát triển mạnh ở nữ thời kì dậy thì',
              'Drives rapid growth and development in girls at puberty',
            ),
            why: L(
              'Dậy thì chủ yếu do tăng estrogen ở nữ.',
              'Puberty in girls comes mainly from rising oestrogen.',
            ),
          },
          {
            id: 'testosterone',
            left: L('Testosterone', 'Testosterone'),
            right: L(
              'Kích thích sinh trưởng, phát triển mạnh ở nam thời kì dậy thì; phát triển cơ bắp',
              'Drives rapid growth and development in boys at puberty; builds muscle',
            ),
            why: L(
              'Dậy thì chủ yếu do tăng testosterone ở nam.',
              'Puberty in boys comes mainly from rising testosterone.',
            ),
          },
          {
            id: 'ecdysone',
            left: L('Ecdysone và juvenile hormone', 'Ecdysone and juvenile hormone'),
            right: L(
              'Phối hợp gây lột xác ở sâu và biến đổi sâu thành nhộng, bướm',
              'Together cause moulting in caterpillars and their change to pupa and butterfly',
            ),
            why: L(
              'Hormone của động vật không xương sống, ví dụ ở bướm.',
              'Hormones of invertebrates, for example in butterflies.',
            ),
          },
        ],
      },
    ],
  },
};
