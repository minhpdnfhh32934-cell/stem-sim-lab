import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * VL12 KNTT Bài 1 "Cấu trúc của chất. Sự chuyển thể" (printed pages 6–9), in SimLab's own words.
 * Checked against the pages on 17/11/2026: the kinetic molecular model (separate particles, never
 * still and faster when hotter, attractive and repulsive forces), Brownian motion, the structure of
 * solids, liquids and gases (Hình 1.3), the six changes of state (Hình 1.4), why a liquid cools
 * while it evaporates (the question on tr. 8, the prediction) and crystalline versus amorphous
 * solids ("Em có biết", tr. 8). VL12-GL-1.
 */
export const vl12b01Matter: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'physics',
  id: 'guided.vl12-matter',
  topic: 'matterStructure',
  title: L('Cấu trúc của chất và sự chuyển thể', 'The structure of matter and changes of state'),
  objectives: [
    L(
      'Dự đoán nhiệt độ của chất lỏng thay đổi thế nào khi nó bay hơi, và giải thích bằng mô hình động học phân tử.',
      'Predict how a liquid’s temperature changes as it evaporates, and explain it with the kinetic model.',
    ),
    L(
      'Phân loại đặc điểm của các phân tử ở thể rắn, thể lỏng, thể khí.',
      'Sort the features of the molecules in solids, liquids and gases.',
    ),
    L(
      'Ghép mỗi quá trình chuyển thể với chiều của nó; phân biệt chất rắn kết tinh và vô định hình.',
      'Match each change of state with its direction; tell crystalline and amorphous solids apart.',
    ),
  ],
  hints: [
    L(
      'Nhiệt độ của vật càng cao thì các phân tử chuyển động càng nhanh, tức động năng trung bình của chúng càng lớn.',
      'The hotter a body, the faster its molecules move, that is the larger their average kinetic energy.',
    ),
    L(
      'Khoảng cách giữa các phân tử càng lớn thì lực liên kết giữa chúng càng yếu.',
      'The farther apart the molecules, the weaker the forces between them.',
    ),
  ],
  questions: [
    L(
      'Khi nước đang sôi, năng lượng nước nhận từ nguồn nhiệt có làm các phân tử chuyển động nhanh hơn không? Vì sao?',
      'While water boils, does the energy it takes from the heater make its molecules move faster? Why?',
    ),
  ],
  expectedConclusion: L(
    'Theo mô hình động học phân tử, chất được cấu tạo từ các phân tử riêng biệt, chuyển động không ngừng, càng nhanh khi nhiệt độ càng cao, và giữa chúng có lực hút, lực đẩy. Ở thể khí các phân tử ở xa nhau, chuyển động hỗn loạn; ở thể lỏng chúng gần nhau, dao động và di chuyển được; ở thể rắn chúng rất gần nhau, sắp xếp có trật tự và dao động quanh vị trí cân bằng. Khi bay hơi, các phân tử có động năng lớn thoát ra khỏi mặt thoáng, nên động năng trung bình của các phân tử còn lại giảm và chất lỏng nguội đi. Khi nóng chảy hay đang sôi, năng lượng nhận được dùng để chuyển thể nên nhiệt độ không đổi.',
    'In the kinetic model, matter is made of separate molecules that never stop moving, move faster when hotter, and attract and repel one another. In a gas the molecules are far apart and move at random; in a liquid they are close, vibrate and move about; in a solid they are very close, ordered, and vibrate about fixed positions. When a liquid evaporates, the molecules with large kinetic energy escape from the surface, so the average kinetic energy of those left drops and the liquid cools. While a solid melts or a liquid boils, the energy taken in changes the state, so the temperature stays the same.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu mô hình và các quá trình như sách giáo khoa; SimLab không tính tốc độ hay số phân tử nào.',
      'The lesson gives only the model and the processes, as the textbook does; SimLab computes no speeds or numbers of molecules.',
    ),
  ],
  limits: [
    L(
      'Nhiệt lượng cần cho việc đun nóng và chuyển thể được tính trong bài “Nội năng, nhiệt độ và nhiệt lượng”.',
      'The heat needed for heating and changes of state is computed in the lesson “Internal energy, temperature and heat”.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'VL12', lesson: 1 },
    question: L(
      'Một cốc nước để ngoài trời, nước bay hơi dần qua mặt thoáng. Trong khi bay hơi, nhiệt độ của phần nước còn lại trong cốc thay đổi thế nào (nếu không nhận thêm nhiệt)?',
      'A glass of water stands outside and slowly evaporates from its surface. While it evaporates, how does the temperature of the water left in the glass change (if it takes in no heat)?',
    ),
    choices: [
      { id: 'giam', text: L('Giảm', 'It falls') },
      { id: 'tang', text: L('Tăng', 'It rises') },
      { id: 'khong-doi', text: L('Không đổi', 'It stays the same') },
      { id: 'tang-giam', text: L('Tăng rồi giảm', 'It rises, then falls') },
    ],
    answer: 'giam',
    answerWhy: L(
      'Các phân tử gần mặt thoáng có động năng đủ lớn mới thắng được lực liên kết và thoát ra ngoài. Những phân tử nhanh nhất rời đi, nên động năng trung bình của các phân tử còn lại giảm: nhiệt độ của nước giảm.',
      'Only molecules near the surface with enough kinetic energy overcome the attraction and escape. The fastest ones leave, so the average kinetic energy of those left drops: the water cools.',
    ),
    activities: [
      {
        kind: 'sort',
        id: 'ba-the',
        prompt: L(
          'Xếp mỗi đặc điểm vào thể rắn, thể lỏng hoặc thể khí.',
          'Put each feature under solid, liquid or gas.',
        ),
        groups: [
          { id: 'ran', label: L('Thể rắn', 'Solid') },
          { id: 'long', label: L('Thể lỏng', 'Liquid') },
          { id: 'khi', label: L('Thể khí', 'Gas') },
        ],
        items: [
          {
            id: 'ran-trat-tu',
            text: L(
              'Phân tử rất gần nhau, sắp xếp có trật tự',
              'Molecules very close and in order',
            ),
            group: 'ran',
            why: L(
              'Lực liên kết mạnh giữ phân tử ở vị trí xác định.',
              'Strong forces hold the molecules in place.',
            ),
          },
          {
            id: 'ran-dao-dong',
            text: L(
              'Phân tử chỉ dao động quanh vị trí cân bằng',
              'Molecules only vibrate about fixed positions',
            ),
            group: 'ran',
            why: L(
              'Vì vậy vật rắn có thể tích và hình dạng riêng, rất khó nén.',
              'So a solid keeps its own volume and shape and is very hard to squeeze.',
            ),
          },
          {
            id: 'long-gan',
            text: L(
              'Phân tử gần nhau nhưng kém trật tự hơn, dao động và di chuyển được',
              'Molecules close but less ordered; they vibrate and move about',
            ),
            group: 'long',
            why: L(
              'Chất lỏng có thể tích riêng nhưng không có hình dạng riêng.',
              'A liquid has its own volume but not its own shape.',
            ),
          },
          {
            id: 'long-binh',
            text: L(
              'Có thể tích riêng, có hình dạng của phần bình chứa nó',
              'Has its own volume; takes the shape of its container',
            ),
            group: 'long',
            why: L(
              'Lực liên kết đủ giữ thể tích nhưng không giữ hình dạng.',
              'The forces keep the volume but not the shape.',
            ),
          },
          {
            id: 'khi-xa',
            text: L(
              'Phân tử ở xa nhau, chuyển động hỗn loạn về mọi phía',
              'Molecules far apart, moving at random in every direction',
            ),
            group: 'khi',
            why: L('Lực liên kết rất yếu.', 'The forces between them are very weak.'),
          },
          {
            id: 'khi-chiem',
            text: L(
              'Chiếm toàn bộ thể tích bình chứa, dễ bị nén',
              'Fills its whole container; easy to squeeze',
            ),
            group: 'khi',
            why: L(
              'Khoảng cách giữa các phân tử lớn nên nén được dễ dàng.',
              'The molecules are far apart, so it compresses easily.',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'chuyen-the',
        prompt: L(
          'Ghép mỗi quá trình chuyển thể với chiều của nó.',
          'Match each change of state with its direction.',
        ),
        pairs: [
          {
            id: 'nong-chay',
            left: L('Nóng chảy', 'Melting'),
            right: L('Rắn sang lỏng', 'Solid to liquid'),
            why: L(
              'Chất rắn kết tinh nóng chảy ở nhiệt độ không đổi.',
              'A crystalline solid melts at a fixed temperature.',
            ),
          },
          {
            id: 'dong-dac',
            left: L('Đông đặc', 'Freezing'),
            right: L('Lỏng sang rắn', 'Liquid to solid'),
            why: L('Quá trình ngược của nóng chảy.', 'The reverse of melting.'),
          },
          {
            id: 'hoa-hoi',
            left: L('Hóa hơi', 'Vaporisation'),
            right: L('Lỏng sang khí', 'Liquid to gas'),
            why: L(
              'Gồm sự bay hơi ở mặt thoáng và sự sôi ở cả trong lòng chất lỏng.',
              'It includes evaporation at the surface and boiling throughout the liquid.',
            ),
          },
          {
            id: 'ngung-tu',
            left: L('Ngưng tụ', 'Condensation'),
            right: L('Khí sang lỏng', 'Gas to liquid'),
            why: L('Quá trình ngược của hóa hơi.', 'The reverse of vaporisation.'),
          },
          {
            id: 'thang-hoa',
            left: L('Thăng hoa', 'Sublimation'),
            right: L('Rắn sang khí', 'Solid to gas'),
            why: L(
              'Một số chất chuyển thẳng từ thể rắn sang thể khí.',
              'Some substances go straight from solid to gas.',
            ),
          },
          {
            id: 'ngung-ket',
            left: L('Ngưng kết', 'Deposition'),
            right: L('Khí sang rắn', 'Gas to solid'),
            why: L('Quá trình ngược của thăng hoa.', 'The reverse of sublimation.'),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'ket-tinh',
        prompt: L(
          'Xếp mỗi chất rắn vào nhóm kết tinh hoặc vô định hình.',
          'Put each solid under crystalline or amorphous.',
        ),
        groups: [
          { id: 'ket-tinh', label: L('Chất rắn kết tinh', 'Crystalline solid') },
          { id: 'vo-dinh-hinh', label: L('Chất rắn vô định hình', 'Amorphous solid') },
        ],
        items: [
          {
            id: 'muoi',
            text: L('Muối ăn', 'Table salt'),
            group: 'ket-tinh',
            why: L(
              'Các hạt sắp xếp theo trật tự hình học tạo thành mạng tinh thể.',
              'Its particles form an ordered crystal lattice.',
            ),
          },
          {
            id: 'kim-loai',
            text: L('Kim loại', 'Metals'),
            group: 'ket-tinh',
            why: L('Hầu hết các kim loại là chất kết tinh.', 'Most metals are crystalline.'),
          },
          {
            id: 'thuy-tinh',
            text: L('Thủy tinh', 'Glass'),
            group: 'vo-dinh-hinh',
            why: L(
              'Các hạt không tạo thành mạng tinh thể.',
              'Its particles do not form a lattice.',
            ),
          },
          {
            id: 'nhua-duong',
            text: L('Nhựa đường', 'Asphalt'),
            group: 'vo-dinh-hinh',
            why: L(
              'Một chất rắn vô định hình trong ví dụ của sách.',
              'An amorphous solid among the book’s examples.',
            ),
          },
          {
            id: 'chat-deo',
            text: L('Chất dẻo', 'Plastics'),
            group: 'vo-dinh-hinh',
            why: L(
              'Các hạt không tạo thành mạng tinh thể; chỉ chất rắn kết tinh mới có nhiệt độ nóng chảy xác định.',
              'Its particles form no lattice; only crystalline solids have a fixed melting point.',
            ),
          },
        ],
      },
    ],
  },
};
