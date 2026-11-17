import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH12 KNTT Bài 20 "Quan niệm của Darwin về chọn lọc tự nhiên và hình thành loài" (printed pages
 * 101–105), in SimLab's own words. Checked against the pages on 17/11/2026: Darwin's method
 * (observe → hypothesise → test), the Galapagos finches (Hình 20.1), artificial selection of
 * pigeons and Brassica (Hình 20.2), natural selection and "descent with modification" (Hình 20.3),
 * his experiments with seeds in seawater and pitcher plants (tr. 104). SH12-GL-6.
 */
export const sh12b20Darwin: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'biology',
  id: 'guided.sh12-darwin',
  topic: 'darwinSelection',
  title: L(
    'Quan niệm của Darwin về chọn lọc tự nhiên và hình thành loài',
    'Darwin: natural selection and the origin of species',
  ),
  objectives: [
    L(
      'Dự đoán điều xảy ra với vi khuẩn khi dùng thuốc kháng sinh lâu dài.',
      'Predict what happens to bacteria under long use of an antibiotic.',
    ),
    L(
      'Sắp xếp các bước của quy trình nghiên cứu mà Darwin áp dụng.',
      'Put the steps of Darwin’s method in order.',
    ),
    L(
      'Ghép mỗi kiểu mỏ chim với loại thức ăn; phân biệt chọn lọc nhân tạo và chọn lọc tự nhiên.',
      'Match each beak with its food; tell artificial from natural selection.',
    ),
  ],
  hints: [
    L(
      'Cá thể có biến dị di truyền giúp sống sót và sinh sản tốt hơn sẽ để lại nhiều con hơn.',
      'Individuals with heritable variation that helps them survive and breed leave more offspring.',
    ),
    L(
      'Chọn lọc chỉ giữ lại các biến dị đã có sẵn, không tạo ra biến dị.',
      'Selection only keeps variation that already exists; it does not make it.',
    ),
  ],
  questions: [
    L(
      'Vì sao chỉ đo tỉ lệ sống sót mà không đo khả năng sinh sản thì chưa đủ để kết luận một đặc điểm là thích nghi?',
      'Why is measuring survival alone not enough to call a trait an adaptation?',
    ),
  ],
  expectedConclusion: L(
    'Darwin quan sát thấy các cá thể cùng loài vừa giống vừa khác nhau (biến dị cá thể) và sinh ra nhiều con hơn số mà môi trường nuôi dưỡng được. Từ đó ông đề xuất: trong tự nhiên, các cá thể có biến dị di truyền làm tăng khả năng sống sót và sinh sản sẽ ngày một tăng dần qua các thế hệ — đó là chọn lọc tự nhiên. Tương tự chọn lọc nhân tạo của con người, chọn lọc tự nhiên làm sinh vật thích nghi với môi trường và hình thành các loài mới từ một tổ tiên chung (hậu duệ có biến đổi). Darwin đã kiểm chứng giả thuyết bằng nhiều thí nghiệm.',
    'Darwin saw that members of a species are alike yet differ (individual variation) and are born in greater numbers than the environment can feed. He proposed that individuals whose heritable variation helps them survive and breed become more common over generations: natural selection. Like human artificial selection, it adapts organisms to their environment and makes new species from a common ancestor (descent with modification). He tested the idea with many experiments.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu quan niệm và ví dụ của Darwin như sách giáo khoa.',
      'The lesson gives Darwin’s ideas and examples as the textbook does.',
    ),
  ],
  limits: [
    L(
      'Sự thay đổi tần số allele qua các thế hệ được tính trong chủ đề về di truyền quần thể.',
      'Changes of allele frequency over generations are worked out in the population genetics topics.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH12', lesson: 20 },
    question: L(
      'Dùng một loại thuốc kháng sinh lâu dài để chữa bệnh. Quần thể vi khuẩn gây bệnh thay đổi thế nào?',
      'An antibiotic is used for a long time. How does the population of disease bacteria change?',
    ),
    choices: [
      {
        id: 'khang',
        text: L(
          'Vi khuẩn kháng thuốc sống sót, sinh sản và ngày càng nhiều',
          'Resistant bacteria survive, breed and become common',
        ),
      },
      { id: 'chet-het', text: L('Toàn bộ vi khuẩn bị tiêu diệt', 'All the bacteria die') },
      {
        id: 'thuoc-tao',
        text: L(
          'Thuốc làm mọi vi khuẩn biến đổi thành kháng thuốc',
          'The drug turns every bacterium resistant',
        ),
      },
      { id: 'khong-doi', text: L('Không thay đổi', 'Nothing changes') },
    ],
    answer: 'khang',
    answerWhy: L(
      'Trong quần thể có sẵn một số ít vi khuẩn mang biến dị kháng thuốc. Khi có thuốc, chúng sống sót và sinh sản, nên qua nhiều thế hệ vi khuẩn kháng thuốc chiếm ưu thế: thuốc chỉ chọn lọc, không tạo ra biến dị.',
      'A few bacteria already carry resistance. With the drug they survive and breed, so over generations resistant bacteria take over: the drug selects; it does not create the variation.',
    ),
    activities: [
      {
        kind: 'order',
        id: 'quy-trinh',
        prompt: L('Sắp xếp các bước Darwin đã áp dụng.', 'Put the steps Darwin used in order.'),
        items: [
          {
            id: 'quan-sat',
            text: L('Quan sát, thu thập dữ liệu', 'Observe and collect data'),
            why: L('Chuyến đi trên tàu Beagle.', 'The voyage of the Beagle.'),
          },
          {
            id: 'gia-thuyet',
            text: L('Đề xuất giả thuyết giải thích dữ liệu', 'Propose a hypothesis'),
            why: L('Chọn lọc tự nhiên.', 'Natural selection.'),
          },
          {
            id: 'kiem-chung',
            text: L('Kiểm chứng giả thuyết bằng thực nghiệm', 'Test it by experiment'),
            why: L('Ví dụ ngâm hạt trong nước biển.', 'For example seeds in seawater.'),
          },
        ],
      },
      {
        kind: 'match',
        id: 'mo-chim',
        prompt: L(
          'Ghép mỗi kiểu mỏ chim trên quần đảo Galapagos với loại thức ăn.',
          'Match each Galapagos finch beak with its food.',
        ),
        pairs: [
          {
            id: 'xuong-rong',
            left: L('Mỏ dài, nhọn', 'Long, pointed beak'),
            right: L('Ăn hoa xương rồng', 'Cactus flowers'),
            why: L('Hợp với việc lấy thức ăn trong hoa.', 'It reaches into flowers.'),
          },
          {
            id: 'sau',
            left: L('Mỏ mảnh', 'Slender beak'),
            right: L('Bắt sâu bọ', 'Insects'),
            why: L('Hợp với việc bắt sâu bọ.', 'It suits catching insects.'),
          },
          {
            id: 'hat',
            left: L('Mỏ ngắn, dày', 'Short, thick beak'),
            right: L('Tách vỏ hạt', 'Cracking seeds'),
            why: L('Ở các đảo có nhiều cây cho hạt to.', 'On islands with big seeds.'),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'chon-loc',
        prompt: L(
          'Xếp mỗi ví dụ vào loại chọn lọc của nó.',
          'Put each example under its kind of selection.',
        ),
        groups: [
          { id: 'nhan-tao', label: L('Chọn lọc nhân tạo', 'Artificial selection') },
          { id: 'tu-nhien', label: L('Chọn lọc tự nhiên', 'Natural selection') },
        ],
        items: [
          {
            id: 'bo-cau',
            text: L('Các giống chim bồ câu từ bồ câu núi', 'Pigeon breeds from the rock pigeon'),
            group: 'nhan-tao',
            why: L(
              'Con người chọn biến dị mình ưa thích.',
              'People chose the variation they liked.',
            ),
          },
          {
            id: 'cai',
            text: L(
              'Bắp cải, su hào, súp lơ từ cải hoang dại',
              'Cabbage, kohlrabi, cauliflower from wild mustard',
            ),
            group: 'nhan-tao',
            why: L('Chọn lọc theo từng bộ phận khác nhau.', 'Selected for different parts.'),
          },
          {
            id: 'mo',
            text: L('Mỏ chim phù hợp thức ăn trên mỗi đảo', 'Beaks suited to each island’s food'),
            group: 'tu-nhien',
            why: L(
              'Môi trường giữ lại các đặc điểm thích nghi.',
              'The environment kept the adaptations.',
            ),
          },
          {
            id: 'vi-khuan',
            text: L(
              'Vi khuẩn kháng thuốc trở nên phổ biến',
              'Drug-resistant bacteria becoming common',
            ),
            group: 'tu-nhien',
            why: L(
              'Thuốc là tác nhân chọn lọc trong môi trường.',
              'The drug is the selecting agent.',
            ),
          },
        ],
      },
    ],
  },
};
