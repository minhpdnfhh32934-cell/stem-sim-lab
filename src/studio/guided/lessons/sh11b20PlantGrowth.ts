import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH11 KNTT Bài 20 "Sinh trưởng và phát triển ở thực vật" (printed pages 129–140), in SimLab's own
 * words. Checked against the pages on 17/11/2026: the meristems (đỉnh, bên, lóng) and their places
 * (Hình 20.5), primary and secondary growth (Hình 20.6–20.7), the two groups of plant hormones
 * (kích thích: auxin, gibberellin, cytokinin; ức chế: abscisic acid, ethylene) and their effects
 * (Hình 20.8–20.11). The prediction follows the secondary growth of woody stems. SH11-GL-15.
 */
export const sh11b20PlantGrowth: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh11-plantgrowth',
  topic: 'plantGrowth',
  title: L('Sinh trưởng và phát triển ở thực vật', 'Growth and development in plants'),
  objectives: [
    L(
      'Dự đoán thân cây gỗ to ra về đường kính nhờ đâu.',
      'Predict what makes a tree trunk thicker.',
    ),
    L(
      'Ghép mỗi loại mô phân sinh với vị trí và vai trò của nó.',
      'Match each kind of meristem with its place and role.',
    ),
    L(
      'Phân loại hormone thực vật thành kích thích và ức chế sinh trưởng; ghép mỗi hormone với tác dụng của nó.',
      'Sort plant hormones into growth promoters and inhibitors; match each hormone with its effect.',
    ),
  ],
  hints: [
    L(
      'Mô phân sinh là nhóm tế bào chưa phân hóa, phân chia suốt đời sống của cây.',
      'A meristem is a group of undifferentiated cells that keep dividing throughout the plant’s life.',
    ),
    L(
      'Sinh trưởng sơ cấp làm cây cao lên và rễ dài ra; sinh trưởng thứ cấp làm thân, rễ to ra.',
      'Primary growth makes the plant taller and the roots longer; secondary growth makes stems and roots thicker.',
    ),
  ],
  questions: [
    L(
      'Vì sao người ta dùng gibberellin cho nho không hạt?',
      'Why is gibberellin used on seedless grapes?',
    ),
  ],
  expectedConclusion: L(
    'Thực vật sinh trưởng tại các mô phân sinh: mô phân sinh đỉnh ở ngọn, đỉnh cành, chóp rễ làm cây cao lên, rễ dài ra (sinh trưởng sơ cấp); mô phân sinh bên ở cây hai lá mầm làm thân, rễ to ra (sinh trưởng thứ cấp, tạo vòng gỗ); mô phân sinh lóng ở cây một lá mầm làm lóng dài ra. Hormone thực vật là chất hữu cơ tổng hợp với lượng nhỏ, điều tiết sinh trưởng: auxin, gibberellin, cytokinin kích thích; abscisic acid, ethylene ức chế. Các hormone phối hợp với nhau, và con người dùng hormone tổng hợp để điều khiển sinh trưởng của cây trồng.',
    'Plants grow at their meristems: apical meristems at shoot and branch tips and root tips make the plant taller and the roots longer (primary growth); lateral meristems in dicots make stems and roots thicker (secondary growth, forming growth rings); intercalary meristems in monocots lengthen the internodes. Plant hormones are organic substances made in small amounts that regulate growth: auxin, gibberellin and cytokinin promote it; abscisic acid and ethylene inhibit it. The hormones act together, and people use synthetic hormones to control crop growth.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu các khái niệm và tác dụng như sách giáo khoa; SimLab không tính nồng độ hormone.',
      'The lesson gives only the ideas and effects, as the textbook does; SimLab computes no hormone concentration.',
    ),
  ],
  limits: [
    L(
      'Các đồ thị, số liệu về ảnh hưởng của nước, ánh sáng, nhiệt độ và tương quan hormone trong nuôi cấy mô không có trong bài học này.',
      'The book’s graphs and data on water, light, temperature and hormone ratios in tissue culture are not part of this lesson.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH11', lesson: 20 },
    question: L(
      'Thân cây gỗ lâu năm to ra về đường kính qua từng năm. Điều này chủ yếu nhờ đâu?',
      'The trunk of an old woody tree gets thicker year by year. What mainly causes this?',
    ),
    choices: [
      {
        id: 'ben',
        text: L(
          'Mô phân sinh bên (tầng sinh mạch, tầng sinh bần) phân chia',
          'Division of the lateral meristems (vascular cambium, cork cambium)',
        ),
      },
      {
        id: 'dinh',
        text: L(
          'Mô phân sinh đỉnh ở ngọn cây phân chia',
          'Division of the apical meristem at the tip',
        ),
      },
      { id: 'long', text: L('Mô phân sinh lóng phân chia', 'Division of intercalary meristems') },
      {
        id: 'nuoc',
        text: L('Tế bào hút nhiều nước nên phình ra', 'Cells take up a lot of water and swell'),
      },
    ],
    answer: 'ben',
    answerWhy: L(
      'Đó là sinh trưởng thứ cấp, chỉ có ở cây hai lá mầm. Tầng sinh mạch tạo mạch gỗ thứ cấp ở phía trong và mạch rây thứ cấp ở phía ngoài; tầng sinh bần tạo lớp bần mới. Qua các năm, các lớp gỗ thứ cấp tạo nên vòng gỗ.',
      'This is secondary growth, found only in dicots. The vascular cambium makes secondary xylem inside and secondary phloem outside; the cork cambium makes new cork. Over the years the layers of secondary xylem form growth rings.',
    ),
    activities: [
      {
        kind: 'match',
        id: 'mo-phan-sinh',
        prompt: L(
          'Ghép mỗi loại mô phân sinh với vị trí và vai trò của nó.',
          'Match each meristem with its place and role.',
        ),
        pairs: [
          {
            id: 'dinh-ngon',
            left: L(
              'Mô phân sinh đỉnh ở ngọn cây, đỉnh cành',
              'Apical meristem at shoot and branch tips',
            ),
            right: L(
              'Làm tăng chiều cao của cây, chiều dài cành',
              'Makes the plant and its branches longer',
            ),
            why: L('Có ở cả cây một lá mầm và hai lá mầm.', 'Found in both monocots and dicots.'),
          },
          {
            id: 'dinh-re',
            left: L('Mô phân sinh đỉnh ở chóp rễ', 'Apical meristem at the root tip'),
            right: L('Làm tăng chiều dài của rễ', 'Makes the root longer'),
            why: L(
              'Cùng với đỉnh ngọn tạo sinh trưởng sơ cấp.',
              'With the shoot tip it gives primary growth.',
            ),
          },
          {
            id: 'ben-than',
            left: L('Mô phân sinh bên', 'Lateral meristem'),
            right: L('Làm tăng đường kính của thân và rễ', 'Makes stems and roots thicker'),
            why: L('Chỉ có ở cây hai lá mầm.', 'Found only in dicots.'),
          },
          {
            id: 'long',
            left: L('Mô phân sinh lóng', 'Intercalary meristem'),
            right: L(
              'Làm tăng chiều dài của lóng ở cây một lá mầm',
              'Lengthens the internodes of monocots',
            ),
            why: L(
              'Nhờ vậy thân lúa, ngô, cỏ vẫn cao lên khi đỉnh bị cắt bỏ.',
              'So rice, maize and grass stems still grow after their tips are cut.',
            ),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'nhom-hormone',
        prompt: L(
          'Xếp mỗi hormone vào nhóm kích thích hoặc ức chế sinh trưởng.',
          'Put each hormone under growth promoter or growth inhibitor.',
        ),
        groups: [
          { id: 'kich-thich', label: L('Kích thích sinh trưởng', 'Growth promoter') },
          { id: 'uc-che', label: L('Ức chế sinh trưởng', 'Growth inhibitor') },
        ],
        items: [
          {
            id: 'auxin',
            text: L('Auxin', 'Auxin'),
            group: 'kich-thich',
            why: L(
              'Kích thích phân bào, dãn dài tế bào.',
              'Promotes cell division and elongation.',
            ),
          },
          {
            id: 'gibberellin',
            text: L('Gibberellin', 'Gibberellin'),
            group: 'kich-thich',
            why: L(
              'Tăng chiều dài thân, lóng; kích thích nảy mầm.',
              'Lengthens stems and internodes; triggers germination.',
            ),
          },
          {
            id: 'cytokinin',
            text: L('Cytokinin', 'Cytokinin'),
            group: 'kich-thich',
            why: L('Kích thích phân chia tế bào.', 'Promotes cell division.'),
          },
          {
            id: 'aba',
            text: L('Abscisic acid', 'Abscisic acid'),
            group: 'uc-che',
            why: L(
              'Ức chế nảy mầm, thúc đẩy đóng khí khổng.',
              'Inhibits germination and closes stomata.',
            ),
          },
          {
            id: 'ethylene',
            text: L('Ethylene', 'Ethylene'),
            group: 'uc-che',
            why: L(
              'Thúc đẩy chín quả, rụng lá, hoa, quả.',
              'Speeds fruit ripening and the fall of leaves, flowers and fruit.',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'tac-dung',
        prompt: L(
          'Ghép mỗi hormone với một tác dụng của nó.',
          'Match each hormone with one of its effects.',
        ),
        pairs: [
          {
            id: 'auxin-uu-the',
            left: L('Auxin', 'Auxin'),
            right: L(
              'Tạo ưu thế ngọn, ức chế phát triển chồi bên',
              'Gives apical dominance and holds back side buds',
            ),
            why: L('Auxin còn điều chỉnh tính hướng động.', 'Auxin also controls tropisms.'),
          },
          {
            id: 'gib-nho',
            left: L('Gibberellin', 'Gibberellin'),
            right: L(
              'Làm tăng chiều dài cuống chùm nho không hạt',
              'Lengthens the stalks of seedless grape bunches',
            ),
            why: L(
              'Tạo không gian cho quả tăng kích thước.',
              'It gives the grapes room to grow bigger.',
            ),
          },
          {
            id: 'cyt-choi',
            left: L('Cytokinin', 'Cytokinin'),
            right: L(
              'Phối hợp với auxin để phân hóa chồi trong nuôi cấy mô',
              'Works with auxin to form shoots in tissue culture',
            ),
            why: L('Cytokinin còn làm chậm sự già hóa của cây.', 'Cytokinin also slows ageing.'),
          },
          {
            id: 'aba-khi-khong',
            left: L('Abscisic acid', 'Abscisic acid'),
            right: L(
              'Thúc đẩy đóng khí khổng, tăng khả năng chống chịu hạn',
              'Closes stomata and raises drought tolerance',
            ),
            why: L(
              'Được tổng hợp nhiều khi cây gặp hạn hán, ngập úng.',
              'Made in large amounts when the plant faces drought or flooding.',
            ),
          },
          {
            id: 'eth-chin',
            left: L('Ethylene', 'Ethylene'),
            right: L('Thúc đẩy sự chín của quả', 'Speeds fruit ripening'),
            why: L(
              'Là hormone thực vật duy nhất ở thể khí.',
              'It is the only plant hormone that is a gas.',
            ),
          },
        ],
      },
    ],
  },
};
