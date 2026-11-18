import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH11 KNTT Bài 6 "Hô hấp ở thực vật" (printed pages 38–43), in SimLab's own words. Checked against
 * the pages on 17/11/2026: aerobic respiration in three stages (đường phân in the cytoplasm,
 * pyruvate oxidation and the Krebs cycle in the mitochondrial matrix, the electron transport chain
 * on the inner membrane), fermentation when O₂ is lacking (waterlogged roots, soaked seeds) giving
 * ethanol or lactate and little ATP, the effects of water, temperature, O₂ and CO₂ (tr. 40–41) and
 * the storage measures (tr. 41–42). The prediction is the book's example of seed water content
 * (tr. 40). SH11-GL-4.
 */
export const sh11b06Respiration: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh11-respiration',
  topic: 'plantRespiration',
  title: L('Hô hấp ở thực vật', 'Respiration in plants'),
  objectives: [
    L(
      'Dự đoán cường độ hô hấp của hạt thay đổi thế nào khi hạt bị ẩm.',
      'Predict how a seed’s rate of respiration changes when the seed gets damp.',
    ),
    L(
      'Xếp đúng thứ tự các giai đoạn hô hấp hiếu khí; phân biệt hô hấp hiếu khí với lên men.',
      'Put the stages of aerobic respiration in order; tell aerobic respiration and fermentation apart.',
    ),
    L(
      'Ghép mỗi biện pháp bảo quản nông sản, canh tác với cơ sở khoa học của nó.',
      'Match each storage or farming measure with the science behind it.',
    ),
  ],
  hints: [
    L(
      'Nước là dung môi và môi trường cho các phản ứng hô hấp; enzyme hô hấp hoạt động mạnh hơn khi có nước.',
      'Water is the solvent and medium of the respiration reactions; respiratory enzymes work harder when water is present.',
    ),
    L(
      'Muốn giữ nông sản lâu, cần giảm hô hấp đến mức tối thiểu nhưng không làm hỏng sản phẩm.',
      'To keep produce longer, respiration must be cut to a minimum without spoiling the produce.',
    ),
  ],
  questions: [
    L(
      'Vì sao rễ cây bị ngập úng lâu ngày thì cây có thể chết?',
      'Why can a plant die when its roots stay waterlogged for a long time?',
    ),
  ],
  expectedConclusion: L(
    'Hô hấp phân giải chất hữu cơ, chủ yếu là carbohydrate, thành chất đơn giản, tạo ATP và nhiệt. Hô hấp hiếu khí cần O₂, gồm đường phân trong tế bào chất, chu trình Krebs trong chất nền ti thể và chuỗi truyền electron ở màng trong ti thể, nơi tạo nhiều ATP nhất. Khi thiếu O₂ (rễ ngập úng, hạt ngâm nước) cây lên men, tạo ethanol hoặc lactate và rất ít ATP. Nước, nhiệt độ, O₂ và CO₂ ảnh hưởng đến hô hấp; con người điều chỉnh các yếu tố này để bảo quản nông sản và chăm sóc cây trồng. Quang hợp và hô hấp phụ thuộc lẫn nhau.',
    'Respiration breaks organic matter, mostly carbohydrates, into simple substances, making ATP and heat. Aerobic respiration needs O₂ and has glycolysis in the cytoplasm, the Krebs cycle in the mitochondrial matrix and the electron transport chain on the inner membrane, which makes the most ATP. Without enough O₂ (waterlogged roots, soaking seeds) the plant ferments, making ethanol or lactate and very little ATP. Water, temperature, O₂ and CO₂ affect respiration; people adjust them to store produce and to look after crops. Photosynthesis and respiration depend on each other.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu các giai đoạn và các yếu tố như sách giáo khoa; SimLab không tính số phân tử ATP hay cường độ hô hấp.',
      'The lesson gives only the stages and factors, as the textbook does; SimLab computes no ATP count or rate of respiration.',
    ),
  ],
  limits: [
    L(
      'Bảng giới hạn nhiệt độ cho sự nảy mầm của hạt và hô hấp sáng (mục "Em có biết") không có trong bài học này.',
      'The table of germination temperature limits and photorespiration (the "Em có biết" box) are not part of this lesson.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH11', lesson: 6 },
    question: L(
      'Hạt thóc phơi khô có rất ít nước nên hô hấp rất yếu. Nếu hạt bị ẩm, hàm lượng nước trong hạt tăng lên, cường độ hô hấp của hạt sẽ thế nào?',
      'Dried rice grains hold very little water, so they respire very weakly. If the grains get damp and their water content rises, what happens to their rate of respiration?',
    ),
    choices: [
      { id: 'tang', text: L('Tăng mạnh', 'It rises sharply') },
      { id: 'giam', text: L('Giảm', 'It falls') },
      { id: 'khong-doi', text: L('Không đổi', 'It stays the same') },
      { id: 'ngung', text: L('Ngừng hẳn', 'It stops completely') },
    ],
    answer: 'tang',
    answerWhy: L(
      'Trong giới hạn nhất định, cường độ hô hấp tỉ lệ thuận với hàm lượng nước. Hạt khô ở trạng thái ngủ, hô hấp rất thấp; khi hạt hút nước, hô hấp tăng nhanh, và càng nhiều nước thì hô hấp càng tăng mạnh. Vì vậy hạt phải được phơi, sấy khô trước khi cất giữ.',
      'Within limits, the rate of respiration rises with the water content. Dry seeds are dormant and respire very little; when they take up water, respiration rises quickly, and the more water, the stronger it gets. That is why grain is dried before it is stored.',
    ),
    activities: [
      {
        kind: 'order',
        id: 'hieu-khi',
        prompt: L(
          'Xếp các giai đoạn hô hấp hiếu khí theo đúng thứ tự.',
          'Put the stages of aerobic respiration in order.',
        ),
        items: [
          {
            id: 'duong-phan',
            text: L(
              'Đường phân trong tế bào chất: glucose thành pyruvate',
              'Glycolysis in the cytoplasm: glucose becomes pyruvate',
            ),
            why: L(
              'Giai đoạn này không cần O₂ và chung cho cả hô hấp hiếu khí lẫn lên men.',
              'This stage needs no O₂ and is shared by aerobic respiration and fermentation.',
            ),
          },
          {
            id: 'acetyl',
            text: L(
              'Pyruvate vào ti thể, bị oxy hóa thành acetyl-CoA',
              'Pyruvate enters the mitochondrion and is oxidised to acetyl-CoA',
            ),
            why: L(
              'Bước này giải phóng CO₂ và tạo NADH.',
              'This step releases CO₂ and makes NADH.',
            ),
          },
          {
            id: 'krebs',
            text: L(
              'Chu trình Krebs trong chất nền ti thể: acetyl-CoA bị phân giải hoàn toàn thành CO₂',
              'The Krebs cycle in the matrix: acetyl-CoA is broken down fully to CO₂',
            ),
            why: L(
              'Chu trình tạo thêm NADH, FADH₂ và một ít ATP.',
              'The cycle makes more NADH, FADH₂ and a little ATP.',
            ),
          },
          {
            id: 'chuoi',
            text: L(
              'Chuỗi truyền electron ở màng trong ti thể: electron đến O₂, tạo ATP và nước',
              'The electron transport chain on the inner membrane: electrons reach O₂, making ATP and water',
            ),
            why: L('Giai đoạn này tạo nhiều ATP nhất.', 'This stage makes the most ATP.'),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'hai-con-duong',
        prompt: L(
          'Xếp mỗi đặc điểm vào hô hấp hiếu khí, lên men, hoặc cả hai.',
          'Put each feature under aerobic respiration, fermentation, or both.',
        ),
        groups: [
          { id: 'hieu-khi', label: L('Hô hấp hiếu khí', 'Aerobic respiration') },
          { id: 'len-men', label: L('Lên men', 'Fermentation') },
          { id: 'ca-hai', label: L('Cả hai', 'Both') },
        ],
        items: [
          {
            id: 'can-o2',
            text: L('Cần O₂', 'Needs O₂'),
            group: 'hieu-khi',
            why: L(
              'O₂ nhận electron ở cuối chuỗi truyền electron.',
              'O₂ takes the electrons at the end of the transport chain.',
            ),
          },
          {
            id: 'krebs-chuoi',
            text: L(
              'Có chu trình Krebs và chuỗi truyền electron',
              'Has the Krebs cycle and the electron transport chain',
            ),
            group: 'hieu-khi',
            why: L(
              'Hai giai đoạn này diễn ra trong ti thể.',
              'Both stages take place in the mitochondrion.',
            ),
          },
          {
            id: 'nhieu-atp',
            text: L(
              'Phân giải hoàn toàn glucose thành CO₂ và nước, tạo nhiều ATP',
              'Breaks glucose down fully to CO₂ and water, making plenty of ATP',
            ),
            group: 'hieu-khi',
            why: L(
              'Đây là nguồn năng lượng chính của cây.',
              'This is the plant’s main energy source.',
            ),
          },
          {
            id: 'ngap-ung',
            text: L(
              'Xảy ra khi rễ bị ngập úng, thiếu O₂',
              'Happens when roots are waterlogged and lack O₂',
            ),
            group: 'len-men',
            why: L(
              'Lên men giúp cây tồn tại tạm thời khi thiếu O₂.',
              'Fermentation helps the plant survive for a while without O₂.',
            ),
          },
          {
            id: 'ethanol',
            text: L('Tạo ethanol hoặc lactate', 'Makes ethanol or lactate'),
            group: 'len-men',
            why: L(
              'Pyruvate không vào ti thể mà bị chuyển thành ethanol hoặc lactate.',
              'Pyruvate does not enter the mitochondrion; it is turned into ethanol or lactate.',
            ),
          },
          {
            id: 'it-atp',
            text: L('Thu được rất ít ATP', 'Yields very little ATP'),
            group: 'len-men',
            why: L('Chỉ giai đoạn đường phân tạo ATP.', 'Only glycolysis makes ATP.'),
          },
          {
            id: 'duong-phan-chung',
            text: L('Có giai đoạn đường phân', 'Includes glycolysis'),
            group: 'ca-hai',
            why: L(
              'Hai con đường có chung giai đoạn đường phân trong tế bào chất.',
              'Both pathways share glycolysis in the cytoplasm.',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'ung-dung',
        prompt: L(
          'Ghép mỗi biện pháp với cơ sở khoa học của nó.',
          'Match each measure with the science behind it.',
        ),
        pairs: [
          {
            id: 'say-kho',
            left: L('Phơi, sấy khô hạt trước khi cất', 'Drying grain before storing it'),
            right: L(
              'Giảm hàm lượng nước nên giảm cường độ hô hấp',
              'Less water means a lower rate of respiration',
            ),
            why: L(
              'Hạt khô hô hấp rất yếu, ít hao chất hữu cơ.',
              'Dry grain respires weakly and loses little organic matter.',
            ),
          },
          {
            id: 'lanh',
            left: L(
              'Bảo quản rau quả ở nhiệt độ thấp phù hợp',
              'Keeping produce at a suitable low temperature',
            ),
            right: L(
              'Giảm hoạt động của enzyme hô hấp và ức chế vi sinh vật gây hỏng',
              'Slows the respiratory enzymes and holds back the microbes that spoil produce',
            ),
            why: L(
              'Mỗi loại nông sản có nhiệt độ bảo quản thích hợp riêng.',
              'Each kind of produce has its own suitable storage temperature.',
            ),
          },
          {
            id: 'khi-kho',
            left: L('Tăng CO₂, giảm O₂ trong kho bảo quản', 'More CO₂ and less O₂ in the store'),
            right: L(
              'Ít O₂ cho hô hấp hiếu khí và CO₂ cao ức chế hô hấp',
              'Little O₂ for aerobic respiration, and high CO₂ holds respiration back',
            ),
            why: L(
              'Điều chỉnh thành phần không khí là một cách bảo quản hiệu quả.',
              'Adjusting the air in the store is an effective way to keep produce.',
            ),
          },
          {
            id: 'lam-dat',
            left: L(
              'Cày, xới đất, chống ngập úng',
              'Ploughing, loosening the soil, preventing waterlogging',
            ),
            right: L(
              'Cung cấp O₂ cho rễ hô hấp hiếu khí',
              'Gives the roots O₂ for aerobic respiration',
            ),
            why: L(
              'Rễ hô hấp hiếu khí tạo năng lượng cho hút nước, hút khoáng và sinh trưởng.',
              'Aerobic root respiration provides energy for taking up water and minerals and for growth.',
            ),
          },
        ],
      },
    ],
  },
};
