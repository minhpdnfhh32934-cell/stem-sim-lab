import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH11 KNTT Bài 28 "Mối quan hệ giữa các quá trình sinh lí trong cơ thể sinh vật" (printed pages
 * 183–184), in SimLab's own words. Checked against the pages on 17/11/2026: in plants photosynthesis
 * and respiration, water uptake and transpiration (Hình 28.1); in animals the links between
 * digestion, respiration, circulation and excretion (Hình 28.2, the book's example of circulation
 * and respiration is the prediction); the organism as an open, self-regulating system. SH11-GL-20.
 */
export const sh11b28Integration: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh11-integration',
  topic: 'bodyIntegration',
  title: L('Mối quan hệ giữa các quá trình sinh lí', 'How the body’s processes work together'),
  objectives: [
    L(
      'Dự đoán điều xảy ra với hô hấp khi hệ tuần hoàn hoạt động kém.',
      'Predict what happens to breathing when the circulatory system works poorly.',
    ),
    L(
      'Ghép mỗi cặp quá trình sinh lí với mối quan hệ giữa chúng, ở thực vật và ở động vật.',
      'Match each pair of processes with how they are linked, in plants and in animals.',
    ),
  ],
  hints: [
    L(
      'Sản phẩm của quá trình này thường là nguyên liệu của quá trình kia.',
      'What one process makes is often what another one uses.',
    ),
    L(
      'Cơ thể là một hệ thống mở: luôn trao đổi chất và năng lượng với môi trường, và tự điều chỉnh.',
      'An organism is an open system: it keeps exchanging matter and energy with its surroundings, and it regulates itself.',
    ),
  ],
  questions: [
    L(
      'Vì sao nói cơ thể thực vật hoặc động vật là một thể thống nhất?',
      'Why is a plant or animal body said to be a single unified whole?',
    ),
  ],
  expectedConclusion: L(
    'Trong cơ thể thực vật và động vật, các quá trình sinh lí liên quan chặt chẽ và ảnh hưởng lẫn nhau. Ở thực vật, quang hợp tạo chất hữu cơ và O₂ cho hô hấp, hô hấp trả lại CO₂, nước và cung cấp năng lượng; thoát hơi nước tạo lực kéo cho hấp thụ nước. Ở động vật, tiêu hóa cung cấp chất dinh dưỡng, hô hấp cung cấp O₂, tuần hoàn vận chuyển chúng đến tế bào và đưa chất thải đến cơ quan bài tiết. Cơ thể là hệ thống mở và tự điều chỉnh.',
    'In plant and animal bodies the processes are closely linked and affect each other. In plants, photosynthesis makes the organic matter and O₂ that respiration uses, and respiration returns CO₂ and water and supplies energy; transpiration pulls water up from the roots. In animals, digestion supplies nutrients, breathing supplies O₂, circulation carries them to the cells and takes wastes to the excretory organs. The body is an open, self-regulating system.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu các mối quan hệ như sách giáo khoa.',
      'The lesson gives only the links, as the textbook does.',
    ),
  ],
  limits: [
    L(
      'Chi tiết từng quá trình đã có ở các bài trước của sách.',
      'The details of each process are in the book’s earlier lessons.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH11', lesson: 28 },
    question: L(
      'Nếu hệ tuần hoàn hoạt động kém, lưu lượng máu lên phổi giảm, điều gì xảy ra với hô hấp của cơ thể?',
      'If the circulatory system works poorly and less blood reaches the lungs, what happens to the body’s breathing?',
    ),
    choices: [
      {
        id: 'thieu-o2',
        text: L(
          'Cơ thể lấy được ít O₂ hơn và thải CO₂ kém hơn',
          'The body gets less O₂ and gets rid of CO₂ less well',
        ),
      },
      { id: 'khong-sao', text: L('Hô hấp không bị ảnh hưởng', 'Breathing is not affected') },
      { id: 'tot-hon', text: L('Hô hấp hiệu quả hơn', 'Breathing works better') },
      { id: 'ngung', text: L('Phổi ngừng thông khí', 'The lungs stop ventilating') },
    ],
    answer: 'thieu-o2',
    answerWhy: L(
      'Hô hấp chỉ hiệu quả khi tuần hoàn đưa đủ máu lên phổi để nhận O₂ và thải CO₂. Khi tuần hoàn bình thường, lưu lượng máu lên hệ hô hấp được bảo đảm nên cơ thể lấy đủ O₂ và thải CO₂ hiệu quả; khi tuần hoàn kém, việc trao đổi khí của cả cơ thể bị giảm.',
      'Breathing only works well when the circulation brings enough blood to the lungs to pick up O₂ and give off CO₂. With normal circulation the blood flow to the lungs is assured, so the body gets enough O₂ and clears CO₂; with poor circulation, gas exchange for the whole body drops.',
    ),
    activities: [
      {
        kind: 'match',
        id: 'thuc-vat',
        prompt: L(
          'Ghép mỗi cặp quá trình ở thực vật với mối quan hệ giữa chúng.',
          'Match each pair of plant processes with how they are linked.',
        ),
        pairs: [
          {
            id: 'qh-hh',
            left: L('Quang hợp với hô hấp', 'Photosynthesis and respiration'),
            right: L(
              'Quang hợp tạo chất hữu cơ và O₂ cho hô hấp; hô hấp trả lại CO₂ và nước',
              'Photosynthesis makes organic matter and O₂ for respiration; respiration returns CO₂ and water',
            ),
            why: L('Hai quá trình phụ thuộc lẫn nhau.', 'The two depend on each other.'),
          },
          {
            id: 'hh-hut',
            left: L('Hô hấp với hút nước, khoáng ở rễ', 'Respiration and water and mineral uptake'),
            right: L(
              'Hô hấp cung cấp năng lượng, tăng áp suất thẩm thấu của tế bào rễ',
              'Respiration supplies energy and raises the root cells’ osmotic pressure',
            ),
            why: L(
              'Rễ cần năng lượng cho hấp thụ chủ động.',
              'Roots need energy for active uptake.',
            ),
          },
          {
            id: 'hut-thoat',
            left: L('Hấp thụ nước với thoát hơi nước', 'Water uptake and transpiration'),
            right: L(
              'Thoát hơi nước tạo lực kéo nước từ rễ lên lá',
              'Transpiration pulls water from the roots up to the leaves',
            ),
            why: L(
              'Nước hút vào bù lại lượng nước đã thoát.',
              'The water taken up replaces what is lost.',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'dong-vat',
        prompt: L(
          'Ghép mỗi cặp quá trình ở động vật với mối quan hệ giữa chúng.',
          'Match each pair of animal processes with how they are linked.',
        ),
        pairs: [
          {
            id: 'th-tuan',
            left: L('Tiêu hóa với tuần hoàn', 'Digestion and circulation'),
            right: L(
              'Chất dinh dưỡng hấp thụ ở ruột được máu vận chuyển đến tế bào',
              'Nutrients absorbed in the gut are carried by the blood to the cells',
            ),
            why: L(
              'Tuần hoàn phân phối sản phẩm của tiêu hóa.',
              'Circulation delivers what digestion produces.',
            ),
          },
          {
            id: 'hh-tuan',
            left: L('Hô hấp với tuần hoàn', 'Breathing and circulation'),
            right: L(
              'O₂ từ phổi được máu chở đến tế bào, CO₂ được chở về phổi để thải',
              'O₂ from the lungs is carried to the cells and CO₂ back to the lungs',
            ),
            why: L('Hai hệ cùng bảo đảm trao đổi khí.', 'Together they keep gas exchange going.'),
          },
          {
            id: 'tuan-bai-tiet',
            left: L('Tuần hoàn với bài tiết', 'Circulation and excretion'),
            right: L(
              'Máu đưa chất thải từ tế bào đến thận để lọc và thải ra ngoài',
              'The blood takes cell wastes to the kidneys to be filtered out',
            ),
            why: L(
              'Nhờ vậy nội môi được giữ ổn định.',
              'This keeps the internal environment steady.',
            ),
          },
          {
            id: 'te-bao',
            left: L('Tế bào với cả cơ thể', 'Cells and the whole body'),
            right: L(
              'Tế bào dùng chất dinh dưỡng và O₂ để tạo năng lượng cho mọi hoạt động sống',
              'Cells use nutrients and O₂ to release energy for every life activity',
            ),
            why: L(
              'Các hệ cơ quan cùng phục vụ hoạt động của tế bào.',
              'All the organ systems serve the cells’ activity.',
            ),
          },
        ],
      },
    ],
  },
};
