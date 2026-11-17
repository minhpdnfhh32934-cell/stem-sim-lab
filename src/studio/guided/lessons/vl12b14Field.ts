import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * VL12 KNTT Bài 14 "Từ trường" (printed pages 56–60), in SimLab's own words. Checked against the
 * pages on 17/11/2026: magnetic interactions (Hình 14.1–14.3 and their questions, tr. 56), the
 * magnetic field and its basic property, the uniform field (tr. 57), iron-filing patterns (Hình
 * 14.4–14.7), field lines and their properties, the right-hand grip rule (Hình 14.8–14.10,
 * tr. 59–60). VL12-GL-3.
 */
export const vl12b14Field: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'physics',
  id: 'guided.vl12-magnetic-field',
  topic: 'magneticField',
  title: L('Từ trường và đường sức từ', 'Magnetic field and field lines'),
  objectives: [
    L(
      'Dự đoán kim nam châm đặt gần dây dẫn thay đổi thế nào khi đổi chiều dòng điện.',
      'Predict what a compass needle near a wire does when the current is reversed.',
    ),
    L(
      'Ghép mỗi loại tương tác từ với thí nghiệm cho thấy nó.',
      'Match each kind of magnetic interaction with the experiment that shows it.',
    ),
    L(
      'Nhận ra các đặc điểm của đường sức từ và hình dạng đường sức của các nguồn từ trường.',
      'Recognise the properties of field lines and the field-line shapes of the sources.',
    ),
  ],
  hints: [
    L(
      'Từ trường của dòng điện có chiều phụ thuộc chiều dòng điện (quy tắc nắm bàn tay phải).',
      'The direction of a current’s field depends on the current’s direction (right-hand grip rule).',
    ),
    L(
      'Kim nam châm thử nằm cân bằng theo phương của vectơ cảm ứng từ tại chỗ đặt nó.',
      'A test compass needle settles along the field at the place where it sits.',
    ),
  ],
  questions: [
    L(
      'Đặt một kim nam châm nhỏ trên mặt phẳng vuông góc với một dòng điện thẳng. Làm thế nào biết được chiều của dòng điện từ hướng của kim?',
      'A small compass lies on a plane perpendicular to a straight current. How can the needle tell the current’s direction?',
    ),
  ],
  expectedConclusion: L(
    'Từ trường tồn tại xung quanh nam châm và dòng điện; tính chất cơ bản của nó là tác dụng lực từ lên nam châm, dòng điện hay hạt mang điện chuyển động đặt trong nó. Tại mỗi điểm, từ trường được đặc trưng bằng vectơ cảm ứng từ, có phương của kim nam châm thử nằm cân bằng và chiều từ cực Nam sang cực Bắc của kim. Đường sức từ là những đường cong khép kín, tiếp tuyến tại mỗi điểm trùng phương của vectơ cảm ứng từ; qua mỗi điểm chỉ có một đường sức, nơi từ trường mạnh thì đường sức dày hơn. Chiều đường sức từ của dòng điện thẳng, dòng điện tròn và ống dây xác định bằng quy tắc nắm bàn tay phải.',
    'A magnetic field exists around magnets and currents; its basic property is to exert a magnetic force on a magnet, a current or a moving charge placed in it. At each point it is described by the field vector, along a test needle at rest and pointing from the needle’s south pole to its north pole. Field lines are closed curves whose tangent at each point is along the field; only one line passes through each point, and they are denser where the field is stronger. The direction of the lines of a straight current, a loop or a solenoid follows the right-hand grip rule.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu các thí nghiệm và khái niệm như sách giáo khoa; SimLab không tính cảm ứng từ ở đây.',
      'The lesson gives only the experiments and ideas, as the textbook does; SimLab computes no field here.',
    ),
  ],
  limits: [
    L(
      'Độ lớn cảm ứng từ và lực từ lên dây dẫn được tính trong bài “Lực từ và cảm ứng từ”.',
      'The field strength and the force on a wire are computed in the lesson “Magnetic force and magnetic field”.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'VL12', lesson: 14 },
    question: L(
      'Một kim nam châm đặt dưới một dây dẫn thẳng bị lệch khỏi phương ban đầu khi có dòng điện chạy qua dây. Nếu đổi chiều dòng điện thì kim nam châm thế nào?',
      'A compass needle under a straight wire turns away from its first direction when a current flows. If the current is reversed, what does the needle do?',
    ),
    choices: [
      { id: 'nguoc', text: L('Lệch theo chiều ngược lại', 'It turns the other way') },
      { id: 'nhu-cu', text: L('Lệch như trước', 'It turns the same way as before') },
      { id: 'khong-lech', text: L('Không lệch nữa', 'It no longer turns') },
      { id: 'quay', text: L('Quay tròn mãi', 'It keeps spinning') },
    ],
    answer: 'nguoc',
    answerWhy: L(
      'Từ trường của dòng điện đổi chiều khi dòng điện đổi chiều, nên lực từ tác dụng lên kim nam châm đổi chiều và kim lệch theo chiều ngược lại.',
      'The current’s field reverses with the current, so the force on the needle reverses and it turns the other way.',
    ),
    activities: [
      {
        kind: 'match',
        id: 'tuong-tac',
        prompt: L(
          'Ghép mỗi loại tương tác từ với thí nghiệm cho thấy nó.',
          'Match each kind of magnetic interaction with the experiment that shows it.',
        ),
        pairs: [
          {
            id: 'nc-nc',
            left: L('Nam châm với nam châm', 'Magnet with magnet'),
            right: L(
              'Đưa hai cực cùng tên lại gần thì chúng đẩy nhau, khác tên thì hút nhau',
              'Like poles brought together repel, unlike poles attract',
            ),
            why: L(
              'Thí nghiệm đưa hai thanh nam châm lại gần kim nam châm trong sách.',
              'The book’s experiment with two bar magnets and a needle.',
            ),
          },
          {
            id: 'dd-nc',
            left: L('Dòng điện với nam châm', 'Current with magnet'),
            right: L(
              'Kim nam châm đặt gần dây dẫn bị lệch khi có dòng điện chạy qua dây',
              'A needle near a wire turns when a current flows',
            ),
            why: L(
              'Thí nghiệm Oersted: dòng điện tác dụng lực lên nam châm.',
              'Oersted’s experiment: a current pushes on a magnet.',
            ),
          },
          {
            id: 'dd-dd',
            left: L('Dòng điện với dòng điện', 'Current with current'),
            right: L(
              'Hai tấm kim loại mỏng có dòng điện ngược chiều chạy qua thì đẩy nhau',
              'Two thin metal strips with opposite currents push apart',
            ),
            why: L(
              'Thí nghiệm hai tấm kim loại mỏng trong sách: hai dòng điện tác dụng lực từ lên nhau.',
              'The book’s two thin strips: two currents push on each other.',
            ),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'duong-suc',
        prompt: L(
          'Xếp mỗi câu vào nhóm đúng hoặc sai với đường sức từ.',
          'Put each statement under true or false for field lines.',
        ),
        groups: [
          { id: 'dung', label: L('Đúng với đường sức từ', 'True of field lines') },
          { id: 'sai', label: L('Không đúng', 'Not true') },
        ],
        items: [
          {
            id: 'mot-duong',
            text: L(
              'Qua mỗi điểm trong từ trường chỉ vẽ được một đường sức từ',
              'Only one field line passes through each point',
            ),
            group: 'dung',
            why: L(
              'Tại mỗi điểm, vectơ cảm ứng từ chỉ có một phương.',
              'At each point the field has only one direction.',
            ),
          },
          {
            id: 'khep-kin',
            text: L('Là những đường cong khép kín', 'They are closed curves'),
            group: 'dung',
            why: L(
              'Đường sức từ không có điểm đầu, điểm cuối.',
              'Field lines have no start or end.',
            ),
          },
          {
            id: 'day',
            text: L(
              'Nơi từ trường mạnh hơn thì đường sức vẽ dày hơn',
              'They are drawn denser where the field is stronger',
            ),
            group: 'dung',
            why: L(
              'Độ dày của đường sức cho biết từ trường mạnh hay yếu.',
              'Their density shows how strong the field is.',
            ),
          },
          {
            id: 'bac-nam',
            text: L(
              'Ở ngoài nam châm, đường sức đi ra từ cực Bắc, đi vào cực Nam',
              'Outside a magnet they leave the north pole and enter the south pole',
            ),
            group: 'dung',
            why: L(
              'Chiều đường sức là chiều của vectơ cảm ứng từ.',
              'Their direction is the field’s direction.',
            ),
          },
          {
            id: 'cat-nhau',
            text: L('Hai đường sức từ có thể cắt nhau', 'Two field lines may cross'),
            group: 'sai',
            why: L(
              'Nếu cắt nhau thì tại giao điểm từ trường có hai phương, điều này không thể xảy ra.',
              'At a crossing the field would have two directions, which cannot happen.',
            ),
          },
          {
            id: 'thua',
            text: L(
              'Nơi từ trường mạnh hơn thì đường sức vẽ thưa hơn',
              'They are drawn sparser where the field is stronger',
            ),
            group: 'sai',
            why: L('Ngược lại: từ trường mạnh thì đường sức dày.', 'The other way round.'),
          },
        ],
      },
      {
        kind: 'match',
        id: 'nguon',
        prompt: L(
          'Ghép mỗi nguồn từ trường với hình dạng đường sức từ của nó.',
          'Match each source with the shape of its field lines.',
        ),
        pairs: [
          {
            id: 'thang',
            left: L('Dòng điện thẳng', 'Straight current'),
            right: L(
              'Những đường tròn đồng tâm bao quanh dây, chiều theo quy tắc nắm bàn tay phải',
              'Circles around the wire, directed by the right-hand grip rule',
            ),
            why: L(
              'Ngón cái theo chiều dòng điện, các ngón khum lại chỉ chiều đường sức.',
              'The thumb along the current, the curled fingers give the lines’ direction.',
            ),
          },
          {
            id: 'ong-day',
            left: L('Dòng điện trong ống dây', 'Current in a solenoid'),
            right: L(
              'Bên trong ống gần như song song, bên ngoài giống của nam châm thẳng',
              'Nearly parallel inside, like a bar magnet’s outside',
            ),
            why: L(
              'Mạt sắt trong và quanh ống dây mang dòng điện cho thấy điều này.',
              'Iron filings in and around a current-carrying solenoid show it.',
            ),
          },
          {
            id: 'chu-u',
            left: L('Nam châm hình chữ U', 'Horseshoe magnet'),
            right: L(
              'Giữa hai cực, đường sức gần như song song và cách đều',
              'Between the poles, nearly parallel and evenly spaced',
            ),
            why: L(
              'Ở khoảng giữa hai cực, từ trường gần như là từ trường đều.',
              'Between the poles the field is nearly uniform.',
            ),
          },
        ],
      },
    ],
  },
};
