import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * VL12 KNTT Bài 8 "Mô hình động học phân tử chất khí" (printed pages 34–36), in SimLab's own words.
 * Checked against the pages on 17/11/2026: Brownian motion of smoke in air and its speeding up when
 * the air is heated (Hình 8.1, 8.2, tr. 34), random motion and collisions (Hình 8.3), weak forces
 * between gas molecules (tr. 35), the three statements of the kinetic model and Bảng 8.1 (tr. 35),
 * the ideal gas (tr. 36) and that an ideal gas is one that follows Boyle's and Charles's laws
 * exactly while a real gas departs from them at very high pressure or very low temperature
 * (Bài 10, tr. 44). VL12-GL-2.
 */
export const vl12b08Gas: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'physics',
  id: 'guided.vl12-gas-model',
  topic: 'gasKinetic',
  title: L('Mô hình động học phân tử chất khí', 'The kinetic model of gases'),
  objectives: [
    L(
      'Dự đoán hạt khói chuyển động thế nào khi không khí quanh nó nóng lên, và giải thích bằng chuyển động của phân tử khí.',
      'Predict how smoke particles move when the air around them warms, and explain it with the motion of gas molecules.',
    ),
    L(
      'Ghép mỗi nội dung của mô hình động học phân tử chất khí với thí nghiệm hoặc hiện tượng làm cơ sở cho nó.',
      'Match each statement of the kinetic model of gases with the experiment or phenomenon behind it.',
    ),
    L('Phân biệt khí lí tưởng với khí thực.', 'Tell an ideal gas from a real gas.'),
  ],
  hints: [
    L(
      'Hạt khói lớn hơn phân tử khí rất nhiều; nó bị các phân tử khí chuyển động hỗn loạn va chạm từ mọi phía.',
      'A smoke particle is far larger than a gas molecule; randomly moving gas molecules hit it from every side.',
    ),
    L(
      'Khoảng cách giữa các phân tử càng lớn thì lực liên kết giữa chúng càng yếu.',
      'The farther apart the molecules, the weaker the forces between them.',
    ),
  ],
  questions: [
    L(
      'Vì sao chất khí luôn chiếm toàn bộ dung tích bình chứa, còn chất lỏng thì không?',
      'Why does a gas always fill its whole container while a liquid does not?',
    ),
  ],
  expectedConclusion: L(
    'Chất khí được cấu tạo từ các phân tử có kích thước rất nhỏ so với khoảng cách giữa chúng. Các phân tử chuyển động hỗn loạn, không ngừng, nhiệt độ càng cao thì chuyển động càng nhanh; khi chuyển động chúng va chạm với nhau và với thành bình, gây áp suất lên thành bình. Khí lí tưởng là mô hình đơn giản hơn: phân tử coi là chất điểm, không tương tác khi chưa va chạm, va chạm hoàn toàn đàn hồi; khí lí tưởng tuân theo đúng các định luật Boyle và Charles, còn khí thực lệch khỏi các định luật này ở áp suất rất cao hoặc nhiệt độ rất thấp.',
    'A gas is made of molecules that are very small compared with the distances between them. They move at random and never stop, faster when hotter; they hit one another and the walls, pressing on the walls. The ideal gas is a simpler model: the molecules are point particles that do not interact until they collide, and collisions are perfectly elastic; an ideal gas follows Boyle’s and Charles’s laws exactly, while a real gas departs from them at very high pressure or very low temperature.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu mô hình như sách giáo khoa; SimLab không tính tốc độ hay số phân tử nào ở đây.',
      'The lesson gives only the model, as the textbook does; SimLab computes no speeds or numbers of molecules here.',
    ),
  ],
  limits: [
    L(
      'Áp suất, thể tích, nhiệt độ và tốc độ của phân tử khí được tính trong bài “Các định luật của khí lí tưởng”.',
      'Pressure, volume, temperature and molecular speeds are computed in the lesson “Ideal gas laws”.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'VL12', lesson: 8 },
    question: L(
      'Quan sát hạt khói trong ống thủy tinh chứa không khí qua kính hiển vi. Nếu làm không khí trong ống nóng lên thì các hạt khói chuyển động thế nào?',
      'Smoke particles in a glass tube of air are watched through a microscope. If the air in the tube is warmed, how do the smoke particles move?',
    ),
    choices: [
      { id: 'nhanh-hon', text: L('Nhanh hơn', 'Faster') },
      { id: 'cham-hon', text: L('Chậm hơn', 'Slower') },
      { id: 'khong-doi', text: L('Như cũ', 'The same as before') },
      { id: 'dung-lai', text: L('Dừng lại', 'They stop') },
    ],
    answer: 'nhanh-hon',
    answerWhy: L(
      'Nhiệt độ của khí càng cao thì các phân tử khí chuyển động hỗn loạn càng nhanh và va chạm vào hạt khói càng mạnh, nên hạt khói chuyển động hỗn loạn nhanh hơn.',
      'The hotter the gas, the faster its molecules move at random and the harder they hit the smoke particles, so the particles jiggle faster.',
    ),
    activities: [
      {
        kind: 'match',
        id: 'co-so',
        prompt: L(
          'Ghép mỗi nội dung của mô hình với thí nghiệm hoặc hiện tượng làm cơ sở cho nó.',
          'Match each statement of the model with the experiment or phenomenon behind it.',
        ),
        pairs: [
          {
            id: 'hon-loan',
            left: L(
              'Phân tử khí chuyển động hỗn loạn, không ngừng',
              'Gas molecules move at random and never stop',
            ),
            right: L(
              'Chuyển động Brown của hạt khói trong không khí',
              'Brownian motion of smoke in air',
            ),
            why: L(
              'Quỹ đạo gấp khúc, hỗn loạn của hạt khói cho thấy các phân tử khí va chạm vào nó từ mọi phía.',
              'The zig-zag path of a smoke particle shows gas molecules hitting it from every side.',
            ),
          },
          {
            id: 'kich-thuoc',
            left: L(
              'Kích thước phân tử khí rất nhỏ so với khoảng cách giữa chúng',
              'Gas molecules are tiny compared with the distances between them',
            ),
            right: L(
              'Cùng nhiệt độ và áp suất, khối lượng riêng của chất ở thể khí nhỏ hơn rất nhiều so với thể lỏng, thể rắn',
              'At the same temperature and pressure, a substance is far less dense as a gas than as a liquid or solid',
            ),
            why: L(
              'Cùng một khối lượng chất chiếm thể tích lớn hơn nhiều khi ở thể khí.',
              'The same mass of substance takes up far more room as a gas.',
            ),
          },
          {
            id: 'va-cham',
            left: L(
              'Phân tử khí va chạm với nhau và với thành bình',
              'Gas molecules hit one another and the walls',
            ),
            right: L(
              'Chất khí gây áp suất lên thành bình theo mọi hướng',
              'A gas presses on the walls in every direction',
            ),
            why: L(
              'Mỗi lần va chạm với thành bình, phân tử tác dụng lực lên thành bình.',
              'Each time a molecule hits a wall it pushes on the wall.',
            ),
          },
          {
            id: 'luc-yeu',
            left: L(
              'Lực liên kết giữa các phân tử khí rất yếu',
              'The forces between gas molecules are very weak',
            ),
            right: L(
              'Chất khí luôn chiếm toàn bộ dung tích bình chứa',
              'A gas always fills its whole container',
            ),
            why: L(
              'Không có gì giữ các phân tử lại gần nhau, nên chúng tràn khắp bình.',
              'Nothing holds the molecules together, so they spread through the whole container.',
            ),
          },
        ],
      },
      {
        kind: 'order',
        id: 'khoang-cach',
        prompt: L(
          'Xếp các thể của cùng một chất theo khoảng cách giữa các phân tử, từ nhỏ nhất đến lớn nhất.',
          'Order the states of one substance by the distance between molecules, smallest first.',
        ),
        items: [
          {
            id: 'ran',
            text: L('Thể rắn', 'Solid'),
            why: L(
              'Các phân tử rất gần nhau, sắp xếp có trật tự.',
              'The molecules are very close and ordered.',
            ),
          },
          {
            id: 'long',
            text: L('Thể lỏng', 'Liquid'),
            why: L(
              'Các phân tử gần nhau nhưng kém trật tự hơn.',
              'The molecules are close but less ordered.',
            ),
          },
          {
            id: 'khi',
            text: L('Thể khí', 'Gas'),
            why: L(
              'Khoảng cách rất lớn so với kích thước phân tử, nên lực liên kết rất yếu.',
              'The distances are huge compared with the molecules, so the forces are very weak.',
            ),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'li-tuong',
        prompt: L(
          'Xếp mỗi đặc điểm vào khí lí tưởng (mô hình) hoặc khí thực.',
          'Put each feature under ideal gas (the model) or real gas.',
        ),
        groups: [
          { id: 'li-tuong', label: L('Khí lí tưởng', 'Ideal gas') },
          { id: 'thuc', label: L('Khí thực', 'Real gas') },
        ],
        items: [
          {
            id: 'chat-diem',
            text: L('Phân tử được coi là chất điểm', 'Molecules taken as point particles'),
            group: 'li-tuong',
            why: L('Bỏ qua thể tích riêng của phân tử.', 'The molecules’ own volume is ignored.'),
          },
          {
            id: 'khong-tuong-tac',
            text: L(
              'Phân tử không tương tác khi chưa va chạm',
              'Molecules do not interact until they collide',
            ),
            group: 'li-tuong',
            why: L(
              'Bỏ qua lực hút, lực đẩy giữa các phân tử ở xa nhau.',
              'The pull and push between distant molecules are ignored.',
            ),
          },
          {
            id: 'dan-hoi',
            text: L('Va chạm hoàn toàn đàn hồi', 'Collisions perfectly elastic'),
            group: 'li-tuong',
            why: L(
              'Va chạm không làm mất động năng của các phân tử.',
              'Collisions take no kinetic energy away from the molecules.',
            ),
          },
          {
            id: 'dung-dinh-luat',
            text: L(
              'Tuân theo đúng các định luật Boyle và Charles',
              'Follows Boyle’s and Charles’s laws exactly',
            ),
            group: 'li-tuong',
            why: L(
              'Đây chính là cách sách định nghĩa khí lí tưởng.',
              'This is how the book defines an ideal gas.',
            ),
          },
          {
            id: 'co-luc',
            text: L(
              'Giữa các phân tử có lực hút và lực đẩy, dù rất yếu',
              'Its molecules attract and repel one another, if only weakly',
            ),
            group: 'thuc',
            why: L(
              'Lực liên kết giữa các phân tử khí rất yếu nhưng vẫn có.',
              'The forces between gas molecules are very weak but present.',
            ),
          },
          {
            id: 'lech',
            text: L(
              'Lệch khỏi định luật Boyle và Charles ở áp suất rất cao hoặc nhiệt độ rất thấp',
              'Departs from Boyle’s and Charles’s laws at very high pressure or very low temperature',
            ),
            group: 'thuc',
            why: L(
              'Ở điều kiện bình thường sự khác biệt nhỏ, nên vẫn áp dụng được các định luật khi không cần độ chính xác cao.',
              'Under ordinary conditions the difference is small, so the laws still apply when high accuracy is not needed.',
            ),
          },
        ],
      },
    ],
  },
};
