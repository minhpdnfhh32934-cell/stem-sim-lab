import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * VL12 KNTT Bài 18 "Ứng dụng hiện tượng cảm ứng điện từ" (printed pages 78–81), in SimLab's own
 * words. Checked against the pages on 17/11/2026: the transformer (Hình 18.1, tr. 78), wireless
 * phone charging (Hình 18.2, 18.3), the electric guitar and its question on loudness (Hình 18.4,
 * tr. 79–80), Foucault currents, their uses and harm, and the laminated transformer core (tr.
 * 80–81). VL12-GL-4.
 */
export const vl12b18Applications: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'physics',
  id: 'guided.vl12-induction-uses',
  topic: 'inductionApplications',
  title: L('Ứng dụng hiện tượng cảm ứng điện từ', 'Uses of electromagnetic induction'),
  objectives: [
    L(
      'Dự đoán âm phát ra từ đàn ghi ta điện khi gảy dây đàn mạnh hơn, và giải thích bằng định luật Faraday.',
      'Predict the sound of an electric guitar when a string is plucked harder, and explain it with Faraday’s law.',
    ),
    L(
      'Sắp xếp các bước hoạt động của máy biến áp.',
      'Put the steps of a transformer’s working in order.',
    ),
    L(
      'Ghép mỗi thiết bị với cách nó dùng hiện tượng cảm ứng điện từ; phân biệt lợi ích và tác hại của dòng điện Foucault.',
      'Match each device with how it uses induction; tell the uses of Foucault currents from their harm.',
    ),
  ],
  hints: [
    L(
      'Suất điện động cảm ứng càng lớn khi từ thông qua mạch biến thiên càng nhanh.',
      'The faster the flux through a circuit changes, the larger the induced e.m.f.',
    ),
    L(
      'Mọi hiện tượng trong bài đều bắt đầu từ một từ thông biến thiên.',
      'Everything in this lesson starts from a changing flux.',
    ),
  ],
  questions: [
    L(
      'Vì sao lõi máy biến áp không làm bằng một khối sắt liền mà ghép từ nhiều lá thép mỏng có lớp sơn cách điện?',
      'Why is a transformer core made of thin insulated steel sheets rather than one solid block?',
    ),
  ],
  expectedConclusion: L(
    'Máy biến áp, sạc không dây và đàn ghi ta điện đều dựa trên hiện tượng cảm ứng điện từ: từ thông qua một cuộn dây biến thiên làm xuất hiện suất điện động cảm ứng trong cuộn dây đó. Trong máy biến áp, dòng điện xoay chiều ở cuộn sơ cấp tạo ra từ trường biến thiên trong lõi, nên ở cuộn thứ cấp xuất hiện điện áp xoay chiều, với tỉ số điện áp hiệu dụng bằng tỉ số số vòng dây. Khối kim loại chuyển động trong từ trường hoặc đặt trong từ trường biến thiên có dòng điện Foucault; dòng này được dùng trong bếp từ, phanh điện từ, luyện kim, nhưng làm nóng lõi máy biến áp nên lõi được ghép từ các lá thép mỏng cách điện.',
    'Transformers, wireless chargers and electric guitars all rest on electromagnetic induction: a changing flux through a coil induces an e.m.f. in it. In a transformer the alternating current in the primary makes a changing field in the core, so an alternating voltage appears across the secondary, the ratio of the effective voltages being the ratio of the turns. A metal block moving in a field or sitting in a changing field carries Foucault currents; they are used in induction hobs, eddy-current brakes and metallurgy, but they heat transformer cores, which are therefore made of thin insulated steel sheets.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu các ứng dụng như sách giáo khoa; SimLab không tính điện áp hay dòng điện ở đây.',
      'The lesson gives only the uses, as the textbook does; SimLab computes no voltages or currents here.',
    ),
  ],
  limits: [
    L(
      'Từ thông, suất điện động cảm ứng và máy phát điện xoay chiều được tính trong bài “Cảm ứng điện từ và máy phát điện xoay chiều”.',
      'Flux, induced e.m.f. and the AC generator are computed in the lesson “Electromagnetic induction and the AC generator”.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'VL12', lesson: 18 },
    question: L(
      'Gảy dây đàn ghi ta điện mạnh hơn (dây dao động với biên độ lớn hơn, cùng tần số). Âm phát ra từ loa thay đổi thế nào?',
      'An electric guitar string is plucked harder (it vibrates with a larger amplitude, at the same frequency). How does the sound from the loudspeaker change?',
    ),
    choices: [
      { id: 'to-hon', text: L('To hơn', 'Louder') },
      { id: 'nho-hon', text: L('Nhỏ hơn', 'Quieter') },
      { id: 'khong-doi', text: L('Như cũ', 'The same') },
      { id: 'cao-hon', text: L('Cao hơn nhưng không to hơn', 'Higher in pitch but not louder') },
    ],
    answer: 'to-hon',
    answerWhy: L(
      'Dây thép nhiễm từ dao động mạnh hơn làm từ thông qua cuộn dây cảm ứng biến thiên nhanh hơn, nên suất điện động cảm ứng lớn hơn: tín hiệu đưa đến máy tăng âm mạnh hơn và âm to hơn. Tần số không đổi nên độ cao không đổi.',
      'The magnetised steel string swings harder, so the flux through the pickup coil changes faster and the induced e.m.f. is larger: the signal to the amplifier is stronger and the sound louder. The frequency is the same, so the pitch is too.',
    ),
    activities: [
      {
        kind: 'order',
        id: 'may-bien-ap',
        prompt: L(
          'Sắp xếp các bước hoạt động của máy biến áp theo đúng thứ tự.',
          'Put the steps of a transformer’s working in order.',
        ),
        items: [
          {
            id: 'so-cap',
            text: L(
              'Dòng điện xoay chiều chạy trong cuộn sơ cấp',
              'An alternating current flows in the primary coil',
            ),
            why: L(
              'Cuộn sơ cấp được nối với nguồn điện xoay chiều.',
              'The primary is connected to the AC supply.',
            ),
          },
          {
            id: 'loi',
            text: L(
              'Trong lõi biến áp có từ trường biến thiên',
              'The core carries a changing magnetic field',
            ),
            why: L(
              'Dòng điện xoay chiều sinh ra từ trường biến thiên.',
              'An alternating current makes a changing field.',
            ),
          },
          {
            id: 'tu-thong',
            text: L(
              'Từ thông qua cuộn thứ cấp biến thiên',
              'The flux through the secondary coil changes',
            ),
            why: L(
              'Hầu hết đường sức từ chỉ chạy trong lõi, xuyên qua cả hai cuộn dây.',
              'Almost all field lines stay in the core and pass through both coils.',
            ),
          },
          {
            id: 'thu-cap',
            text: L(
              'Ở cuộn thứ cấp xuất hiện suất điện động cảm ứng xoay chiều',
              'An alternating e.m.f. is induced in the secondary coil',
            ),
            why: L('Đây là hiện tượng cảm ứng điện từ.', 'This is electromagnetic induction.'),
          },
        ],
      },
      {
        kind: 'match',
        id: 'ung-dung',
        prompt: L(
          'Ghép mỗi thiết bị với cách nó dùng hiện tượng cảm ứng điện từ.',
          'Match each device with how it uses electromagnetic induction.',
        ),
        pairs: [
          {
            id: 'bien-ap',
            left: L('Máy biến áp', 'Transformer'),
            right: L(
              'Hai cuộn dây có số vòng khác nhau quấn trên cùng một lõi kín',
              'Two coils with different numbers of turns on one closed core',
            ),
            why: L(
              'Tỉ số điện áp hiệu dụng bằng tỉ số số vòng dây.',
              'The ratio of effective voltages equals the ratio of turns.',
            ),
          },
          {
            id: 'sac',
            left: L('Sạc điện thoại không dây', 'Wireless phone charger'),
            right: L(
              'Cuộn dây trong đế sạc là cuộn sơ cấp, cuộn dây nối với pin điện thoại là cuộn thứ cấp',
              'The coil in the pad is the primary, the coil on the phone’s battery the secondary',
            ),
            why: L(
              'Hoạt động như một máy biến áp không có lõi chung.',
              'It works like a transformer without a shared core.',
            ),
          },
          {
            id: 'ghi-ta',
            left: L('Đàn ghi ta điện', 'Electric guitar'),
            right: L(
              'Dây đàn bằng thép bị nhiễm từ dao động làm từ thông qua cuộn dây cảm ứng biến thiên',
              'A magnetised steel string vibrates and changes the flux through a pickup coil',
            ),
            why: L(
              'Dòng điện cảm ứng có cùng tần số với dao động của dây đàn.',
              'The induced current has the string’s frequency.',
            ),
          },
          {
            id: 'bep-tu',
            left: L('Bếp từ', 'Induction hob'),
            right: L(
              'Từ trường biến thiên sinh ra dòng điện Foucault làm nóng đáy nồi kim loại',
              'A changing field drives Foucault currents that heat the metal pan',
            ),
            why: L(
              'Dòng điện Foucault tỏa nhiệt trong khối kim loại.',
              'Foucault currents heat the metal.',
            ),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'foucault',
        prompt: L(
          'Xếp mỗi trường hợp vào nhóm dòng điện Foucault có lợi hoặc có hại.',
          'Put each case under Foucault currents being useful or harmful.',
        ),
        groups: [
          { id: 'loi', label: L('Có lợi', 'Useful') },
          { id: 'hai', label: L('Có hại', 'Harmful') },
        ],
        items: [
          {
            id: 'luyen-kim',
            text: L('Luyện kim', 'Metallurgy'),
            group: 'loi',
            why: L('Nhiệt của dòng Foucault nung chảy kim loại.', 'Their heat melts metal.'),
          },
          {
            id: 'bep',
            text: L('Bếp từ', 'Induction hob'),
            group: 'loi',
            why: L('Nhiệt tỏa ra ngay trong đáy nồi.', 'The heat appears in the pan itself.'),
          },
          {
            id: 'phanh',
            text: L('Phanh điện từ', 'Eddy-current brake'),
            group: 'loi',
            why: L(
              'Dòng Foucault có tác dụng ngăn cản chuyển động của khối kim loại.',
              'Foucault currents oppose the metal’s motion.',
            ),
          },
          {
            id: 'dong-ho',
            text: L('Đồng hồ đo điện', 'Electricity meter'),
            group: 'loi',
            why: L('Một ứng dụng sách nêu.', 'A use the book lists.'),
          },
          {
            id: 'loi-bien-ap',
            text: L(
              'Làm nóng lõi máy biến áp, gây hao phí điện năng',
              'Heating a transformer core, wasting energy',
            ),
            group: 'hai',
            why: L(
              'Vì vậy lõi được ghép từ các lá thép mỏng có lớp sơn cách điện.',
              'That is why the core is made of thin insulated steel sheets.',
            ),
          },
        ],
      },
    ],
  },
};
