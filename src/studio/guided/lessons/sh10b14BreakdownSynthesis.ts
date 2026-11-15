import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH10 KNTT Bài 14 "Phân giải và tổng hợp các chất trong tế bào" (printed pages 85–93), in
 * SimLab's own words. Checked on 16/11/2026: glycolysis in the cytoplasm without O₂, the Krebs
 * cycle inside the mitochondrion (H 14.1), the electron transport chain on the inner membrane,
 * light reactions on the thylakoid membrane, "pha tối" = Calvin cycle in the chloroplast stroma;
 * fermentation = glycolysis + fermentation, no electron transport chain, little ATP. "Chất nền" of
 * the mitochondrion and of the chloroplast is the book's own word (Bài 8 "Tế bào nhân thực",
 * pp. 52–53, H 8.8 and H 8.9: the mitochondrion's inner space is the chất nền holding the enzymes of
 * cell respiration). SH10-GL-4.
 */
export const sh10b14BreakdownSynthesis: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh10-breakdown-synthesis',
  topic: 'breakdownSynthesis',
  title: L(
    'Phân giải và tổng hợp: hô hấp, lên men và quang hợp diễn ra ở đâu?',
    'Breaking down and building up: where do respiration, fermentation and photosynthesis happen?',
  ),
  objectives: [
    L(
      'Dự đoán giai đoạn nào vẫn diễn ra khi tế bào thiếu O₂.',
      'Predict which stage still runs when a cell lacks O₂.',
    ),
    L(
      'Ghép mỗi giai đoạn với nơi nó diễn ra trong tế bào nhân thực.',
      'Match each stage with where it happens in a eukaryotic cell.',
    ),
    L('Phân biệt hô hấp hiếu khí với lên men.', 'Tell aerobic respiration from fermentation.'),
  ],
  hints: [
    L(
      'Tìm giai đoạn không cần O₂ và diễn ra ngay trong tế bào chất.',
      'Look for the stage that needs no O₂ and happens right in the cytoplasm.',
    ),
    L(
      'So sánh: glucose bị phân giải hoàn toàn hay không hoàn toàn thì lấy được nhiều năng lượng hơn?',
      'Compare: is more energy gained when glucose is broken down completely or only partly?',
    ),
  ],
  questions: [
    L(
      'Vì sao hô hấp hiếu khí tạo được nhiều ATP hơn lên men?',
      'Why does aerobic respiration make much more ATP than fermentation?',
    ),
  ],
  expectedConclusion: L(
    'Phân giải hiếu khí glucose gồm đường phân (tế bào chất), chu trình Krebs (chất nền ti thể) và chuỗi truyền electron (màng trong ti thể). Khi thiếu O₂, tế bào chỉ đường phân rồi lên men, tạo được ít ATP. Quang hợp là quá trình tổng hợp: pha sáng ở màng thylakoid, pha tối (chu trình Calvin) ở chất nền lục lạp.',
    'Aerobic breakdown of glucose is glycolysis (cytoplasm), the Krebs cycle (mitochondrial matrix) and the electron transport chain (inner mitochondrial membrane). Without O₂ the cell only runs glycolysis and then fermentation, making little ATP. Photosynthesis builds substances up: the light reactions on the thylakoid membrane, the dark phase (Calvin cycle) in the chloroplast stroma.',
  ),
  sources: [
    {
      id: 'kntt-sh10-8-chat-nen',
      citation:
        'SGK Sinh học 10 “Kết nối tri thức với cuộc sống”, NXB Giáo dục Việt Nam — Bài 8. Tế bào nhân thực, tr. 52–53 (ti thể: khoang trong là chất nền chứa enzyme hô hấp tế bào, H 8.8; lục lạp: chất nền (stroma), H 8.9)',
      url: 'https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-sinh-hoc-10.4700819489',
    },
  ],
  assumptions: [
    L(
      'Các vị trí trong bài là của tế bào nhân thực, có ti thể và lục lạp.',
      'The places in the lesson are those of a eukaryotic cell, with mitochondria and chloroplasts.',
    ),
  ],
  limits: [
    L(
      'Bài không đếm số phân tử ATP của từng giai đoạn.',
      'The lesson does not count the ATP molecules of each stage.',
    ),
    L(
      'Tên “chất nền” của ti thể và của lục lạp lấy từ bài Tế bào nhân thực của sách giáo khoa (xem mục Nguồn); bài này vẽ chu trình Krebs bên trong ti thể.',
      'The names “mitochondrial matrix” and “chloroplast stroma” come from the textbook’s lesson on the eukaryotic cell (see Sources); this lesson draws the Krebs cycle inside the mitochondrion.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH10', lesson: 14 },
    question: L(
      'Khi tế bào cơ của người thiếu O₂, theo em giai đoạn nào của quá trình phân giải glucose vẫn diễn ra?',
      'When a human muscle cell runs short of O₂, which stage of glucose breakdown do you think still runs?',
    ),
    choices: [
      { id: 'duong-phan', text: L('Đường phân', 'Glycolysis') },
      { id: 'krebs', text: L('Chu trình Krebs', 'The Krebs cycle') },
      { id: 'chuoi', text: L('Chuỗi truyền electron', 'The electron transport chain') },
    ],
    answer: 'duong-phan',
    answerWhy: L(
      'Đường phân diễn ra trong tế bào chất và không cần O₂. Khi thiếu O₂, tế bào cơ đi tiếp bằng lên men lactate: lên men gồm đường phân rồi giai đoạn lên men, không qua chu trình Krebs và chuỗi truyền electron.',
      'Glycolysis happens in the cytoplasm and needs no O₂. Without O₂ a muscle cell carries on with lactate fermentation: glycolysis followed by the fermentation step, with no Krebs cycle and no electron transport chain.',
    ),
    activities: [
      {
        kind: 'match',
        id: 'noi-dien-ra',
        prompt: L(
          'Ghép mỗi giai đoạn với nơi nó diễn ra trong tế bào nhân thực.',
          'Match each stage with where it happens in a eukaryotic cell.',
        ),
        pairs: [
          {
            id: 'duong-phan',
            left: L('Đường phân', 'Glycolysis'),
            right: L('Tế bào chất', 'Cytoplasm'),
            why: L(
              'Glucose được tách thành hai phân tử pyruvate ngay trong tế bào chất, không cần O₂.',
              'Glucose is split into two pyruvate molecules right in the cytoplasm, without O₂.',
            ),
          },
          {
            id: 'krebs',
            left: L('Chu trình Krebs', 'The Krebs cycle'),
            right: L('Chất nền của ti thể', 'Mitochondrial matrix'),
            why: L(
              'Pyruvate đi vào ti thể, được đổi thành acetyl-CoA rồi vào chu trình Krebs, giải phóng CO₂.',
              'Pyruvate enters the mitochondrion, becomes acetyl-CoA and joins the Krebs cycle, which gives off CO₂.',
            ),
          },
          {
            id: 'chuoi',
            left: L('Chuỗi truyền electron', 'The electron transport chain'),
            right: L('Màng trong của ti thể', 'Inner mitochondrial membrane'),
            why: L(
              'NADH và FADH₂ từ các giai đoạn trước được dùng ở đây; đây là giai đoạn tạo nhiều ATP nhất.',
              'NADH and FADH₂ from the earlier stages are used here; this stage makes the most ATP.',
            ),
          },
          {
            id: 'pha-sang',
            left: L('Pha sáng của quang hợp', 'Light reactions of photosynthesis'),
            right: L('Màng thylakoid của lục lạp', 'Thylakoid membrane of the chloroplast'),
            why: L(
              'Năng lượng ánh sáng được dùng để tạo ATP và NADPH; nước bị phân li và giải phóng O₂.',
              'Light energy is used to make ATP and NADPH; water is split and O₂ is given off.',
            ),
          },
          {
            id: 'pha-toi',
            left: L('Pha tối (chu trình Calvin)', 'Dark phase (Calvin cycle)'),
            right: L('Chất nền của lục lạp', 'Chloroplast stroma'),
            why: L(
              'ATP và NADPH từ pha sáng được dùng để biến CO₂ thành đường.',
              'ATP and NADPH from the light reactions are used to turn CO₂ into sugar.',
            ),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'hieu-khi-len-men',
        prompt: L(
          'Mỗi đặc điểm dưới đây thuộc hô hấp hiếu khí hay lên men?',
          'Does each feature below belong to aerobic respiration or to fermentation?',
        ),
        groups: [
          { id: 'hieu-khi', label: L('Hô hấp hiếu khí', 'Aerobic respiration') },
          { id: 'len-men', label: L('Lên men', 'Fermentation') },
        ],
        items: [
          {
            id: 'can-o2',
            text: L('Cần O₂ tham gia', 'Needs O₂'),
            group: 'hieu-khi',
            why: L(
              'Hô hấp hiếu khí cần O₂ để phân giải hoàn toàn glucose thành CO₂ và nước.',
              'Aerobic respiration needs O₂ to break glucose down completely to CO₂ and water.',
            ),
          },
          {
            id: 'co-chuoi',
            text: L('Có chuỗi truyền electron', 'Has an electron transport chain'),
            group: 'hieu-khi',
            why: L(
              'Chuỗi truyền electron ở màng trong ti thể là nơi tạo ra phần lớn ATP.',
              'The electron transport chain on the inner mitochondrial membrane makes most of the ATP.',
            ),
          },
          {
            id: 'nhieu-atp',
            text: L('Tạo nhiều ATP từ một phân tử glucose', 'Makes a lot of ATP from one glucose'),
            group: 'hieu-khi',
            why: L(
              'Glucose bị phân giải hoàn toàn nên lấy được nhiều năng lượng hơn hẳn.',
              'Glucose is broken down completely, so far more energy is gained.',
            ),
          },
          {
            id: 'co2-nuoc',
            text: L('Sản phẩm cuối là CO₂ và nước', 'Ends with CO₂ and water'),
            group: 'hieu-khi',
            why: L(
              'Glucose được phân giải hoàn toàn đến CO₂ và nước.',
              'Glucose is broken down all the way to CO₂ and water.',
            ),
          },
          {
            id: 'khong-o2',
            text: L('Không cần O₂', 'Needs no O₂'),
            group: 'len-men',
            why: L('Lên men diễn ra không có O₂ tham gia.', 'Fermentation runs without O₂.'),
          },
          {
            id: 'lactate',
            text: L('Tạo ra lactate hoặc ethanol', 'Makes lactate or ethanol'),
            group: 'len-men',
            why: L(
              'Người và động vật thường lên men lactate; thực vật chủ yếu lên men ethanol.',
              'People and animals usually make lactate; plants mostly make ethanol.',
            ),
          },
          {
            id: 'it-atp',
            text: L('Tạo ít ATP từ một phân tử glucose', 'Makes little ATP from one glucose'),
            group: 'len-men',
            why: L(
              'Glucose chỉ bị phân giải không hoàn toàn nên lấy được ít năng lượng hơn nhiều.',
              'Glucose is only partly broken down, so much less energy is gained.',
            ),
          },
          {
            id: 'khong-chuoi',
            text: L('Không có chuỗi truyền electron', 'Has no electron transport chain'),
            group: 'len-men',
            why: L(
              'Electron từ NADH được chuyển cho một phân tử hữu cơ khác, không qua chuỗi truyền electron.',
              'Electrons from NADH are handed to another organic molecule, not to an electron transport chain.',
            ),
          },
        ],
      },
    ],
  },
};
