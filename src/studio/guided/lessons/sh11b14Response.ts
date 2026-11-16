import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH11 KNTT Bài 14 "Khái quát về cảm ứng ở sinh vật" (printed pages 88–89), in SimLab's own words.
 * Checked against the pages on 17/11/2026: response as sensing and answering changes inside and
 * outside, its role, and the four parts of the mechanism (tiếp nhận, dẫn truyền, xử lí, đáp ứng),
 * with the book's examples (cây trinh nữ, rút tay khi chạm gai, ngọn cây hướng sáng, đồng tử co).
 * The prediction is the book's opening question (tr. 88). SH11-GL-10.
 */
export const sh11b14Response: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh11-response',
  topic: 'responseOverview',
  title: L('Khái quát về cảm ứng ở sinh vật', 'Response in organisms: an overview'),
  objectives: [
    L(
      'Dự đoán hậu quả khi sinh vật không phản ứng kịp với kích thích.',
      'Predict what happens when an organism does not respond to a stimulus in time.',
    ),
    L(
      'Xếp đúng thứ tự các bộ phận của cơ chế cảm ứng; ghép mỗi bộ phận với ví dụ rút tay khi chạm gai.',
      'Put the parts of the response mechanism in order; match each part with the hand-on-a-thorn example.',
    ),
    L(
      'Phân biệt cảm ứng ở thực vật và ở động vật.',
      'Tell response in plants and in animals apart.',
    ),
  ],
  hints: [
    L(
      'Mọi cảm ứng đều đi qua: tiếp nhận kích thích, dẫn truyền thông tin, xử lí thông tin, đáp ứng.',
      'Every response passes through: sensing the stimulus, passing the information on, processing it, responding.',
    ),
    L(
      'Ở động vật có hệ thần kinh, cảm ứng diễn ra nhanh qua cung phản xạ; ở thực vật thường chậm và khó nhận thấy.',
      'In animals with a nervous system, responses are fast, through reflex arcs; in plants they are usually slow and hard to see.',
    ),
  ],
  questions: [
    L(
      'Người quay đầu lại khi nghe ai đó gọi tên mình từ phía sau có phải là cảm ứng không? Vì sao?',
      'When you turn round on hearing your name called from behind, is that a response? Why?',
    ),
  ],
  expectedConclusion: L(
    'Cảm ứng là sự tiếp nhận và phản ứng của sinh vật với những thay đổi của môi trường trong và ngoài cơ thể, giúp sinh vật thích ứng và tồn tại. Cơ chế cảm ứng gồm tiếp nhận kích thích, dẫn truyền thông tin, xử lí thông tin và đáp ứng. Ở thực vật, thông tin truyền qua tế bào chất dưới dạng dòng điện hoặc chất hóa học, đáp ứng thường chậm; ở động vật có hệ thần kinh, cảm ứng thực hiện qua cung phản xạ, nhanh và chính xác.',
    'Response is how organisms sense and react to changes inside and outside the body, which helps them adapt and survive. The mechanism is: sensing the stimulus, passing the information on, processing it and responding. In plants the information travels through the cytoplasm as electrical currents or chemicals and the response is usually slow; in animals with a nervous system it runs through reflex arcs, quickly and precisely.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu khái niệm và cơ chế chung như sách giáo khoa.',
      'The lesson gives only the general idea and mechanism, as the textbook does.',
    ),
  ],
  limits: [
    L(
      'Chi tiết cảm ứng ở thực vật, ở động vật và tập tính ở các bài sau của chương.',
      'Details of responses in plants and animals, and of behaviour, are in the chapter’s later lessons.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH11', lesson: 14 },
    question: L(
      'Nếu sinh vật không phản ứng kịp thời với kích thích đến từ môi trường thì điều gì sẽ xảy ra?',
      'If an organism does not respond in time to a stimulus from its surroundings, what happens?',
    ),
    choices: [
      {
        id: 'nguy-hiem',
        text: L(
          'Sinh vật dễ bị tổn thương, khó tồn tại',
          'It is easily harmed and struggles to survive',
        ),
      },
      { id: 'tot-hon', text: L('Sinh vật khỏe hơn', 'It becomes healthier') },
      { id: 'khong-sao', text: L('Không ảnh hưởng gì', 'Nothing is affected') },
      { id: 'lon-nhanh', text: L('Sinh vật lớn nhanh hơn', 'It grows faster') },
    ],
    answer: 'nguy-hiem',
    answerWhy: L(
      'Cảm ứng giúp sinh vật thích ứng với thay đổi của môi trường. Không phản ứng kịp, sinh vật có thể bị tổn thương (ví dụ không rút tay khỏi gai nhọn, không co đồng tử khi ánh sáng mạnh) và khó tồn tại.',
      'Responding lets an organism adapt to changes around it. Without a timely response it can be harmed (for example not pulling a hand off a thorn, not narrowing the pupil in strong light) and may not survive.',
    ),
    activities: [
      {
        kind: 'order',
        id: 'co-che',
        prompt: L(
          'Xếp các bộ phận của cơ chế cảm ứng theo đúng thứ tự.',
          'Put the parts of the response mechanism in order.',
        ),
        items: [
          {
            id: 'tiep-nhan',
            text: L('Tiếp nhận kích thích', 'Sensing the stimulus'),
            why: L(
              'Thụ thể tiếp nhận kích thích từ môi trường.',
              'Receptors pick up the stimulus.',
            ),
          },
          {
            id: 'dan-truyen',
            text: L('Dẫn truyền thông tin kích thích', 'Passing the information on'),
            why: L(
              'Thông tin được truyền đến bộ phận xử lí.',
              'The information is carried to the processing part.',
            ),
          },
          {
            id: 'xu-li',
            text: L('Xử lí thông tin', 'Processing the information'),
            why: L(
              'Ở động vật là trung ương thần kinh; ở thực vật là bộ phận xử lí trong cây.',
              'In animals the central nervous system; in plants a processing part of the plant.',
            ),
          },
          {
            id: 'dap-ung',
            text: L('Đáp ứng', 'Responding'),
            why: L(
              'Cơ quan đáp ứng tạo ra phản ứng phù hợp.',
              'The effector organ produces a fitting reaction.',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'rut-tay',
        prompt: L(
          'Khi bị gai đâm vào tay, ghép mỗi bộ phận với vai trò của nó.',
          'When a thorn pricks your hand, match each part with its role.',
        ),
        pairs: [
          {
            id: 'thu-the',
            left: L('Thụ thể đau ở tay', 'Pain receptors in the hand'),
            right: L('Tiếp nhận kích thích', 'Sense the stimulus'),
            why: L('Thụ thể đau phát hiện tổn thương.', 'Pain receptors detect the damage.'),
          },
          {
            id: 'day',
            left: L('Dây thần kinh', 'Nerves'),
            right: L('Dẫn truyền thông tin', 'Carry the information'),
            why: L(
              'Xung thần kinh đi về và đi ra từ trung ương thần kinh.',
              'Nerve impulses travel to and from the central nervous system.',
            ),
          },
          {
            id: 'tuy-nao',
            left: L('Tủy sống và não bộ', 'Spinal cord and brain'),
            right: L('Xử lí thông tin', 'Process the information'),
            why: L(
              'Trung ương thần kinh quyết định đáp ứng.',
              'The central nervous system decides the response.',
            ),
          },
          {
            id: 'co',
            left: L('Cơ ở cánh tay', 'Arm muscles'),
            right: L('Co lại, làm tay rút lại', 'Contract and pull the hand back'),
            why: L('Cơ là cơ quan đáp ứng.', 'Muscles are the effectors.'),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'tv-dv',
        prompt: L(
          'Xếp mỗi ví dụ vào cảm ứng ở thực vật hoặc ở động vật.',
          'Put each example under response in plants or in animals.',
        ),
        groups: [
          { id: 'thuc-vat', label: L('Thực vật', 'Plants') },
          { id: 'dong-vat', label: L('Động vật', 'Animals') },
        ],
        items: [
          {
            id: 'trinh-nu',
            text: L('Lá cây trinh nữ cụp lại khi bị chạm', 'Mimosa leaves fold when touched'),
            group: 'thuc-vat',
            why: L('Một cảm ứng nhanh hiếm thấy ở thực vật.', 'A rare fast response in a plant.'),
          },
          {
            id: 'ngon',
            text: L('Ngọn cây mọc hướng về phía có ánh sáng', 'A shoot grows towards the light'),
            group: 'thuc-vat',
            why: L(
              'Cảm ứng ở thực vật thường chậm, gắn với sinh trưởng.',
              'Plant responses are usually slow and tied to growth.',
            ),
          },
          {
            id: 'choi-mua',
            text: L('Cây mọc chồi theo mùa', 'A tree sprouts with the seasons'),
            group: 'thuc-vat',
            why: L(
              'Biểu hiện bằng sinh trưởng, khó nhận thấy ngay.',
              'It shows as growth and is hard to see at once.',
            ),
          },
          {
            id: 'dong-tu',
            text: L(
              'Đồng tử co lại khi ánh sáng mạnh chiếu vào mắt',
              'The pupil narrows in strong light',
            ),
            group: 'dong-vat',
            why: L(
              'Phản ứng nhanh nhờ hệ thần kinh, bảo vệ mắt.',
              'A fast nervous response that protects the eye.',
            ),
          },
          {
            id: 'rut-tay-gai',
            text: L('Rút tay lại khi chạm vào gai nhọn', 'Pulling a hand back from a sharp thorn'),
            group: 'dong-vat',
            why: L('Cảm ứng qua cung phản xạ.', 'A response through a reflex arc.'),
          },
        ],
      },
    ],
  },
};
