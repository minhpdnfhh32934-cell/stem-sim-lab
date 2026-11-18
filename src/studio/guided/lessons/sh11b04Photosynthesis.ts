import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH11 KNTT Bài 4 "Quang hợp ở thực vật" (printed pages 26–34), in SimLab's own words. Checked
 * against the pages on 17/11/2026: the two phases (pha sáng on the thylakoid membrane: water split,
 * O₂, ATP, NADPH; pha tối in the stroma: RuBP takes CO₂, Calvin cycle), the C₃ / C₄ / CAM pathways
 * with the book's example plants (lúa, khoai, sắn, đậu; mía, ngô; dứa, xương rồng, thuốc bỏng),
 * PEP-carboxylase letting C₄ and CAM plants fix CO₂ at very low levels, and the light and CO₂ points
 * (điểm bù, điểm bão hòa) and the colours of light (tr. 30–31). SH11-GL-3.
 */
export const sh11b04Photosynthesis: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh11-photosynth',
  topic: 'plantPhotosynthesis',
  title: L(
    'Quang hợp ở thực vật: hai pha và ba con đường',
    'Photosynthesis in plants: two phases, three pathways',
  ),
  objectives: [
    L(
      'Dự đoán cây ngô hay cây lúa quang hợp tốt hơn khi trời nắng nóng, khí khổng đóng bớt.',
      'Predict whether maize or rice photosynthesises better when it is hot and the stomata partly close.',
    ),
    L(
      'Phân loại các sự kiện vào pha sáng hoặc pha tối; ghép thực vật C₃, C₄, CAM với đặc điểm của chúng.',
      'Sort events into the light or the dark phase; match C₃, C₄ and CAM plants with their features.',
    ),
    L(
      'Ghép các khái niệm về ánh sáng và CO₂ với ý nghĩa của chúng.',
      'Match the light and CO₂ terms with their meanings.',
    ),
  ],
  hints: [
    L(
      'Pha sáng cần ánh sáng và tạo ATP, NADPH; pha tối dùng ATP, NADPH đó để cố định CO₂ thành chất hữu cơ.',
      'The light phase needs light and makes ATP and NADPH; the dark phase uses them to fix CO₂ into organic matter.',
    ),
    L(
      'Khi khí khổng đóng, CO₂ trong lá giảm mạnh. Hãy nghĩ xem nhóm cây nào có enzyme giữ được CO₂ ở nồng độ rất thấp.',
      'When the stomata close, the CO₂ inside the leaf drops sharply. Think which group of plants has an enzyme that holds CO₂ at very low levels.',
    ),
  ],
  questions: [
    L(
      'Vì sao trồng cây quá dày lại làm giảm quang hợp và năng suất?',
      'Why does planting too densely lower photosynthesis and yield?',
    ),
  ],
  expectedConclusion: L(
    'Quang hợp là quá trình lục lạp dùng năng lượng ánh sáng để biến CO₂ và nước thành chất hữu cơ, đồng thời giải phóng O₂. Pha sáng diễn ra trên màng thylakoid: diệp lục hấp thụ ánh sáng, nước bị phân li giải phóng O₂, tạo ATP và NADPH. Pha tối diễn ra trong chất nền lục lạp: CO₂ được cố định thành chất hữu cơ nhờ ATP và NADPH. Thực vật C₄ và CAM có thêm bước cố định CO₂ nhờ enzyme có ái lực cao với CO₂, nên vẫn quang hợp được khi nóng, khô, khí khổng đóng. Ánh sáng, CO₂ và nhiệt độ đều ảnh hưởng đến cường độ quang hợp.',
    'Photosynthesis is how chloroplasts use light energy to turn CO₂ and water into organic matter while releasing O₂. The light phase runs on the thylakoid membranes: chlorophyll absorbs light, water is split releasing O₂, and ATP and NADPH are made. The dark phase runs in the stroma: CO₂ is fixed into organic matter using ATP and NADPH. C₄ and CAM plants have an extra CO₂-fixing step with an enzyme of high affinity for CO₂, so they keep photosynthesising when it is hot and dry and the stomata close. Light, CO₂ and temperature all affect the rate of photosynthesis.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu các pha, các con đường và các khái niệm như sách giáo khoa; SimLab không tính cường độ quang hợp.',
      'The lesson gives only the phases, pathways and terms, as the textbook does; SimLab computes no rate of photosynthesis.',
    ),
  ],
  limits: [
    L(
      'Các đồ thị của sách (ảnh hưởng của ánh sáng và CO₂) chỉ là hình dạng định tính, không có trong bài học này dưới dạng số.',
      'The book’s graphs (effects of light and CO₂) only show shapes; this lesson has no numbers from them.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH11', lesson: 4 },
    question: L(
      'Trời nắng nóng, khí khổng đóng bớt để giữ nước nên nồng độ CO₂ trong lá rất thấp. Cây ngô (thực vật C₄) và cây lúa (thực vật C₃) trồng cạnh nhau: cây nào vẫn quang hợp tốt hơn?',
      'On a hot day the stomata partly close to save water, so the CO₂ inside the leaves is very low. Maize (a C₄ plant) and rice (a C₃ plant) grow side by side: which keeps photosynthesising better?',
    ),
    choices: [
      { id: 'ngo', text: L('Cây ngô (C₄)', 'Maize (C₄)') },
      { id: 'lua', text: L('Cây lúa (C₃)', 'Rice (C₃)') },
      { id: 'nhu-nhau', text: L('Như nhau', 'Both the same') },
      {
        id: 'ca-hai',
        text: L('Cả hai ngừng quang hợp hoàn toàn', 'Both stop photosynthesising completely'),
      },
    ],
    answer: 'ngo',
    answerWhy: L(
      'Thực vật C₄ có enzyme PEP-carboxylase với ái lực cao với CO₂, cố định nhanh CO₂ ngay cả khi nồng độ CO₂ rất thấp, rồi tích lũy CO₂ cho chu trình Calvin. Nhờ vậy ngô vẫn quang hợp tốt khi trời nóng, khí khổng đóng bớt; lúa chỉ có chu trình C₃ nên quang hợp kém hơn trong điều kiện này.',
      'C₄ plants have PEP-carboxylase, an enzyme with high affinity for CO₂, which fixes CO₂ quickly even at very low levels and stores it for the Calvin cycle. So maize keeps photosynthesising when it is hot and the stomata partly close; rice has only the C₃ cycle and does worse in these conditions.',
    ),
    activities: [
      {
        kind: 'sort',
        id: 'hai-pha',
        prompt: L(
          'Xếp mỗi sự kiện vào pha sáng hoặc pha tối của quang hợp.',
          'Put each event in the light phase or the dark phase of photosynthesis.',
        ),
        groups: [
          { id: 'sang', label: L('Pha sáng', 'Light phase') },
          { id: 'toi', label: L('Pha tối (đồng hóa CO₂)', 'Dark phase (CO₂ fixation)') },
        ],
        items: [
          {
            id: 'kich-dong',
            text: L(
              'Diệp lục hấp thụ ánh sáng, electron bị kích động',
              'Chlorophyll absorbs light and its electrons are excited',
            ),
            group: 'sang',
            why: L(
              'Năng lượng ánh sáng được các sắc tố truyền về diệp lục a ở trung tâm phản ứng.',
              'Pigments pass the light energy to chlorophyll a at the reaction centre.',
            ),
          },
          {
            id: 'phan-li',
            text: L('Nước bị phân li, giải phóng O₂', 'Water is split and O₂ is released'),
            group: 'sang',
            why: L(
              'Electron từ nước bù lại cho diệp lục a đã mất electron; O₂ là sản phẩm phụ.',
              'Electrons from water replace those chlorophyll a lost; O₂ is a by-product.',
            ),
          },
          {
            id: 'atp-nadph',
            text: L('Tạo ATP và NADPH', 'ATP and NADPH are made'),
            group: 'sang',
            why: L(
              'H⁺ và electron được dùng tổng hợp ATP và khử NADP⁺ thành NADPH.',
              'H⁺ and electrons are used to make ATP and to reduce NADP⁺ to NADPH.',
            ),
          },
          {
            id: 'thylakoid',
            text: L('Diễn ra trên màng thylakoid', 'Takes place on the thylakoid membranes'),
            group: 'sang',
            why: L(
              'Hệ sắc tố quang hợp nằm trên màng thylakoid.',
              'The photosynthetic pigments sit on the thylakoid membranes.',
            ),
          },
          {
            id: 'rubp',
            text: L('RuBP nhận CO₂', 'RuBP takes up CO₂'),
            group: 'toi',
            why: L(
              'RuBP là chất nhận CO₂ đầu tiên của chu trình Calvin.',
              'RuBP is the first CO₂ acceptor of the Calvin cycle.',
            ),
          },
          {
            id: 'g3p',
            text: L(
              'Hợp chất ba carbon bị khử thành glyceraldehyde phosphate nhờ ATP và NADPH',
              'A three-carbon compound is reduced to glyceraldehyde phosphate using ATP and NADPH',
            ),
            group: 'toi',
            why: L(
              'Pha tối dùng sản phẩm của pha sáng; một phần glyceraldehyde phosphate tạo glucose, phần còn lại tái tạo RuBP.',
              'The dark phase uses the light phase’s products; some glyceraldehyde phosphate makes glucose, the rest rebuilds RuBP.',
            ),
          },
          {
            id: 'chat-nen',
            text: L(
              'Diễn ra trong chất nền lục lạp',
              'Takes place in the stroma of the chloroplast',
            ),
            group: 'toi',
            why: L(
              'Các enzyme cố định CO₂ nằm trong chất nền.',
              'The CO₂-fixing enzymes are in the stroma.',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'ba-nhom',
        prompt: L(
          'Ghép mỗi nhóm thực vật với đặc điểm cố định CO₂ của nó.',
          'Match each group of plants with how it fixes CO₂.',
        ),
        pairs: [
          {
            id: 'c3',
            left: L(
              'Thực vật C₃ (lúa, khoai, sắn, đậu)',
              'C₃ plants (rice, potato, cassava, beans)',
            ),
            right: L(
              'Chỉ có chu trình Calvin; sản phẩm đầu tiên là hợp chất ba carbon',
              'Only the Calvin cycle; the first product is a three-carbon compound',
            ),
            why: L(
              'Chu trình C₃ phân bố rộng, chủ yếu ở vùng ôn đới và cận nhiệt đới.',
              'The C₃ cycle is widespread, mostly in temperate and subtropical regions.',
            ),
          },
          {
            id: 'c4',
            left: L('Thực vật C₄ (mía, ngô)', 'C₄ plants (sugar cane, maize)'),
            right: L(
              'Cố định CO₂ ở tế bào mô giậu thành hợp chất bốn carbon, chu trình Calvin ở tế bào bao bó mạch',
              'Fix CO₂ in the mesophyll cells into a four-carbon compound; the Calvin cycle runs in the bundle-sheath cells',
            ),
            why: L(
              'Hai giai đoạn tách nhau về không gian, giúp cây quang hợp mạnh ở vùng nhiệt đới.',
              'The two steps are separated in space, which lets the plant photosynthesise strongly in the tropics.',
            ),
          },
          {
            id: 'cam',
            left: L(
              'Thực vật CAM (dứa, xương rồng, thuốc bỏng)',
              'CAM plants (pineapple, cactus, kalanchoe)',
            ),
            right: L(
              'Khí khổng mở ban đêm để lấy CO₂, đóng ban ngày để giữ nước',
              'Stomata open at night to take in CO₂ and close by day to save water',
            ),
            why: L(
              'Hai giai đoạn tách nhau về thời gian: thích nghi với sa mạc, nơi khô hạn.',
              'The two steps are separated in time: an adaptation to deserts and dry places.',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'anh-sang-co2',
        prompt: L('Ghép mỗi khái niệm với ý nghĩa của nó.', 'Match each term with its meaning.'),
        pairs: [
          {
            id: 'bu-as',
            left: L('Điểm bù ánh sáng', 'Light compensation point'),
            right: L(
              'Cường độ ánh sáng mà tại đó quang hợp bằng hô hấp',
              'The light intensity at which photosynthesis equals respiration',
            ),
            why: L(
              'Cây ưa bóng có điểm bù ánh sáng thấp hơn cây ưa sáng.',
              'Shade plants have a lower light compensation point than sun plants.',
            ),
          },
          {
            id: 'bao-hoa-as',
            left: L('Điểm bão hòa ánh sáng', 'Light saturation point'),
            right: L(
              'Từ đây tăng ánh sáng nữa cũng không làm tăng quang hợp',
              'Beyond it, more light no longer raises photosynthesis',
            ),
            why: L(
              'Quang hợp đã đạt cực đại theo ánh sáng.',
              'Photosynthesis has reached its maximum for light.',
            ),
          },
          {
            id: 'bu-co2',
            left: L('Điểm bù CO₂', 'CO₂ compensation point'),
            right: L(
              'Nồng độ CO₂ tối thiểu để quang hợp bằng hô hấp',
              'The lowest CO₂ level at which photosynthesis equals respiration',
            ),
            why: L(
              'Điểm bù CO₂ của thực vật C₄ và CAM thấp hơn thực vật C₃.',
              'C₄ and CAM plants have a lower CO₂ compensation point than C₃ plants.',
            ),
          },
          {
            id: 'do',
            left: L('Ánh sáng đỏ', 'Red light'),
            right: L(
              'Quang hợp mạnh nhất, thúc đẩy hình thành carbohydrate',
              'Strongest photosynthesis; favours making carbohydrates',
            ),
            why: L(
              'Cùng cường độ, ánh sáng đơn sắc đỏ hiệu quả hơn ánh sáng xanh tím.',
              'At the same intensity, red light works better than blue-violet light.',
            ),
          },
          {
            id: 'xanh-tim',
            left: L('Ánh sáng xanh tím', 'Blue-violet light'),
            right: L(
              'Kích thích tổng hợp amino acid, protein',
              'Stimulates making amino acids and proteins',
            ),
            why: L(
              'Thành phần ánh sáng ảnh hưởng cả đến loại sản phẩm quang hợp.',
              'The colour of light also affects which products photosynthesis makes.',
            ),
          },
        ],
      },
    ],
  },
};
