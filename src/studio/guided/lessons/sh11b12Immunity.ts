import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH11 KNTT Bài 12 "Miễn dịch ở người và động vật" (printed pages 72–79), in SimLab's own words.
 * Checked against the pages on 17/11/2026: non-specific immunity (physical and chemical barriers of
 * Hình 12.1; phagocytosis, inflammation, fever, interferon and complement), specific immunity with
 * antigen presentation, helper T cells, B cells, plasma cells, antibodies and cytotoxic T cells
 * (Hình 12.4), primary and secondary responses and vaccines, allergy, AIDS, cancer and autoimmune
 * disease (tr. 77–78). The prediction is the book's opening question (tr. 72). SH11-GL-8.
 */
export const sh11b12Immunity: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh11-immunity',
  topic: 'immunity',
  title: L('Miễn dịch ở người và động vật', 'Immunity in humans and animals'),
  objectives: [
    L(
      'Dự đoán vì sao con người ít mắc bệnh dù xung quanh có rất nhiều mầm bệnh.',
      'Predict why people rarely fall ill although germs are everywhere.',
    ),
    L(
      'Phân loại các cơ chế bảo vệ thành miễn dịch không đặc hiệu và đặc hiệu; xếp đúng các bước của đáp ứng miễn dịch đặc hiệu.',
      'Sort the defences into non-specific and specific immunity; put the steps of the specific response in order.',
    ),
    L(
      'Ghép mỗi bệnh liên quan đến miễn dịch, và vaccine, với cơ chế của nó.',
      'Match each immune-related disease, and vaccination, with how it works.',
    ),
  ],
  hints: [
    L(
      'Miễn dịch không đặc hiệu phản ứng giống nhau với mọi mầm bệnh; miễn dịch đặc hiệu nhận biết từng kháng nguyên riêng.',
      'Non-specific immunity reacts the same way to every germ; specific immunity recognises each antigen.',
    ),
    L(
      'Tế bào nhớ giúp lần tiếp xúc thứ hai với cùng kháng nguyên được đáp ứng nhanh và mạnh hơn.',
      'Memory cells make the second encounter with the same antigen faster and stronger.',
    ),
  ],
  questions: [
    L(
      'Vì sao tiêm vaccine giúp phòng được một số bệnh do virus, vi khuẩn gây ra?',
      'Why can vaccination prevent some diseases caused by viruses and bacteria?',
    ),
  ],
  expectedConclusion: L(
    'Miễn dịch là khả năng cơ thể chống lại các tác nhân gây bệnh. Miễn dịch không đặc hiệu gồm hàng rào vật lí, hóa học (da, niêm mạc, lysozyme, acid dạ dày…) và các đáp ứng thực bào, viêm, sốt, peptide và protein chống mầm bệnh. Miễn dịch đặc hiệu gồm miễn dịch dịch thể (tương bào tạo kháng thể) và miễn dịch tế bào (tế bào T độc tiêu diệt tế bào nhiễm), khởi đầu khi tế bào trình diện kháng nguyên hoạt hóa tế bào T hỗ trợ. Tế bào nhớ cho đáp ứng thứ phát nhanh, mạnh; vaccine chủ động tạo đáp ứng này. Dị ứng là phản ứng quá mức; AIDS, ung thư, bệnh tự miễn là khi hệ miễn dịch bị phá vỡ.',
    'Immunity is the body’s ability to resist disease agents. Non-specific immunity is the physical and chemical barriers (skin, mucous membranes, lysozyme, stomach acid…) and the responses of phagocytosis, inflammation, fever and antimicrobial peptides and proteins. Specific immunity is humoral (plasma cells make antibodies) and cell-mediated (cytotoxic T cells kill infected cells), starting when antigen-presenting cells activate helper T cells. Memory cells make the secondary response fast and strong; vaccines set this up on purpose. Allergy is an over-reaction; AIDS, cancer and autoimmune diseases arise when the immune system breaks down.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu các cơ chế như sách giáo khoa; SimLab không tính số lượng tế bào hay kháng thể.',
      'The lesson gives only the mechanisms, as the textbook does; SimLab computes no numbers of cells or antibodies.',
    ),
  ],
  limits: [
    L(
      'Các bài tập ghép tác nhân gây bệnh của sách và thời gian đáp ứng nguyên phát, thứ phát không có trong bài học này.',
      'The book’s matching exercises on disease agents and the timing of primary and secondary responses are not part of this lesson.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH11', lesson: 12 },
    question: L(
      'Xung quanh con người có rất nhiều virus, vi khuẩn, nấm… nhưng xác suất mắc bệnh lại nhỏ. Vì sao?',
      'People are surrounded by viruses, bacteria, fungi… yet the chance of falling ill is small. Why?',
    ),
    choices: [
      {
        id: 'mien-dich',
        text: L(
          'Hệ miễn dịch ngăn chặn và tiêu diệt phần lớn mầm bệnh',
          'The immune system blocks and destroys most germs',
        ),
      },
      {
        id: 'khong-vao',
        text: L('Mầm bệnh không bao giờ vào được cơ thể', 'Germs can never get into the body'),
      },
      { id: 'vo-hai', text: L('Hầu hết mầm bệnh đều vô hại', 'Almost all germs are harmless') },
      {
        id: 'nuoc',
        text: L('Nhờ uống đủ nước mỗi ngày', 'Because people drink enough water each day'),
      },
    ],
    answer: 'mien-dich',
    answerWhy: L(
      'Mầm bệnh vẫn thường xuyên tiếp xúc và xâm nhập, nhưng trước hết bị hàng rào vật lí, hóa học chặn lại, rồi bị các đáp ứng không đặc hiệu và đặc hiệu tiêu diệt. Chỉ khi các tuyến bảo vệ này bị vượt qua hoặc suy yếu, cơ thể mới mắc bệnh.',
      'Germs reach and enter the body all the time, but they are first stopped by physical and chemical barriers, then destroyed by non-specific and specific responses. Only when these defences are overcome or weakened does the body fall ill.',
    ),
    activities: [
      {
        kind: 'sort',
        id: 'hai-loai',
        prompt: L(
          'Xếp mỗi cơ chế bảo vệ vào miễn dịch không đặc hiệu hoặc miễn dịch đặc hiệu.',
          'Put each defence under non-specific or specific immunity.',
        ),
        groups: [
          { id: 'khong', label: L('Miễn dịch không đặc hiệu', 'Non-specific immunity') },
          { id: 'dac-hieu', label: L('Miễn dịch đặc hiệu', 'Specific immunity') },
        ],
        items: [
          {
            id: 'da',
            text: L(
              'Lớp sừng và lớp tế bào biểu bì ở da ngăn mầm bệnh',
              'The skin’s keratin and epidermis keep germs out',
            ),
            group: 'khong',
            why: L(
              'Đây là hàng rào vật lí, có sẵn từ khi sinh ra.',
              'A physical barrier, present from birth.',
            ),
          },
          {
            id: 'lysozyme',
            text: L('Lysozyme trong nước bọt diệt vi khuẩn', 'Lysozyme in saliva kills bacteria'),
            group: 'khong',
            why: L(
              'Đây là hàng rào hóa học, tác động lên nhiều loại mầm bệnh.',
              'A chemical barrier that acts on many kinds of germ.',
            ),
          },
          {
            id: 'thuc-bao',
            text: L(
              'Đại thực bào và bạch cầu trung tính thực bào mầm bệnh',
              'Macrophages and neutrophils engulf germs',
            ),
            group: 'khong',
            why: L(
              'Thực bào không phân biệt từng loại kháng nguyên.',
              'Phagocytes do not tell one antigen from another.',
            ),
          },
          {
            id: 'viem-sot',
            text: L('Phản ứng viêm và sốt', 'Inflammation and fever'),
            group: 'khong',
            why: L(
              'Đây là các đáp ứng không đặc hiệu với mọi mầm bệnh.',
              'These are non-specific responses to any germ.',
            ),
          },
          {
            id: 'khang-the',
            text: L(
              'Tương bào sản sinh kháng thể gắn đúng một loại kháng nguyên',
              'Plasma cells make antibodies that bind one kind of antigen',
            ),
            group: 'dac-hieu',
            why: L(
              'Kháng thể gắn với kháng nguyên như chìa khóa với ổ khóa.',
              'An antibody fits its antigen like a key in a lock.',
            ),
          },
          {
            id: 't-doc',
            text: L(
              'Tế bào T độc tiêu diệt tế bào nhiễm mầm bệnh',
              'Cytotoxic T cells destroy infected cells',
            ),
            group: 'dac-hieu',
            why: L(
              'Đây là miễn dịch tế bào, nhận biết kháng nguyên riêng.',
              'This is cell-mediated immunity, aimed at one antigen.',
            ),
          },
          {
            id: 'te-bao-nho',
            text: L(
              'Tế bào nhớ giúp đáp ứng lần sau nhanh và mạnh hơn',
              'Memory cells make the next response faster and stronger',
            ),
            group: 'dac-hieu',
            why: L(
              'Đáp ứng thứ phát là đặc điểm của miễn dịch đặc hiệu.',
              'The secondary response is a feature of specific immunity.',
            ),
          },
        ],
      },
      {
        kind: 'order',
        id: 'dap-ung',
        prompt: L(
          'Xếp các bước của đáp ứng miễn dịch đặc hiệu theo đúng thứ tự.',
          'Put the steps of the specific immune response in order.',
        ),
        items: [
          {
            id: 'bat-giu',
            text: L(
              'Tế bào trình diện kháng nguyên bắt giữ và thực bào mầm bệnh',
              'Antigen-presenting cells capture and engulf the germ',
            ),
            why: L(
              'Đại thực bào, tế bào B và tế bào chia nhánh là tế bào trình diện kháng nguyên.',
              'Macrophages, B cells and dendritic cells present antigens.',
            ),
          },
          {
            id: 'trinh-dien',
            text: L(
              'Kháng nguyên được trình diện cho tế bào T hỗ trợ',
              'The antigen is shown to helper T cells',
            ),
            why: L(
              'Tế bào T hỗ trợ nhận diện kháng nguyên và được hoạt hóa.',
              'Helper T cells recognise the antigen and become active.',
            ),
          },
          {
            id: 'cytokine',
            text: L(
              'Tế bào T hỗ trợ phân chia và tiết cytokine',
              'Helper T cells divide and release cytokines',
            ),
            why: L(
              'Cytokine khởi đầu miễn dịch dịch thể và miễn dịch tế bào.',
              'Cytokines start both humoral and cell-mediated immunity.',
            ),
          },
          {
            id: 'tieu-diet',
            text: L(
              'Tương bào tạo kháng thể, tế bào T độc tiêu diệt tế bào nhiễm',
              'Plasma cells make antibodies and cytotoxic T cells kill infected cells',
            ),
            why: L(
              'Đồng thời tạo ra tế bào nhớ cho những lần tiếp xúc sau.',
              'Memory cells are made at the same time for later encounters.',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'benh',
        prompt: L(
          'Ghép mỗi bệnh, hoặc vaccine, với cơ chế của nó.',
          'Match each disease, or vaccination, with how it works.',
        ),
        pairs: [
          {
            id: 'aids',
            left: L(
              'Hội chứng suy giảm miễn dịch mắc phải (AIDS)',
              'Acquired immunodeficiency syndrome (AIDS)',
            ),
            right: L(
              'Virus HIV tiêu diệt tế bào T hỗ trợ',
              'The HIV virus destroys helper T cells',
            ),
            why: L(
              'Không còn tế bào T hỗ trợ, cả miễn dịch dịch thể và tế bào đều suy yếu; bệnh cơ hội phát triển.',
              'Without helper T cells both humoral and cell-mediated immunity fail; opportunistic infections take hold.',
            ),
          },
          {
            id: 'di-ung',
            left: L('Dị ứng', 'Allergy'),
            right: L(
              'Phản ứng quá mức với dị nguyên, giải phóng histamin',
              'Over-reaction to an allergen, releasing histamine',
            ),
            why: L(
              'Dị nguyên có thể là phấn hoa, bào tử nấm, lông động vật, hải sản, một số thuốc…',
              'Allergens include pollen, fungal spores, animal hair, seafood, some medicines…',
            ),
          },
          {
            id: 'tu-mien',
            left: L('Bệnh tự miễn', 'Autoimmune disease'),
            right: L(
              'Hệ miễn dịch tấn công tế bào của chính cơ thể',
              'The immune system attacks the body’s own cells',
            ),
            why: L(
              'Ví dụ: tế bào T tiêu diệt tế bào sản xuất insulin, gây tiểu đường type I.',
              'For example, T cells destroy the cells that make insulin, causing type I diabetes.',
            ),
          },
          {
            id: 'ung-thu',
            left: L('Ung thư', 'Cancer'),
            right: L(
              'Tế bào bất thường phân chia không kiểm soát, tạo khối u ác tính',
              'Abnormal cells divide out of control, forming a malignant tumour',
            ),
            why: L(
              'Tế bào ung thư di căn vào tủy xương làm giảm sản sinh bạch cầu.',
              'Cancer cells spreading to the bone marrow cut the production of white cells.',
            ),
          },
          {
            id: 'vaccine',
            left: L('Tiêm vaccine', 'Vaccination'),
            right: L(
              'Chủ động tạo đáp ứng miễn dịch nguyên phát để có tế bào nhớ',
              'Sets up a primary response on purpose, leaving memory cells',
            ),
            why: L(
              'Kháng nguyên trong vaccine đã được xử lí, không còn khả năng gây bệnh.',
              'The antigens in a vaccine are treated so they can no longer cause disease.',
            ),
          },
        ],
      },
    ],
  },
};
