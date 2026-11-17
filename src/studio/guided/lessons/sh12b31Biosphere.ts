import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH12 KNTT Bài 31 "Sinh quyển, khu sinh học và chu trình sinh - địa - hoá" (printed pages
 * 165–171), in SimLab's own words. Checked against the pages on 17/11/2026: the biosphere, biomes
 * on land (Hình 31.1, 31.2) and in water (Hình 31.3), protecting them (tr. 167–168), the
 * biogeochemical cycle (Hình 31.4), the carbon cycle (Hình 31.5) and the nitrogen cycle (tr. 169).
 * SH12-GL-11.
 */
export const sh12b31Biosphere: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'biology',
  id: 'guided.sh12-biosphere',
  topic: 'biosphere',
  title: L(
    'Sinh quyển, khu sinh học và chu trình sinh – địa – hóa',
    'Biosphere, biomes and biogeochemical cycles',
  ),
  objectives: [
    L(
      'Dự đoán vì sao đốt nhiên liệu hóa thạch góp phần làm Trái Đất ấm lên.',
      'Predict why burning fossil fuels warms the Earth.',
    ),
    L(
      'Xếp mỗi quá trình vào việc đưa carbon vào hay lấy carbon ra khỏi khí quyển.',
      'Put each process under adding carbon to the air or taking it out.',
    ),
    L('Ghép mỗi khu sinh học với đặc điểm của nó.', 'Match each biome with its features.'),
  ],
  hints: [
    L(
      'Quang hợp cố định CO₂; hô hấp, phân hủy và đốt cháy giải phóng CO₂.',
      'Photosynthesis fixes CO₂; respiration, decay and burning release it.',
    ),
    L(
      'Lượng CO₂ trong khí quyển tăng làm tăng hiệu ứng nhà kính.',
      'More CO₂ in the air strengthens the greenhouse effect.',
    ),
  ],
  questions: [
    L(
      'Vì sao muốn bảo vệ sinh quyển hiệu quả thì cần sự đồng thuận của tất cả các nước?',
      'Why does protecting the biosphere need every country to agree?',
    ),
  ],
  expectedConclusion: L(
    'Sinh quyển là cấp tổ chức sống lớn nhất, gồm toàn bộ các hệ sinh thái trên Trái Đất gắn kết với nhau qua các nhân tố vô sinh. Sinh quyển gồm các khu sinh học trên cạn (rừng nhiệt đới, savanna, hoang mạc, rừng rụng lá ôn đới, thảo nguyên, rừng lá kim phương bắc, đồng rêu hàn đới) và dưới nước (nước ngọt, nước mặn). Chu trình sinh – địa – hóa là sự tuần hoàn vật chất qua các dạng khác nhau giữa sinh vật và môi trường; quan trọng nhất là chu trình carbon, nitrogen và nước. Con người đốt nhiên liệu hóa thạch làm tăng CO₂ trong khí quyển, gây hiệu ứng nhà kính và làm Trái Đất ấm lên.',
    'The biosphere is the largest level of life: all of Earth’s ecosystems joined by non-living factors. It is made of biomes on land (tropical forest, savanna, desert, temperate deciduous forest, steppe, boreal forest, tundra) and in water (fresh and salt). A biogeochemical cycle moves matter in different forms between living things and the environment; the carbon, nitrogen and water cycles matter most. Burning fossil fuels raises the air’s CO₂, strengthening the greenhouse effect and warming the Earth.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu khái niệm và ví dụ như sách giáo khoa.',
      'The lesson gives the ideas and examples as the textbook does.',
    ),
  ],
  limits: [
    L(
      'Bài không tính lượng carbon hay nitrogen trong mỗi chu trình.',
      'The lesson does not compute the amounts in each cycle.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH12', lesson: 31 },
    question: L(
      'Vì sao việc đốt nhiên liệu hóa thạch (than đá, dầu mỏ) góp phần làm Trái Đất ấm lên?',
      'Why does burning fossil fuels (coal, oil) help warm the Earth?',
    ),
    choices: [
      {
        id: 'co2',
        text: L(
          'Giải phóng lượng lớn CO₂, làm tăng hiệu ứng nhà kính',
          'It releases much CO₂, strengthening the greenhouse effect',
        ),
      },
      { id: 'o2', text: L('Làm tăng lượng oxygen trong khí quyển', 'It adds oxygen to the air') },
      {
        id: 'nhiet',
        text: L('Chỉ vì ngọn lửa tỏa nhiệt trực tiếp', 'Only because flames give off heat'),
      },
      {
        id: 'khong',
        text: L('Không liên quan đến nhiệt độ Trái Đất', 'It has no effect on temperature'),
      },
    ],
    answer: 'co2',
    answerWhy: L(
      'Carbon lắng đọng trong nhiên liệu hóa thạch bị đốt cháy trở lại khí quyển dưới dạng CO₂, vượt quá lượng được cố định, làm tăng hiệu ứng nhà kính.',
      'Carbon stored in fossil fuels returns to the air as CO₂, faster than it is fixed, strengthening the greenhouse effect.',
    ),
    activities: [
      {
        kind: 'sort',
        id: 'carbon',
        prompt: L(
          'Xếp mỗi quá trình vào việc đưa CO₂ vào hay lấy CO₂ ra khỏi khí quyển.',
          'Put each process under adding CO₂ to the air or removing it.',
        ),
        groups: [
          { id: 'vao', label: L('Đưa CO₂ vào khí quyển', 'Adds CO₂ to the air') },
          { id: 'ra', label: L('Lấy CO₂ ra khỏi khí quyển', 'Removes CO₂ from the air') },
        ],
        items: [
          {
            id: 'quang-hop',
            text: L('Quang hợp của sinh vật sản xuất', 'Photosynthesis by producers'),
            group: 'ra',
            why: L('Cố định CO₂ thành chất hữu cơ.', 'It fixes CO₂ into organic matter.'),
          },
          {
            id: 'hoa-tan',
            text: L('CO₂ hòa tan trong nước', 'CO₂ dissolving in water'),
            group: 'ra',
            why: L('Đi vào đại dương.', 'It enters the oceans.'),
          },
          {
            id: 'ho-hap',
            text: L('Hô hấp của sinh vật', 'Respiration'),
            group: 'vao',
            why: L('Giải phóng CO₂.', 'It releases CO₂.'),
          },
          {
            id: 'dot',
            text: L('Đốt nhiên liệu hóa thạch', 'Burning fossil fuels'),
            group: 'vao',
            why: L('Phát thải lượng lớn CO₂.', 'It emits much CO₂.'),
          },
          {
            id: 'nui-lua',
            text: L('Hoạt động của núi lửa', 'Volcanoes'),
            group: 'vao',
            why: L('Bổ sung CO₂ vào chu trình.', 'They add CO₂ to the cycle.'),
          },
        ],
      },
      {
        kind: 'match',
        id: 'khu-sinh-hoc',
        prompt: L(
          'Ghép mỗi khu sinh học với đặc điểm của nó.',
          'Match each biome with its features.',
        ),
        pairs: [
          {
            id: 'nhiet-doi',
            left: L('Rừng mưa nhiệt đới', 'Tropical rainforest'),
            right: L(
              'Nóng quanh năm, mưa nhiều, nhiều tầng cây lá rộng thường xanh',
              'Hot all year, very wet, many layers of evergreen broadleaf trees',
            ),
            why: L('Đa dạng sinh vật rất cao.', 'Very high biodiversity.'),
          },
          {
            id: 'on-doi',
            left: L('Rừng rụng lá ôn đới', 'Temperate deciduous forest'),
            right: L(
              'Cây lá rộng rụng lá theo mùa',
              'Broadleaf trees that shed leaves each season',
            ),
            why: L('Mùa đông lạnh.', 'Cold winters.'),
          },
          {
            id: 'nuoc-ngot',
            left: L('Khu sinh học nước ngọt', 'Freshwater biome'),
            right: L(
              'Suối, sông, ao, hồ, đất ngập nước',
              'Streams, rivers, ponds, lakes, wetlands',
            ),
            why: L('Nước có độ mặn rất thấp.', 'Water of very low salinity.'),
          },
          {
            id: 'bien-khoi',
            left: L('Vùng khơi đại dương', 'Open ocean'),
            right: L(
              'Nước sâu, sinh vật sản xuất chủ yếu là tảo và vi khuẩn quang hợp ở tầng mặt',
              'Deep water; producers are mostly algae and photosynthetic bacteria at the surface',
            ),
            why: L('Chiếm phần lớn bề mặt Trái Đất.', 'It covers most of the Earth.'),
          },
        ],
      },
    ],
  },
};
