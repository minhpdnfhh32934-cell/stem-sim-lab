import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * HH12 KNTT Bài 20 "Kim loại trong tự nhiên và phương pháp tách kim loại" (printed pages 94–98),
 * in SimLab's own words. Checked against the pages on 17/11/2026: metals in nature and the ores of
 * Bảng 20.1 (tr. 94), the principle Mⁿ⁺ + ne → M, electrolysis of molten compounds for active
 * metals (tr. 95), the thermal method and electrolysis of solutions (tr. 96), the hydrometallurgical
 * method and recycling (tr. 96–97). HH12-GL-9.
 */
export const hh12b20Extraction: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'chemistry',
  id: 'guided.hh12-metal-extraction',
  topic: 'metalExtraction',
  title: L(
    'Kim loại trong tự nhiên và phương pháp tách kim loại',
    'Metals in nature and their extraction',
  ),
  objectives: [
    L(
      'Dự đoán phương pháp sản xuất nhôm trong công nghiệp.',
      'Predict how aluminium is made in industry.',
    ),
    L(
      'Ghép mỗi quặng với thành phần chính của nó; phân loại các phương pháp tách kim loại.',
      'Match each ore with its main component; sort the ways of extracting metals.',
    ),
    L('Sắp xếp các giai đoạn tái chế kim loại.', 'Put the stages of recycling metals in order.'),
  ],
  hints: [
    L(
      'Nguyên tắc tách kim loại là khử ion kim loại thành nguyên tử: Mⁿ⁺ + ne → M.',
      'Extracting a metal means reducing its ion to the atom: Mⁿ⁺ + ne → M.',
    ),
    L(
      'Kim loại hoạt động hóa học càng mạnh thì ion của nó càng khó bị khử.',
      'The more active the metal, the harder its ion is to reduce.',
    ),
  ],
  questions: [
    L(
      'Vì sao cần phải tái chế sắt, nhôm, đồng thay vì chỉ khai thác quặng mới?',
      'Why recycle iron, aluminium and copper instead of only mining new ore?',
    ),
  ],
  expectedConclusion: L(
    'Trong tự nhiên, hầu hết kim loại tồn tại ở dạng hợp chất trong quặng; chỉ một vài kim loại kém hoạt động như vàng, bạc, platinum có ở dạng đơn chất. Nguyên tắc tách kim loại là khử ion kim loại thành nguyên tử. Kim loại hoạt động hóa học mạnh (K, Na, Ca, Mg, Al) được điều chế bằng điện phân nóng chảy hợp chất của chúng; kim loại hoạt động trung bình, yếu được điều chế bằng nhiệt luyện, điện phân dung dịch muối hoặc thủy luyện. Sắt, nhôm, đồng được dùng nhiều nhất nên cần được tái chế nhiều nhất, góp phần giảm ô nhiễm môi trường.',
    'In nature most metals are found as compounds in ores; only a few unreactive metals such as gold, silver and platinum occur free. Extracting a metal means reducing its ion to the atom. Very active metals (K, Na, Ca, Mg, Al) are made by electrolysing their molten compounds; moderately and weakly active metals by the thermal method, electrolysis of salt solutions or the hydrometallurgical method. Iron, aluminium and copper are used most, so they most need recycling, which also cuts pollution.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu phương pháp và ví dụ như sách giáo khoa; SimLab không tính lượng chất ở đây.',
      'The lesson gives only methods and examples, as the textbook does; SimLab computes no amounts here.',
    ),
  ],
  limits: [
    L(
      'Phương trình của từng quá trình tách kim loại được viết trong sách; bài này chỉ dùng tên.',
      'The book writes the equation of each process; this lesson uses the names only.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'HH12', lesson: 20 },
    question: L(
      'Trong công nghiệp, nhôm được sản xuất bằng phương pháp nào?',
      'How is aluminium made in industry?',
    ),
    choices: [
      {
        id: 'dpnc',
        text: L('Điện phân nóng chảy aluminium oxide', 'Electrolysing molten aluminium oxide'),
      },
      {
        id: 'nhiet-luyen',
        text: L(
          'Khử aluminium oxide bằng CO ở nhiệt độ cao',
          'Reducing aluminium oxide with CO when hot',
        ),
      },
      {
        id: 'dpdd',
        text: L('Điện phân dung dịch muối nhôm', 'Electrolysing an aluminium salt solution'),
      },
      {
        id: 'thuy-luyen',
        text: L(
          'Dùng sắt khử ion nhôm trong dung dịch',
          'Reducing aluminium ions in solution with iron',
        ),
      },
    ],
    answer: 'dpnc',
    answerWhy: L(
      'Nhôm là kim loại hoạt động hóa học mạnh nên được điều chế bằng điện phân nóng chảy hợp chất của nó; aluminium oxide được trộn với cryolite để hạ nhiệt độ nóng chảy.',
      'Aluminium is very active, so it is made by electrolysing a molten compound; the oxide is mixed with cryolite to lower its melting point.',
    ),
    activities: [
      {
        kind: 'match',
        id: 'quang',
        prompt: L(
          'Ghép mỗi quặng trong bảng của sách với thành phần chính của nó.',
          'Match each ore of the book’s table with its main component.',
        ),
        pairs: [
          {
            id: 'bauxite',
            left: L('Bauxite', 'Bauxite'),
            right: L('Al₂O₃ ngậm nước', 'Hydrated Al₂O₃'),
            why: L('Quặng của nhôm.', 'An aluminium ore.'),
          },
          {
            id: 'zinc-blende',
            left: L('Zinc blende', 'Zinc blende'),
            right: L('ZnS', 'ZnS'),
            why: L('Quặng của kẽm.', 'A zinc ore.'),
          },
          {
            id: 'hematite',
            left: L('Hematite', 'Haematite'),
            right: L('Fe₂O₃', 'Fe₂O₃'),
            why: L('Quặng của sắt.', 'An iron ore.'),
          },
          {
            id: 'pyrite',
            left: L('Pyrite', 'Pyrite'),
            right: L('FeS₂', 'FeS₂'),
            why: L('Quặng của sắt.', 'An iron ore.'),
          },
          {
            id: 'chalcopyrite',
            left: L('Chalcopyrite', 'Chalcopyrite'),
            right: L('CuFeS₂', 'CuFeS₂'),
            why: L('Quặng của đồng.', 'A copper ore.'),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'phuong-phap',
        prompt: L(
          'Xếp mỗi ví dụ trong sách vào phương pháp tách kim loại của nó.',
          'Put each example from the book under its method.',
        ),
        groups: [
          { id: 'dpnc', label: L('Điện phân nóng chảy', 'Molten electrolysis') },
          { id: 'nhiet-luyen', label: L('Nhiệt luyện', 'Thermal method') },
          { id: 'dpdd', label: L('Điện phân dung dịch', 'Solution electrolysis') },
          { id: 'thuy-luyen', label: L('Thủy luyện', 'Hydrometallurgy') },
        ],
        items: [
          {
            id: 'mg',
            text: L('Magnesium từ MgCl₂ nóng chảy', 'Magnesium from molten MgCl₂'),
            group: 'dpnc',
            why: L('Kim loại hoạt động mạnh.', 'A very active metal.'),
          },
          {
            id: 'al',
            text: L('Nhôm từ quặng bauxite', 'Aluminium from bauxite'),
            group: 'dpnc',
            why: L(
              'Điện phân aluminium oxide nóng chảy.',
              'Molten aluminium oxide is electrolysed.',
            ),
          },
          {
            id: 'zn',
            text: L('Kẽm: khử ZnO bằng than cốc', 'Zinc: ZnO reduced with coke'),
            group: 'nhiet-luyen',
            why: L('Khử oxide ở nhiệt độ cao.', 'An oxide reduced when hot.'),
          },
          {
            id: 'fe',
            text: L('Sắt: khử Fe₂O₃ bằng CO', 'Iron: Fe₂O₃ reduced with CO'),
            group: 'nhiet-luyen',
            why: L('Khử oxide ở nhiệt độ cao.', 'An oxide reduced when hot.'),
          },
          {
            id: 'cu-dd',
            text: L('Đồng từ dung dịch CuCl₂', 'Copper from CuCl₂ solution'),
            group: 'dpdd',
            why: L('Kim loại hoạt động yếu.', 'A weakly active metal.'),
          },
          {
            id: 'cu-fe',
            text: L('Đồng: dùng sắt khử ion Cu²⁺', 'Copper: Cu²⁺ reduced by iron'),
            group: 'thuy-luyen',
            why: L(
              'Kim loại mạnh hơn khử ion trong dung dịch.',
              'A stronger metal reduces the ion in solution.',
            ),
          },
          {
            id: 'au',
            text: L(
              'Vàng: hòa tan bằng dung dịch KCN rồi dùng kẽm',
              'Gold: dissolved with KCN solution, then zinc',
            ),
            group: 'thuy-luyen',
            why: L('Thường dùng cho kim loại quý.', 'Used for precious metals.'),
          },
        ],
      },
      {
        kind: 'order',
        id: 'tai-che',
        prompt: L(
          'Sắp xếp các giai đoạn tái chế kim loại.',
          'Put the stages of recycling metals in order.',
        ),
        items: [
          {
            id: 'thu-gom',
            text: L('Thu gom, phân loại', 'Collect and sort'),
            why: L('Giai đoạn đầu tiên.', 'The first stage.'),
          },
          {
            id: 'xu-li',
            text: L('Xử lí sơ bộ', 'Pre-treat'),
            why: L('Chuẩn bị phế liệu.', 'Prepare the scrap.'),
          },
          {
            id: 'phoi-tron',
            text: L('Phối trộn phế liệu', 'Blend the scrap'),
            why: L('Trước khi nấu chảy.', 'Before melting.'),
          },
          {
            id: 'nau-chay',
            text: L('Nấu chảy', 'Melt'),
            why: L('Kim loại chuyển sang thể lỏng.', 'The metal becomes liquid.'),
          },
          {
            id: 'tinh-che',
            text: L('Tinh chế', 'Refine'),
            why: L('Loại bỏ tạp chất.', 'Impurities are removed.'),
          },
          {
            id: 'duc',
            text: L('Đúc, chế tạo, gia công', 'Cast, make and shape'),
            why: L('Giai đoạn cuối cùng.', 'The last stage.'),
          },
        ],
      },
    ],
  },
};
