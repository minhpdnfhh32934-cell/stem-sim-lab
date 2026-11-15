import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH10 KNTT Bài 3 "Các cấp độ tổ chức của thế giới sống" (printed pages 18–22), in SimLab's own
 * words. Checked against the pages on 16/11/2026: the book's figure runs from atom to biosphere;
 * the activity uses its levels from the cell to the ecosystem. Review: DATA_REVIEW SH10-GL-1.
 */
export const sh10b03Levels: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh10-levels-of-life',
  topic: 'levelsOfLife',
  title: L(
    'Cấp độ tổ chức sống: từ tế bào đến hệ sinh thái',
    'Levels of life: from the cell to the ecosystem',
  ),
  objectives: [
    L(
      'Dự đoán cấp độ nhỏ nhất có đủ các đặc điểm của sự sống.',
      'Predict the smallest level that has all the features of life.',
    ),
    L(
      'Xếp các cấp độ tổ chức sống từ nhỏ đến lớn.',
      'Put the levels of living organisation in order from small to large.',
    ),
    L(
      'Ghép mỗi đặc điểm chung của thế giới sống với ý nghĩa của nó.',
      'Match each shared feature of the living world with what it means.',
    ),
  ],
  hints: [
    L(
      'Thử hỏi: nếu tách riêng một bào quan ra khỏi tế bào, nó có tự lớn lên và sinh sản được không?',
      'Ask yourself: if one organelle is taken out of the cell, can it grow and reproduce on its own?',
    ),
    L(
      'Ở mỗi cấp, xem cấp đó được tạo nên từ những phần nào của cấp ngay dưới nó.',
      'At each level, look at which parts of the level just below it build it.',
    ),
  ],
  questions: [
    L(
      'Vì sao nói tế bào là cấp tổ chức sống cơ bản?',
      'Why is the cell called the basic level of living organisation?',
    ),
    L(
      'Hãy lấy một ví dụ cho thấy cấp lớn có đặc tính mà các phần nhỏ của nó không có.',
      'Give an example of a larger level having a property that its small parts do not have.',
    ),
  ],
  expectedConclusion: L(
    'Thế giới sống được tổ chức thành nhiều cấp từ nhỏ đến lớn: tế bào, mô, cơ quan, hệ cơ quan, cơ thể, quần thể, quần xã, hệ sinh thái. Tế bào là cấp nhỏ nhất có đủ các đặc điểm của sự sống. Mỗi cấp được tạo nên từ cấp dưới nó và có thêm đặc tính mới; các cấp đều là hệ mở, tự điều chỉnh và liên tục tiến hoá.',
    'The living world is organised in levels from small to large: cell, tissue, organ, organ system, organism, population, community, ecosystem. The cell is the smallest level with all the features of life. Each level is built from the one below and gains new properties; every level is an open, self-regulating system that keeps evolving.',
  ),
  sources: [],
  assumptions: [
    L(
      'Thang cấp độ trong hoạt động bắt đầu từ tế bào; sách giáo khoa còn kể các cấp nhỏ hơn (nguyên tử, phân tử, bào quan) và cấp lớn hơn (sinh quyển).',
      'The ladder in the activity starts at the cell; the textbook also names smaller levels (atom, molecule, organelle) and a larger one (biosphere).',
    ),
  ],
  limits: [],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH10', lesson: 3 },
    question: L(
      'Theo em, cấp tổ chức nhỏ nhất có đủ các đặc điểm của sự sống (lớn lên, sinh sản, trao đổi chất…) là cấp nào?',
      'Which do you think is the smallest level that has all the features of life (growing, reproducing, exchanging matter…)?',
    ),
    choices: [
      { id: 'phan-tu', text: L('Phân tử', 'Molecule') },
      { id: 'bao-quan', text: L('Bào quan', 'Organelle') },
      { id: 'te-bao', text: L('Tế bào', 'Cell') },
      { id: 'mo', text: L('Mô', 'Tissue') },
    ],
    answer: 'te-bao',
    answerWhy: L(
      'Phân tử và bào quan chỉ là những phần cấu tạo nên tế bào; tách riêng ra, chúng không tự lớn lên hay sinh sản được. Tế bào là cấp nhỏ nhất làm được đủ các việc của sự sống, nên là cấp tổ chức sống cơ bản. Mô lớn hơn tế bào vì được tạo từ nhiều tế bào.',
      'Molecules and organelles are only parts that build the cell; on their own they cannot grow or reproduce. The cell is the smallest level that does everything life does, so it is the basic level of living organisation. A tissue is larger: it is made of many cells.',
    ),
    activities: [
      {
        kind: 'order',
        id: 'thu-tu',
        prompt: L(
          'Xếp các cấp độ tổ chức sống từ nhỏ đến lớn, bắt đầu từ tế bào.',
          'Put the levels of living organisation in order from small to large, starting with the cell.',
        ),
        items: [
          {
            id: 'te-bao',
            text: L('Tế bào', 'Cell'),
            why: L(
              'Cấp nhỏ nhất có đủ đặc điểm của sự sống; mọi cấp lớn hơn đều được tạo nên từ tế bào.',
              'The smallest level with all the features of life; every larger level is made of cells.',
            ),
          },
          {
            id: 'mo',
            text: L('Mô', 'Tissue'),
            why: L(
              'Nhiều tế bào hợp lại, cùng làm một việc.',
              'Many cells together, doing one job.',
            ),
          },
          {
            id: 'co-quan',
            text: L('Cơ quan', 'Organ'),
            why: L(
              'Nhiều mô khác nhau hợp lại thành một bộ phận, ví dụ quả tim.',
              'Several different tissues form one body part, for example the heart.',
            ),
          },
          {
            id: 'he-co-quan',
            text: L('Hệ cơ quan', 'Organ system'),
            why: L(
              'Nhiều cơ quan cùng phối hợp để làm một chức năng chung.',
              'Several organs work together for one shared function.',
            ),
          },
          {
            id: 'co-the',
            text: L('Cơ thể', 'Organism'),
            why: L(
              'Các hệ cơ quan hợp thành một cá thể sống hoàn chỉnh.',
              'The organ systems together make one complete living individual.',
            ),
          },
          {
            id: 'quan-the',
            text: L('Quần thể', 'Population'),
            why: L(
              'Các cá thể cùng loài sống ở cùng một nơi, vào cùng một thời điểm.',
              'Individuals of one species living in the same place at the same time.',
            ),
          },
          {
            id: 'quan-xa',
            text: L('Quần xã', 'Community'),
            why: L(
              'Quần thể của nhiều loài khác nhau cùng sống ở một nơi.',
              'Populations of many different species living in one place.',
            ),
          },
          {
            id: 'he-sinh-thai',
            text: L('Hệ sinh thái', 'Ecosystem'),
            why: L(
              'Quần xã cùng với môi trường sống quanh nó, tác động qua lại với nhau.',
              'A community together with its surroundings, each acting on the other.',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'dac-diem',
        prompt: L(
          'Ghép mỗi đặc điểm chung của thế giới sống với ý nghĩa của nó.',
          'Match each shared feature of the living world with what it means.',
        ),
        pairs: [
          {
            id: 'thu-bac',
            left: L('Tổ chức theo nguyên tắc thứ bậc', 'Organised as a hierarchy'),
            right: L(
              'Cấp nhỏ làm nền cho cấp lớn; cấp lớn có đặc tính mới mà các phần riêng lẻ không có',
              'Small levels are the base of larger ones; a larger level has new properties its separate parts lack',
            ),
            why: L(
              'Ví dụ: từng tế bào thần kinh riêng lẻ không suy nghĩ được, nhưng cả bộ não thì làm được. Đặc tính mới như vậy gọi là đặc tính nổi trội.',
              'For example, a single nerve cell cannot think, but a whole brain can. Such a new property is called an emergent property.',
            ),
          },
          {
            id: 'he-mo',
            left: L('Hệ thống mở', 'Open system'),
            right: L(
              'Luôn trao đổi chất và năng lượng với môi trường',
              'Always exchanges matter and energy with the surroundings',
            ),
            why: L(
              'Tế bào phải lấy chất từ bên ngoài và thải chất thải ra mới sống và lớn lên được; cơ thể cũng luôn trao đổi khí, nước và thức ăn.',
              'A cell must take in substances and get rid of waste to live and grow; a body also keeps exchanging gases, water and food.',
            ),
          },
          {
            id: 'tu-dieu-chinh',
            left: L('Tự điều chỉnh', 'Self-regulating'),
            right: L(
              'Giữ các chỉ số bên trong ổn định dù môi trường thay đổi',
              'Keeps its inner conditions steady while the surroundings change',
            ),
            why: L(
              'Ví dụ: cơ thể người giữ thân nhiệt, độ pH, lượng đường trong máu ở mức tương đối ổn định. Khi khả năng này trục trặc, cơ thể có thể bị bệnh.',
              'For example, the human body keeps its temperature, pH and blood sugar fairly steady. When this fails, the body can fall ill.',
            ),
          },
          {
            id: 'tien-hoa',
            left: L('Liên tục tiến hoá', 'Keeps evolving'),
            right: L(
              'Thông tin di truyền qua các thế hệ có đột biến và được chọn lọc, nên sinh giới rất đa dạng',
              'Genetic information passed down the generations changes by mutation and is selected, so life is very diverse',
            ),
            why: L(
              'DNA được truyền khá chính xác từ thế hệ này sang thế hệ khác nhưng vẫn có đột biến; môi trường giữ lại những dạng thích nghi nhất. Vì vậy sinh vật rất đa dạng mà vẫn có nhiều điểm chung.',
              'DNA is passed on quite faithfully from one generation to the next but still mutates; the surroundings keep the best-adapted forms. So living things are very diverse yet share many features.',
            ),
          },
        ],
      },
    ],
  },
};
