import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH11 KNTT Bài 1 "Khái quát về trao đổi chất và chuyển hóa năng lượng" (printed pages 5–8), in
 * SimLab's own words. Checked against the pages on 17/11/2026: the four signs of metabolism
 * (tiếp nhận và vận chuyển; biến đổi kèm chuyển hóa năng lượng; thải chất; điều hòa), the three
 * stages of energy conversion in the living world (Hình 1.1: tổng hợp, phân giải, huy động) and the
 * two ways of getting matter and energy (quang/hóa tự dưỡng, dị dưỡng) with the book's examples. The
 * prediction is the book's opening question (tr. 5). SH11-GL-1.
 */
export const sh11b01Metabolism: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh11-metabolism',
  topic: 'organismMetabolism',
  title: L(
    'Trao đổi chất và chuyển hóa năng lượng ở sinh vật',
    'Metabolism and energy conversion in organisms',
  ),
  objectives: [
    L(
      'Dự đoán điều xảy ra khi cơ thể không lấy được chất cần thiết và không thải được chất thải.',
      'Predict what happens when a body cannot take in what it needs or get rid of its wastes.',
    ),
    L(
      'Xếp đúng thứ tự ba giai đoạn chuyển hóa năng lượng trong sinh giới.',
      'Put the three stages of energy conversion in the living world in order.',
    ),
    L(
      'Phân biệt quang tự dưỡng, hóa tự dưỡng và dị dưỡng; ghép mỗi dấu hiệu của trao đổi chất với ví dụ.',
      'Tell photoautotrophs, chemoautotrophs and heterotrophs apart; match each sign of metabolism with an example.',
    ),
  ],
  hints: [
    L(
      'Năng lượng trong sinh giới bắt đầu từ ánh sáng mặt trời và cuối cùng tỏa ra môi trường dưới dạng nhiệt.',
      'Energy in the living world starts as sunlight and finally leaves as heat.',
    ),
    L(
      'Tự dưỡng là tự tạo chất hữu cơ từ chất vô cơ; dị dưỡng là lấy chất hữu cơ có sẵn từ sinh vật khác.',
      'Autotrophs make their own organic matter from inorganic substances; heterotrophs take ready-made organic matter from other organisms.',
    ),
  ],
  questions: [
    L(
      'Vì sao nói sinh vật tự dưỡng giữ vai trò quan trọng đối với cả sinh giới?',
      'Why are autotrophs said to matter for the whole living world?',
    ),
  ],
  expectedConclusion: L(
    'Trao đổi chất và chuyển hóa năng lượng giúp sinh vật tồn tại: cơ thể tiếp nhận và vận chuyển chất, biến đổi chất kèm chuyển hóa năng lượng, thải chất ra môi trường, và mọi quá trình đều được điều hòa. Năng lượng trong sinh giới đi qua ba giai đoạn: tổng hợp (quang năng thành hóa năng trong chất hữu cơ), phân giải (hô hấp tạo ATP) và huy động (ATP dùng cho hoạt động sống, rồi tỏa ra dạng nhiệt). Sinh vật tự dưỡng tạo chất hữu cơ và O₂ cho cả sinh giới; sinh vật dị dưỡng lấy chất hữu cơ từ sinh vật khác.',
    'Metabolism and energy conversion keep organisms alive: the body takes in and moves substances, changes them while converting energy, gives off wastes, and every process is regulated. Energy in the living world passes three stages: synthesis (light energy into chemical energy in organic matter), breakdown (respiration makes ATP) and use (ATP drives life activities and finally leaves as heat). Autotrophs make organic matter and O₂ for the whole living world; heterotrophs take organic matter from other organisms.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu các khái niệm và sơ đồ của sách; SimLab không tính lượng chất hay năng lượng nào.',
      'The lesson gives only the book’s ideas and diagrams; SimLab computes no amount of matter or energy.',
    ),
  ],
  limits: [
    L(
      'Chi tiết từng quá trình (hấp thụ nước, quang hợp, hô hấp, tiêu hóa, tuần hoàn…) ở các bài sau của chương.',
      'The details of each process (water uptake, photosynthesis, respiration, digestion, circulation…) are in the chapter’s later lessons.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH11', lesson: 1 },
    question: L(
      'Điều gì xảy ra nếu cơ thể sinh vật không lấy đủ các chất cần thiết từ môi trường và không thải được các chất ra môi trường?',
      'What happens if an organism cannot take enough of what it needs from its surroundings and cannot get rid of substances?',
    ),
    choices: [
      {
        id: 'roi-loan',
        text: L(
          'Hoạt động sống bị rối loạn, có thể chết',
          'Its life activities are disturbed; it may die',
        ),
      },
      { id: 'binh-thuong', text: L('Vẫn sống bình thường', 'It lives on as usual') },
      {
        id: 'tu-tao',
        text: L('Cơ thể tự tạo ra mọi chất cần thiết', 'The body makes everything it needs itself'),
      },
      {
        id: 'cham-lon',
        text: L(
          'Chỉ lớn chậm hơn, không ảnh hưởng gì khác',
          'It only grows more slowly, nothing else changes',
        ),
      },
    ],
    answer: 'roi-loan',
    answerWhy: L(
      'Sinh vật cần lấy chất từ môi trường để tạo chất sống và lấy năng lượng cho mọi hoạt động. Chất thải, chất độc hay chất dư thừa nếu ứ đọng lại trong cơ thể sẽ gây rối loạn hoạt động sống, thậm chí gây chết.',
      'An organism needs substances from its surroundings to build living matter and to get energy for every activity. Wastes, poisons or surplus substances that build up inside disturb life activities and can even kill.',
    ),
    activities: [
      {
        kind: 'order',
        id: 'ba-giai-doan',
        prompt: L(
          'Xếp ba giai đoạn chuyển hóa năng lượng trong sinh giới theo đúng thứ tự.',
          'Put the three stages of energy conversion in the living world in order.',
        ),
        items: [
          {
            id: 'tong-hop',
            text: L(
              'Tổng hợp: cây xanh biến năng lượng ánh sáng thành năng lượng hóa học trong chất hữu cơ',
              'Synthesis: green plants turn light energy into chemical energy in organic matter',
            ),
            why: L(
              'Năng lượng khởi đầu của sinh giới là ánh sáng; diệp lục nhận quang năng để tạo chất hữu cơ từ CO₂ và nước.',
              'The living world’s energy starts as light; chlorophyll captures it to make organic matter from CO₂ and water.',
            ),
          },
          {
            id: 'phan-giai',
            text: L(
              'Phân giải: hô hấp biến năng lượng trong chất hữu cơ thành năng lượng dễ dùng trong ATP',
              'Breakdown: respiration turns the energy in organic matter into easy-to-use energy in ATP',
            ),
            why: L(
              'Phân tử lớn bị phân giải thành phân tử nhỏ; năng lượng được tích lũy ở dạng dễ chuyển đổi như ATP.',
              'Large molecules are broken into small ones; the energy is stored in an easy-to-convert form such as ATP.',
            ),
          },
          {
            id: 'huy-dong',
            text: L(
              'Huy động: ATP cung cấp năng lượng cho các hoạt động sống, cuối cùng tỏa ra dạng nhiệt',
              'Use: ATP powers life activities, and the energy finally leaves as heat',
            ),
            why: L(
              'Liên kết giữa các gốc phosphate trong ATP bị phá vỡ, giải phóng năng lượng cho vận động, sinh sản, sinh trưởng…',
              'The bonds between ATP’s phosphate groups break, releasing energy for movement, reproduction, growth…',
            ),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'phuong-thuc',
        prompt: L(
          'Xếp mỗi ví dụ vào đúng phương thức trao đổi chất và chuyển hóa năng lượng.',
          'Put each example under its way of getting matter and energy.',
        ),
        groups: [
          { id: 'quang', label: L('Quang tự dưỡng', 'Photoautotroph') },
          { id: 'hoa', label: L('Hóa tự dưỡng', 'Chemoautotroph') },
          { id: 'di', label: L('Dị dưỡng', 'Heterotroph') },
        ],
        items: [
          {
            id: 'cay-lua',
            text: L(
              'Cây lúa dùng ánh sáng, CO₂ và nước để tạo chất hữu cơ',
              'A rice plant uses light, CO₂ and water to make organic matter',
            ),
            group: 'quang',
            why: L(
              'Thực vật là sinh vật quang tự dưỡng điển hình.',
              'Plants are the typical photoautotrophs.',
            ),
          },
          {
            id: 'cay-rung',
            text: L(
              'Cây rừng nhờ diệp lục biến quang năng thành hóa năng trong chất hữu cơ',
              'Forest trees use chlorophyll to turn light energy into chemical energy in organic matter',
            ),
            group: 'quang',
            why: L(
              'Diệp lục của cây xanh nhận năng lượng ánh sáng mặt trời để tổng hợp chất hữu cơ từ CO₂ và nước.',
              'The chlorophyll of green plants captures sunlight to build organic matter from CO₂ and water.',
            ),
          },
          {
            id: 'vk-h2s',
            text: L(
              'Vi khuẩn lấy năng lượng từ phản ứng biến đổi H₂S để tổng hợp chất hữu cơ',
              'Bacteria take energy from changing H₂S to build organic matter',
            ),
            group: 'hoa',
            why: L(
              'Hóa tự dưỡng dùng nguồn carbon là CO₂ và năng lượng từ chất vô cơ.',
              'Chemoautotrophs use CO₂ as their carbon source and energy from inorganic substances.',
            ),
          },
          {
            id: 'vk-nh4',
            text: L(
              'Vi khuẩn lấy năng lượng từ phản ứng biến đổi NH₄⁺',
              'Bacteria take energy from changing NH₄⁺',
            ),
            group: 'hoa',
            why: L(
              'Năng lượng đến từ chất vô cơ, không từ ánh sáng.',
              'The energy comes from an inorganic substance, not from light.',
            ),
          },
          {
            id: 'con-bo',
            text: L(
              'Con bò ăn cỏ, tiêu hóa và hấp thụ chất hữu cơ',
              'A cow eats grass, digests it and absorbs the organic matter',
            ),
            group: 'di',
            why: L(
              'Động vật là sinh vật dị dưỡng điển hình: lấy chất hữu cơ có sẵn từ sinh vật khác.',
              'Animals are the typical heterotrophs: they take ready-made organic matter from other organisms.',
            ),
          },
          {
            id: 'con-nguoi',
            text: L(
              'Con người lấy năng lượng hóa học có sẵn trong thức ăn',
              'People take the chemical energy already stored in food',
            ),
            group: 'di',
            why: L(
              'Động vật không nhận năng lượng trực tiếp từ ánh sáng; chúng lấy hóa năng có trong thức ăn.',
              'Animals cannot use sunlight directly; they take the chemical energy in their food.',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'dau-hieu',
        prompt: L(
          'Ghép mỗi dấu hiệu đặc trưng của trao đổi chất với ví dụ của nó.',
          'Match each sign of metabolism with its example.',
        ),
        pairs: [
          {
            id: 'tiep-nhan',
            left: L('Tiếp nhận và vận chuyển chất', 'Taking in and moving substances'),
            right: L(
              'Rễ hút nước và khoáng, lá lấy CO₂; động vật ăn thức ăn và lấy O₂',
              'Roots take up water and minerals, leaves take CO₂; animals eat and take in O₂',
            ),
            why: L(
              'Chất lấy vào được vận chuyển đến từng tế bào: ở cây nhờ hệ dẫn, ở động vật nhờ hệ tuần hoàn.',
              'What is taken in reaches every cell: through the vascular system in plants, the circulatory system in animals.',
            ),
          },
          {
            id: 'bien-doi',
            left: L(
              'Biến đổi chất kèm chuyển hóa năng lượng',
              'Changing substances while converting energy',
            ),
            right: L(
              'Đồng hóa tổng hợp chất và tích lũy năng lượng; dị hóa phân giải chất và giải phóng năng lượng',
              'Anabolism builds substances and stores energy; catabolism breaks them down and releases energy',
            ),
            why: L(
              'Hai quá trình diễn ra trong tế bào và luôn đi kèm biến đổi năng lượng.',
              'Both happen in cells and always go with a change in energy.',
            ),
          },
          {
            id: 'thai',
            left: L('Thải chất ra môi trường', 'Giving substances off to the surroundings'),
            right: L(
              'Chất không dùng đến, chất dư thừa, chất độc hại được đưa ra ngoài cơ thể',
              'Unused, surplus or harmful substances leave the body',
            ),
            why: L(
              'Nếu ứ đọng lại, các chất này gây rối loạn hoạt động sống.',
              'If they built up, they would disturb life activities.',
            ),
          },
          {
            id: 'dieu-hoa',
            left: L('Điều hòa', 'Regulation'),
            right: L(
              'Hormone ở thực vật, hormone và hệ thần kinh ở động vật điều chỉnh theo nhu cầu cơ thể',
              'Hormones in plants, hormones and the nervous system in animals adjust it to the body’s needs',
            ),
            why: L(
              'Trao đổi chất luôn được điều chỉnh cho phù hợp với nhu cầu của cơ thể.',
              'Metabolism is always adjusted to what the body needs.',
            ),
          },
        ],
      },
    ],
  },
};
