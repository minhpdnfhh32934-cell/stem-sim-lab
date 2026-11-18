import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH11 KNTT Bài 17 "Cảm ứng ở động vật" (printed pages 100–114), in SimLab's own words. Checked
 * against the pages on 17/11/2026: nerve-net, ganglion-chain and tubular nervous systems (Hình
 * 17.1–17.3; the hydra question on tr. 101 is the prediction), the five parts of a reflex arc (Hình
 * 17.11), the receptor types of Bảng 17.1 and the two kinds of reflex of Bảng 17.3. SH11-GL-12.
 */
export const sh11b17AnimalResponse: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh11-animalresp',
  topic: 'animalResponse',
  title: L(
    'Cảm ứng ở động vật: hệ thần kinh và phản xạ',
    'Animal responses: nervous systems and reflexes',
  ),
  objectives: [
    L(
      'Dự đoán thủy tức phản ứng thế nào khi bị chạm nhẹ vào một điểm.',
      'Predict how a hydra reacts when touched lightly at one point.',
    ),
    L(
      'Xếp đúng thứ tự các bộ phận của cung phản xạ; ghép mỗi loại thụ thể cảm giác với ví dụ.',
      'Put the parts of a reflex arc in order; match each kind of receptor with an example.',
    ),
    L(
      'Phân biệt phản xạ không điều kiện và phản xạ có điều kiện.',
      'Tell unconditioned and conditioned reflexes apart.',
    ),
  ],
  hints: [
    L(
      'Ở hệ thần kinh lưới, các tế bào thần kinh nối với nhau rải rác khắp cơ thể.',
      'In a nerve net, nerve cells are joined together all over the body.',
    ),
    L(
      'Phản xạ không điều kiện sinh ra đã có; phản xạ có điều kiện được hình thành trong đời sống.',
      'Unconditioned reflexes are inborn; conditioned reflexes are formed during life.',
    ),
  ],
  questions: [
    L(
      'Vì sao bất kì một bộ phận nào của cung phản xạ bị tổn thương thì phản xạ không thực hiện được?',
      'Why does a reflex fail if any part of its arc is damaged?',
    ),
  ],
  expectedConclusion: L(
    'Động vật có hệ thần kinh lưới (Ruột khoang) phản ứng toàn thân; hệ thần kinh chuỗi hạch (Giun, Chân khớp) phản ứng theo từng vùng; hệ thần kinh ống (động vật có xương sống) phản ứng nhanh, chính xác theo nguyên tắc phản xạ. Cung phản xạ gồm thụ thể, đường hướng tâm, trung ương, đường li tâm và cơ quan đáp ứng. Thụ thể cảm giác chuyển kích thích thành xung thần kinh. Phản xạ không điều kiện bẩm sinh, bền vững; phản xạ có điều kiện học được, dễ mất nếu không được củng cố.',
    'Animals with a nerve net (cnidarians) respond with the whole body; with a ganglion chain (worms, arthropods) region by region; with a tubular nervous system (vertebrates) quickly and precisely, through reflexes. A reflex arc has a receptor, a sensory pathway, a centre, a motor pathway and an effector. Receptors turn stimuli into nerve impulses. Unconditioned reflexes are inborn and lasting; conditioned reflexes are learned and fade if not reinforced.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu cấu tạo và cơ chế như sách giáo khoa; SimLab không tính điện thế hay tốc độ lan truyền xung thần kinh.',
      'The lesson gives only structures and mechanisms, as the textbook does; SimLab computes no membrane potential or impulse speed.',
    ),
  ],
  limits: [
    L(
      'Điện thế nghỉ, điện thế hoạt động, synapse và các giác quan chỉ được nhắc ngắn.',
      'Resting and action potentials, synapses and the senses are only mentioned briefly.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH11', lesson: 17 },
    question: L(
      'Thủy tức có hệ thần kinh dạng lưới. Khi chạm nhẹ vào một điểm trên cơ thể thủy tức, nó phản ứng thế nào?',
      'A hydra has a nerve net. When one point of its body is touched lightly, how does it react?',
    ),
    choices: [
      { id: 'toan-than', text: L('Toàn bộ cơ thể co lại', 'The whole body contracts') },
      { id: 'mot-cho', text: L('Chỉ chỗ bị chạm co lại', 'Only the touched spot contracts') },
      { id: 'khong', text: L('Không phản ứng', 'It does not react') },
      {
        id: 'boi-di',
        text: L('Bơi nhanh về phía kích thích', 'It swims quickly towards the stimulus'),
      },
    ],
    answer: 'toan-than',
    answerWhy: L(
      'Ở hệ thần kinh lưới, các tế bào thần kinh nối với nhau khắp cơ thể. Thông tin từ tế bào cảm giác lan đến mọi tế bào biểu mô cơ, nên toàn bộ cơ thể phản ứng. Ở côn trùng (hệ thần kinh chuỗi hạch), kích thích nhẹ một chân thì chỉ chân đó co lại.',
      'In a nerve net the nerve cells are joined all over the body. The signal from the sensory cells spreads to every muscle cell, so the whole body reacts. In an insect (a ganglion chain), touching one leg lightly makes only that leg pull in.',
    ),
    activities: [
      {
        kind: 'order',
        id: 'cung-phan-xa',
        prompt: L(
          'Xếp các bộ phận của cung phản xạ theo đúng thứ tự.',
          'Put the parts of a reflex arc in order.',
        ),
        items: [
          {
            id: 'thu-the',
            text: L('Thụ thể cảm giác tiếp nhận kích thích', 'A receptor senses the stimulus'),
            why: L('Ví dụ: thụ thể đau ở da.', 'For example pain receptors in the skin.'),
          },
          {
            id: 'huong-tam',
            text: L('Đường hướng tâm: dây thần kinh cảm giác', 'Sensory pathway: a sensory nerve'),
            why: L('Do các neuron cảm giác tạo thành.', 'Made of sensory neurons.'),
          },
          {
            id: 'trung-uong',
            text: L('Bộ phận trung ương: tủy sống, não bộ', 'Centre: spinal cord, brain'),
            why: L(
              'Các neuron trung gian xử lí thông tin.',
              'Interneurons process the information.',
            ),
          },
          {
            id: 'li-tam',
            text: L('Đường li tâm: dây thần kinh vận động', 'Motor pathway: a motor nerve'),
            why: L('Do các neuron vận động tạo thành.', 'Made of motor neurons.'),
          },
          {
            id: 'dap-ung',
            text: L('Bộ phận đáp ứng: cơ hay tuyến', 'Effector: a muscle or gland'),
            why: L(
              'Ví dụ: cơ tay co, tay rút lại.',
              'For example the arm muscle contracts and the hand pulls back.',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'thu-the',
        prompt: L(
          'Ghép mỗi loại thụ thể cảm giác với ví dụ của nó.',
          'Match each kind of receptor with its example.',
        ),
        pairs: [
          {
            id: 'co-hoc',
            left: L('Thụ thể cơ học', 'Mechanoreceptor'),
            right: L(
              'Thông tin độ dãn của dạ dày gửi về hành não',
              'Information on how stretched the stomach is, sent to the medulla',
            ),
            why: L('Phát hiện biến dạng vật lí.', 'Detects physical deformation.'),
          },
          {
            id: 'hoa-hoc',
            left: L('Thụ thể hóa học', 'Chemoreceptor'),
            right: L(
              'Tế bào tuyến tụy phát hiện nồng độ glucose máu',
              'Pancreas cells detecting blood glucose',
            ),
            why: L(
              'Phát hiện phân tử hóa học và nồng độ của chúng.',
              'Detects chemicals and their concentrations.',
            ),
          },
          {
            id: 'dien-tu',
            left: L('Thụ thể điện từ', 'Electromagnetic receptor'),
            right: L(
              'Tế bào que và tế bào nón trong mắt phát hiện ánh sáng',
              'Rods and cones in the eye detecting light',
            ),
            why: L(
              'Phát hiện ánh sáng, dòng điện, từ trường.',
              'Detects light, electric currents, magnetic fields.',
            ),
          },
          {
            id: 'nhiet',
            left: L('Thụ thể nhiệt', 'Thermoreceptor'),
            right: L(
              'Thụ thể nóng, lạnh ở da báo về trung khu điều hòa thân nhiệt',
              'Hot and cold receptors in the skin reporting to the temperature centre',
            ),
            why: L('Phát hiện sự thay đổi nhiệt độ.', 'Detects changes in temperature.'),
          },
          {
            id: 'dau',
            left: L('Thụ thể đau', 'Pain receptor'),
            right: L(
              'Báo tổn thương mô để cơ thể phản ứng bảo vệ',
              'Reports tissue damage so the body protects itself',
            ),
            why: L(
              'Có ở hầu hết các bộ phận, nhiều nhất ở da.',
              'Found almost everywhere, most of all in the skin.',
            ),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'phan-xa',
        prompt: L(
          'Xếp mỗi đặc điểm vào phản xạ không điều kiện hoặc có điều kiện.',
          'Put each feature under unconditioned or conditioned reflex.',
        ),
        groups: [
          { id: 'khong-dk', label: L('Phản xạ không điều kiện', 'Unconditioned reflex') },
          { id: 'co-dk', label: L('Phản xạ có điều kiện', 'Conditioned reflex') },
        ],
        items: [
          {
            id: 'di-truyen',
            text: L('Di truyền, sinh ra đã có', 'Inherited, present from birth'),
            group: 'khong-dk',
            why: L('Đặc trưng cho loài.', 'Typical of the species.'),
          },
          {
            id: 'ben-vung',
            text: L('Rất bền vững', 'Very lasting'),
            group: 'khong-dk',
            why: L('Không mất đi trong đời sống.', 'It does not fade during life.'),
          },
          {
            id: 'tuy-song',
            text: L(
              'Trung ương là tủy sống, thân não',
              'Its centre is the spinal cord and brainstem',
            ),
            group: 'khong-dk',
            why: L('Không cần vỏ não tham gia.', 'The cerebral cortex is not needed.'),
          },
          {
            id: 'hoc',
            text: L('Hình thành trong đời sống cá thể', 'Formed during the individual’s life'),
            group: 'co-dk',
            why: L('Không di truyền.', 'Not inherited.'),
          },
          {
            id: 'de-mat',
            text: L('Dễ mất nếu không được củng cố', 'Fades if not reinforced'),
            group: 'co-dk',
            why: L('Cần lặp lại để duy trì.', 'It must be repeated to last.'),
          },
          {
            id: 'vo-nao',
            text: L('Có sự tham gia của vỏ não', 'The cerebral cortex takes part'),
            group: 'co-dk',
            why: L(
              'Ví dụ: chó tiết nước bọt khi nghe tiếng chuông trong thí nghiệm của Pavlov.',
              'For example the dog salivating at the bell in Pavlov’s experiment.',
            ),
          },
        ],
      },
    ],
  },
};
