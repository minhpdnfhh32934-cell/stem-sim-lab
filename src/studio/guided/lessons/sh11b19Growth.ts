import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH11 KNTT Bài 19 "Khái quát về sinh trưởng và phát triển ở sinh vật" (printed pages 125–128), in
 * SimLab's own words. Checked against the pages on 17/11/2026: growth (more size and mass) and
 * development (growth, cell differentiation, morphogenesis), the life cycle of a frog and of a
 * flowering plant (Hình 19.1), uses of life cycles and the factors of human lifespan. The
 * prediction is the book's opening question (tr. 125). SH11-GL-14.
 */
export const sh11b19Growth: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh11-growth',
  topic: 'growthOverview',
  title: L('Khái quát về sinh trưởng và phát triển', 'Growth and development: an overview'),
  objectives: [
    L(
      'Dự đoán vì sao một hạt có thể thành cây, một trứng thụ tinh có thể thành con vật.',
      'Predict why a seed can become a plant and a fertilised egg an animal.',
    ),
    L(
      'Phân biệt dấu hiệu của sinh trưởng và của phát triển; xếp đúng các giai đoạn trong vòng đời của ếch.',
      'Tell the signs of growth from those of development; put the stages of a frog’s life cycle in order.',
    ),
    L(
      'Ghép hiểu biết về vòng đời với cách áp dụng trong thực tiễn.',
      'Match knowledge of life cycles with how it is used in practice.',
    ),
  ],
  hints: [
    L(
      'Sinh trưởng là lớn lên về kích thước, khối lượng; phát triển còn gồm phân hóa tế bào và hình thành cơ quan.',
      'Growth is getting bigger and heavier; development also includes cell differentiation and the forming of organs.',
    ),
    L(
      'Vòng đời là chuỗi thay đổi lặp lại từ khi sinh ra đến khi sinh sản, già rồi chết.',
      'A life cycle is the repeated series of changes from birth to reproduction, ageing and death.',
    ),
  ],
  questions: [
    L('Mỗi người cần làm gì để nâng cao tuổi thọ?', 'What can each of us do to live longer?'),
  ],
  expectedConclusion: L(
    'Sinh trưởng là quá trình tăng kích thước và khối lượng cơ thể; phát triển là toàn bộ biến đổi trong chu kì sống, gồm sinh trưởng, phân hóa tế bào và phát sinh hình thái cơ quan, cơ thể. Ba quá trình này liên quan mật thiết và đan xen nhau. Vòng đời là chuỗi thay đổi lặp lại từ khi sinh ra đến khi sinh sản, già rồi chết; hiểu vòng đời giúp chăm sóc cây trồng, vật nuôi đúng giai đoạn và phòng trừ sinh vật gây hại. Tuổi thọ do di truyền quy định và chịu ảnh hưởng của chế độ ăn, luyện tập, lối sống và môi trường.',
    'Growth is the increase in body size and mass; development is every change in the life cycle, including growth, cell differentiation and the forming of organs and body shape. The three are closely linked and overlap. A life cycle is the repeated series of changes from birth to reproduction, ageing and death; knowing it helps care for crops and livestock at the right stage and control pests. Lifespan is set by heredity and affected by diet, exercise, way of life and the environment.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu khái niệm và ví dụ như sách giáo khoa; SimLab không tính tốc độ sinh trưởng hay tuổi thọ.',
      'The lesson gives only the ideas and examples, as the textbook does; SimLab computes no growth rate or lifespan.',
    ),
  ],
  limits: [
    L(
      'Tuổi thọ của các loài trong sách không có trong bài học này.',
      'The lifespans of species given in the book are not part of this lesson.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH11', lesson: 19 },
    question: L(
      'Vì sao một hạt có thể phát triển thành một cây xanh, một trứng thụ tinh có thể phát triển thành một con vật?',
      'Why can a seed grow into a green plant, and a fertilised egg into an animal?',
    ),
    choices: [
      {
        id: 'phan-hoa',
        text: L(
          'Tế bào phân chia, phân hóa và hình thành các cơ quan',
          'Cells divide, differentiate and form organs',
        ),
      },
      { id: 'phinh-to', text: L('Tế bào ban đầu phình to dần', 'The first cell just swells up') },
      { id: 'nuoc', text: L('Chỉ nhờ hút thật nhiều nước', 'Only by taking up a lot of water') },
      {
        id: 'co-san',
        text: L(
          'Mọi cơ quan đã có sẵn, chỉ to ra',
          'Every organ is already there and only gets bigger',
        ),
      },
    ],
    answer: 'phan-hoa',
    answerWhy: L(
      'Hợp tử phân chia tạo nhiều tế bào (sinh trưởng); các tế bào biệt hóa thành những loại khác nhau (phân hóa tế bào) và tạo nên các cơ quan, hình dạng cơ thể (phát sinh hình thái). Nhờ vậy một tế bào ban đầu phát triển thành cơ thể hoàn chỉnh.',
      'The zygote divides into many cells (growth); the cells specialise into different kinds (differentiation) and build organs and the body’s shape (morphogenesis). That is how one starting cell develops into a whole organism.',
    ),
    activities: [
      {
        kind: 'sort',
        id: 'dau-hieu',
        prompt: L(
          'Xếp mỗi biến đổi vào dấu hiệu sinh trưởng hoặc dấu hiệu phân hóa, phát sinh hình thái.',
          'Put each change under growth or under differentiation and morphogenesis.',
        ),
        groups: [
          { id: 'sinh-truong', label: L('Sinh trưởng', 'Growth') },
          {
            id: 'phat-trien',
            label: L('Phân hóa, phát sinh hình thái', 'Differentiation, morphogenesis'),
          },
        ],
        items: [
          {
            id: 'so-luong',
            text: L('Số lượng tế bào tăng nhờ phân bào', 'Cell number rises by cell division'),
            group: 'sinh-truong',
            why: L('Dấu hiệu đặc trưng của sinh trưởng.', 'A typical sign of growth.'),
          },
          {
            id: 'kich-thuoc',
            text: L(
              'Tế bào tăng kích thước, tích lũy chất',
              'Cells get bigger and store substances',
            ),
            group: 'sinh-truong',
            why: L(
              'Tế bào tổng hợp và tích lũy chất nên to ra.',
              'Cells build up and store material, so they enlarge.',
            ),
          },
          {
            id: 'cay-cao',
            text: L('Cây non cao lên, nặng hơn', 'A seedling gets taller and heavier'),
            group: 'sinh-truong',
            why: L('Tăng kích thước và khối lượng cơ thể.', 'More body size and mass.'),
          },
          {
            id: 'hoa-qua',
            text: L(
              'Tế bào ở đỉnh chồi chuyển thành tế bào tạo hoa',
              'Cells at the shoot tip turn into flower-making cells',
            ),
            group: 'phat-trien',
            why: L(
              'Tế bào thay đổi cấu trúc và chuyên hóa chức năng.',
              'Cells change their structure and specialise.',
            ),
          },
          {
            id: 'bo-cau',
            text: L(
              'Chim bồ câu có hình dạng riêng, khác các loài khác',
              'A pigeon takes its own shape, unlike other species',
            ),
            group: 'phat-trien',
            why: L(
              'Phát sinh hình thái tạo hình dạng của cơ quan, cơ thể.',
              'Morphogenesis gives organs and bodies their shape.',
            ),
          },
          {
            id: 'giao-tu',
            text: L(
              'Cơ quan sinh sản hình thành, tạo ra giao tử',
              'Reproductive organs form and make gametes',
            ),
            group: 'phat-trien',
            why: L(
              'Một nhóm tế bào phân hóa thành cơ quan sinh sản.',
              'A group of cells differentiates into reproductive organs.',
            ),
          },
        ],
      },
      {
        kind: 'order',
        id: 'vong-doi-ech',
        prompt: L(
          'Xếp các giai đoạn trong vòng đời của ếch theo đúng thứ tự.',
          'Put the stages of a frog’s life cycle in order.',
        ),
        items: [
          {
            id: 'trung',
            text: L('Trứng đã thụ tinh', 'Fertilised eggs'),
            why: L(
              'Vòng đời của loài sinh sản hữu tính bắt đầu từ hợp tử.',
              'The life cycle of a sexually reproducing species starts with a zygote.',
            ),
          },
          {
            id: 'phoi',
            text: L('Phôi phát triển từ hợp tử', 'An embryo develops from the zygote'),
            why: L(
              'Hợp tử phân chia nhiều lần tạo phôi.',
              'The zygote divides many times into an embryo.',
            ),
          },
          {
            id: 'nong-noc',
            text: L('Nòng nọc', 'Tadpole'),
            why: L(
              'Con non sống trong nước, thở bằng mang.',
              'The young live in water and breathe with gills.',
            ),
          },
          {
            id: 'moc-chan',
            text: L('Nòng nọc mọc chân', 'Tadpole with legs'),
            why: L('Hình thái thay đổi dần.', 'Its shape changes step by step.'),
          },
          {
            id: 'ech-con',
            text: L('Ếch con chưa tiêu biến đuôi', 'Young frog still with a tail'),
            why: L('Đuôi tiêu biến dần.', 'The tail shrinks away.'),
          },
          {
            id: 'truong-thanh',
            text: L(
              'Ếch trưởng thành sinh sản, già và chết',
              'Adult frog reproduces, ages and dies',
            ),
            why: L(
              'Ếch trưởng thành đẻ trứng, vòng đời lặp lại.',
              'The adult lays eggs and the cycle begins again.',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'ung-dung',
        prompt: L(
          'Ghép mỗi hiểu biết về vòng đời với cách áp dụng.',
          'Match each piece of life-cycle knowledge with how it is used.',
        ),
        pairs: [
          {
            id: 'hat-nay-mam',
            left: L(
              'Hạt cần đủ nước, độ ẩm để nảy mầm',
              'Seeds need enough water and moisture to sprout',
            ),
            right: L(
              'Tưới đủ nước, giữ độ ẩm của đất khi gieo hạt',
              'Water well and keep the soil moist when sowing',
            ),
            why: L(
              'Chăm sóc phù hợp từng giai đoạn của cây.',
              'Care fitted to each stage of the plant.',
            ),
          },
          {
            id: 'ga',
            left: L(
              'Gà ở giai đoạn sinh trưởng lớn nhanh hơn gà đã trưởng thành',
              'Chickens gain weight faster while growing than as adults',
            ),
            right: L(
              'Cho gà ăn đầy đủ ở giai đoạn sinh trưởng để thu nhiều thịt',
              'Feed chickens well while they grow to get more meat',
            ),
            why: L(
              'Cùng một lượng thức ăn cho nhiều thịt hơn ở giai đoạn này.',
              'The same food gives more meat at this stage.',
            ),
          },
          {
            id: 'sau',
            left: L('Sâu bướm phá hoại cây xanh', 'Caterpillars damage green plants'),
            right: L(
              'Dùng thuốc diệt sâu ở giai đoạn sâu',
              'Use insecticide at the caterpillar stage',
            ),
            why: L(
              'Tiêu diệt sinh vật gây hại ở giai đoạn dễ diệt nhất.',
              'Pests are killed at their most vulnerable stage.',
            ),
          },
          {
            id: 'muoi',
            left: L(
              'Muỗi đẻ trứng trong nước đọng, bọ gậy sống trong nước',
              'Mosquitoes lay eggs in still water, where the larvae live',
            ),
            right: L(
              'Thả cá ăn bọ gậy, loại bỏ vũng nước đọng',
              'Put fish in to eat the larvae, clear away standing water',
            ),
            why: L(
              'Diệt muỗi ở giai đoạn bọ gậy.',
              'Mosquitoes are controlled at the larval stage.',
            ),
          },
        ],
      },
    ],
  },
};
