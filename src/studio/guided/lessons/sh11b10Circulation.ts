import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH11 KNTT Bài 10 "Tuần hoàn ở động vật" (printed pages 61–68), in SimLab's own words. Checked
 * against the pages on 17/11/2026: open and closed circulatory systems with the book's animal groups
 * (Hình 10.1), the vessels and their roles, the heart valves and chambers (Hình 10.3), the conducting
 * system (nút xoang nhĩ → nút nhĩ thất → bó His → mạng Purkinje, Hình 10.4) and the nervous and
 * hormonal regulation when blood pressure falls (tr. 66), which is the prediction. SH11-GL-7.
 */
export const sh11b10Circulation: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh11-circulation',
  topic: 'animalCirculation',
  title: L('Tuần hoàn ở động vật', 'Circulation in animals'),
  objectives: [
    L(
      'Dự đoán cơ thể phản ứng thế nào khi huyết áp giảm.',
      'Predict how the body responds when blood pressure falls.',
    ),
    L(
      'Xếp đúng đường đi của xung điện trong hệ dẫn truyền tim; phân biệt hệ tuần hoàn hở và kín.',
      'Put the path of the electrical signal through the heart’s conducting system in order; tell open and closed circulation apart.',
    ),
    L(
      'Ghép các mạch máu và bộ phận của tim với chức năng của chúng.',
      'Match the blood vessels and parts of the heart with their roles.',
    ),
  ],
  hints: [
    L(
      'Hoạt động tim mạch được điều hòa bằng thần kinh và hormone để giữ huyết áp ổn định.',
      'The heart and vessels are regulated by nerves and hormones to keep blood pressure steady.',
    ),
    L(
      'Ở hệ tuần hoàn kín, máu luôn chảy trong mạch; ở hệ tuần hoàn hở, máu tràn ra xoang cơ thể.',
      'In a closed system blood always stays in vessels; in an open system it spills into the body cavity.',
    ),
  ],
  questions: [
    L(
      'Vì sao luyện tập thể dục, thể thao thường xuyên có lợi cho tim và mạch máu?',
      'Why is regular exercise good for the heart and blood vessels?',
    ),
  ],
  expectedConclusion: L(
    'Hệ tuần hoàn gồm dịch tuần hoàn, tim và hệ mạch, vận chuyển các chất trong cơ thể. Hệ tuần hoàn hở có máu chảy chậm dưới áp lực thấp; hệ tuần hoàn kín (đơn hoặc kép) có máu chảy nhanh, liên tục trong mạch. Tim có tính tự động nhờ hệ dẫn truyền: xung phát ra từ nút xoang nhĩ, lan qua tâm nhĩ, nút nhĩ thất, bó His, mạng Purkinje. Van tim cho máu đi một chiều. Động mạch đưa máu đi, tĩnh mạch đưa máu về, trao đổi chất diễn ra ở mao mạch. Thần kinh và hormone điều hòa tim mạch để giữ huyết áp ổn định.',
    'The circulatory system is the circulating fluid, the heart and the vessels; it carries substances round the body. Open systems move blood slowly at low pressure; closed systems (single or double) move it quickly and continuously in vessels. The heart beats on its own thanks to its conducting system: the signal starts at the sinoatrial node and spreads across the atria, the atrioventricular node, the bundle of His and the Purkinje fibres. Valves keep blood flowing one way. Arteries carry blood out, veins bring it back, and exchange happens in the capillaries. Nerves and hormones regulate the heart and vessels to keep blood pressure steady.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu cấu tạo và cơ chế như sách giáo khoa; SimLab không tính huyết áp, nhịp tim hay vận tốc máu.',
      'The lesson gives only the structures and mechanisms, as the textbook does; SimLab computes no blood pressure, heart rate or blood speed.',
    ),
  ],
  limits: [
    L(
      'Thời gian các pha của chu kì tim, trị số huyết áp và nhịp tim của các loài trong sách không có trong bài học này.',
      'The timing of the cardiac cycle, the blood pressure values and the animals’ heart rates in the book are not part of this lesson.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH11', lesson: 10 },
    question: L(
      'Thụ thể áp lực ở xoang động mạch cảnh và gốc cung động mạch chủ báo huyết áp đang giảm. Cơ thể phản ứng thế nào?',
      'Pressure receptors in the carotid sinus and the aortic arch report that blood pressure is falling. How does the body respond?',
    ),
    choices: [
      {
        id: 'tang',
        text: L(
          'Tim đập nhanh, mạnh hơn và mạch máu nhỏ co lại, huyết áp tăng trở lại',
          'The heart beats faster and harder and small vessels narrow, so the pressure rises again',
        ),
      },
      { id: 'cham', text: L('Tim đập chậm lại để nghỉ ngơi', 'The heart slows down to rest') },
      { id: 'dan', text: L('Mọi mạch máu đều dãn rộng ra', 'Every blood vessel widens') },
      { id: 'khong-doi', text: L('Không có phản ứng nào', 'Nothing happens') },
    ],
    answer: 'tang',
    answerWhy: L(
      'Trung khu điều hòa tim mạch ở hành não tăng xung thần kinh trên dây giao cảm: tim đập nhanh, mạnh, các mạch máu nhỏ co lại; tuyến trên thận tiết thêm adrenalin và noradrenalin cũng làm tim đập nhanh, mạnh và mạch máu co. Nhờ vậy huyết áp tăng trở lại bình thường.',
      'The cardiovascular centre in the medulla sends more signals along the sympathetic nerves: the heart beats faster and harder and small vessels narrow; the adrenal glands also release adrenaline and noradrenaline, with the same effect. So blood pressure rises back to normal.',
    ),
    activities: [
      {
        kind: 'order',
        id: 'dan-truyen',
        prompt: L(
          'Xếp đường đi của xung điện trong hệ dẫn truyền tim theo đúng thứ tự.',
          'Put the path of the electrical signal through the heart in order.',
        ),
        items: [
          {
            id: 'nut-xoang',
            text: L(
              'Nút xoang nhĩ tự phát xung điện',
              'The sinoatrial node fires a signal on its own',
            ),
            why: L(
              'Cứ sau một khoảng thời gian, nút xoang nhĩ lại phát xung: tim có tính tự động.',
              'The sinoatrial node fires again and again by itself: the heart beats automatically.',
            ),
          },
          {
            id: 'tam-nhi',
            text: L(
              'Xung lan khắp cơ tâm nhĩ, hai tâm nhĩ co',
              'The signal spreads across the atria and both atria contract',
            ),
            why: L(
              'Tâm nhĩ co đẩy máu xuống tâm thất.',
              'The contracting atria push blood into the ventricles.',
            ),
          },
          {
            id: 'nut-nhi-that',
            text: L('Xung đến nút nhĩ thất', 'The signal reaches the atrioventricular node'),
            why: L(
              'Nút nhĩ thất chuyển xung từ tâm nhĩ xuống tâm thất.',
              'The atrioventricular node passes the signal from the atria to the ventricles.',
            ),
          },
          {
            id: 'bo-his',
            text: L('Xung theo bó His', 'The signal runs along the bundle of His'),
            why: L(
              'Bó His dẫn xung từ nút nhĩ thất xuống phía tâm thất.',
              'The bundle of His carries the signal from the atrioventricular node towards the ventricles.',
            ),
          },
          {
            id: 'purkinje',
            text: L(
              'Xung theo mạng Purkinje lan khắp cơ tâm thất, hai tâm thất co',
              'The Purkinje fibres spread it through the ventricles, which contract',
            ),
            why: L(
              'Tâm thất co đẩy máu vào động mạch phổi và động mạch chủ.',
              'The contracting ventricles push blood into the pulmonary artery and the aorta.',
            ),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'ho-kin',
        prompt: L(
          'Xếp mỗi đặc điểm vào hệ tuần hoàn hở hoặc hệ tuần hoàn kín.',
          'Put each feature under the open or the closed circulatory system.',
        ),
        groups: [
          { id: 'ho', label: L('Hệ tuần hoàn hở', 'Open system') },
          { id: 'kin', label: L('Hệ tuần hoàn kín', 'Closed system') },
        ],
        items: [
          {
            id: 'xoang',
            text: L(
              'Máu tràn vào xoang cơ thể, trộn lẫn với dịch mô',
              'Blood spills into the body cavity and mixes with tissue fluid',
            ),
            group: 'ho',
            why: L(
              'Hỗn hợp máu – dịch mô được gọi chung là máu.',
              'The blood–tissue fluid mix is simply called blood.',
            ),
          },
          {
            id: 'cham',
            text: L(
              'Máu chảy dưới áp lực thấp, tốc độ chậm',
              'Blood flows at low pressure, slowly',
            ),
            group: 'ho',
            why: L('Tim thu hồi máu chậm.', 'The heart gets the blood back slowly.'),
          },
          {
            id: 'chan-khop',
            text: L(
              'Có ở đa số Chân khớp và một số Thân mềm',
              'Found in most arthropods and some molluscs',
            ),
            group: 'ho',
            why: L(
              'Ví dụ của sách về hệ tuần hoàn hở.',
              'The book’s examples of open circulation.',
            ),
          },
          {
            id: 'lien-tuc',
            text: L(
              'Máu chảy liên tục trong mạch kín, qua mao mạch',
              'Blood flows continuously in closed vessels, through capillaries',
            ),
            group: 'kin',
            why: L(
              'Máu từ động mạch qua mao mạch, tĩnh mạch rồi về tim.',
              'Blood goes from arteries through capillaries and veins back to the heart.',
            ),
          },
          {
            id: 'dich-mo',
            text: L(
              'Máu trao đổi chất với tế bào qua dịch mô',
              'Blood exchanges substances with cells through tissue fluid',
            ),
            group: 'kin',
            why: L(
              'Máu không tiếp xúc trực tiếp với tế bào.',
              'The blood does not touch the cells directly.',
            ),
          },
          {
            id: 'nhanh',
            text: L(
              'Máu chảy dưới áp lực cao hoặc trung bình, tốc độ nhanh',
              'Blood flows at high or medium pressure, quickly',
            ),
            group: 'kin',
            why: L('Tim thu hồi máu nhanh.', 'The heart gets the blood back quickly.'),
          },
          {
            id: 'xuong-song',
            text: L('Có ở Giun đốt và động vật có xương sống', 'Found in annelids and vertebrates'),
            group: 'kin',
            why: L(
              'Có thể là tuần hoàn đơn (cá) hoặc tuần hoàn kép (động vật có phổi).',
              'It may be single (fish) or double (animals with lungs).',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'chuc-nang',
        prompt: L(
          'Ghép mỗi mạch máu, bộ phận của tim với chức năng của nó.',
          'Match each blood vessel or part of the heart with its role.',
        ),
        pairs: [
          {
            id: 'dong-mach',
            left: L('Động mạch', 'Artery'),
            right: L(
              'Đưa máu từ tim đến các cơ quan',
              'Carries blood from the heart to the organs',
            ),
            why: L(
              'Động mạch từ lớn đến nhỏ, máu chảy dưới áp lực cao.',
              'Arteries branch from large to small; blood flows at high pressure.',
            ),
          },
          {
            id: 'tinh-mach',
            left: L('Tĩnh mạch', 'Vein'),
            right: L(
              'Đưa máu từ các cơ quan về tim',
              'Brings blood back from the organs to the heart',
            ),
            why: L(
              'Các tĩnh mạch lớn ở chân có van giữ máu đi một chiều.',
              'Large veins in the legs have valves that keep blood going one way.',
            ),
          },
          {
            id: 'mao-mach',
            left: L('Mao mạch', 'Capillary'),
            right: L(
              'Nơi trao đổi chất giữa máu và tế bào',
              'Where blood and cells exchange substances',
            ),
            why: L(
              'Thành mao mạch chỉ gồm một lớp tế bào biểu mô dẹt.',
              'A capillary wall is a single layer of flat cells.',
            ),
          },
          {
            id: 'van-tim',
            left: L('Van tim', 'Heart valves'),
            right: L('Cho máu đi theo một chiều', 'Keep blood flowing one way'),
            why: L(
              'Van nằm giữa tâm nhĩ và tâm thất, giữa tâm thất và động mạch.',
              'Valves sit between atria and ventricles and between ventricles and arteries.',
            ),
          },
          {
            id: 'tam-that',
            left: L('Tâm thất', 'Ventricle'),
            right: L('Bơm máu ra khỏi tim', 'Pumps blood out of the heart'),
            why: L(
              'Tâm nhĩ thu nhận máu từ tĩnh mạch; tâm thất bơm máu vào động mạch.',
              'The atria receive blood from the veins; the ventricles pump it into the arteries.',
            ),
          },
        ],
      },
    ],
  },
};
