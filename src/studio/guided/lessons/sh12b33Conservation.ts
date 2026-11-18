import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH12 KNTT Bài 33 "Sinh thái học phục hồi và bảo tồn đa dạng sinh vật" (printed pages 175–179),
 * in SimLab's own words. Checked against the pages on 17/11/2026: restoration and conservation
 * ecology (tr. 175), the values of natural ecosystems (Hình 33.1) and why they decline (tr. 176–177),
 * bioremediation and biological augmentation (Hình 33.2, 33.3), in situ and ex situ conservation
 * (Hình 33.4, the Việt Nam bear rescue centre, tr. 178). SH12-GL-12.
 */
export const sh12b33Conservation: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'biology',
  id: 'guided.sh12-conservation',
  topic: 'conservation',
  title: L(
    'Sinh thái học phục hồi và bảo tồn đa dạng sinh vật',
    'Restoration ecology and conservation',
  ),
  objectives: [
    L(
      'Dự đoán vì sao người ta trồng cây họ Đậu trên đất nghèo đạm.',
      'Predict why legumes are planted on nitrogen-poor soil.',
    ),
    L(
      'Phân loại biện pháp bảo tồn nguyên vị và chuyển vị.',
      'Sort in situ and ex situ conservation.',
    ),
    L(
      'Xếp mỗi việc làm vào phương pháp phục hồi sinh thái của nó.',
      'Put each action under its restoration method.',
    ),
  ],
  hints: [
    L(
      'Gia tăng sinh học là bổ sung các thành phần cần thiết cho hệ sinh thái phục hồi.',
      'Biological augmentation adds what the ecosystem needs to recover.',
    ),
    L(
      'Bảo tồn nguyên vị là bảo tồn loài tại nơi sống tự nhiên của nó.',
      'In situ conservation protects a species where it lives.',
    ),
  ],
  questions: [
    L(
      'Vì sao cần bảo vệ các rạn san hô khỏi tác động của con người?',
      'Why must coral reefs be protected from people?',
    ),
  ],
  expectedConclusion: L(
    'Sinh thái học phục hồi ứng dụng nguyên lí sinh thái để đưa hệ sinh thái bị suy thoái về gần trạng thái tự nhiên; sinh thái học bảo tồn tìm cách bảo vệ loài, môi trường sống và hệ sinh thái. Hệ sinh thái tự nhiên có giá trị trực tiếp (cung cấp vật chất) và gián tiếp (dịch vụ sinh thái) nhưng đang bị suy thoái nhanh do con người gây hại trực tiếp và khai thác cạn kiệt. Phục hồi bằng cải tạo sinh học (loại bỏ yếu tố gây hại) và gia tăng sinh học (bổ sung thành phần cần thiết); bảo tồn đa dạng sinh vật bằng bảo tồn nguyên vị (khu bảo tồn, vườn quốc gia) và bảo tồn chuyển vị (vườn thú, ngân hàng gene, trung tâm cứu hộ).',
    'Restoration ecology uses ecological principles to bring degraded ecosystems back towards their natural state; conservation ecology protects species, habitats and ecosystems. Natural ecosystems have direct value (materials) and indirect value (ecosystem services) but are degrading fast from direct harm and overuse. They are restored by bioremediation (removing harm) and augmentation (adding what is needed); biodiversity is conserved in situ (reserves, national parks) and ex situ (zoos, gene banks, rescue centres).',
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
      'Bài không đánh giá hiệu quả của từng biện pháp bằng số liệu.',
      'The lesson does not measure how well each method works.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH12', lesson: 33 },
    question: L(
      'Để phục hồi đất nghèo đạm, người ta thường trồng cây họ Đậu. Vì sao?',
      'To restore nitrogen-poor soil, legumes are often planted. Why?',
    ),
    choices: [
      {
        id: 'co-dinh',
        text: L(
          'Cây họ Đậu có vi sinh vật cố định đạm, bổ sung nitrogen cho đất',
          'Legumes host nitrogen-fixing microbes that add nitrogen to the soil',
        ),
      },
      { id: 'nhanh', text: L('Vì chúng lớn nhanh nhất', 'Because they grow fastest') },
      { id: 'dep', text: L('Để làm đẹp cảnh quan', 'To make the landscape pretty') },
      { id: 'khong-can', text: L('Vì chúng không cần nước', 'Because they need no water') },
    ],
    answer: 'co-dinh',
    answerWhy: L(
      'Đây là biện pháp gia tăng sinh học: cây họ Đậu cùng vi sinh vật cố định đạm bổ sung nitrogen, cải tạo đất cho các loài khác phát triển.',
      'This is biological augmentation: legumes and their nitrogen-fixing microbes add nitrogen, improving the soil for other species.',
    ),
    activities: [
      {
        kind: 'sort',
        id: 'bao-ton',
        prompt: L(
          'Xếp mỗi biện pháp vào loại bảo tồn của nó.',
          'Put each measure under its kind of conservation.',
        ),
        groups: [
          { id: 'nguyen-vi', label: L('Bảo tồn nguyên vị', 'In situ') },
          { id: 'chuyen-vi', label: L('Bảo tồn chuyển vị', 'Ex situ') },
        ],
        items: [
          {
            id: 'khu-bao-ton',
            text: L('Thành lập khu bảo tồn thiên nhiên', 'Setting up a nature reserve'),
            group: 'nguyen-vi',
            why: L('Bảo vệ loài tại nơi sống tự nhiên.', 'It protects species where they live.'),
          },
          {
            id: 'vooc',
            text: L(
              'Bảo vệ voọc Chà vá chân nâu tại rừng của chúng',
              'Protecting red-shanked doucs in their forests',
            ),
            group: 'nguyen-vi',
            why: L('Như ví dụ bán đảo Sơn Trà.', 'As on the Sơn Trà peninsula.'),
          },
          {
            id: 'ngan-hang',
            text: L('Ngân hàng hạt giống, ngân hàng gene', 'Seed and gene banks'),
            group: 'chuyen-vi',
            why: L('Lưu giữ ngoài nơi sống tự nhiên.', 'Kept away from the wild.'),
          },
          {
            id: 'gau',
            text: L('Trung tâm cứu hộ gấu', 'A bear rescue centre'),
            group: 'chuyen-vi',
            why: L('Chăm sóc gấu được giải cứu.', 'It cares for rescued bears.'),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'phuc-hoi',
        prompt: L(
          'Xếp mỗi việc làm vào phương pháp phục hồi sinh thái của nó.',
          'Put each action under its restoration method.',
        ),
        groups: [
          { id: 'cai-tao', label: L('Cải tạo sinh học', 'Bioremediation') },
          { id: 'gia-tang', label: L('Gia tăng sinh học', 'Biological augmentation') },
        ],
        items: [
          {
            id: 'uranium',
            text: L(
              'Bổ sung vi khuẩn hấp thụ uranium để làm sạch đất',
              'Adding bacteria that take up uranium to clean soil',
            ),
            group: 'cai-tao',
            why: L('Loại bỏ yếu tố gây hại.', 'It removes a harmful factor.'),
          },
          {
            id: 'beo',
            text: L(
              'Thả bèo hoa dâu để hấp thụ kim loại nặng trong ao',
              'Growing water fern to absorb heavy metals in a pond',
            ),
            group: 'cai-tao',
            why: L('Loại bỏ chất độc.', 'It removes toxins.'),
          },
          {
            id: 'mai-duong',
            text: L('Loại bỏ cây mai dương xâm lấn', 'Removing invasive giant sensitive plants'),
            group: 'cai-tao',
            why: L('Loại bỏ loài ngoại lai gây hại.', 'It removes a harmful invader.'),
          },
          {
            id: 'tien-phong',
            text: L(
              'Trồng cây tiên phong trên bãi bồi để phục hồi rừng ngập mặn',
              'Planting pioneer trees on mudflats to restore mangroves',
            ),
            group: 'gia-tang',
            why: L('Bổ sung thành phần cần thiết.', 'It adds what is needed.'),
          },
          {
            id: 'dan-nuoc',
            text: L(
              'Dẫn nước sông ngòi vào hệ sinh thái bị khô cạn',
              'Bringing river water to a dried-out ecosystem',
            ),
            group: 'gia-tang',
            why: L('Bổ sung nguồn nước.', 'It adds water.'),
          },
        ],
      },
    ],
  },
};
