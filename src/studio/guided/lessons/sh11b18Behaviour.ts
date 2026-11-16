import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH11 KNTT Bài 18 "Tập tính ở động vật" (printed pages 115–124), in SimLab's own words. Checked
 * against the pages on 17/11/2026: innate and learned behaviour with the book's examples (mọt gỗ,
 * nhện giăng tơ, hải âu con mổ chấm đỏ; động vật học sợ người), the common kinds of behaviour
 * (kiếm ăn, bảo vệ lãnh thổ, sinh sản, di cư, xã hội) and the forms of learning (quen nhờn, in vết,
 * nhận biết không gian, học liên kết, học xã hội, giải quyết vấn đề) with the book's examples. The
 * prediction is the book's question 2 (tr. 123). SH11-GL-13.
 */
export const sh11b18Behaviour: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh11-behaviour',
  topic: 'animalBehaviour',
  title: L('Tập tính ở động vật', 'Animal behaviour'),
  objectives: [
    L(
      'Dự đoán hình thức học tập khi chó không sủa người quen nhưng sủa người lạ.',
      'Predict the form of learning when a dog does not bark at people it knows but barks at strangers.',
    ),
    L(
      'Phân loại tập tính bẩm sinh và tập tính học được; ghép mỗi hình thức học tập với ví dụ.',
      'Sort innate and learned behaviour; match each form of learning with an example.',
    ),
    L(
      'Ghép mỗi dạng tập tính phổ biến với ví dụ của nó.',
      'Match each common kind of behaviour with its example.',
    ),
  ],
  hints: [
    L(
      'Tập tính bẩm sinh sinh ra đã có, di truyền; tập tính học được hình thành qua học tập và kinh nghiệm.',
      'Innate behaviour is present from birth and inherited; learned behaviour comes from learning and experience.',
    ),
    L(
      'Quen nhờn là khi động vật thôi đáp ứng một kích thích lặp lại nhiều lần mà không kèm nguy hiểm.',
      'Habituation is when an animal stops answering a stimulus repeated many times without danger.',
    ),
  ],
  questions: [
    L(
      'Vì sao khi ấp trứng sếu bằng lò ấp, người ta không cho sếu con nhìn thấy người hay vật chuyển động khác?',
      'Why, when crane eggs are hatched in an incubator, are the chicks kept from seeing people or other moving things?',
    ),
  ],
  expectedConclusion: L(
    'Tập tính là những hành động của động vật trả lời kích thích từ môi trường, giúp chúng sinh tồn, sinh sản và cân bằng nội môi. Tập tính bẩm sinh di truyền, đặc trưng cho loài và bền vững; tập tính học được hình thành trong đời sống. Các dạng tập tính phổ biến là kiếm ăn, bảo vệ lãnh thổ, sinh sản, di cư và xã hội; pheromone là tín hiệu hóa học giữa các cá thể cùng loài. Động vật học tập qua quen nhờn, in vết, nhận biết không gian, học liên kết, học xã hội và giải quyết vấn đề.',
    'Behaviour is what animals do in answer to stimuli; it helps them survive, reproduce and keep a steady internal state. Innate behaviour is inherited, typical of the species and lasting; learned behaviour forms during life. Common kinds are feeding, defending territory, reproduction, migration and social behaviour; pheromones are chemical signals between members of a species. Animals learn by habituation, imprinting, spatial learning, associative learning, social learning and problem solving.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu các khái niệm và ví dụ như sách giáo khoa.',
      'The lesson gives only the ideas and examples, as the textbook does.',
    ),
  ],
  limits: [
    L(
      'Phần quan sát tập tính ngoài thực tế không có trong bài học này.',
      'The field observation of behaviour is not part of this lesson.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH11', lesson: 18 },
    question: L(
      'Con chó sủa khi gặp người lạ nhưng không sủa khi gặp người quen trong nhà. Đây là hình thức học tập nào?',
      'A dog barks at strangers but not at the people it lives with. Which form of learning is this?',
    ),
    choices: [
      { id: 'quen-nhon', text: L('Quen nhờn', 'Habituation') },
      { id: 'in-vet', text: L('In vết', 'Imprinting') },
      { id: 'giai-quyet', text: L('Giải quyết vấn đề', 'Problem solving') },
      {
        id: 'bam-sinh',
        text: L('Không học tập: tập tính bẩm sinh', 'No learning: innate behaviour'),
      },
    ],
    answer: 'quen-nhon',
    answerWhy: L(
      'Người quen xuất hiện lặp đi lặp lại mà không gây nguy hiểm, nên chó thôi đáp ứng (không sủa). Đó là quen nhờn, hình thức học tập đơn giản nhất. Người lạ là kích thích mới nên chó vẫn sủa.',
      'The family appear again and again without any danger, so the dog stops reacting (it does not bark). That is habituation, the simplest form of learning. A stranger is a new stimulus, so the dog still barks.',
    ),
    activities: [
      {
        kind: 'sort',
        id: 'bam-sinh-hoc',
        prompt: L(
          'Xếp mỗi ví dụ vào tập tính bẩm sinh hoặc tập tính học được.',
          'Put each example under innate or learned behaviour.',
        ),
        groups: [
          { id: 'bam-sinh', label: L('Tập tính bẩm sinh', 'Innate behaviour') },
          { id: 'hoc-duoc', label: L('Tập tính học được', 'Learned behaviour') },
        ],
        items: [
          {
            id: 'nhen',
            text: L(
              'Nhện giăng tơ thành lưới ngay lần đầu',
              'A spider spins a web right the first time',
            ),
            group: 'bam-sinh',
            why: L(
              'Bản năng: chuỗi hành động có thứ tự do gene quy định.',
              'An instinct: an ordered chain of actions set by genes.',
            ),
          },
          {
            id: 'hai-au',
            text: L(
              'Hải âu con mổ vào chấm đỏ trên mỏ chim mẹ để đòi ăn',
              'A gull chick pecks the red spot on its parent’s beak to beg for food',
            ),
            group: 'bam-sinh',
            why: L(
              'Kích hoạt bởi một kích thích dấu hiệu đơn giản.',
              'Set off by a simple sign stimulus.',
            ),
          },
          {
            id: 'mot-go',
            text: L(
              'Mọt gỗ di chuyển nhanh khỏi chỗ khô, chậm lại ở chỗ ẩm',
              'Woodlice move fast out of dry places and slow down in damp ones',
            ),
            group: 'bam-sinh',
            why: L(
              'Tập tính sinh ra đã có, giúp chúng đến nơi sống tốt hơn.',
              'Present from birth, it brings them to better places to live.',
            ),
          },
          {
            id: 'so-nguoi',
            text: L(
              'Động vật bị săn bắt học được rằng gặp người phải chạy trốn',
              'Hunted animals learn to run from people',
            ),
            group: 'hoc-duoc',
            why: L(
              'Hình thành qua kinh nghiệm trong đời sống.',
              'Formed by experience during life.',
            ),
          },
          {
            id: 'xiec',
            text: L('Cá heo được huấn luyện biểu diễn', 'A dolphin trained to perform'),
            group: 'hoc-duoc',
            why: L(
              'Học qua thưởng, phạt: điều kiện hóa hành động.',
              'Learned through reward: operant conditioning.',
            ),
          },
          {
            id: 'trau-keng',
            text: L('Trâu bò về chuồng khi nghe tiếng kẻng', 'Cattle go home on hearing a gong'),
            group: 'hoc-duoc',
            why: L(
              'Liên kết tiếng kẻng với việc về chuồng: học liên kết.',
              'Linking the gong with going home: associative learning.',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'hinh-thuc',
        prompt: L(
          'Ghép mỗi hình thức học tập với ví dụ của sách.',
          'Match each form of learning with the book’s example.',
        ),
        pairs: [
          {
            id: 'quen-nhon',
            left: L('Quen nhờn', 'Habituation'),
            right: L(
              'Rùa thôi rụt đầu khi hòn đá nhỏ được thả cạnh nó nhiều lần',
              'A tortoise stops pulling in its head when a pebble is dropped beside it again and again',
            ),
            why: L(
              'Kích thích lặp lại không kèm nguy hiểm.',
              'A repeated stimulus with no danger.',
            ),
          },
          {
            id: 'in-vet',
            left: L('In vết', 'Imprinting'),
            right: L(
              'Vịt con đi theo vật chuyển động đầu tiên nó nhìn thấy',
              'Ducklings follow the first moving thing they see',
            ),
            why: L(
              'Học nhanh trong giai đoạn then chốt sau khi nở.',
              'Fast learning in the critical period after hatching.',
            ),
          },
          {
            id: 'dap-ung',
            left: L('Điều kiện hóa đáp ứng', 'Classical conditioning'),
            right: L(
              'Chó tiết nước bọt khi nghe tiếng máy gõ nhịp',
              'A dog salivates at the sound of a metronome',
            ),
            why: L(
              'Thí nghiệm của Pavlov: tiếng gõ nhịp đi kèm thức ăn nhiều lần.',
              'Pavlov’s experiment: the metronome paired many times with food.',
            ),
          },
          {
            id: 'hanh-dong',
            left: L('Điều kiện hóa hành động', 'Operant conditioning'),
            right: L('Chuột nhấn bàn đạp để có thức ăn', 'A rat presses a lever to get food'),
            why: L(
              'Thí nghiệm của Skinner: hành vi đi kèm phần thưởng.',
              'Skinner’s experiment: behaviour linked to a reward.',
            ),
          },
          {
            id: 'xa-hoi',
            left: L('Học xã hội', 'Social learning'),
            right: L(
              'Tinh tinh con đập vỡ quả cọ dầu bằng hai hòn đá như con trưởng thành',
              'A young chimpanzee cracks oil-palm nuts with two stones like the adults',
            ),
            why: L('Học bằng quan sát và bắt chước.', 'Learning by watching and copying.'),
          },
          {
            id: 'giai-quyet',
            left: L('Giải quyết vấn đề', 'Problem solving'),
            right: L(
              'Tinh tinh xếp chồng các hộp để lấy quả chuối trên cao',
              'A chimpanzee stacks boxes to reach a banana hanging high up',
            ),
            why: L('Dạng học tập phức tạp nhất.', 'The most complex form of learning.'),
          },
        ],
      },
      {
        kind: 'match',
        id: 'dang',
        prompt: L(
          'Ghép mỗi dạng tập tính với ví dụ của nó.',
          'Match each kind of behaviour with its example.',
        ),
        pairs: [
          {
            id: 'kiem-an',
            left: L('Kiếm ăn', 'Feeding'),
            right: L(
              'Thỏ rời nơi ẩn nấp tìm lá, củ, luôn cảnh giác kẻ săn mồi',
              'A rabbit leaves cover to find leaves and roots, watching for predators',
            ),
            why: L(
              'Lợi là có thức ăn, bất lợi là tốn năng lượng và dễ bị ăn thịt.',
              'It brings food but costs energy and risks being eaten.',
            ),
          },
          {
            id: 'lanh-tho',
            left: L('Bảo vệ lãnh thổ', 'Defending territory'),
            right: L(
              'Chim đực đậu trên cành cao hót báo khu vực đã có chủ',
              'A male bird sings from a high branch to say the area is taken',
            ),
            why: L(
              'Bảo vệ nguồn thức ăn, nơi ở và nơi sinh sản.',
              'It protects food, shelter and a breeding place.',
            ),
          },
          {
            id: 'di-cu',
            left: L('Di cư', 'Migration'),
            right: L(
              'Đàn ngỗng trời bay đi rồi bay về theo mùa',
              'Wild geese fly away and back with the seasons',
            ),
            why: L(
              'Do khan hiếm thức ăn và thời tiết khắc nghiệt.',
              'Driven by scarce food and harsh weather.',
            ),
          },
          {
            id: 'xa-hoi-dan',
            left: L('Tập tính xã hội', 'Social behaviour'),
            right: L('Chó sói sống và săn mồi theo bầy đàn', 'Wolves live and hunt in packs'),
            why: L(
              'Gồm tập tính thứ bậc, hợp tác, vị tha.',
              'It includes ranking, cooperation and altruism.',
            ),
          },
          {
            id: 'sinh-san',
            left: L('Sinh sản', 'Reproduction'),
            right: L(
              'Chim làm tổ, ấp trứng, chăm sóc con non',
              'Birds build nests, sit on eggs and feed their young',
            ),
            why: L(
              'Tập tính sinh sản hầu hết mang tính bản năng.',
              'Reproductive behaviour is mostly instinctive.',
            ),
          },
        ],
      },
    ],
  },
};
