import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH11 KNTT Bài 27 "Sinh sản ở động vật" (printed pages 170–182), in SimLab's own words. Checked
 * against the pages on 17/11/2026: egg laying, ovoviviparity and live birth with the book's groups
 * (tr. 172), the four stages of human sexual reproduction (Hình 27.3), fertilisation and the
 * reaction that lets only one sperm in (Hình 27.6, the prediction), the yellow body and the
 * hormones of birth (oxytocin, prostagladin; Hình 27.8). SH11-GL-19.
 */
export const sh11b27AnimalReproduction: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh11-animalrepro',
  topic: 'animalReproduction',
  title: L('Sinh sản ở động vật', 'Reproduction in animals'),
  objectives: [
    L(
      'Dự đoán vì sao chỉ một tinh trùng thụ tinh với một tế bào trứng.',
      'Predict why only one sperm fertilises an egg.',
    ),
    L(
      'Xếp đúng các giai đoạn sinh sản hữu tính ở người; phân loại động vật theo cách đẻ.',
      'Put the stages of human sexual reproduction in order; sort animals by how they bear young.',
    ),
    L(
      'Ghép các hormone sinh sản với vai trò của chúng.',
      'Match the reproductive hormones with their roles.',
    ),
  ],
  hints: [
    L(
      'Màng tế bào trứng thay đổi ngay khi tinh trùng đầu tiên gắn vào.',
      'The egg’s membrane changes as soon as the first sperm binds.',
    ),
    L(
      'Đẻ trứng thai là hợp tử phát triển trong ống dẫn trứng nhờ chất dinh dưỡng dự trữ trong noãn hoàng, không nhờ cơ thể mẹ.',
      'In ovoviviparity the zygote develops in the oviduct on the yolk’s stored food, not on food from the mother.',
    ),
  ],
  questions: [
    L(
      'Mang thai và sinh con ở Thú có ưu điểm và nhược điểm gì so với đẻ trứng?',
      'What are the advantages and drawbacks of pregnancy and live birth in mammals compared with laying eggs?',
    ),
  ],
  expectedConclusion: L(
    'Động vật sinh sản hữu tính bằng đẻ trứng, đẻ trứng thai hoặc đẻ con. Ở người, sinh sản hữu tính gồm bốn giai đoạn: hình thành giao tử (tinh trùng ở tinh hoàn, trứng ở buồng trứng), thụ tinh trong ống dẫn trứng, phát triển phôi thai trong tử cung và đẻ con. Khi tinh trùng gắn vào màng tế bào trứng, phản ứng vỏ ngăn các tinh trùng khác, nên chỉ một tinh trùng thụ tinh. Hormone của nang trứng và thể vàng chuẩn bị tử cung; oxytocin và prostagladin làm tử cung co bóp khi sinh.',
    'Animals reproduce sexually by laying eggs, by ovoviviparity or by live birth. In people sexual reproduction has four stages: gametes form (sperm in the testes, eggs in the ovaries), fertilisation in the oviduct, the embryo and fetus develop in the uterus, and birth. When a sperm binds to the egg’s membrane, the cortical reaction blocks the others, so only one sperm fertilises it. Hormones of the follicle and yellow body prepare the uterus; oxytocin and prostaglandin make it contract at birth.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu các giai đoạn và cơ chế như sách giáo khoa.',
      'The lesson gives only the stages and mechanisms, as the textbook does.',
    ),
  ],
  limits: [
    L(
      'Số liệu của sách về thời gian sinh tinh, số tinh trùng, số noãn bào, chu kì kinh nguyệt và thời gian mang thai không có trong bài học này.',
      'The book’s figures on sperm production, numbers of sperm and egg cells, the menstrual cycle and pregnancy length are not part of this lesson.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH11', lesson: 27 },
    question: L(
      'Rất nhiều tinh trùng bao quanh tế bào trứng, nhưng chỉ một tinh trùng thụ tinh với nó. Vì sao?',
      'Very many sperm surround the egg, but only one fertilises it. Why?',
    ),
    choices: [
      {
        id: 'phan-ung-vo',
        text: L(
          'Tinh trùng đầu tiên gắn vào gây phản ứng vỏ, ngăn các tinh trùng khác',
          'The first sperm to bind sets off a cortical reaction that blocks the others',
        ),
      },
      { id: 'chet', text: L('Các tinh trùng khác đều đã chết', 'All the other sperm are dead') },
      {
        id: 'mot-tinh',
        text: L(
          'Chỉ có một tinh trùng đến được ống dẫn trứng',
          'Only one sperm reaches the oviduct',
        ),
      },
      {
        id: 'ngau-nhien',
        text: L('Trứng chọn ngẫu nhiên một tinh trùng', 'The egg picks one sperm at random'),
      },
    ],
    answer: 'phan-ung-vo',
    answerWhy: L(
      'Khi tinh trùng gắn vào thụ thể trên màng sinh chất của tế bào trứng, màng trứng có phản ứng vỏ, ngăn không cho các tinh trùng khác xâm nhập. Vì vậy chỉ một tinh trùng thụ tinh với một tế bào trứng, tạo hợp tử lưỡng bội.',
      'When a sperm binds to a receptor on the egg’s membrane, the egg reacts (the cortical reaction) and keeps other sperm out. So only one sperm fertilises the egg, making a diploid zygote.',
    ),
    activities: [
      {
        kind: 'order',
        id: 'nguoi',
        prompt: L(
          'Xếp các giai đoạn sinh sản hữu tính ở người theo đúng thứ tự.',
          'Put the stages of human sexual reproduction in order.',
        ),
        items: [
          {
            id: 'giao-tu',
            text: L('Hình thành tinh trùng và trứng', 'Sperm and eggs form'),
            why: L(
              'Qua nguyên phân và giảm phân ở tinh hoàn, buồng trứng.',
              'By mitosis and meiosis in the testes and ovaries.',
            ),
          },
          {
            id: 'thu-tinh',
            text: L(
              'Thụ tinh trong ống dẫn trứng, tạo hợp tử',
              'Fertilisation in the oviduct makes a zygote',
            ),
            why: L(
              'Hợp tử nhận một nửa nhiễm sắc thể từ bố, một nửa từ mẹ.',
              'The zygote gets half its chromosomes from each parent.',
            ),
          },
          {
            id: 'lam-to',
            text: L(
              'Phôi di chuyển về tử cung và làm tổ',
              'The embryo moves to the uterus and implants',
            ),
            why: L(
              'Hợp tử phân bào liên tiếp trên đường di chuyển.',
              'The zygote keeps dividing on the way.',
            ),
          },
          {
            id: 'phoi-thai',
            text: L(
              'Phôi thai phát triển, được nuôi qua nhau thai',
              'The embryo and fetus grow, fed through the placenta',
            ),
            why: L(
              'Giai đoạn phôi rồi giai đoạn thai.',
              'First the embryo stage, then the fetal stage.',
            ),
          },
          {
            id: 'de-con',
            text: L('Đẻ con', 'Birth'),
            why: L(
              'Oxytocin và prostagladin làm tử cung co bóp, đẩy thai ra ngoài.',
              'Oxytocin and prostaglandin make the uterus contract and push the baby out.',
            ),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'cach-de',
        prompt: L(
          'Xếp mỗi động vật vào cách đẻ của nó theo sách.',
          'Put each animal under how it bears young, as in the book.',
        ),
        groups: [
          { id: 'trung', label: L('Đẻ trứng', 'Lays eggs') },
          { id: 'trung-thai', label: L('Đẻ trứng thai', 'Ovoviviparous') },
          { id: 'con', label: L('Đẻ con', 'Live birth') },
        ],
        items: [
          {
            id: 'chim',
            text: L('Chim', 'Birds'),
            group: 'trung',
            why: L(
              'Trứng thụ tinh trong cơ thể con cái rồi được đẻ ra.',
              'Eggs are fertilised inside the female, then laid.',
            ),
          },
          {
            id: 'mo-vit',
            text: L('Thú mỏ vịt', 'Platypus'),
            group: 'trung',
            why: L(
              'Loài Thú duy nhất trong sách không đẻ con.',
              'The only mammal in the book that does not give live birth.',
            ),
          },
          {
            id: 'mot-so-ca',
            text: L(
              'Một số loài cá giữ hợp tử trong ống dẫn trứng',
              'Some fish that keep the zygote in the oviduct',
            ),
            group: 'trung-thai',
            why: L(
              'Hợp tử sống nhờ noãn hoàng rồi con non được đẻ ra.',
              'The zygote lives on its yolk and the young are then born.',
            ),
          },
          {
            id: 'trau',
            text: L('Trâu, bò', 'Buffalo, cattle'),
            group: 'con',
            why: L(
              'Thú (trừ thú mỏ vịt) đẻ con.',
              'Mammals (except the platypus) give live birth.',
            ),
          },
          {
            id: 'nguoi',
            text: L('Người', 'Humans'),
            group: 'con',
            why: L(
              'Phôi thai được nuôi dưỡng qua nhau thai.',
              'The fetus is fed through the placenta.',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'hormone',
        prompt: L('Ghép mỗi hormone với vai trò của nó.', 'Match each hormone with its role.'),
        pairs: [
          {
            id: 'estrogen',
            left: L('Estrogen của tế bào hạt nang trứng', 'Oestrogen from the follicle cells'),
            right: L('Kích thích niêm mạc tử cung phát triển', 'Makes the uterine lining grow'),
            why: L(
              'Chuẩn bị tử cung trước khi trứng rụng.',
              'It prepares the uterus before ovulation.',
            ),
          },
          {
            id: 'the-vang',
            left: L(
              'Estrogen và progesterone của thể vàng',
              'Oestrogen and progesterone from the yellow body',
            ),
            right: L(
              'Duy trì niêm mạc tử cung, chuẩn bị đón hợp tử làm tổ',
              'Keep up the uterine lining, ready for implantation',
            ),
            why: L(
              'Thể vàng là phần còn lại của nang trứng sau khi trứng rụng.',
              'The yellow body is what is left of the follicle after ovulation.',
            ),
          },
          {
            id: 'oxytocin',
            left: L('Oxytocin', 'Oxytocin'),
            right: L('Kích thích tử cung co bóp khi sinh', 'Makes the uterus contract at birth'),
            why: L(
              'Não làm tuyến yên tăng tiết oxytocin khi đầu thai nhi kích thích cổ tử cung.',
              'The brain makes the pituitary release more oxytocin when the baby’s head presses the cervix.',
            ),
          },
          {
            id: 'prostagladin',
            left: L('Prostagladin', 'Prostaglandin'),
            right: L(
              'Do nhau thai tiết, hỗ trợ oxytocin làm tử cung co mạnh hơn',
              'Released by the placenta, helps oxytocin make stronger contractions',
            ),
            why: L(
              'Hai hormone phối hợp đẩy thai nhi ra ngoài.',
              'Together they push the baby out.',
            ),
          },
        ],
      },
    ],
  },
};
