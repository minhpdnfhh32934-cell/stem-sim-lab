import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * VL12 KNTT Bài 24 "Công nghiệp hạt nhân" (printed pages 114–118), in SimLab's own words. Checked
 * against the pages on 17/11/2026: the nuclear power plant and its two circuits (Hình 24.1, tr. 114),
 * its strengths and drawbacks, spent fuel (tr. 115), control rods keeping k = 1 (tr. 115), nuclear
 * medicine (PET, SPECT, radiotherapy, tr. 116–117), radioactive tracers, mutation breeding and food
 * irradiation (tr. 117–118). VL12-GL-6.
 */
export const vl12b24Industry: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'physics',
  id: 'guided.vl12-nuclear-industry',
  topic: 'nuclearIndustry',
  title: L('Công nghiệp hạt nhân', 'Nuclear industry'),
  objectives: [
    L(
      'Dự đoán vì sao nhà máy điện hạt nhân thường được xây cạnh nguồn nước lớn.',
      'Predict why nuclear power plants are usually built next to a large body of water.',
    ),
    L(
      'Sắp xếp các bước biến năng lượng hạt nhân thành điện năng; phân loại ưu điểm, nhược điểm của nhà máy điện hạt nhân.',
      'Order the steps that turn nuclear energy into electricity; sort the strengths and drawbacks of a nuclear power plant.',
    ),
    L(
      'Ghép các ứng dụng của tia phóng xạ trong y học, nông nghiệp và bảo quản thực phẩm với cách chúng hoạt động.',
      'Match the uses of radiation in medicine, farming and food keeping with how they work.',
    ),
  ],
  hints: [
    L(
      'Nhà máy điện hạt nhân sinh điện giống nhà máy nhiệt điện: hơi nước làm quay tua bin.',
      'A nuclear plant makes electricity like a thermal plant: steam turns a turbine.',
    ),
    L(
      'Tia phóng xạ vừa giúp nhìn vào bên trong cơ thể, vừa có thể phá hủy tế bào.',
      'Radiation both lets us see inside the body and can destroy cells.',
    ),
  ],
  questions: [
    L(
      'Trong lò phản ứng, thanh điều khiển chứa Bo hay Cd có vai trò gì khi số neutron tăng quá nhiều?',
      'In a reactor, what do control rods containing boron or cadmium do when the neutrons grow too many?',
    ),
  ],
  expectedConclusion: L(
    'Trong nhà máy điện hạt nhân, phản ứng phân hạch dây chuyền trong lò tỏa nhiệt; chất tải nhiệt mang nhiệt sang bộ sinh hơi, hơi áp suất cao làm quay tua bin và máy phát điện, rồi được nước sông, hồ hay biển làm mát để ngưng tụ. Thanh điều khiển hấp thụ bớt neutron để giữ cho phản ứng ổn định. Nhà máy không trực tiếp thải khí như CO₂ và phát điện liên tục nhiều năm, nhưng chất thải phóng xạ phải được bảo quản rất lâu với chi phí cao và sự cố có thể gây hại cho con người, môi trường. Tia phóng xạ còn được dùng trong y học (chụp ảnh PET, SPECT, xạ trị), trong nông nghiệp (đánh dấu phóng xạ, gây đột biến tạo giống) và để bảo quản thực phẩm.',
    'In a nuclear power plant the fission chain reaction in the reactor releases heat; a coolant carries it to the steam generator, high-pressure steam turns the turbine and generator, and water from a river, lake or sea cools it back into water. Control rods absorb some neutrons to keep the reaction steady. The plant does not directly emit gases such as CO₂ and runs for years, but its radioactive waste must be stored for a very long time at high cost, and an accident can harm people and the environment. Radiation is also used in medicine (PET, SPECT imaging, radiotherapy), in farming (tracers, mutation breeding) and to keep food.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu các ứng dụng như sách giáo khoa; SimLab không tính năng lượng hay liều phóng xạ ở đây.',
      'The lesson gives only the uses, as the textbook does; SimLab computes no energies or doses here.',
    ),
  ],
  limits: [
    L(
      'Năng lượng phân hạch được tính trong bài “Hạt nhân và năng lượng liên kết”; chu kì bán rã, độ phóng xạ và an toàn phóng xạ trong bài “Hiện tượng phóng xạ”.',
      'Fission energy is computed in “The nucleus and binding energy”; half-lives, activity and radiation safety in “Radioactivity”.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'VL12', lesson: 24 },
    question: L(
      'Nhà máy điện hạt nhân thường được xây cạnh hồ, sông hoặc bờ biển. Lí do chính là gì?',
      'Nuclear power plants are usually built by a lake, a river or the sea. What is the main reason?',
    ),
    choices: [
      {
        id: 'lam-mat',
        text: L('Cần rất nhiều nước để làm mát', 'They need a lot of cooling water'),
      },
      { id: 'nhien-lieu', text: L('Nước là nhiên liệu của lò', 'Water is the reactor’s fuel') },
      {
        id: 'thai',
        text: L('Để thải chất thải phóng xạ ra nước', 'To dump radioactive waste in the water'),
      },
      { id: 'van-chuyen', text: L('Để chở khách đến tham quan', 'To bring visitors by boat') },
    ],
    answer: 'lam-mat',
    answerWhy: L(
      'Hơi nước sau khi làm quay tua bin phải được làm mát để ngưng tụ lại thành nước; bộ ngưng tụ dùng nước sông, hồ hay biển làm nước làm mát (Hình đơn giản hóa nhà máy trong sách).',
      'After turning the turbine, the steam must be cooled back into water; the condenser uses river, lake or sea water for this (the book’s simplified plant).',
    ),
    activities: [
      {
        kind: 'order',
        id: 'nha-may',
        prompt: L(
          'Sắp xếp các bước biến năng lượng hạt nhân thành điện năng.',
          'Put the steps from nuclear energy to electricity in order.',
        ),
        items: [
          {
            id: 'phan-hach',
            text: L(
              'Phản ứng phân hạch trong lò tỏa nhiệt',
              'Fission in the reactor releases heat',
            ),
            why: L(
              'Năng lượng của phân hạch chuyển thành nhiệt.',
              'The fission energy becomes heat.',
            ),
          },
          {
            id: 'tai-nhiet',
            text: L(
              'Chất tải nhiệt sơ cấp mang nhiệt qua bộ trao đổi nhiệt',
              'The primary coolant carries the heat to the heat exchanger',
            ),
            why: L('Đây là chu trình thứ nhất.', 'This is the first circuit.'),
          },
          {
            id: 'sinh-hoi',
            text: L(
              'Nước ở chu trình thứ hai sôi thành hơi áp suất cao',
              'Water in the second circuit boils into high-pressure steam',
            ),
            why: L('Bộ phận sinh hơi tạo ra hơi nước.', 'The steam generator makes steam.'),
          },
          {
            id: 'tua-bin',
            text: L(
              'Hơi nước làm quay tua bin và máy phát điện',
              'The steam turns the turbine and the generator',
            ),
            why: L('Giống như trong nhà máy nhiệt điện.', 'As in a thermal power plant.'),
          },
          {
            id: 'ngung-tu',
            text: L(
              'Hơi được nước sông, hồ làm mát và ngưng tụ thành nước',
              'River or lake water cools the steam back into water',
            ),
            why: L(
              'Nước lại được bơm về bộ sinh hơi.',
              'The water is pumped back to the steam generator.',
            ),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'uu-nhuoc',
        prompt: L(
          'Xếp mỗi đặc điểm vào ưu điểm hoặc nhược điểm của nhà máy điện hạt nhân.',
          'Put each feature under the strengths or drawbacks of a nuclear power plant.',
        ),
        groups: [
          { id: 'uu', label: L('Ưu điểm', 'Strengths') },
          { id: 'nhuoc', label: L('Nhược điểm', 'Drawbacks') },
        ],
        items: [
          {
            id: 'khong-thai-khi',
            text: L(
              'Không trực tiếp thải khí như CO₂, CO ra môi trường',
              'Does not directly emit gases such as CO₂ or CO',
            ),
            group: 'uu',
            why: L('Không đốt nhiên liệu hóa thạch.', 'No fossil fuel is burned.'),
          },
          {
            id: 'lien-tuc',
            text: L(
              'Phát điện liên tục nhiều năm mới phải thay nhiên liệu',
              'Runs for years before the fuel must be changed',
            ),
            group: 'uu',
            why: L(
              'Nhiên liệu hạt nhân chứa rất nhiều năng lượng.',
              'Nuclear fuel holds a great deal of energy.',
            ),
          },
          {
            id: 'chat-thai',
            text: L(
              'Chất thải phóng xạ phải bảo quản hàng trăm năm, chi phí cao',
              'Radioactive waste must be stored for centuries at high cost',
            ),
            group: 'nhuoc',
            why: L(
              'Một số đồng vị trong nhiên liệu đã dùng có chu kì bán rã rất lớn.',
              'Some isotopes in spent fuel have very long half-lives.',
            ),
          },
          {
            id: 'su-co',
            text: L(
              'Sự cố lò phản ứng có thể gây hại cho sức khỏe và môi trường',
              'A reactor accident can harm health and the environment',
            ),
            group: 'nhuoc',
            why: L('Chất phóng xạ có thể thoát ra ngoài.', 'Radioactive material may escape.'),
          },
        ],
      },
      {
        kind: 'match',
        id: 'ung-dung',
        prompt: L(
          'Ghép mỗi ứng dụng của tia phóng xạ với cách nó hoạt động.',
          'Match each use of radiation with how it works.',
        ),
        pairs: [
          {
            id: 'pet',
            left: L('Chụp ảnh PET, SPECT', 'PET, SPECT imaging'),
            right: L(
              'Đưa đồng vị phóng xạ vào cơ thể rồi theo dõi tia phát ra để dựng ảnh',
              'Put a radioactive isotope into the body and follow its rays to build a picture',
            ),
            why: L('Phương pháp theo dõi vết phóng xạ.', 'Radioactive tracing.'),
          },
          {
            id: 'xa-tri',
            left: L('Xạ trị ung thư', 'Cancer radiotherapy'),
            right: L(
              'Chiếu tia phóng xạ để tiêu diệt tế bào ung thư',
              'Aim radiation at cancer cells to destroy them',
            ),
            why: L(
              'Tia phóng xạ cũng tác động lên tế bào khỏe mạnh, nên phải dùng đúng liều.',
              'Radiation also affects healthy cells, so the dose must be right.',
            ),
          },
          {
            id: 'thuc-pham',
            left: L('Chiếu xạ thực phẩm', 'Food irradiation'),
            right: L(
              'Diệt vi khuẩn, giúp thực phẩm tươi lâu hơn',
              'Kills bacteria so food stays fresh longer',
            ),
            why: L(
              'Ví dụ vải thiều được chiếu xạ trong sách.',
              'For example the irradiated lychees in the book.',
            ),
          },
          {
            id: 'danh-dau',
            left: L('Đánh dấu phóng xạ trong nông nghiệp', 'Radioactive tracers in farming'),
            right: L(
              'Bón phân chứa đồng vị phóng xạ để theo dõi đường đi của phân trong cây',
              'Use fertiliser with a radioactive isotope to follow its path in the plant',
            ),
            why: L('Giúp chọn cách chăm sóc cây phù hợp.', 'It helps choose the right care.'),
          },
          {
            id: 'dot-bien',
            left: L('Gây đột biến gene', 'Mutation breeding'),
            right: L(
              'Tạo giống cây trồng mới có đặc điểm vượt trội',
              'Makes new crop varieties with better traits',
            ),
            why: L(
              'Cần thận trọng vì có thể ảnh hưởng tới hệ sinh thái.',
              'It needs care because it may affect ecosystems.',
            ),
          },
        ],
      },
    ],
  },
};
