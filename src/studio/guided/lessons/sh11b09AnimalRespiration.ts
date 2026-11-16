import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH11 KNTT Bài 9 "Hô hấp ở động vật" (printed pages 54–60), in SimLab's own words. Checked against
 * the pages on 17/11/2026: the five linked stages of respiration in people and mammals (Hình 9.1),
 * the four kinds of gas-exchange surface with the book's animals (thủy tức, giun đất; côn trùng;
 * Thân mềm, Chân khớp, Cá xương, nòng nọc; Bò sát, Chim, Thú) and Bảng 9.1 (chemicals in tobacco
 * smoke and their effects). The prediction is the book's opening question (tr. 54). SH11-GL-6.
 */
export const sh11b09AnimalRespiration: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh11-breathing',
  topic: 'animalRespiration',
  title: L('Hô hấp ở động vật', 'Respiration in animals'),
  objectives: [
    L(
      'Dự đoán vì sao cá heo, cá voi phải thường xuyên nhô lên mặt nước.',
      'Predict why dolphins and whales keep coming up to the surface.',
    ),
    L(
      'Phân loại động vật theo bề mặt trao đổi khí; xếp đúng thứ tự các giai đoạn hô hấp ở người.',
      'Sort animals by their gas-exchange surface; put the stages of human respiration in order.',
    ),
    L(
      'Ghép mỗi chất trong khói thuốc lá với tác hại của nó.',
      'Match each chemical in tobacco smoke with the harm it does.',
    ),
  ],
  hints: [
    L(
      'O₂ và CO₂ khuếch tán từ nơi có phân áp cao sang nơi có phân áp thấp, qua bề mặt mỏng và ẩm ướt.',
      'O₂ and CO₂ diffuse from high to low partial pressure, across a thin, moist surface.',
    ),
    L(
      'Bề mặt trao đổi khí càng rộng và thông khí càng tốt thì trao đổi khí càng hiệu quả.',
      'The larger the exchange surface and the better the ventilation, the more efficient the exchange.',
    ),
  ],
  questions: [
    L(
      'Vì sao người nuôi ếch, giun đất phải giữ cho môi trường nuôi luôn ẩm ướt?',
      'Why do people who raise frogs or earthworms keep their surroundings damp?',
    ),
  ],
  expectedConclusion: L(
    'Hô hấp lấy O₂ từ môi trường cho hô hấp tế bào và thải CO₂ ra ngoài. Ở người gồm thông khí, trao đổi khí ở phổi, vận chuyển khí, trao đổi khí ở mô và hô hấp tế bào. Động vật trao đổi khí qua bề mặt cơ thể, hệ thống ống khí, mang hoặc phổi; mọi bề mặt trao đổi khí đều mỏng, ẩm và rộng, kèm cơ chế thông khí. Ô nhiễm không khí và khói thuốc lá là nguyên nhân hàng đầu gây bệnh hô hấp; luyện tập thể dục giúp hệ hô hấp khỏe mạnh.',
    'Respiration takes O₂ from the surroundings for cell respiration and gets rid of CO₂. In people it is ventilation, gas exchange in the lungs, gas transport, gas exchange in the tissues and cell respiration. Animals exchange gases through the body surface, a tracheal system, gills or lungs; every exchange surface is thin, moist and large, with a way of ventilating it. Air pollution and tobacco smoke are the leading causes of respiratory disease; exercise keeps the respiratory system healthy.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu các hình thức trao đổi khí như sách giáo khoa; SimLab không tính lượng khí nào.',
      'The lesson gives only the forms of gas exchange, as the textbook does; SimLab computes no amount of gas.',
    ),
  ],
  limits: [
    L(
      'Chi tiết thông khí ở cá xương và ở chim (túi khí) chỉ được nhắc ngắn trong lời giải thích.',
      'Ventilation in bony fish and in birds (air sacs) is only mentioned briefly in the explanations.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH11', lesson: 9 },
    question: L(
      'Cá heo, cá voi sống trong nước nhưng phải thường xuyên nhô lên mặt nước. Vì sao?',
      'Dolphins and whales live in water but keep coming up to the surface. Why?',
    ),
    choices: [
      {
        id: 'phoi',
        text: L(
          'Chúng thở bằng phổi, phải lấy O₂ từ không khí',
          'They breathe with lungs and must take O₂ from the air',
        ),
      },
      {
        id: 'mang',
        text: L('Mang của chúng cần không khí để ẩm', 'Their gills need air to stay moist'),
      },
      { id: 'lam-mat', text: L('Để làm mát cơ thể', 'To cool their bodies') },
      { id: 'thuc-an', text: L('Để tìm thức ăn trên mặt nước', 'To look for food at the surface') },
    ],
    answer: 'phoi',
    answerWhy: L(
      'Cá heo, cá voi là Thú. Thú trao đổi khí qua phổi, nên phải hít không khí để lấy O₂ và thải CO₂, dù sống trong nước.',
      'Dolphins and whales are mammals. Mammals exchange gases in their lungs, so they must breathe air to take in O₂ and get rid of CO₂, even though they live in water.',
    ),
    activities: [
      {
        kind: 'sort',
        id: 'be-mat',
        prompt: L(
          'Xếp mỗi động vật vào bề mặt trao đổi khí chủ yếu của nó.',
          'Put each animal under its main gas-exchange surface.',
        ),
        groups: [
          { id: 'co-the', label: L('Bề mặt cơ thể', 'Body surface') },
          { id: 'ong-khi', label: L('Hệ thống ống khí', 'Tracheal system') },
          { id: 'mang', label: L('Mang', 'Gills') },
          { id: 'phoi', label: L('Phổi', 'Lungs') },
        ],
        items: [
          {
            id: 'thuy-tuc',
            text: L('Thủy tức', 'Hydra'),
            group: 'co-the',
            why: L(
              'O₂ và CO₂ khuếch tán qua toàn bộ bề mặt cơ thể.',
              'O₂ and CO₂ diffuse across the whole body surface.',
            ),
          },
          {
            id: 'giun-dat',
            text: L('Giun đất', 'Earthworm'),
            group: 'co-the',
            why: L(
              'Trao đổi khí qua da ẩm có nhiều mao mạch.',
              'Gases are exchanged through moist skin rich in capillaries.',
            ),
          },
          {
            id: 'chau-chau',
            text: L('Châu chấu', 'Grasshopper'),
            group: 'ong-khi',
            why: L(
              'Ống khí phân nhánh đến tận tế bào, thông ra ngoài qua lỗ thở.',
              'Branching tubes reach every cell and open to the air through spiracles.',
            ),
          },
          {
            id: 'ca-xuong',
            text: L('Cá chép (cá xương)', 'Carp (a bony fish)'),
            group: 'mang',
            why: L(
              'Dòng máu trong mao mạch mang chảy song song và ngược chiều với dòng nước.',
              'Blood in the gill capillaries flows parallel and opposite to the water.',
            ),
          },
          {
            id: 'nong-noc',
            text: L('Nòng nọc', 'Tadpole'),
            group: 'mang',
            why: L(
              'Nòng nọc lưỡng cư sống trong nước, trao đổi khí qua mang.',
              'Amphibian tadpoles live in water and breathe with gills.',
            ),
          },
          {
            id: 'chim',
            text: L('Chim sẻ', 'Sparrow'),
            group: 'phoi',
            why: L(
              'Phổi chim có hệ thống túi khí: không khí giàu O₂ đi qua phổi cả khi hít vào và thở ra.',
              'Bird lungs have air sacs: O₂-rich air passes through the lungs both in and out.',
            ),
          },
          {
            id: 'nguoi',
            text: L('Người', 'Human'),
            group: 'phoi',
            why: L(
              'Hàng triệu phế nang tạo diện tích trao đổi khí rất lớn.',
              'Millions of alveoli give a very large exchange surface.',
            ),
          },
        ],
      },
      {
        kind: 'order',
        id: 'giai-doan',
        prompt: L(
          'Xếp các giai đoạn hô hấp ở người theo đúng thứ tự, bắt đầu từ không khí bên ngoài.',
          'Put the stages of human respiration in order, starting from the outside air.',
        ),
        items: [
          {
            id: 'thong-khi',
            text: L('Thông khí: hít vào và thở ra', 'Ventilation: breathing in and out'),
            why: L(
              'Các cơ hô hấp làm thay đổi thể tích lồng ngực và phổi.',
              'The breathing muscles change the volume of the chest and lungs.',
            ),
          },
          {
            id: 'tdk-phoi',
            text: L('Trao đổi khí ở phổi', 'Gas exchange in the lungs'),
            why: L(
              'O₂ từ phế nang vào máu, CO₂ từ máu vào phế nang.',
              'O₂ passes from the alveoli into the blood, CO₂ the other way.',
            ),
          },
          {
            id: 'van-chuyen',
            text: L('Vận chuyển O₂ và CO₂ trong máu', 'Transport of O₂ and CO₂ in the blood'),
            why: L(
              'Máu mang khí hòa tan đi khắp cơ thể.',
              'The blood carries the dissolved gases round the body.',
            ),
          },
          {
            id: 'tdk-mo',
            text: L('Trao đổi khí ở mô', 'Gas exchange in the tissues'),
            why: L(
              'O₂ từ máu vào tế bào, CO₂ từ tế bào vào máu.',
              'O₂ passes from the blood into cells, CO₂ from cells into the blood.',
            ),
          },
          {
            id: 'te-bao',
            text: L('Hô hấp tế bào tạo năng lượng', 'Cell respiration releasing energy'),
            why: L(
              'O₂ được dùng để tạo năng lượng cho hoạt động sống; CO₂ sinh ra.',
              'O₂ is used to release energy for life activities; CO₂ is produced.',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'khoi-thuoc',
        prompt: L(
          'Ghép mỗi chất trong khói thuốc lá với tác hại của nó.',
          'Match each chemical in tobacco smoke with the harm it does.',
        ),
        pairs: [
          {
            id: 'nicotin',
            left: L('Nicotin', 'Nicotine'),
            right: L(
              'Gây nghiện, tăng nhịp tim, tăng huyết áp',
              'Addictive; raises heart rate and blood pressure',
            ),
            why: L(
              'Nicotin còn làm tăng nguy cơ hình thành cục máu đông.',
              'Nicotine also raises the risk of blood clots.',
            ),
          },
          {
            id: 'co',
            left: L('Carbon monoxide (CO)', 'Carbon monoxide (CO)'),
            right: L(
              'Kết hợp với hemoglobin, làm máu vận chuyển O₂ kém',
              'Binds haemoglobin, so the blood carries less O₂',
            ),
            why: L(
              'Hemoglobin đã gắn CO không chở được O₂.',
              'Haemoglobin bound to CO cannot carry O₂.',
            ),
          },
          {
            id: 'tar',
            left: L('Tar (hắc ín)', 'Tar'),
            right: L(
              'Gây nguy cơ ung thư; làm tê liệt lông rung đường dẫn khí',
              'Raises cancer risk; paralyses the cilia of the airways',
            ),
            why: L(
              'Lông rung bị tê liệt không đẩy được bụi, chất nhầy ra ngoài.',
              'Paralysed cilia can no longer sweep out dust and mucus.',
            ),
          },
          {
            id: 'kich-thich',
            left: L(
              'Các chất kích thích (hydrogen cyanide, acrolein…)',
              'Irritants (hydrogen cyanide, acrolein…)',
            ),
            right: L(
              'Gây tiết nhiều dịch nhầy, viêm và hẹp đường dẫn khí',
              'Cause too much mucus, inflammation and narrowed airways',
            ),
            why: L(
              'Đường dẫn khí bị hẹp làm khó thở và ho.',
              'Narrowed airways make breathing hard and cause coughing.',
            ),
          },
        ],
      },
    ],
  },
};
