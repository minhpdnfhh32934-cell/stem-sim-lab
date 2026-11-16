import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH11 KNTT Bài 13 "Bài tiết và cân bằng nội môi" (printed pages 80–87), in SimLab's own words.
 * Checked against the pages on 17/11/2026: Bảng 13.1 (excretory organs and their products), urine
 * formation in the nephron (lọc, tái hấp thu, tiết, Hình 13.2), the three parts of a homeostatic
 * system (Hình 13.3) and the kidney's regulation of blood osmotic pressure through ADH (Hình 13.4),
 * which is the prediction. SH11-GL-9.
 */
export const sh11b13Excretion: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh11-excretion',
  topic: 'excretionHomeostasis',
  title: L('Bài tiết và cân bằng nội môi', 'Excretion and homeostasis'),
  objectives: [
    L(
      'Dự đoán thận phản ứng thế nào khi áp suất thẩm thấu của máu tăng.',
      'Predict how the kidneys respond when the osmotic pressure of the blood rises.',
    ),
    L(
      'Xếp đúng thứ tự các giai đoạn tạo nước tiểu; ghép mỗi cơ quan bài tiết với sản phẩm của nó.',
      'Put the stages of urine formation in order; match each excretory organ with its product.',
    ),
    L(
      'Phân loại các thành phần của hệ thống điều hòa cân bằng nội môi.',
      'Sort the parts of a homeostatic control system.',
    ),
  ],
  hints: [
    L(
      'Áp suất thẩm thấu của máu tăng nghĩa là máu đang thiếu nước so với chất tan.',
      'A higher osmotic pressure of the blood means it has too little water for its solutes.',
    ),
    L(
      'Một hệ thống điều hòa gồm bộ phận tiếp nhận kích thích, bộ phận điều khiển và bộ phận thực hiện, kèm liên hệ ngược.',
      'A control system has a receptor, a control centre and an effector, linked by feedback.',
    ),
  ],
  questions: [
    L(
      'Vì sao cần uống đủ nước, ăn ít muối và không lạm dụng thuốc để bảo vệ thận?',
      'Why should we drink enough water, eat little salt and not overuse medicines to protect the kidneys?',
    ),
  ],
  expectedConclusion: L(
    'Bài tiết là thải ra khỏi cơ thể các chất không dùng đến, chất độc hại và chất dư thừa; phổi thải CO₂, thận thải nước tiểu, da thải mồ hôi, hệ tiêu hóa thải bilirubin. Nước tiểu tạo thành ở nephron qua lọc ở cầu thận, tái hấp thu và tiết ở ống thận, rồi ống góp hấp thụ bớt nước. Cân bằng nội môi là giữ các điều kiện lí, hóa trong cơ thể ổn định nhờ hệ thống gồm bộ phận tiếp nhận, điều khiển, thực hiện và liên hệ ngược. Khi máu thiếu nước, ADH làm tăng tái hấp thu nước ở thận và gây cảm giác khát.',
    'Excretion is getting rid of unused, harmful and surplus substances: the lungs give off CO₂, the kidneys urine, the skin sweat and the gut bilirubin. Urine is made in the nephron by filtration in the glomerulus, reabsorption and secretion in the tubule, and the collecting duct takes back more water. Homeostasis keeps the body’s physical and chemical conditions steady through a system of receptor, control centre, effector and feedback. When the blood lacks water, ADH makes the kidneys take back more water and causes thirst.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu các quá trình và cơ chế như sách giáo khoa; SimLab không tính lượng nước tiểu hay chỉ số xét nghiệm.',
      'The lesson gives only the processes and mechanisms, as the textbook does; SimLab computes no urine volume or test value.',
    ),
  ],
  limits: [
    L(
      'Bảng kết quả xét nghiệm của sách và các chỉ số sinh hóa máu không có trong bài học này.',
      'The book’s table of blood test results and blood chemistry values are not part of this lesson.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH11', lesson: 13 },
    question: L(
      'Sau khi ra nhiều mồ hôi, cơ thể mất nước, áp suất thẩm thấu của máu tăng. Thận phản ứng thế nào?',
      'After heavy sweating the body has lost water and the osmotic pressure of the blood rises. How do the kidneys respond?',
    ),
    choices: [
      {
        id: 'giu-nuoc',
        text: L(
          'Tăng tái hấp thu nước ở ống thận và ống góp, nước tiểu ít đi',
          'They take back more water in the tubules and collecting ducts, so less urine is made',
        ),
      },
      { id: 'thai-nhieu', text: L('Thải nhiều nước tiểu hơn', 'They make more urine') },
      { id: 'ngung', text: L('Ngừng lọc máu', 'They stop filtering the blood') },
      { id: 'khong-doi', text: L('Không thay đổi', 'Nothing changes') },
    ],
    answer: 'giu-nuoc',
    answerWhy: L(
      'Vùng dưới đồi nhận biết áp suất thẩm thấu tăng, gây cảm giác khát và làm tuyến yên tiết ADH. ADH làm tăng tái hấp thu nước ở ống thận và ống góp, nên nước được giữ lại, áp suất thẩm thấu của máu giảm về bình thường.',
      'The hypothalamus senses the higher osmotic pressure, causes thirst and makes the pituitary release ADH. ADH increases water reabsorption in the tubules and collecting ducts, so water is kept and the blood’s osmotic pressure falls back to normal.',
    ),
    activities: [
      {
        kind: 'order',
        id: 'nuoc-tieu',
        prompt: L(
          'Xếp các giai đoạn tạo nước tiểu ở nephron theo đúng thứ tự.',
          'Put the stages of urine formation in the nephron in order.',
        ),
        items: [
          {
            id: 'loc',
            text: L(
              'Lọc: huyết áp đẩy nước và chất hòa tan qua cầu thận vào nang Bowman',
              'Filtration: blood pressure pushes water and solutes through the glomerulus into Bowman’s capsule',
            ),
            why: L(
              'Dịch lọc cầu thận giống huyết tương nhưng không có tế bào máu và protein huyết tương.',
              'The filtrate is like plasma but has no blood cells or plasma proteins.',
            ),
          },
          {
            id: 'tai-hap-thu',
            text: L(
              'Tái hấp thu: chất dinh dưỡng, ion cần thiết và nước trở lại máu',
              'Reabsorption: nutrients, needed ions and water return to the blood',
            ),
            why: L(
              'Phần lớn dịch lọc được ống thận hấp thu trở lại.',
              'Most of the filtrate is taken back by the tubule.',
            ),
          },
          {
            id: 'tiet',
            text: L(
              'Tiết: chất độc, ion dư thừa được tế bào ống thận tiết vào dịch lọc',
              'Secretion: poisons and surplus ions are released by the tubule cells into the filtrate',
            ),
            why: L(
              'Nhờ tiết, thận loại thêm chất thải và giữ pH máu ổn định.',
              'Secretion removes more waste and keeps blood pH steady.',
            ),
          },
          {
            id: 'ong-gop',
            text: L(
              'Ống góp hấp thụ bớt nước; nước tiểu chảy vào bể thận, xuống bàng quang',
              'The collecting duct takes back more water; urine flows to the renal pelvis and the bladder',
            ),
            why: L(
              'Nước tiểu được lưu ở bàng quang trước khi thải ra ngoài.',
              'Urine is stored in the bladder before it leaves the body.',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'co-quan',
        prompt: L(
          'Ghép mỗi cơ quan bài tiết với sản phẩm bài tiết chính của nó.',
          'Match each excretory organ with its main product.',
        ),
        pairs: [
          {
            id: 'phoi',
            left: L('Phổi', 'Lungs'),
            right: L('CO₂', 'CO₂'),
            why: L(
              'Phổi thải CO₂ ra môi trường, nhờ đó còn góp phần giữ pH máu.',
              'The lungs give off CO₂, which also helps keep blood pH steady.',
            ),
          },
          {
            id: 'than',
            left: L('Thận', 'Kidneys'),
            right: L(
              'Nước tiểu (nước, urea, uric acid, creatinin, ion)',
              'Urine (water, urea, uric acid, creatinine, ions)',
            ),
            why: L(
              'Thận lọc máu, thải chất độc và chất dư thừa.',
              'The kidneys filter the blood and remove poisons and surplus substances.',
            ),
          },
          {
            id: 'da',
            left: L('Da', 'Skin'),
            right: L(
              'Mồ hôi (nước, một ít chất vô cơ và urea)',
              'Sweat (water, a little salt and urea)',
            ),
            why: L(
              'Mồ hôi được tiết qua tuyến mồ hôi ở da.',
              'Sweat is released by the skin’s sweat glands.',
            ),
          },
          {
            id: 'tieu-hoa',
            left: L('Hệ tiêu hóa', 'Digestive system'),
            right: L('Bilirubin', 'Bilirubin'),
            why: L(
              'Bilirubin được thải ra ngoài qua đường tiêu hóa.',
              'Bilirubin leaves the body through the gut.',
            ),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'he-dieu-hoa',
        prompt: L(
          'Xếp mỗi thành phần vào đúng bộ phận của hệ thống điều hòa cân bằng nội môi.',
          'Put each part under its role in a homeostatic control system.',
        ),
        groups: [
          { id: 'tiep-nhan', label: L('Bộ phận tiếp nhận kích thích', 'Receptor') },
          { id: 'dieu-khien', label: L('Bộ phận điều khiển', 'Control centre') },
          { id: 'thuc-hien', label: L('Bộ phận thực hiện', 'Effector') },
        ],
        items: [
          {
            id: 'thu-the',
            text: L(
              'Thụ thể áp lực ở xoang động mạch cảnh',
              'Pressure receptors in the carotid sinus',
            ),
            group: 'tiep-nhan',
            why: L(
              'Thụ thể nhận kích thích từ môi trường trong cơ thể.',
              'Receptors pick up stimuli from inside the body.',
            ),
          },
          {
            id: 'thu-cam',
            text: L(
              'Cơ quan thụ cảm nhận kích thích từ môi trường ngoài',
              'Sense organs that detect stimuli from outside',
            ),
            group: 'tiep-nhan',
            why: L(
              'Bộ phận tiếp nhận là thụ thể hoặc cơ quan thụ cảm.',
              'The receptor is a sensory receptor or sense organ.',
            ),
          },
          {
            id: 'than-kinh',
            text: L('Trung ương thần kinh', 'The central nervous system'),
            group: 'dieu-khien',
            why: L(
              'Bộ phận điều khiển gửi tín hiệu thần kinh đến bộ phận thực hiện.',
              'The control centre sends nerve signals to the effector.',
            ),
          },
          {
            id: 'tuyen-tuy',
            text: L(
              'Tuyến tụy tiết insulin hoặc glucagon',
              'The pancreas releasing insulin or glucagon',
            ),
            group: 'dieu-khien',
            why: L(
              'Tuyến nội tiết điều khiển bằng hormone.',
              'Endocrine glands control through hormones.',
            ),
          },
          {
            id: 'gan',
            text: L(
              'Gan chuyển glucose thành glycogen dự trữ',
              'The liver storing glucose as glycogen',
            ),
            group: 'thuc-hien',
            why: L(
              'Gan thực hiện việc giữ nồng độ glucose máu ổn định.',
              'The liver carries out the work of keeping blood glucose steady.',
            ),
          },
          {
            id: 'than-hap-thu',
            text: L(
              'Thận tái hấp thu nước ở ống thận và ống góp',
              'The kidneys taking back water in the tubules and collecting ducts',
            ),
            group: 'thuc-hien',
            why: L(
              'Thận thực hiện việc điều hòa nước và muối.',
              'The kidneys carry out the regulation of water and salt.',
            ),
          },
          {
            id: 'tim-mach',
            text: L(
              'Tim và mạch máu thay đổi nhịp đập và độ co',
              'The heart and vessels changing their beat and tone',
            ),
            group: 'thuc-hien',
            why: L(
              'Kết quả đáp ứng tác động ngược trở lại bộ phận tiếp nhận: liên hệ ngược.',
              'The response acts back on the receptor: feedback.',
            ),
          },
        ],
      },
    ],
  },
};
