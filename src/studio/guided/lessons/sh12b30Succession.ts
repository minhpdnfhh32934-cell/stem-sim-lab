import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH12 KNTT Bài 30 "Diễn thế sinh thái" (printed pages 161–164), in SimLab's own words. Checked
 * against the pages on 17/11/2026: what succession is, primary and secondary succession (Hình
 * 30.1), external and internal causes (tr. 162), why studying it matters (tr. 163), and harmful
 * changes — eutrophication, global warming, desertification (tr. 163–164). SH12-GL-10.
 */
export const sh12b30Succession: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'biology',
  id: 'guided.sh12-succession',
  topic: 'succession',
  title: L('Diễn thế sinh thái', 'Ecological succession'),
  objectives: [
    L(
      'Dự đoán diễn thế nào hình thành quần xã ổn định nhanh hơn.',
      'Predict which succession reaches a stable community sooner.',
    ),
    L(
      'Sắp xếp các giai đoạn của diễn thế nguyên sinh.',
      'Put the stages of primary succession in order.',
    ),
    L(
      'Phân loại diễn thế nguyên sinh, thứ sinh và các hiện tượng bất lợi.',
      'Sort primary and secondary succession, and harmful changes.',
    ),
  ],
  hints: [
    L(
      'Diễn thế thứ sinh bắt đầu từ nơi đã có quần xã, có đất và một số loài còn sống sót.',
      'Secondary succession starts where a community was, with soil and some survivors.',
    ),
    L(
      'Diễn thế nguyên sinh bắt đầu từ môi trường trống trơn.',
      'Primary succession starts from bare ground.',
    ),
  ],
  questions: [
    L(
      'Vì sao người ta thường trồng cây họ Đậu để phủ xanh đất trống, đồi trọc?',
      'Why are legumes planted to green bare land and bald hills?',
    ),
  ],
  expectedConclusion: L(
    'Diễn thế sinh thái là quá trình thay đổi dần thành phần loài của quần xã theo thời gian, tương ứng với sự biến đổi của môi trường, qua ba giai đoạn: mở đầu, giữa và cuối. Diễn thế nguyên sinh bắt đầu từ môi trường trống trơn, diễn ra rất lâu; diễn thế thứ sinh bắt đầu từ nơi quần xã bị tổn hại nên thường nhanh hơn. Nguyên nhân bên ngoài là các nhân tố vô sinh và tác động của con người; nguyên nhân bên trong là quan hệ giữa các loài, đặc biệt là cạnh tranh. Hiểu biết về diễn thế giúp dự đoán, khắc phục tác động của con người và phục hồi hệ sinh thái.',
    'Succession is the gradual change of a community’s species over time as its environment changes, through early, middle and late stages. Primary succession starts on bare ground and takes very long; secondary succession starts where a community was damaged and is usually faster. External causes are non-living factors and people; internal causes are relations between species, above all competition. Understanding succession helps predict and remedy human impacts and restore ecosystems.',
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
      'Bài không tính thời gian của từng giai đoạn diễn thế.',
      'The lesson does not time each stage of succession.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH12', lesson: 30 },
    question: L(
      'Một khu rừng bị cháy và một vùng đá mới hình thành sau núi lửa phun trào. Ở đâu quần xã ổn định được hình thành nhanh hơn?',
      'A burnt forest and new rock left by a volcano: where does a stable community form sooner?',
    ),
    choices: [
      { id: 'rung-chay', text: L('Khu rừng bị cháy', 'The burnt forest') },
      { id: 'da-moi', text: L('Vùng đá mới', 'The new rock') },
      { id: 'bang', text: L('Như nhau', 'At the same pace') },
      { id: 'khong', text: L('Không nơi nào hình thành quần xã', 'Neither forms a community') },
    ],
    answer: 'rung-chay',
    answerWhy: L(
      'Rừng bị cháy trải qua diễn thế thứ sinh: đã có đất và một số loài còn sống sót nên quần xã ổn định hình thành nhanh hơn diễn thế nguyên sinh trên đá mới.',
      'The burnt forest undergoes secondary succession: soil and some survivors remain, so it recovers sooner than primary succession on new rock.',
    ),
    activities: [
      {
        kind: 'order',
        id: 'nguyen-sinh',
        prompt: L(
          'Sắp xếp các giai đoạn của diễn thế nguyên sinh trên cạn.',
          'Put the stages of primary succession on land in order.',
        ),
        items: [
          {
            id: 'da',
            text: L('Đá trống trơn', 'Bare rock'),
            why: L('Chưa có sinh vật.', 'No life yet.'),
          },
          {
            id: 'dia-y',
            text: L('Địa y, rêu (quần xã tiên phong)', 'Lichens and mosses (pioneers)'),
            why: L('Thích nghi với điều kiện nghèo dinh dưỡng.', 'Suited to poor conditions.'),
          },
          {
            id: 'co',
            text: L('Cỏ và cây bụi', 'Grasses and shrubs'),
            why: L('Đất mùn được tích tụ dần.', 'Humus builds up.'),
          },
          {
            id: 'cay-go',
            text: L('Cây gỗ ưa sáng', 'Light-loving trees'),
            why: L('Quần xã trung gian.', 'An intermediate community.'),
          },
          {
            id: 'dinh-cuc',
            text: L('Cây ưa bóng, quần xã đỉnh cực', 'Shade-tolerant trees: the climax community'),
            why: L('Giai đoạn cuối, tương đối ổn định.', 'The fairly stable last stage.'),
          },
        ],
      },
      {
        kind: 'match',
        id: 'hien-tuong',
        prompt: L(
          'Ghép mỗi hiện tượng bất lợi với nguyên nhân chính của nó.',
          'Match each harmful change with its main cause.',
        ),
        pairs: [
          {
            id: 'phi-duong',
            left: L('Phì dưỡng', 'Eutrophication'),
            right: L(
              'Nước thừa nitrogen, phosphorus từ phân bón và nước thải',
              'Excess nitrogen and phosphorus from fertiliser and waste',
            ),
            why: L('Tảo phát triển quá mức, thiếu oxygen.', 'Algae boom, oxygen runs out.'),
          },
          {
            id: 'am-len',
            left: L('Sự ấm lên toàn cầu', 'Global warming'),
            right: L(
              'Chặt phá rừng, phát thải khí nhà kính',
              'Deforestation and greenhouse gas emissions',
            ),
            why: L('Tăng hiệu ứng nhà kính.', 'A stronger greenhouse effect.'),
          },
          {
            id: 'sa-mac',
            left: L('Sa mạc hóa', 'Desertification'),
            right: L(
              'Biến đổi khí hậu, canh tác lạc hậu, chăn thả quá mức',
              'Climate change, poor farming, overgrazing',
            ),
            why: L('Đất ở vùng khô hạn bị thoái hóa.', 'Dry land degrades.'),
          },
        ],
      },
    ],
  },
};
