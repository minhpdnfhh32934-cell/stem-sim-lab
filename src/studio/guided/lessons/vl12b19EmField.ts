import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * VL12 KNTT Bài 19 "Điện từ trường. Mô hình sóng điện từ" (printed pages 82–85), in SimLab's own
 * words. Checked against the pages on 17/11/2026: a changing magnetic field makes a rotational
 * electric field (Hình 19.1, Maxwell), a changing electric field makes a magnetic field (the
 * displacement current in a capacitor, Hình 19.3), the electromagnetic field (Hình 19.4), how an
 * electromagnetic wave forms and travels (Hình 19.5, 19.6), and how it differs from a mechanical
 * wave (tr. 85). VL12-GL-5.
 */
export const vl12b19EmField: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'physics',
  id: 'guided.vl12-em-field',
  topic: 'electromagneticField',
  title: L('Điện từ trường và mô hình sóng điện từ', 'The electromagnetic field and wave model'),
  objectives: [
    L(
      'Dự đoán sóng điện từ có truyền được trong chân không không, và giải thích bằng điện từ trường.',
      'Predict whether an electromagnetic wave crosses a vacuum, and explain it with the electromagnetic field.',
    ),
    L(
      'Ghép mỗi kết luận của Maxwell với hiện tượng tương ứng; sắp xếp các bước tạo thành sóng điện từ.',
      'Match Maxwell’s conclusions with the phenomena; order the steps by which a wave forms.',
    ),
    L(
      'Phân biệt tính chất của sóng điện từ với sóng cơ.',
      'Tell the properties of electromagnetic waves from those of mechanical waves.',
    ),
  ],
  hints: [
    L(
      'Điện trường biến thiên và từ trường biến thiên sinh ra nhau.',
      'A changing electric field and a changing magnetic field make each other.',
    ),
    L(
      'Sóng cơ là dao động của các phần tử vật chất; sóng điện từ thì không cần phần tử vật chất nào.',
      'A mechanical wave is matter vibrating; an electromagnetic wave needs no matter at all.',
    ),
  ],
  questions: [
    L(
      'Điện trường xoáy khác điện trường của một điện tích đứng yên ở điểm nào?',
      'How does a rotational electric field differ from the field of a charge at rest?',
    ),
  ],
  expectedConclusion: L(
    'Theo Maxwell, từ trường biến thiên theo thời gian sinh ra trong không gian xung quanh một điện trường xoáy có đường sức khép kín, và ngược lại điện trường biến thiên theo thời gian sinh ra một từ trường. Hai trường biến thiên này cùng tồn tại, chuyển hóa lẫn nhau trong một trường thống nhất là điện từ trường. Điện từ trường lan truyền trong không gian là sóng điện từ: tại mỗi điểm vectơ cường độ điện trường và vectơ cảm ứng từ vuông góc với nhau và vuông góc với phương truyền (sóng ngang), biến thiên điều hòa cùng pha. Sóng điện từ truyền được cả trong chân không với tốc độ ánh sáng, mang năng lượng và cũng phản xạ, khúc xạ, giao thoa, nhiễu xạ như sóng cơ.',
    'In Maxwell’s view a magnetic field that changes in time makes a rotational electric field with closed lines around it, and an electric field that changes in time makes a magnetic field. The two changing fields exist together and turn into each other in one field, the electromagnetic field. The electromagnetic field travelling through space is an electromagnetic wave: at each point the electric and magnetic vectors are perpendicular to each other and to the direction of travel (a transverse wave) and oscillate in phase. It crosses even a vacuum at the speed of light, carries energy, and reflects, refracts, interferes and diffracts like a mechanical wave.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu mô hình như sách giáo khoa; SimLab không tính trường hay bước sóng ở đây.',
      'The lesson gives only the model, as the textbook does; SimLab computes no fields or wavelengths here.',
    ),
  ],
  limits: [
    L(
      'Bước sóng λ = c/f và thang sóng điện từ được tính trong bài “Sóng điện từ”.',
      'The wavelength λ = c/f and the electromagnetic spectrum are computed in the lesson “Electromagnetic waves”.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'VL12', lesson: 19 },
    question: L(
      'Ánh sáng Mặt Trời là sóng điện từ và đến được Trái Đất qua khoảng không gần như chân không. Sóng điện từ có truyền được trong chân không không?',
      'Sunlight is an electromagnetic wave and reaches the Earth across nearly empty space. Can an electromagnetic wave cross a vacuum?',
    ),
    choices: [
      { id: 'co', text: L('Có', 'Yes') },
      { id: 'khong', text: L('Không, cần có không khí', 'No, it needs air') },
      { id: 'ran', text: L('Chỉ truyền được trong chất rắn', 'Only through solids') },
    ],
    answer: 'co',
    answerWhy: L(
      'Sóng điện từ là điện từ trường lan truyền: điện trường biến thiên và từ trường biến thiên sinh ra nhau mà không cần phần tử vật chất nào dao động, nên truyền được cả trong chân không. Đây chính là điểm khác sóng cơ.',
      'An electromagnetic wave is the electromagnetic field travelling: the changing electric and magnetic fields make each other without any matter vibrating, so it crosses even a vacuum. That is how it differs from a mechanical wave.',
    ),
    activities: [
      {
        kind: 'match',
        id: 'maxwell',
        prompt: L(
          'Ghép mỗi đại lượng hay khái niệm với điều đúng về nó.',
          'Match each quantity or idea with what is true of it.',
        ),
        pairs: [
          {
            id: 'b-bien-thien',
            left: L('Từ trường biến thiên theo thời gian', 'A magnetic field changing in time'),
            right: L(
              'Sinh ra điện trường xoáy có đường sức khép kín',
              'Makes a rotational electric field with closed lines',
            ),
            why: L(
              'Thí nghiệm nam châm rơi qua ống dây: điện trường xoáy xuất hiện cả khi không có ống dây.',
              'The magnet dropped through a coil: the rotational field appears even without the coil.',
            ),
          },
          {
            id: 'e-bien-thien',
            left: L('Điện trường biến thiên theo thời gian', 'An electric field changing in time'),
            right: L('Sinh ra từ trường', 'Makes a magnetic field'),
            why: L(
              'Kết luận của Maxwell về mối liên hệ hai chiều giữa hai trường.',
              'Maxwell’s conclusion that the link runs both ways.',
            ),
          },
          {
            id: 'dong-dich',
            left: L('Dòng điện dịch', 'Displacement current'),
            right: L(
              'Điện trường biến thiên giữa hai bản tụ điện, tương đương một dòng điện',
              'The changing field between capacitor plates, acting like a current',
            ),
            why: L(
              'Khi tụ điện đang tích điện hay phóng điện, điện tích trên các bản thay đổi.',
              'While a capacitor charges or discharges, the charge on its plates changes.',
            ),
          },
          {
            id: 'dien-tu-truong',
            left: L('Điện từ trường', 'Electromagnetic field'),
            right: L(
              'Điện trường và từ trường biến thiên cùng tồn tại, chuyển hóa lẫn nhau',
              'Changing electric and magnetic fields existing together, turning into each other',
            ),
            why: L(
              'Hai trường không tách rời nhau mà là hai mặt của một trường thống nhất.',
              'The two fields are not separate but two sides of one field.',
            ),
          },
        ],
      },
      {
        kind: 'order',
        id: 'tao-thanh',
        prompt: L(
          'Sắp xếp các bước tạo thành sóng điện từ theo đúng thứ tự.',
          'Put the steps by which an electromagnetic wave forms in order.',
        ),
        items: [
          {
            id: 'e-tai-o',
            text: L(
              'Tại một điểm có điện trường biến thiên',
              'At one point there is a changing electric field',
            ),
            why: L('Đây là bước khởi đầu.', 'This is where it starts.'),
          },
          {
            id: 'b-lan-can',
            text: L(
              'Ở vùng lân cận xuất hiện từ trường biến thiên',
              'A changing magnetic field appears nearby',
            ),
            why: L(
              'Điện trường biến thiên sinh ra từ trường.',
              'A changing electric field makes a magnetic field.',
            ),
          },
          {
            id: 'e-xa-hon',
            text: L(
              'Từ trường biến thiên này lại sinh ra điện trường biến thiên ở vùng xa hơn',
              'That changing magnetic field makes a changing electric field farther out',
            ),
            why: L(
              'Từ trường biến thiên sinh ra điện trường xoáy.',
              'A changing magnetic field makes a rotational electric field.',
            ),
          },
          {
            id: 'lan-truyen',
            text: L(
              'Cứ như thế điện từ trường lan truyền trong không gian thành sóng điện từ',
              'And so on: the electromagnetic field travels out as a wave',
            ),
            why: L(
              'Quá trình lan truyền này gọi là sóng điện từ.',
              'This travel is the electromagnetic wave.',
            ),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'so-sanh',
        prompt: L(
          'Xếp mỗi tính chất vào sóng điện từ, sóng cơ hoặc cả hai.',
          'Put each property under electromagnetic waves, mechanical waves or both.',
        ),
        groups: [
          { id: 'dien-tu', label: L('Sóng điện từ', 'Electromagnetic waves') },
          { id: 'co', label: L('Sóng cơ', 'Mechanical waves') },
          { id: 'ca-hai', label: L('Cả hai', 'Both') },
        ],
        items: [
          {
            id: 'chan-khong',
            text: L('Truyền được trong chân không', 'Crosses a vacuum'),
            group: 'dien-tu',
            why: L('Không cần môi trường vật chất.', 'It needs no matter.'),
          },
          {
            id: 'moi-truong',
            text: L('Cần môi trường vật chất để truyền', 'Needs matter to travel'),
            group: 'co',
            why: L(
              'Sóng cơ là dao động lan truyền của các phần tử vật chất.',
              'It is matter’s vibration travelling.',
            ),
          },
          {
            id: 'song-ngang',
            text: L(
              'Luôn là sóng ngang: E và B vuông góc với phương truyền',
              'Always transverse: E and B perpendicular to the travel',
            ),
            group: 'dien-tu',
            why: L(
              'Vectơ E và vectơ B vuông góc với nhau và với phương truyền.',
              'E and B are perpendicular to each other and to the travel.',
            ),
          },
          {
            id: 'ngang-doc',
            text: L('Có thể là sóng ngang hoặc sóng dọc', 'Can be transverse or longitudinal'),
            group: 'co',
            why: L(
              'Ví dụ sóng âm trong không khí là sóng dọc.',
              'Sound in air, for example, is longitudinal.',
            ),
          },
          {
            id: 'phan-xa',
            text: L(
              'Phản xạ, khúc xạ, giao thoa, nhiễu xạ',
              'Reflects, refracts, interferes, diffracts',
            ),
            group: 'ca-hai',
            why: L(
              'Sách nêu sóng điện từ có các tính chất này giống như sóng cơ.',
              'The book says electromagnetic waves share these with mechanical waves.',
            ),
          },
          {
            id: 'nang-luong',
            text: L('Mang theo năng lượng', 'Carries energy'),
            group: 'ca-hai',
            why: L(
              'Khi lan truyền, cả sóng cơ và sóng điện từ đều truyền năng lượng đi xa.',
              'As they travel, both kinds of wave carry energy away.',
            ),
          },
        ],
      },
    ],
  },
};
