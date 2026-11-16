import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH10 KNTT Bài 20 "Sự đa dạng và phương pháp nghiên cứu vi sinh vật" (printed pages 116–121),
 * in SimLab's own words. Checked on 16/11/2026: the four nutrition types with only the example
 * groups of the book's table (Bảng 20), and the methods of part III (soi tươi, nhuộm Gram,
 * phân lập on solid agar, culture in liquid medium, biochemical / DNA–RNA analysis). SH10-GL-6.
 */
export const sh10b20MicrobeDiversity: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh10-microbe-diversity',
  topic: 'microbeDiversity',
  title: L(
    'Vi sinh vật: các kiểu dinh dưỡng và cách nghiên cứu',
    'Microbes: ways of feeding and ways of studying them',
  ),
  objectives: [
    L(
      'Dự đoán nấm men làm bánh mì lấy năng lượng và carbon từ đâu.',
      'Predict where baker’s yeast gets its energy and carbon.',
    ),
    L(
      'Xếp các nhóm vi sinh vật vào bốn kiểu dinh dưỡng.',
      'Sort groups of microbes into the four ways of feeding.',
    ),
    L(
      'Ghép mỗi phương pháp nghiên cứu vi sinh vật với mục đích của nó.',
      'Match each method of studying microbes with what it is for.',
    ),
  ],
  hints: [
    L(
      'Hỏi hai câu: nó lấy năng lượng từ đâu (ánh sáng hay chất hoá học)? Nó lấy carbon từ đâu (CO₂ hay chất hữu cơ)?',
      'Ask two questions: where does it get energy (light or chemicals)? Where does it get carbon (CO₂ or organic matter)?',
    ),
    L(
      'Vi sinh vật rất nhỏ, nên người ta nhìn chúng qua kính hiển vi hoặc cho chúng mọc thành khuẩn lạc thấy được bằng mắt.',
      'Microbes are tiny, so we look at them through a microscope or let them grow into colonies we can see.',
    ),
  ],
  questions: [
    L(
      'Vì sao muốn nghiên cứu một loài vi khuẩn thì trước hết phải có nó ở dạng thuần khiết?',
      'Why must a bacterium be pure, not mixed with others, before we study it?',
    ),
  ],
  expectedConclusion: L(
    'Vi sinh vật có bốn kiểu dinh dưỡng, phân theo nguồn năng lượng (ánh sáng hay chất hoá học) và nguồn carbon (CO₂ hay chất hữu cơ): quang tự dưỡng, hoá tự dưỡng, quang dị dưỡng và hoá dị dưỡng. Nấm men là hoá dị dưỡng. Để nghiên cứu vi sinh vật, người ta quan sát dưới kính hiển vi (soi tươi, nhuộm), phân lập và nuôi cấy, phân tích hoá sinh và di truyền.',
    'Microbes feed in four ways, set by their energy source (light or chemicals) and carbon source (CO₂ or organic matter): photoautotrophs, chemoautotrophs, photoheterotrophs and chemoheterotrophs. Yeast is a chemoheterotroph. Microbes are studied by looking under a microscope (wet mounts, staining), by isolating and culturing them, and by biochemical and genetic analysis.',
  ),
  sources: [],
  assumptions: [
    L(
      'Mỗi nhóm được xếp theo kiểu dinh dưỡng mà bài nêu cho nhóm đó.',
      'Each group is sorted by the way of feeding the lesson gives for it.',
    ),
  ],
  limits: [
    L(
      'Bài không hướng dẫn làm thí nghiệm thật; nuôi cấy vi sinh vật cần phòng thí nghiệm và giáo viên hướng dẫn.',
      'The lesson is not a guide to real experiments; growing microbes needs a laboratory and a teacher.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH10', lesson: 20 },
    question: L(
      'Nấm men làm nở bánh mì lấy năng lượng và carbon từ đâu?',
      'Where does the yeast that makes bread rise get its energy and carbon?',
    ),
    choices: [
      { id: 'anh-sang-co2', text: L('Ánh sáng và CO₂', 'Light and CO₂') },
      { id: 'vo-co-co2', text: L('Chất vô cơ và CO₂', 'Inorganic substances and CO₂') },
      { id: 'anh-sang-huu-co', text: L('Ánh sáng và chất hữu cơ', 'Light and organic matter') },
      { id: 'huu-co', text: L('Đều từ chất hữu cơ', 'Both from organic matter') },
    ],
    answer: 'huu-co',
    answerWhy: L(
      'Nấm men không quang hợp được; nó lấy cả năng lượng lẫn carbon từ chất hữu cơ như đường trong bột. Đó là kiểu hoá dị dưỡng, giống nhiều vi khuẩn, nấm và động vật nguyên sinh.',
      'Yeast cannot photosynthesise; it takes both energy and carbon from organic matter such as the sugar in dough. That is chemoheterotrophy, like many bacteria, fungi and protozoa.',
    ),
    activities: [
      {
        kind: 'sort',
        id: 'kieu-dinh-duong',
        prompt: L(
          'Xếp mỗi nhóm vi sinh vật vào kiểu dinh dưỡng của nó. Tên mỗi kiểu ghi nguồn năng lượng và nguồn carbon.',
          'Put each group of microbes under its way of feeding. Each name gives the energy source and the carbon source.',
        ),
        groups: [
          {
            id: 'quang-tu',
            label: L('Quang tự dưỡng: ánh sáng, CO₂', 'Photoautotroph: light, CO₂'),
          },
          {
            id: 'hoa-tu',
            label: L('Hoá tự dưỡng: chất vô cơ, CO₂', 'Chemoautotroph: inorganic, CO₂'),
          },
          {
            id: 'quang-di',
            label: L('Quang dị dưỡng: ánh sáng, chất hữu cơ', 'Photoheterotroph: light, organic'),
          },
          { id: 'hoa-di', label: L('Hoá dị dưỡng: chất hữu cơ', 'Chemoheterotroph: organic') },
        ],
        items: [
          {
            id: 'vk-lam',
            text: L('Vi khuẩn lam', 'Cyanobacteria'),
            group: 'quang-tu',
            why: L(
              'Vi khuẩn lam quang hợp: dùng năng lượng ánh sáng và lấy carbon từ CO₂.',
              'Cyanobacteria photosynthesise: they use light energy and take carbon from CO₂.',
            ),
          },
          {
            id: 'tao',
            text: L('Tảo', 'Algae'),
            group: 'quang-tu',
            why: L(
              'Tảo có diệp lục và quang hợp như cây xanh.',
              'Algae have chlorophyll and photosynthesise like green plants.',
            ),
          },
          {
            id: 'nitrat',
            text: L('Vi khuẩn nitrate hoá', 'Nitrifying bacteria'),
            group: 'hoa-tu',
            why: L(
              'Lấy năng lượng từ phản ứng oxy hoá chất vô cơ chứa nitrogen; carbon lấy từ CO₂.',
              'They get energy by oxidising inorganic nitrogen compounds; carbon comes from CO₂.',
            ),
          },
          {
            id: 'hydro',
            text: L('Vi khuẩn oxy hoá hydrogen', 'Hydrogen-oxidising bacteria'),
            group: 'hoa-tu',
            why: L(
              'Lấy năng lượng từ việc oxy hoá hydrogen, một chất vô cơ; carbon lấy từ CO₂.',
              'They get energy by oxidising hydrogen, an inorganic substance; carbon comes from CO₂.',
            ),
          },
          {
            id: 'luc',
            text: L('Vi khuẩn không lưu huỳnh màu lục', 'Green non-sulfur bacteria'),
            group: 'quang-di',
            why: L(
              'Dùng năng lượng ánh sáng nhưng lấy carbon từ chất hữu cơ.',
              'They use light energy but take carbon from organic matter.',
            ),
          },
          {
            id: 'tia',
            text: L('Vi khuẩn không lưu huỳnh màu tía', 'Purple non-sulfur bacteria'),
            group: 'quang-di',
            why: L(
              'Giống nhóm màu lục: năng lượng từ ánh sáng, carbon từ chất hữu cơ.',
              'Like the green group: energy from light, carbon from organic matter.',
            ),
          },
          {
            id: 'nam',
            text: L('Nấm', 'Fungi'),
            group: 'hoa-di',
            why: L(
              'Nấm không quang hợp; chúng lấy cả năng lượng và carbon từ chất hữu cơ.',
              'Fungi do not photosynthesise; they take both energy and carbon from organic matter.',
            ),
          },
          {
            id: 'nguyen-sinh',
            text: L('Động vật nguyên sinh', 'Protozoa'),
            group: 'hoa-di',
            why: L(
              'Ăn chất hữu cơ có sẵn để lấy năng lượng và carbon.',
              'They feed on ready-made organic matter for energy and carbon.',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'phuong-phap',
        prompt: L(
          'Ghép mỗi phương pháp nghiên cứu với điều nó giúp ta biết hoặc làm được.',
          'Match each method with what it lets us learn or do.',
        ),
        pairs: [
          {
            id: 'soi-tuoi',
            left: L('Làm tiêu bản soi tươi', 'A wet mount'),
            right: L(
              'Xem tế bào vi khuẩn còn sống và cách chúng di động',
              'See living bacterial cells and how they move',
            ),
            why: L(
              'Soi tươi làm nhanh và giữ tế bào ở trạng thái sống.',
              'A wet mount is quick and keeps the cells alive.',
            ),
          },
          {
            id: 'nhuom-gram',
            left: L('Nhuộm Gram', 'Gram staining'),
            right: L(
              'Phân biệt vi khuẩn Gram dương và Gram âm',
              'Tell Gram-positive from Gram-negative bacteria',
            ),
            why: L(
              'Sau khi nhuộm, vi khuẩn Gram dương có màu tím, Gram âm có màu đỏ; điều này giúp bác sĩ chọn thuốc.',
              'After staining, Gram-positive bacteria look purple and Gram-negative ones red; this helps doctors choose a medicine.',
            ),
          },
          {
            id: 'phan-lap',
            left: L(
              'Cấy mẫu đã pha loãng lên thạch đặc',
              'Spreading a diluted sample on solid agar',
            ),
            right: L(
              'Tách riêng từng tế bào thành các khuẩn lạc riêng rẽ',
              'Separate single cells into separate colonies',
            ),
            why: L(
              'Mỗi tế bào mọc thành một khuẩn lạc, nhờ đó có được vi sinh vật thuần khiết, không lẫn loài khác.',
              'Each cell grows into one colony, which gives a pure microbe, not mixed with others.',
            ),
          },
          {
            id: 'nuoi-long',
            left: L('Nuôi khuẩn lạc trong môi trường lỏng', 'Growing a colony in a liquid medium'),
            right: L(
              'Nhân lên với số lượng lớn để nghiên cứu tiếp',
              'Multiply it in large numbers for further study',
            ),
            why: L(
              'Môi trường dinh dưỡng lỏng thích hợp giúp tế bào sinh sản nhanh.',
              'A suitable liquid medium lets the cells multiply quickly.',
            ),
          },
          {
            id: 'phan-tich',
            left: L('Phân tích hoá sinh, phân tích DNA và RNA', 'Biochemical and DNA–RNA analysis'),
            right: L(
              'Định loại chính xác loài và quan hệ họ hàng giữa chúng',
              'Name the species exactly and find how they are related',
            ),
            why: L(
              'Hình dạng nhìn qua kính hiển vi chưa đủ để phân biệt loài; cần phân tích thành phần hoá học và vật chất di truyền.',
              'Shape under the microscope is not enough to tell species apart; their chemistry and genetic material must be analysed.',
            ),
          },
        ],
      },
    ],
  },
};
