import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH11 KNTT Bài 15 "Cảm ứng ở thực vật" (printed pages 90–96), in SimLab's own words. Checked
 * against the pages on 17/11/2026: tropisms (hướng sáng, hướng hóa, hướng nước, hướng trọng lực,
 * hướng tiếp xúc; Hình 15.1–15.6) and nastic movements (ứng động không sinh trưởng: cây trinh nữ,
 * cây bắt ruồi, cây gọng vó; ứng động sinh trưởng: hoa bồ công anh, chồi cây theo mùa), the auxin
 * mechanism of phototropism (Hình 15.8) and the turgor mechanism of the mimosa (Hình 15.9). The
 * prediction follows Hình 15.2. SH11-GL-11.
 */
export const sh11b15PlantResponse: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh11-plantresp',
  topic: 'plantResponse',
  title: L(
    'Cảm ứng ở thực vật: hướng động và ứng động',
    'Plant responses: tropisms and nastic movements',
  ),
  objectives: [
    L(
      'Dự đoán ngọn cây đặt cạnh cửa sổ sẽ mọc thế nào và vì sao.',
      'Predict how a shoot grows beside a window, and why.',
    ),
    L(
      'Phân loại các hiện tượng vào hướng động hoặc ứng động; ghép mỗi kiểu hướng động với tác nhân kích thích.',
      'Sort phenomena into tropisms or nastic movements; match each tropism with its stimulus.',
    ),
    L(
      'Phân biệt ứng động sinh trưởng và ứng động không sinh trưởng.',
      'Tell growth and non-growth nastic movements apart.',
    ),
  ],
  hints: [
    L(
      'Hướng động là phản ứng với kích thích từ một hướng xác định; ứng động là phản ứng với kích thích không định hướng.',
      'A tropism answers a stimulus from one direction; a nastic movement answers a stimulus with no direction.',
    ),
    L(
      'Auxin làm tế bào thân dài ra; phía có nhiều auxin hơn mọc nhanh hơn.',
      'Auxin makes stem cells lengthen; the side with more auxin grows faster.',
    ),
  ],
  questions: [
    L(
      'Vì sao bón phân quanh gốc cây theo vòng rộng giúp rễ phát triển rộng và sâu?',
      'Why does spreading fertiliser in a wide ring round a tree help its roots spread wide and deep?',
    ),
  ],
  expectedConclusion: L(
    'Cảm ứng ở thực vật gồm hướng động và ứng động. Hướng động là phản ứng sinh trưởng với kích thích từ một hướng: hướng sáng, hướng hóa, hướng nước, hướng trọng lực, hướng tiếp xúc; vận động về phía kích thích là hướng động dương, tránh xa là âm. Hướng sáng do auxin phân bố không đều: phía tối nhiều auxin hơn, dãn dài nhanh hơn nên ngọn cong về phía sáng. Ứng động là phản ứng với kích thích không định hướng: ứng động không sinh trưởng do thay đổi sức trương nước (lá trinh nữ cụp), ứng động sinh trưởng do tốc độ sinh trưởng không đều (hoa nở, khép).',
    'Plant responses are tropisms and nastic movements. A tropism is a growth response to a stimulus from one direction: light, chemicals, water, gravity, touch; growing towards it is positive, away from it negative. Phototropism comes from uneven auxin: the shaded side has more auxin, lengthens faster, and the shoot bends towards the light. A nastic movement answers a stimulus with no direction: non-growth movements come from turgor changes (mimosa leaves folding), growth movements from uneven growth (flowers opening and closing).',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu các hình thức và cơ chế như sách giáo khoa; SimLab không tính lượng auxin hay tốc độ sinh trưởng.',
      'The lesson gives only the forms and mechanisms, as the textbook does; SimLab computes no auxin level or growth rate.',
    ),
  ],
  limits: [
    L(
      'Các thí nghiệm của bài thực hành không có trong bài học này.',
      'The experiments of the practical lesson are not part of this lesson.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH11', lesson: 15 },
    question: L(
      'Một chậu cây đặt cạnh cửa sổ, ánh sáng chỉ chiếu từ một phía. Sau một thời gian, ngọn cây sẽ thế nào?',
      'A potted plant stands by a window, with light from one side only. After a while, what does its shoot do?',
    ),
    choices: [
      { id: 've-sang', text: L('Cong về phía có ánh sáng', 'Bends towards the light') },
      { id: 'tranh-sang', text: L('Cong tránh xa ánh sáng', 'Bends away from the light') },
      { id: 'thang', text: L('Vẫn mọc thẳng đứng', 'Keeps growing straight up') },
      { id: 'ngung', text: L('Ngừng sinh trưởng', 'Stops growing') },
    ],
    answer: 've-sang',
    answerWhy: L(
      'Ánh sáng làm auxin phân bố không đều giữa hai phía của ngọn: phía khuất sáng có nhiều auxin hơn nên tế bào dãn dài nhanh hơn, ngọn cong về phía có ánh sáng. Đó là hướng sáng dương.',
      'Light makes auxin spread unevenly across the shoot: the shaded side gets more auxin, its cells lengthen faster, and the shoot bends towards the light. This is positive phototropism.',
    ),
    activities: [
      {
        kind: 'sort',
        id: 'huong-ung',
        prompt: L(
          'Xếp mỗi hiện tượng vào hướng động hoặc ứng động.',
          'Put each phenomenon under tropism or nastic movement.',
        ),
        groups: [
          { id: 'huong', label: L('Hướng động', 'Tropism') },
          { id: 'ung', label: L('Ứng động', 'Nastic movement') },
        ],
        items: [
          {
            id: 'ngon-sang',
            text: L('Ngọn cây cong về phía cửa sổ', 'A shoot bends towards the window'),
            group: 'huong',
            why: L('Kích thích ánh sáng đến từ một hướng.', 'The light comes from one direction.'),
          },
          {
            id: 're-nuoc',
            text: L('Rễ mọc về phía nguồn nước', 'Roots grow towards water'),
            group: 'huong',
            why: L('Hướng nước dương.', 'Positive hydrotropism.'),
          },
          {
            id: 'tua-cuon',
            text: L('Tua cuốn quấn quanh cọc rào', 'Tendrils coil round a fence post'),
            group: 'huong',
            why: L('Hướng tiếp xúc.', 'Thigmotropism.'),
          },
          {
            id: 'trinh-nu',
            text: L('Lá cây trinh nữ cụp lại khi bị chạm', 'Mimosa leaves fold when touched'),
            group: 'ung',
            why: L(
              'Ứng động không sinh trưởng, do thay đổi sức trương nước.',
              'A non-growth nastic movement from turgor changes.',
            ),
          },
          {
            id: 'bo-cong-anh',
            text: L(
              'Hoa bồ công anh nở khi có ánh sáng, cụp lại lúc chạng vạng',
              'Dandelion flowers open in the light and close at dusk',
            ),
            group: 'ung',
            why: L(
              'Ứng động sinh trưởng theo chu kì ngày đêm.',
              'A growth nastic movement following day and night.',
            ),
          },
          {
            id: 'bat-ruoi',
            text: L('Cây bắt ruồi khép lá bắt mồi', 'A Venus flytrap snaps shut on its prey'),
            group: 'ung',
            why: L('Ứng động không sinh trưởng.', 'A non-growth nastic movement.'),
          },
        ],
      },
      {
        kind: 'match',
        id: 'tac-nhan',
        prompt: L(
          'Ghép mỗi kiểu hướng động với tác nhân kích thích của nó.',
          'Match each tropism with its stimulus.',
        ),
        pairs: [
          {
            id: 'sang',
            left: L('Hướng sáng', 'Phototropism'),
            right: L('Ánh sáng', 'Light'),
            why: L('Thân hướng sáng dương.', 'Stems are positively phototropic.'),
          },
          {
            id: 'trong-luc',
            left: L('Hướng trọng lực', 'Gravitropism'),
            right: L('Lực hút của Trái Đất', 'The Earth’s pull'),
            why: L(
              'Rễ hướng trọng lực dương, thân hướng trọng lực âm.',
              'Roots are positively gravitropic, stems negatively.',
            ),
          },
          {
            id: 'hoa',
            left: L('Hướng hóa', 'Chemotropism'),
            right: L(
              'Chất khoáng, chất hữu cơ, hormone, chất độc',
              'Minerals, organic substances, hormones, poisons',
            ),
            why: L(
              'Rễ mọc về phía chất dinh dưỡng, tránh xa kim loại nặng.',
              'Roots grow towards nutrients and away from heavy metals.',
            ),
          },
          {
            id: 'nuoc',
            left: L('Hướng nước', 'Hydrotropism'),
            right: L('Nguồn nước phân bố không đều trong đất', 'Water spread unevenly in the soil'),
            why: L(
              'Hướng nước là trường hợp đặc biệt của hướng hóa.',
              'Hydrotropism is a special case of chemotropism.',
            ),
          },
          {
            id: 'tiep-xuc',
            left: L('Hướng tiếp xúc', 'Thigmotropism'),
            right: L('Tác động cơ học từ một phía', 'A mechanical touch from one side'),
            why: L('Thường gặp ở thân leo, thân bò.', 'Common in climbing and creeping stems.'),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'ung-dong',
        prompt: L(
          'Xếp mỗi đặc điểm vào ứng động sinh trưởng hoặc ứng động không sinh trưởng.',
          'Put each feature under growth or non-growth nastic movement.',
        ),
        groups: [
          { id: 'sinh-truong', label: L('Ứng động sinh trưởng', 'Growth nastic movement') },
          { id: 'khong', label: L('Ứng động không sinh trưởng', 'Non-growth nastic movement') },
        ],
        items: [
          {
            id: 'toc-do',
            text: L(
              'Do tốc độ sinh trưởng không đều ở hai phía của cơ quan',
              'Caused by uneven growth on the two sides of an organ',
            ),
            group: 'sinh-truong',
            why: L(
              'Ví dụ: mặt trên và mặt dưới cánh hoa sinh trưởng khác nhau.',
              'For example the upper and lower faces of petals grow at different rates.',
            ),
          },
          {
            id: 'chu-ki',
            text: L(
              'Thường theo chu kì ngày đêm hoặc theo mùa',
              'Usually follows day and night or the seasons',
            ),
            group: 'sinh-truong',
            why: L(
              'Ví dụ: hoa nở, khép; chồi cây ngủ, thức theo mùa.',
              'For example flowers opening and closing, buds resting and waking with the seasons.',
            ),
          },
          {
            id: 'suc-truong',
            text: L(
              'Do thay đổi sức trương nước của tế bào',
              'Caused by changes in the cells’ turgor',
            ),
            group: 'khong',
            why: L(
              'Ví dụ: lá trinh nữ cụp, khí khổng đóng mở.',
              'For example mimosa leaves folding, stomata opening and closing.',
            ),
          },
          {
            id: 'nhanh',
            text: L('Xảy ra nhanh và thuận nghịch', 'Happens quickly and can be reversed'),
            group: 'khong',
            why: L(
              'Lá trinh nữ cụp lại rồi mở ra khi hết kích thích.',
              'Mimosa leaves fold, then open again once the stimulus is gone.',
            ),
          },
        ],
      },
    ],
  },
};
